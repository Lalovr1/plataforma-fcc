import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type SupabaseAdmin = ReturnType<typeof createClient>;

type IntentoRow = {
  id: string;
  usuario_id: string | null;
  puntaje: number;
  numero_intento: number | null;
  created_at: string;
  envio_automatico: boolean;
};

type PreguntaActual = {
  id: string;
  enunciado: string;
  orden: number;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRole) {
    throw new Error("Configuración de Supabase incompleta.");
  }

  return { url, anonKey, serviceRole };
}

async function autenticar(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) throw new Error("UNAUTHORIZED");

  const { url, anonKey, serviceRole } = getSupabaseConfig();

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) throw new Error("UNAUTHORIZED");

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userId: user.id, admin };
}

async function validarMateria(
  admin: SupabaseAdmin,
  userId: string,
  materiaId: string
) {
  const { data: materia, error } = await admin
    .from("materias")
    .select("id,profesor_id")
    .eq("id", materiaId)
    .single();

  if (error || !materia) {
    return {
      ok: false as const,
      status: 404,
      error: "Curso no encontrado.",
    };
  }

  if (materia.profesor_id !== userId) {
    return {
      ok: false as const,
      status: 403,
      error: "No tienes permiso para consultar estas analíticas.",
    };
  }

  return { ok: true as const };
}

async function responderEstudiantesCurso(
  admin: SupabaseAdmin,
  materiaId: string
) {
  const { data: progresoRows, error: progresoError } = await admin
    .from("progreso")
    .select("usuario_id,carrera_id,periodo_id,seccion_id,es_visitante")
    .eq("materia_id", materiaId);

  if (progresoError) throw progresoError;

  const progresoPorUsuario = new Map<string, any>();

  (progresoRows || []).forEach((row: any) => {
    if (!row.usuario_id || Boolean(row.es_visitante)) return;
    const uid = String(row.usuario_id);
    if (!progresoPorUsuario.has(uid)) progresoPorUsuario.set(uid, row);
  });

  const ids = Array.from(progresoPorUsuario.keys());

  if (ids.length === 0) {
    return NextResponse.json({
      ok: true,
      modo: "curso",
      datos: { estudiantes: [] },
    });
  }

  const { data: usuarios, error: usuariosError } = await admin
    .from("usuarios")
    .select("id,nombre,avatar_config,rol,carrera_id,matricula")
    .in("id", ids);

  if (usuariosError) throw usuariosError;

  const estudiantes = (usuarios || [])
    .filter((row: any) => (row.rol || "estudiante") === "estudiante")
    .map((row: any) => {
      const progreso = progresoPorUsuario.get(String(row.id));

      return {
        usuario_id: String(row.id),
        nombre: row.nombre || "Sin nombre",
        avatar_config: row.avatar_config ?? null,
        carrera_id: progreso?.carrera_id ?? row.carrera_id ?? null,
        periodo_id: progreso?.periodo_id ?? null,
        seccion_id: progreso?.seccion_id ?? null,
        matricula: row.matricula ?? null,
      };
    });

  return NextResponse.json({
    ok: true,
    modo: "curso",
    datos: { estudiantes },
  });
}

async function validarQuiz(
  admin: SupabaseAdmin,
  userId: string,
  quizId: string
) {
  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select("id,titulo,materia_id,intentos_max")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return {
      ok: false as const,
      status: 404,
      error: "Quiz no encontrado.",
    };
  }

  const { data: materia, error: materiaError } = await admin
    .from("materias")
    .select("id,profesor_id")
    .eq("id", quiz.materia_id)
    .single();

  if (materiaError || !materia || materia.profesor_id !== userId) {
    return {
      ok: false as const,
      status: 403,
      error: "No tienes permiso para consultar estas analíticas.",
    };
  }

  return {
    ok: true as const,
    quiz: {
      id: String(quiz.id),
      titulo: quiz.titulo || "Quiz",
      materia_id: String(quiz.materia_id),
      intentos_max: Math.max(1, Number(quiz.intentos_max ?? 1)),
    },
  };
}

function compararIntentos(a: IntentoRow, b: IntentoRow) {
  const numeroA = Number(a.numero_intento ?? 0);
  const numeroB = Number(b.numero_intento ?? 0);

  if (numeroA !== numeroB) return numeroA - numeroB;

  const fechaA = new Date(a.created_at).getTime();
  const fechaB = new Date(b.created_at).getTime();

  if (fechaA !== fechaB) return fechaA - fechaB;
  return a.id.localeCompare(b.id);
}

async function cargarPreguntasYConceptos(
  admin: SupabaseAdmin,
  quizId: string
) {
  const { data: preguntasRows, error: preguntasError } = await admin
    .from("preguntas")
    .select("id,enunciado,orden")
    .eq("quiz_id", quizId)
    .order("orden", { ascending: true });

  if (preguntasError) throw preguntasError;

  const preguntas: PreguntaActual[] = (preguntasRows || []).map((row: any) => ({
    id: String(row.id),
    enunciado: row.enunciado || "",
    orden: Number(row.orden ?? 0),
  }));

  const preguntaIds = preguntas.map((p) => p.id);

  if (preguntaIds.length === 0) {
    return {
      preguntas,
      conceptoPrincipalPorPregunta: new Map<
        string,
        { id: string; nombre: string }
      >(),
    };
  }

  const { data: relaciones, error: relacionesError } = await admin
    .from("ia_pregunta_conceptos")
    .select("pregunta_id,concepto_id,es_principal,orden")
    .in("pregunta_id", preguntaIds)
    .order("es_principal", { ascending: false })
    .order("orden", { ascending: true });

  if (relacionesError) throw relacionesError;

  const conceptoIds = Array.from(
    new Set(
      (relaciones || [])
        .map((row: any) => row.concepto_id)
        .filter(Boolean)
        .map(String)
    )
  );

  const conceptosResult =
    conceptoIds.length > 0
      ? await admin
          .from("ia_conceptos_curso")
          .select("id,nombre")
          .in("id", conceptoIds)
      : { data: [] as any[], error: null };

  if (conceptosResult.error) throw conceptosResult.error;

  const nombres = new Map<string, string>(
    (conceptosResult.data || []).map((row: any) => [
      String(row.id),
      row.nombre || "Concepto",
    ])
  );

  const conceptoPrincipalPorPregunta = new Map<
    string,
    { id: string; nombre: string }
  >();

  (relaciones || []).forEach((row: any) => {
    const preguntaId = String(row.pregunta_id);
    if (conceptoPrincipalPorPregunta.has(preguntaId)) return;
    if (!row.concepto_id) return;

    const conceptoId = String(row.concepto_id);
    const nombre = nombres.get(conceptoId);
    if (!nombre) return;

    conceptoPrincipalPorPregunta.set(preguntaId, {
      id: conceptoId,
      nombre,
    });
  });

  return { preguntas, conceptoPrincipalPorPregunta };
}

async function cargarInscritos(
  admin: SupabaseAdmin,
  materiaId: string
): Promise<string[]> {
  const { data: progresoRows, error: progresoError } = await admin
    .from("progreso")
    .select("usuario_id,es_visitante")
    .eq("materia_id", materiaId);

  if (progresoError) throw progresoError;

  const candidatos = Array.from(
    new Set(
      (progresoRows || [])
        .filter((row: any) => !Boolean(row.es_visitante) && row.usuario_id)
        .map((row: any) => String(row.usuario_id))
    )
  );

  if (candidatos.length === 0) return [];

  const { data: usuarios, error: usuariosError } = await admin
    .from("usuarios")
    .select("id,rol")
    .in("id", candidatos);

  if (usuariosError) throw usuariosError;

  return (usuarios || [])
    .filter((row: any) => (row.rol || "estudiante") === "estudiante")
    .map((row: any) => String(row.id));
}

function construirRespuestaAnalitica(
  row: any,
  preguntaActualPorId: Map<string, PreguntaActual>,
  conceptoPrincipalPorPregunta: Map<
    string,
    { id: string; nombre: string }
  >
) {
  const preguntaId = row.pregunta_id ? String(row.pregunta_id) : null;
  const preguntaActual = preguntaId
    ? preguntaActualPorId.get(preguntaId)
    : undefined;

  const esVersionActual = Boolean(
    preguntaActual &&
      String(preguntaActual.enunciado || "") ===
        String(row.pregunta_enunciado || "")
  );

  return {
    pregunta_id: preguntaId,
    orden_pregunta: Number(row.orden_pregunta ?? 0),
    pregunta_enunciado: row.pregunta_enunciado || "",
    respuesta_seleccionada_texto:
      row.respuesta_seleccionada_texto ?? null,
    respuesta_correcta_texto: row.respuesta_correcta_texto ?? null,
    es_correcta: Boolean(row.es_correcta),
    es_version_actual: esVersionActual,
    concepto_principal:
      esVersionActual && preguntaId
        ? conceptoPrincipalPorPregunta.get(preguntaId) || null
        : null,
  };
}

async function responderDetalleEstudiante({
  admin,
  quiz,
  usuarioId,
  inscritos,
}: {
  admin: SupabaseAdmin;
  quiz: {
    id: string;
    titulo: string;
    materia_id: string;
    intentos_max: number;
  };
  usuarioId: string;
  inscritos: string[];
}) {
  if (!inscritos.includes(usuarioId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "El estudiante no pertenece a este curso.",
      },
      { status: 404 }
    );
  }

  const [{ data: usuario, error: usuarioError }, preguntasData] =
    await Promise.all([
      admin
        .from("usuarios")
        .select("id,nombre,matricula")
        .eq("id", usuarioId)
        .single(),
      cargarPreguntasYConceptos(admin, quiz.id),
    ]);

  if (usuarioError || !usuario) {
    return NextResponse.json(
      { ok: false, error: "Estudiante no encontrado." },
      { status: 404 }
    );
  }

  const { preguntas, conceptoPrincipalPorPregunta } = preguntasData;
  const preguntaActualPorId = new Map(
    preguntas.map((pregunta) => [pregunta.id, pregunta])
  );

  const { data: intentosRows, error: intentosError } = await admin
    .from("intentos_quiz")
    .select(
      "id,usuario_id,puntaje,numero_intento,created_at,envio_automatico"
    )
    .eq("quiz_id", quiz.id)
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: true });

  if (intentosError) throw intentosError;

  const intentos = ((intentosRows || []) as IntentoRow[]).sort(
    compararIntentos
  );
  const intentoIds = intentos.map((intento) => intento.id);

  const respuestasResult =
    intentoIds.length > 0
      ? await admin
          .from("intento_respuestas")
          .select(
            "intento_id,pregunta_id,respuesta_id,es_correcta,pregunta_enunciado,respuesta_seleccionada_texto,respuesta_correcta_id,respuesta_correcta_texto,orden_pregunta"
          )
          .in("intento_id", intentoIds)
          .order("orden_pregunta", { ascending: true })
      : { data: [] as any[], error: null };

  if (respuestasResult.error) throw respuestasResult.error;

  const respuestasPorIntento = new Map<string, any[]>();

  (respuestasResult.data || []).forEach((row: any) => {
    const intentoId = String(row.intento_id);
    const lista = respuestasPorIntento.get(intentoId) || [];
    lista.push(row);
    respuestasPorIntento.set(intentoId, lista);
  });

  const detalleIntentos = intentos.map((intento, index) => ({
    id: intento.id,
    numero_intento: Math.max(
      1,
      Number(intento.numero_intento ?? 0) || index + 1
    ),
    puntaje: Number(intento.puntaje ?? 0),
    created_at: intento.created_at,
    envio_automatico: Boolean(intento.envio_automatico),
    respuestas: (respuestasPorIntento.get(intento.id) || [])
      .map((row) =>
        construirRespuestaAnalitica(
          row,
          preguntaActualPorId,
          conceptoPrincipalPorPregunta
        )
      )
      .sort(
        (a, b) => Number(a.orden_pregunta) - Number(b.orden_pregunta)
      ),
  }));

  return NextResponse.json({
    ok: true,
    modo: "detalle",
    datos: {
      quiz: {
        id: quiz.id,
        titulo: quiz.titulo,
        intentos_max: quiz.intentos_max,
      },
      estudiante: {
        usuario_id: String(usuario.id),
        nombre: usuario.nombre || "Sin nombre",
        matricula: usuario.matricula || null,
      },
      preguntas,
      intentos: detalleIntentos,
    },
  });
}

async function responderGrupo({
  admin,
  quiz,
  inscritos,
}: {
  admin: SupabaseAdmin;
  quiz: {
    id: string;
    titulo: string;
    materia_id: string;
    intentos_max: number;
  };
  inscritos: string[];
}) {
  const { preguntas, conceptoPrincipalPorPregunta } =
    await cargarPreguntasYConceptos(admin, quiz.id);

  if (inscritos.length === 0) {
    return NextResponse.json({
      ok: true,
      modo: "grupo",
      datos: {
        quiz: {
          id: quiz.id,
          titulo: quiz.titulo,
          intentos_max: quiz.intentos_max,
        },
        estudiantes: [],
        preguntas,
      },
    });
  }

  const { data: intentosRows, error: intentosError } = await admin
    .from("intentos_quiz")
    .select(
      "id,usuario_id,puntaje,numero_intento,created_at,envio_automatico"
    )
    .eq("quiz_id", quiz.id)
    .in("usuario_id", inscritos)
    .order("created_at", { ascending: true });

  if (intentosError) throw intentosError;

  const intentosPorUsuario = new Map<string, IntentoRow[]>();

  ((intentosRows || []) as IntentoRow[]).forEach((row) => {
    if (!row.usuario_id) return;
    const uid = String(row.usuario_id);
    const lista = intentosPorUsuario.get(uid) || [];
    lista.push(row);
    intentosPorUsuario.set(uid, lista);
  });

  const ultimoPorUsuario = new Map<string, IntentoRow>();
  const mejorPorUsuario = new Map<string, IntentoRow>();

  intentosPorUsuario.forEach((lista, uid) => {
    const ordenados = [...lista].sort(compararIntentos);
    const ultimo = ordenados[ordenados.length - 1];

    if (ultimo) {
      ultimoPorUsuario.set(uid, ultimo);
    }

    const mejor = [...ordenados].sort((a, b) => {
      const diferenciaPuntaje =
        Number(b.puntaje ?? 0) - Number(a.puntaje ?? 0);

      if (diferenciaPuntaje !== 0) {
        return diferenciaPuntaje;
      }

      return compararIntentos(b, a);
    })[0];

    if (mejor) {
      mejorPorUsuario.set(uid, mejor);
    }
  });

  const mejorIds = Array.from(mejorPorUsuario.values()).map(
    (intento) => intento.id
  );

  const respuestasResult =
    mejorIds.length > 0
      ? await admin
          .from("intento_respuestas")
          .select(
            "intento_id,pregunta_id,es_correcta,pregunta_enunciado,respuesta_seleccionada_texto,respuesta_correcta_texto,orden_pregunta"
          )
          .in("intento_id", mejorIds)
          .order("orden_pregunta", { ascending: true })
      : { data: [] as any[], error: null };

  if (respuestasResult.error) throw respuestasResult.error;

  const preguntaActualPorId = new Map(
    preguntas.map((pregunta) => [pregunta.id, pregunta])
  );
  const respuestasPorIntento = new Map<string, any[]>();

  (respuestasResult.data || []).forEach((row: any) => {
    const intentoId = String(row.intento_id);
    const lista = respuestasPorIntento.get(intentoId) || [];
    lista.push(row);
    respuestasPorIntento.set(intentoId, lista);
  });

  const estudiantes = inscritos.map((uid) => {
    const lista = (intentosPorUsuario.get(uid) || []).sort(compararIntentos);
    const ultimo = ultimoPorUsuario.get(uid) || null;
    const mejor = mejorPorUsuario.get(uid) || null;
    const intentosRealizados = lista.length;

    const numeroIntento = ultimo
      ? Math.max(
          Number(ultimo.numero_intento ?? 0),
          intentosRealizados
        )
      : 0;

    const estado = !ultimo
      ? "sin_iniciar"
      : Number(mejor?.puntaje ?? 0) === 100 ||
          numeroIntento >= quiz.intentos_max
        ? "final"
        : "provisional";

    return {
      usuario_id: uid,
      estado,
      puntaje: mejor ? Number(mejor.puntaje ?? 0) : null,
      intentos_realizados: intentosRealizados,
      numero_intento: numeroIntento,
      intentos_max: quiz.intentos_max,
      respuestas: mejor
        ? (respuestasPorIntento.get(mejor.id) || [])
            .map((row) =>
              construirRespuestaAnalitica(
                row,
                preguntaActualPorId,
                conceptoPrincipalPorPregunta
              )
            )
            .sort(
              (a, b) =>
                Number(a.orden_pregunta) - Number(b.orden_pregunta)
            )
        : [],
    };
  });

  return NextResponse.json({
    ok: true,
    modo: "grupo",
    datos: {
      quiz: {
        id: quiz.id,
        titulo: quiz.titulo,
        intentos_max: quiz.intentos_max,
      },
      estudiantes,
      preguntas,
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const materiaId = url.searchParams.get("materiaId")?.trim() || "";
    const quizId = url.searchParams.get("quizId")?.trim() || "";
    const usuarioId = url.searchParams.get("usuarioId")?.trim() || "";

    const { userId, admin } = await autenticar(request);

    if (!quizId && materiaId) {
      const validacionMateria = await validarMateria(
        admin,
        userId,
        materiaId
      );

      if (!validacionMateria.ok) {
        return NextResponse.json(
          { ok: false, error: validacionMateria.error },
          { status: validacionMateria.status }
        );
      }

      return await responderEstudiantesCurso(admin, materiaId);
    }

    if (!quizId) {
      return NextResponse.json(
        { ok: false, error: "Falta identificar el quiz." },
        { status: 400 }
      );
    }

    const validacion = await validarQuiz(admin, userId, quizId);

    if (!validacion.ok) {
      return NextResponse.json(
        { ok: false, error: validacion.error },
        { status: validacion.status }
      );
    }

    const inscritos = await cargarInscritos(
      admin,
      validacion.quiz.materia_id
    );

    if (usuarioId) {
      return await responderDetalleEstudiante({
        admin,
        quiz: validacion.quiz,
        usuarioId,
        inscritos,
      });
    }

    return await responderGrupo({
      admin,
      quiz: validacion.quiz,
      inscritos,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { ok: false, error: "Tu sesión no está disponible." },
        { status: 401 }
      );
    }

    console.error("Error cargando analíticas del quiz:", error);

    return NextResponse.json(
      { ok: false, error: "No se pudieron cargar las analíticas del quiz." },
      { status: 500 }
    );
  }
}
