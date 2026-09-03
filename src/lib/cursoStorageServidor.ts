import { createClient } from "@supabase/supabase-js";

export const BUCKET_CURSO = "curso-contenido";

type AdminClient = ReturnType<typeof createClient>;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRole) {
    throw new Error("Configuración de Supabase incompleta.");
  }

  return {
    url,
    anonKey,
    serviceRole,
  };
}

export async function autenticarProfesorDeCurso(
  request: Request,
  materiaId: string
) {
  const authorization = request.headers.get("authorization");

  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "Sesión no disponible.",
    };
  }

  const { url, anonKey, serviceRole } = getSupabaseConfig();

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "Sesión no válida.",
    };
  }

  const admin = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: materia, error: materiaError } = await admin
    .from("materias")
    .select("id,profesor_id")
    .eq("id", materiaId)
    .maybeSingle();

  if (materiaError || !materia) {
    return {
      ok: false as const,
      status: 404,
      error: "Curso no encontrado.",
    };
  }

  if (materia.profesor_id !== user.id) {
    return {
      ok: false as const,
      status: 403,
      error: "No tienes permiso para administrar este curso.",
    };
  }

  return {
    ok: true as const,
    admin,
    userId: user.id,
    materia,
  };
}

function escaparRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extraerRutasStorageDeTexto(
  texto: unknown,
  materiaId: string
) {
  const resultado = new Set<string>();

  if (typeof texto !== "string" || !texto) {
    return resultado;
  }

  const marker = `/storage/v1/object/public/${BUCKET_CURSO}/`;
  const regex = new RegExp(
    `${escaparRegex(marker)}([^"'<>\\s}\\\\]+)`,
    "gi"
  );

  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    const raw = match[1]?.split(/[?#]/, 1)[0];

    if (!raw) continue;

    let ruta = raw;

    try {
      ruta = decodeURIComponent(raw);
    } catch {
      // Si no se puede decodificar, conservamos el valor original.
    }

    if (ruta.startsWith(`${materiaId}/`)) {
      resultado.add(ruta);
    }
  }

  return resultado;
}

function agregarReferencias(
  destino: Set<string>,
  texto: unknown,
  materiaId: string
) {
  for (const ruta of extraerRutasStorageDeTexto(
    texto,
    materiaId
  )) {
    destino.add(ruta);
  }
}

async function listarDirectorioStorage(
  admin: AdminClient,
  prefix: string
): Promise<string[]> {
  const archivos: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(BUCKET_CURSO)
      .list(prefix, {
        limit: 1000,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw new Error(
        `No se pudo listar Storage (${prefix}): ${error.message}`
      );
    }

    const items = data ?? [];

    for (const item of items) {
      if (item.name === ".emptyFolderPlaceholder") {
        continue;
      }

      const ruta = prefix
        ? `${prefix}/${item.name}`
        : item.name;

      const esCarpeta = !item.id && !item.metadata;

      if (esCarpeta) {
        archivos.push(
          ...(await listarDirectorioStorage(admin, ruta))
        );
      } else {
        archivos.push(ruta);
      }
    }

    if (items.length < 1000) {
      break;
    }

    offset += items.length;
  }

  return archivos;
}

export async function listarArchivosStorageCurso(
  admin: AdminClient,
  materiaId: string
) {
  return listarDirectorioStorage(admin, materiaId);
}

export async function eliminarRutasStorage(
  admin: AdminClient,
  rutas: string[]
) {
  const unicas = [...new Set(rutas)];

  if (unicas.length === 0) {
    return 0;
  }

  let eliminadas = 0;

  for (let i = 0; i < unicas.length; i += 500) {
    const lote = unicas.slice(i, i + 500);

    const { data, error } = await admin.storage
      .from(BUCKET_CURSO)
      .remove(lote);

    if (error) {
      throw new Error(
        `No se pudieron eliminar archivos de Storage: ${error.message}`
      );
    }

    eliminadas += data?.length ?? lote.length;
  }

  return eliminadas;
}

export async function reconciliarStorageMateria(
  admin: AdminClient,
  materiaId: string
) {
  const referencias = new Set<string>();

  const { data: bloques, error: bloquesError } = await admin
    .from("curso_contenido_bloques")
    .select("id,titulo,introduccion,contenido")
    .eq("materia_id", materiaId);

  if (bloquesError) {
    throw bloquesError;
  }

  const bloqueIds = (bloques ?? []).map((bloque) =>
    String(bloque.id)
  );

  for (const bloque of bloques ?? []) {
    agregarReferencias(
      referencias,
      bloque.titulo,
      materiaId
    );

    agregarReferencias(
      referencias,
      bloque.introduccion,
      materiaId
    );

    agregarReferencias(
      referencias,
      bloque.contenido,
      materiaId
    );
  }

  // curso_archivos es un índice auxiliar. El contenido guardado del bloque
  // es la fuente de verdad: si la URL ya no está en el bloque, eliminamos
  // la fila auxiliar para que no "proteja" un archivo que ya no se usa.
  if (bloqueIds.length > 0) {
    const { data: archivosDb, error: archivosDbError } =
      await admin
        .from("curso_archivos")
        .select("id,bloque_id,url")
        .in("bloque_id", bloqueIds);

    if (archivosDbError) {
      throw archivosDbError;
    }

    const filasObsoletas: string[] = [];

    for (const archivo of archivosDb ?? []) {
      const rutas = extraerRutasStorageDeTexto(
        archivo.url,
        materiaId
      );

      if (rutas.size === 0) {
        continue;
      }

      const sigueUsado = [...rutas].some((ruta) =>
        referencias.has(ruta)
      );

      if (!sigueUsado) {
        filasObsoletas.push(String(archivo.id));
      }
    }

    if (filasObsoletas.length > 0) {
      const { error: borrarFilasError } = await admin
        .from("curso_archivos")
        .delete()
        .in("id", filasObsoletas);

      if (borrarFilasError) {
        throw borrarFilasError;
      }
    }
  }

  const { data: quizzes, error: quizzesError } = await admin
    .from("quizzes")
    .select("id,titulo,descripcion")
    .eq("materia_id", materiaId);

  if (quizzesError) {
    throw quizzesError;
  }

  const quizIds = (quizzes ?? []).map((quiz) =>
    String(quiz.id)
  );

  for (const quiz of quizzes ?? []) {
    agregarReferencias(
      referencias,
      quiz.titulo,
      materiaId
    );

    agregarReferencias(
      referencias,
      quiz.descripcion,
      materiaId
    );
  }

  let preguntaIds: string[] = [];

  if (quizIds.length > 0) {
    const { data: preguntas, error: preguntasError } =
      await admin
        .from("preguntas")
        .select("id,enunciado")
        .in("quiz_id", quizIds);

    if (preguntasError) {
      throw preguntasError;
    }

    preguntaIds = (preguntas ?? []).map((pregunta) =>
      String(pregunta.id)
    );

    for (const pregunta of preguntas ?? []) {
      agregarReferencias(
        referencias,
        pregunta.enunciado,
        materiaId
      );
    }
  }

  if (preguntaIds.length > 0) {
    const { data: respuestas, error: respuestasError } =
      await admin
        .from("respuestas")
        .select("id,texto")
        .in("pregunta_id", preguntaIds);

    if (respuestasError) {
      throw respuestasError;
    }

    for (const respuesta of respuestas ?? []) {
      agregarReferencias(
        referencias,
        respuesta.texto,
        materiaId
      );
    }
  }

  const existentes = await listarArchivosStorageCurso(
    admin,
    materiaId
  );

  const sinReferencia = existentes.filter(
    (ruta) => !referencias.has(ruta)
  );

  const eliminados = await eliminarRutasStorage(
    admin,
    sinReferencia
  );

  return {
    archivosExistentes: existentes.length,
    referenciasVivas: referencias.size,
    archivosEliminados: eliminados,
    archivosConservados:
      existentes.length - sinReferencia.length,
  };
}
