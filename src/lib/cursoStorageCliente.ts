"use client";

import { supabase } from "@/utils/supabaseClient";

const BUCKET_CURSO = "curso-contenido";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "xlsx",
  "application/vnd.ms-excel": "xls",
};

function extensionSegura(file: File) {
  const mime = String(file.type || "").toLowerCase();

  if (EXTENSION_POR_MIME[mime]) {
    return EXTENSION_POR_MIME[mime];
  }

  const desdeNombre =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";

  return desdeNombre || "bin";
}

async function sha256Archivo(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function esErrorDuplicadoStorage(error: unknown) {
  const raw = error as {
    status?: number | string;
    statusCode?: number | string;
    message?: string;
    error?: string;
  };

  const status = String(raw?.statusCode ?? raw?.status ?? "");
  const mensaje = `${raw?.message ?? ""} ${raw?.error ?? ""}`.toLowerCase();

  return (
    status === "409" ||
    mensaje.includes("already exists") ||
    mensaje.includes("resource already exists") ||
    mensaje.includes("duplicate")
  );
}

export async function subirArchivoCursoDeduplicado(
  materiaId: string,
  file: File,
  carpetaOriginal: string
) {
  if (!materiaId) {
    throw new Error("Curso no disponible.");
  }

  if (
    carpetaOriginal === "videos" &&
    file.size > MAX_VIDEO_BYTES
  ) {
    throw new Error(
      "El video es demasiado pesado. Máximo permitido: 50 MB."
    );
  }

  const hash = await sha256Archivo(file);
  const extension = extensionSegura(file);

  // Todos los recursos nuevos viven en una sola colección por curso.
  // El hash del contenido hace que el MISMO archivo tenga la MISMA ruta,
  // aunque se vuelva a seleccionar o se use tanto en contenido como en quiz.
  const key = `${materiaId}/recursos/${hash}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_CURSO)
    .upload(key, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error && !esErrorDuplicadoStorage(error)) {
    throw error;
  }

  const { data } = supabase.storage
    .from(BUCKET_CURSO)
    .getPublicUrl(key);

  return {
    url: data.publicUrl,
    originalName: file.name,
    key,
    reutilizado: Boolean(error),
  };
}

async function obtenerAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

type ResultadoReconciliacionStorage = {
  ok: true;
  materiaId: string;
  archivosExistentes: number;
  referenciasVivas: number;
  archivosEliminados: number;
  archivosConservados: number;
};

type EstadoReconciliacionStorage = {
  timer: ReturnType<typeof setTimeout> | null;
  ejecutando: boolean;
  pendiente: boolean;
  resolvers: Array<
    (resultado: ResultadoReconciliacionStorage | null) => void
  >;
};

const RECONCILIACION_DEBOUNCE_MS = 250;

const reconciliacionesPorCurso = new Map<
  string,
  EstadoReconciliacionStorage
>();

function obtenerEstadoReconciliacion(
  materiaId: string
) {
  const existente =
    reconciliacionesPorCurso.get(materiaId);

  if (existente) {
    return existente;
  }

  const nuevo: EstadoReconciliacionStorage = {
    timer: null,
    ejecutando: false,
    pendiente: false,
    resolvers: [],
  };

  reconciliacionesPorCurso.set(
    materiaId,
    nuevo
  );

  return nuevo;
}

async function reconciliarStorageCursoAhora(
  materiaId: string
): Promise<ResultadoReconciliacionStorage | null> {
  try {
    const token = await obtenerAccessToken();

    if (!token) {
      console.warn(
        "[FCC Academy] No se pudo reconciliar Storage: sesión no disponible."
      );
      return null;
    }

    const response = await fetch(
      "/api/curso-storage/reconciliar",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ materiaId }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      console.warn(
        "[FCC Academy] No se pudo reconciliar Storage:",
        data?.error || response.status
      );
      return null;
    }

    return data as ResultadoReconciliacionStorage;
  } catch (error) {
    console.warn(
      "[FCC Academy] No se pudo reconciliar Storage:",
      error
    );
    return null;
  }
}

async function ejecutarColaReconciliacion(
  materiaId: string,
  estado: EstadoReconciliacionStorage
) {
  if (estado.ejecutando) {
    estado.pendiente = true;
    return;
  }

  estado.ejecutando = true;

  let resultado:
    | ResultadoReconciliacionStorage
    | null = null;

  try {
    do {
      estado.pendiente = false;

      resultado =
        await reconciliarStorageCursoAhora(
          materiaId
        );

      // Si otra accion pidio limpieza mientras
      // esta estaba corriendo, hacemos una pasada
      // adicional una vez estabilizada la rafaga.
      if (estado.pendiente) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            RECONCILIACION_DEBOUNCE_MS
          )
        );
      }
    } while (estado.pendiente);
  } finally {
    estado.ejecutando = false;

    const resolvers =
      estado.resolvers.splice(0);

    for (const resolver of resolvers) {
      resolver(resultado);
    }

    if (
      !estado.timer &&
      !estado.pendiente &&
      estado.resolvers.length === 0
    ) {
      reconciliacionesPorCurso.delete(
        materiaId
      );
    }
  }
}

/**
 * Limpia archivos del curso que ya no aparecen
 * en contenido/quizzes guardados.
 *
 * Varias llamadas cercanas se agrupan y nunca
 * se ejecutan reconciliaciones simultaneas para
 * el mismo curso dentro de esta sesion.
 */
export function reconciliarStorageCurso(
  materiaId: string
): Promise<
  ResultadoReconciliacionStorage | null
> {
  if (!materiaId) {
    return Promise.resolve(null);
  }

  const estado =
    obtenerEstadoReconciliacion(materiaId);

  return new Promise((resolve) => {
    estado.resolvers.push(resolve);

    if (estado.ejecutando) {
      estado.pendiente = true;
      return;
    }

    if (estado.timer) {
      clearTimeout(estado.timer);
    }

    estado.timer = setTimeout(() => {
      estado.timer = null;

      void ejecutarColaReconciliacion(
        materiaId,
        estado
      );
    }, RECONCILIACION_DEBOUNCE_MS);
  });
}
export async function eliminarCursoCompleto(materiaId: string) {
  const token = await obtenerAccessToken();

  if (!token) {
    throw new Error("Tu sesión no está disponible.");
  }

  const response = await fetch("/api/cursos/eliminar", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ materiaId }),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error || "No se pudo eliminar el curso."
    );
  }

  return data as {
    ok: true;
    storageEliminados: number;
    advertencia?: string | null;
  };
}
