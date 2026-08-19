import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AuthContext = {
  userId: string;
  admin: ReturnType<typeof createClient>;
};

function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRole) {
    throw new Error(
      "Configuración de Supabase incompleta."
    );
  }

  return {
    url,
    anonKey,
    serviceRole,
  };
}

async function autenticar(
  request: Request
): Promise<AuthContext> {
  const authorization =
    request.headers.get("authorization");

  const token =
    authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const {
    url,
    anonKey,
    serviceRole,
  } = getSupabaseConfig();

  const authClient =
    createClient(
      url,
      anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data: { user },
    error,
  } =
    await authClient.auth.getUser(
      token
    );

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  const admin =
    createClient(
      url,
      serviceRole,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  return {
    userId: user.id,
    admin,
  };
}

async function validarPropiedadQuiz(
  admin: ReturnType<typeof createClient>,
  userId: string,
  quizId: string
) {
  const {
    data: quiz,
    error: quizError,
  } = await admin
    .from("quizzes")
    .select("id,materia_id")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return {
      ok: false as const,
      status: 404,
      error: "Quiz no encontrado.",
    };
  }

  const {
    data: materia,
    error: materiaError,
  } = await admin
    .from("materias")
    .select("id,profesor_id")
    .eq("id", quiz.materia_id)
    .single();

  if (
    materiaError ||
    !materia ||
    materia.profesor_id !== userId
  ) {
    return {
      ok: false as const,
      status: 403,
      error:
        "No tienes permiso para editar las explicaciones de este quiz.",
    };
  }

  return {
    ok: true as const,
    quiz,
  };
}

async function cargarDatos(
  admin: ReturnType<typeof createClient>,
  quizId: string
) {
  const {
    data: preguntas,
    error: preguntasError,
  } = await admin
    .from("preguntas")
    .select("id,enunciado,orden")
    .eq("quiz_id", quizId)
    .order("orden", {
      ascending: true,
    });

  if (preguntasError) {
    throw preguntasError;
  }

  const {
    data: feedback,
    error: feedbackError,
  } = await admin
    .from("ia_feedback_preguntas")
    .select(
      `
      pregunta_id,
      retroalimentacion_correcta,
      retroalimentacion_incorrecta,
      estado,
      motivo_no_disponible,
      updated_at
      `
    )
    .eq("quiz_id", quizId);

  if (feedbackError) {
    throw feedbackError;
  }

  const feedbackPorPregunta =
    new Map(
      (feedback || []).map(
        (item: any) => [
          item.pregunta_id,
          item,
        ]
      )
    );

  const lista =
    (preguntas || []).map(
      (pregunta: any) => {
        const item =
          feedbackPorPregunta.get(
            pregunta.id
          );

        const estado =
          item?.estado === "ia" ||
          item?.estado === "manual" ||
          item?.estado ===
            "manual_pendiente"
            ? item.estado
            : "sin_generar";

        return {
          id: pregunta.id,
          orden: pregunta.orden,
          enunciado:
            pregunta.enunciado || "",
          estado,

          retroalimentacion_correcta:
            item
              ?.retroalimentacion_correcta ||
            "",

          retroalimentacion_incorrecta:
            item
              ?.retroalimentacion_incorrecta ||
            "",

          motivo_no_disponible:
            item
              ?.motivo_no_disponible ||
            null,
        };
      }
    );

  const completas =
    lista.filter(
      (item: any) =>
        item.estado === "ia" ||
        item.estado === "manual"
    ).length;

  return {
    preguntas: lista,

    resumen: {
      total: lista.length,
      completas,
      pendientes:
        Math.max(
          0,
          lista.length - completas
        ),
    },
  };
}

async function hashPreguntaActual(
  admin: ReturnType<typeof createClient>,
  pregunta: {
    id: string;
    enunciado: string | null;
    orden: number | null;
  }
) {
  const {
    data: respuestas,
    error,
  } = await admin
    .from("respuestas")
    .select(
      "id,texto,es_correcta,orden"
    )
    .eq(
      "pregunta_id",
      pregunta.id
    )
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const snapshot = {
    id: pregunta.id,
    enunciado:
      pregunta.enunciado || "",
    orden:
      Number(pregunta.orden ?? 0),

    respuestas:
      (respuestas || []).map(
        (respuesta: any) => ({
          id: respuesta.id,
          texto:
            respuesta.texto || "",
          es_correcta:
            Boolean(
              respuesta.es_correcta
            ),
          orden:
            Number(
              respuesta.orden ?? 0
            ),
        })
      ),
  };

  return createHash("sha256")
    .update(
      JSON.stringify(snapshot)
    )
    .digest("hex");
}


type SnapshotRespuestaIA = {
  id: string;
  texto: string;
  es_correcta: boolean;
  orden: number;
};

type SnapshotPreguntaIA = {
  id: string;
  enunciado: string;
  orden: number;
  respuestas: SnapshotRespuestaIA[];
};

function normalizarConceptoIA(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizarSnapshotPreguntaIA(
  pregunta: any
): SnapshotPreguntaIA {
  return {
    id: String(pregunta?.id ?? ""),
    enunciado: String(pregunta?.enunciado ?? ""),
    orden: Number(pregunta?.orden ?? 0),
    respuestas: Array.isArray(pregunta?.respuestas)
      ? pregunta.respuestas
          .map((respuesta: any) => ({
            id: String(respuesta?.id ?? ""),
            texto: String(respuesta?.texto ?? ""),
            es_correcta: Boolean(respuesta?.es_correcta),
            orden: Number(respuesta?.orden ?? 0),
          }))
          .sort((a: SnapshotRespuestaIA, b: SnapshotRespuestaIA) =>
            a.orden - b.orden || a.id.localeCompare(b.id)
          )
      : [],
  };
}

function snapshotPreguntaCoincideIA(
  izquierda: SnapshotPreguntaIA,
  derecha: SnapshotPreguntaIA
) {
  return JSON.stringify(
    normalizarSnapshotPreguntaIA(izquierda)
  ) === JSON.stringify(
    normalizarSnapshotPreguntaIA(derecha)
  );
}

async function cargarSnapshotActualQuizIA(
  admin: ReturnType<typeof createClient>,
  quizId: string
) {
  const {
    data: preguntas,
    error: preguntasError,
  } = await admin
    .from("preguntas")
    .select("id,enunciado,orden")
    .eq("quiz_id", quizId)
    .order("orden", { ascending: true });

  if (preguntasError) {
    throw preguntasError;
  }

  const ids = (preguntas || []).map((pregunta: any) => pregunta.id);
  let respuestas: any[] = [];

  if (ids.length > 0) {
    const resultado = await admin
      .from("respuestas")
      .select("id,pregunta_id,texto,es_correcta,orden")
      .in("pregunta_id", ids)
      .order("orden", { ascending: true });

    if (resultado.error) {
      throw resultado.error;
    }

    respuestas = resultado.data || [];
  }

  return (preguntas || []).map((pregunta: any) =>
    normalizarSnapshotPreguntaIA({
      ...pregunta,
      respuestas: respuestas.filter(
        (respuesta: any) => respuesta.pregunta_id === pregunta.id
      ),
    })
  );
}

function construirSnapshotEsperadoIA(
  registro: any
) {
  const snapshot: SnapshotPreguntaIA[] = Array.isArray(registro?.snapshot)
    ? registro.snapshot.map((pregunta: any) =>
        normalizarSnapshotPreguntaIA(pregunta)
      )
    : [];

  const decisiones = new Map<string, "aplicar" | "ignorar">();

  if (Array.isArray(registro?.decisiones)) {
    registro.decisiones.forEach((decision: any) => {
      const preguntaId = String(decision?.pregunta_id ?? "");
      const accionIndex = Number(decision?.accion_index);
      const valor = decision?.decision;

      if (
        preguntaId &&
        Number.isInteger(accionIndex) &&
        (valor === "aplicar" || valor === "ignorar")
      ) {
        decisiones.set(`${preguntaId}:${accionIndex}`, valor);
      }
    });
  }

  const preguntasAnalizadas = Array.isArray(registro?.resultado?.preguntas)
    ? registro.resultado.preguntas
    : [];

  preguntasAnalizadas.forEach((preguntaAnalizada: any) => {
    const preguntaId = String(preguntaAnalizada?.pregunta_id ?? "");
    const pregunta = snapshot.find((item) => item.id === preguntaId);

    if (!pregunta) return;

    const acciones = Array.isArray(preguntaAnalizada?.acciones)
      ? preguntaAnalizada.acciones
      : [];

    acciones.forEach((accion: any, accionIndex: number) => {
      if (decisiones.get(`${preguntaId}:${accionIndex}`) !== "aplicar") {
        return;
      }

      if (accion?.tipo === "reescribir_pregunta") {
        pregunta.enunciado = String(accion?.texto_propuesto ?? "");
        return;
      }

      if (accion?.tipo === "reescribir_respuesta") {
        const respuesta = pregunta.respuestas.find(
          (item) => item.id === String(accion?.respuesta_objetivo_id ?? "")
        );

        if (respuesta) {
          respuesta.texto = String(accion?.texto_propuesto ?? "");
        }
        return;
      }

      if (accion?.tipo === "cambiar_respuesta_correcta") {
        const objetivo = String(accion?.respuesta_objetivo_id ?? "");
        pregunta.respuestas = pregunta.respuestas.map((respuesta) => ({
          ...respuesta,
          es_correcta: respuesta.id === objetivo,
        }));
      }
    });
  });

  return snapshot.map((pregunta) => normalizarSnapshotPreguntaIA(pregunta));
}

async function restaurarConceptosPreguntaIA(
  admin: ReturnType<typeof createClient>,
  materiaId: string,
  analisisId: string,
  preguntaId: string,
  preguntaAnalizada: any,
  conceptosGlobales: any[]
) {
  const nombres = [
    {
      nombre: String(preguntaAnalizada?.concepto_principal ?? "").trim(),
      principal: true,
      orden: 0,
    },
    ...(Array.isArray(preguntaAnalizada?.conceptos_secundarios)
      ? preguntaAnalizada.conceptos_secundarios.map(
          (nombre: unknown, index: number) => ({
            nombre: String(nombre ?? "").trim(),
            principal: false,
            orden: index + 1,
          })
        )
      : []),
  ];

  const unicos = new Set<string>();
  const relaciones: any[] = [];

  const { error: borrarError } = await admin
    .from("ia_pregunta_conceptos")
    .delete()
    .eq("pregunta_id", preguntaId);

  if (borrarError) {
    throw borrarError;
  }

  for (const item of nombres) {
    const normalizado = normalizarConceptoIA(item.nombre);

    if (!normalizado || unicos.has(normalizado)) {
      continue;
    }

    unicos.add(normalizado);

    const conceptoGlobal = conceptosGlobales.find(
      (concepto: any) =>
        normalizarConceptoIA(concepto?.nombre) === normalizado
    );

    const descripcion = String(
      conceptoGlobal?.descripcion ?? ""
    ).trim();

    const conceptoPayload: Record<string, unknown> = {
      materia_id: materiaId,
      nombre: item.nombre,
      nombre_normalizado: normalizado,
      updated_at: new Date().toISOString(),
    };

    if (descripcion) {
      conceptoPayload.descripcion = descripcion;
    }

    const {
      data: concepto,
      error: conceptoError,
    } = await admin
      .from("ia_conceptos_curso")
      .upsert(
        conceptoPayload,
        {
          onConflict: "materia_id,nombre_normalizado",
        }
      )
      .select("id")
      .single();

    if (conceptoError || !concepto) {
      throw conceptoError || new Error("No se pudo restaurar un concepto.");
    }

    relaciones.push({
      pregunta_id: preguntaId,
      concepto_id: concepto.id,
      analisis_id: analisisId,
      es_principal: item.principal,
      orden: item.orden,
    });
  }

  if (relaciones.length > 0) {
    const { error } = await admin
      .from("ia_pregunta_conceptos")
      .insert(relaciones);

    if (error) {
      throw error;
    }
  }
}

async function restaurarDatosAprobadosFaltantesIA(
  admin: ReturnType<typeof createClient>,
  quizId: string,
  materiaId: string
) {
  const snapshotActual = await cargarSnapshotActualQuizIA(admin, quizId);

  if (snapshotActual.length === 0) {
    return;
  }

  const { data: feedbackActual, error: feedbackError } = await admin
    .from("ia_feedback_preguntas")
    .select("pregunta_id")
    .eq("quiz_id", quizId);

  if (feedbackError) {
    throw feedbackError;
  }

  const existentes = new Set(
    (feedbackActual || []).map((item: any) => String(item.pregunta_id))
  );

  const faltantes = snapshotActual.filter(
    (pregunta) => !existentes.has(pregunta.id)
  );

  if (faltantes.length === 0) {
    return;
  }

  const { data: registro, error: analisisError } = await admin
    .from("ia_analisis_quiz")
    .select(
      "id,resultado,snapshot,snapshot_hash,decisiones,numero_intento,created_at"
    )
    .eq("quiz_id", quizId)
    .eq("estado", "aprobado")
    .not("resultado", "is", null)
    .not("snapshot", "is", null)
    .order("numero_intento", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analisisError || !registro) {
    return;
  }

  const snapshotEsperado = construirSnapshotEsperadoIA(registro);
  const preguntasAnalizadas = Array.isArray(registro?.resultado?.preguntas)
    ? registro.resultado.preguntas
    : [];
  const conceptosGlobales = Array.isArray(registro?.resultado?.conceptos)
    ? registro.resultado.conceptos
    : [];

  const decisiones = new Map<string, "aplicar" | "ignorar">();

  if (Array.isArray(registro?.decisiones)) {
    registro.decisiones.forEach((decision: any) => {
      decisiones.set(
        `${String(decision?.pregunta_id ?? "")}:${Number(decision?.accion_index)}`,
        decision?.decision === "aplicar" ? "aplicar" : "ignorar"
      );
    });
  }

  const snapshotHash =
    String(registro?.snapshot_hash ?? "").trim() ||
    createHash("sha256")
      .update(JSON.stringify(registro.snapshot))
      .digest("hex");

  for (const actual of faltantes) {
    const esperado = snapshotEsperado.find((item) => item.id === actual.id);
    const preguntaAnalizada = preguntasAnalizadas.find(
      (item: any) => String(item?.pregunta_id ?? "") === actual.id
    );

    if (
      !esperado ||
      !preguntaAnalizada ||
      !snapshotPreguntaCoincideIA(actual, esperado)
    ) {
      continue;
    }

    const acciones = Array.isArray(preguntaAnalizada?.acciones)
      ? preguntaAnalizada.acciones
      : [];

    const ignoroAcademico = acciones.some(
      (accion: any, index: number) =>
        accion?.impacto === "academico" &&
        decisiones.get(`${actual.id}:${index}`) === "ignorar"
    );

    const contextoSuficiente =
      preguntaAnalizada?.contexto_suficiente !== false;

    const correcta = String(
      preguntaAnalizada?.retroalimentacion_correcta ?? ""
    ).trim();

    const incorrecta = String(
      preguntaAnalizada?.retroalimentacion_incorrecta ?? ""
    ).trim();

    const puedeSerAutomatica =
      !ignoroAcademico &&
      contextoSuficiente &&
      Boolean(correcta && incorrecta);

    const motivo = puedeSerAutomatica
      ? null
      : ignoroAcademico
        ? "Decidiste conservar una respuesta o contenido que el asistente recomendó cambiar por razones académicas. Escribe las explicaciones manualmente."
        : !contextoSuficiente
          ? "El contenido disponible no fue suficiente para generar explicaciones confiables."
          : "No se pudo generar una explicación completa para esta pregunta.";

    const { error: guardarError } = await admin
      .from("ia_feedback_preguntas")
      .insert({
        pregunta_id: actual.id,
        quiz_id: quizId,
        analisis_id: registro.id,
        retroalimentacion_correcta: puedeSerAutomatica ? correcta : null,
        retroalimentacion_incorrecta: puedeSerAutomatica ? incorrecta : null,
        snapshot_hash: snapshotHash,
        estado: puedeSerAutomatica ? "ia" : "manual_pendiente",
        motivo_no_disponible: motivo,
        aprobado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (guardarError) {
      if (guardarError.code === "23505") {
        continue;
      }
      throw guardarError;
    }

    await restaurarConceptosPreguntaIA(
      admin,
      materiaId,
      String(registro.id),
      actual.id,
      preguntaAnalizada,
      conceptosGlobales
    );
  }
}

function errorResponse(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message ===
      "UNAUTHORIZED"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Tu sesión no está disponible.",
      },
      {
        status: 401,
      }
    );
  }

  console.error(
    "Error en explicaciones del quiz:",
    error
  );

  return NextResponse.json(
    {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron procesar las explicaciones.",
    },
    {
      status: 500,
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const quizId =
      url.searchParams
        .get("quizId")
        ?.trim() || "";

    if (!quizId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el quiz.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      userId,
      admin,
    } = await autenticar(
      request
    );

    const propiedad =
      await validarPropiedadQuiz(
        admin,
        userId,
        quizId
      );

    if (!propiedad.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            propiedad.error,
        },
        {
          status:
            propiedad.status,
        }
      );
    }

    await restaurarDatosAprobadosFaltantesIA(
      admin,
      quizId,
      String(propiedad.quiz.materia_id)
    );

    const datos =
      await cargarDatos(
        admin,
        quizId
      );

    return NextResponse.json({
      ok: true,
      ...datos,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request
) {
  try {
    const {
      userId,
      admin,
    } = await autenticar(
      request
    );

    const body =
      await request.json();

    const quizId =
      typeof body?.quizId ===
      "string"
        ? body.quizId.trim()
        : "";

    const cambios =
      Array.isArray(
        body?.cambios
      )
        ? body.cambios
        : [];

    if (!quizId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el quiz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      cambios.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay cambios por guardar.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      cambios.length > 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Se recibieron demasiados cambios.",
        },
        {
          status: 400,
        }
      );
    }

    const propiedad =
      await validarPropiedadQuiz(
        admin,
        userId,
        quizId
      );

    if (!propiedad.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            propiedad.error,
        },
        {
          status:
            propiedad.status,
        }
      );
    }

    const {
      data: preguntas,
      error: preguntasError,
    } = await admin
      .from("preguntas")
      .select(
        "id,enunciado,orden"
      )
      .eq("quiz_id", quizId);

    if (preguntasError) {
      throw preguntasError;
    }

    const preguntaPorId =
      new Map(
        (preguntas || []).map(
          (pregunta: any) => [
            pregunta.id,
            pregunta,
          ]
        )
      );

    const idsRecibidos =
      new Set<string>();

    for (
      const cambio
      of cambios
    ) {
      const preguntaId =
        typeof cambio
          ?.preguntaId ===
        "string"
          ? cambio.preguntaId.trim()
          : "";

      if (
        !preguntaId ||
        idsRecibidos.has(
          preguntaId
        ) ||
        !preguntaPorId.has(
          preguntaId
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Las preguntas enviadas no son válidas.",
          },
          {
            status: 400,
          }
        );
      }

      idsRecibidos.add(
        preguntaId
      );
    }

    const {
      data: existentes,
      error: existentesError,
    } = await admin
      .from(
        "ia_feedback_preguntas"
      )
      .select(
        `
        pregunta_id,
        analisis_id,
        snapshot_hash,
        motivo_no_disponible
        `
      )
      .eq("quiz_id", quizId)
      .in(
        "pregunta_id",
        Array.from(idsRecibidos)
      );

    if (existentesError) {
      throw existentesError;
    }

    const existentePorId =
      new Map(
        (existentes || []).map(
          (item: any) => [
            item.pregunta_id,
            item,
          ]
        )
      );

    for (
      const cambio
      of cambios
    ) {
      const preguntaId =
        String(
          cambio.preguntaId
        );

      const correcta =
        String(
          cambio.correcta ?? ""
        )
          .trim()
          .slice(0, 2500);

      const incorrecta =
        String(
          cambio.incorrecta ?? ""
        )
          .trim()
          .slice(0, 2500);

      const completa =
        Boolean(
          correcta &&
          incorrecta
        );

      const existente =
        existentePorId.get(
          preguntaId
        );

      const pregunta =
        preguntaPorId.get(
          preguntaId
        );

      const snapshotHash =
        existente?.snapshot_hash ||
        (
          await hashPreguntaActual(
            admin,
            pregunta
          )
        );

      const motivoPendiente =
        completa
          ? null
          : existente
              ?.motivo_no_disponible ||
            "Completa ambas explicaciones para que esta pregunta pueda mostrarlas al estudiante.";

      const {
        error: guardarError,
      } = await admin
        .from(
          "ia_feedback_preguntas"
        )
        .upsert(
          {
            pregunta_id:
              preguntaId,

            quiz_id:
              quizId,

            analisis_id:
              existente
                ?.analisis_id ||
              null,

            retroalimentacion_correcta:
              correcta || null,

            retroalimentacion_incorrecta:
              incorrecta || null,

            snapshot_hash:
              snapshotHash,

            estado:
              completa
                ? "manual"
                : "manual_pendiente",

            motivo_no_disponible:
              motivoPendiente,

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "pregunta_id",
          }
        );

      if (guardarError) {
        throw guardarError;
      }
    }

    const datos =
      await cargarDatos(
        admin,
        quizId
      );

    return NextResponse.json({
      ok: true,
      ...datos,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
