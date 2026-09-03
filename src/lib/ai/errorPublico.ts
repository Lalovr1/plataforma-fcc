type AccionIA = "generar" | "analizar" | "formatear";

export type ErrorPublicoIA = {
  status: number;
  code:
    | "IA_QUOTA"
    | "IA_TEMPORAL"
    | "IA_TIMEOUT"
    | "IA_RECURSO"
    | "IA_RESPUESTA_INVALIDA"
    | "IA_NO_DISPONIBLE";
  error: string;
  retry_after_seconds?: number;
};

function valorNumerico(value: unknown) {
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : 0;
}

function leerEncabezadoRetryAfter(error: any) {
  const candidatos = [
    error?.headers,
    error?.rawResponse?.headers,
    error?.error?.httpMeta?.response?.headers,
    error?.cause?.headers,
    error?.cause?.rawResponse?.headers,
  ];

  for (const headers of candidatos) {
    const valor =
      typeof headers?.get === "function"
        ? headers.get("retry-after")
        : headers?.["retry-after"];
    const segundos = valorNumerico(valor);

    if (segundos) return Math.min(segundos, 300);
  }

  return 30;
}

export function interpretarErrorIA(
  error: unknown,
  accion: AccionIA
): ErrorPublicoIA {
  const detalle = error as any;
  const mensajeCrudo = [
    error instanceof Error ? error.message : String(error ?? ""),
    detalle?.body,
    detalle?.error?.error?.message,
    detalle?.cause?.message,
    detalle?.cause?.body,
  ]
    .filter(Boolean)
    .join(" ");
  const statusProveedor = valorNumerico(
    detalle?.status ?? detalle?.statusCode ?? detalle?.cause?.statusCode
  );
  const esFormato = accion === "formatear";
  const intento = accion === "generar" ? "generación" : "análisis";
  const notaIntento = esFormato
    ? "Tu contenido no se modificó."
    : `Este intento de ${intento} no se descontó.`;

  if (
    statusProveedor === 429 ||
    /429|RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(
      mensajeCrudo
    )
  ) {
    return {
      status: 429,
      code: "IA_QUOTA",
      error: esFormato
        ? `El formato automático alcanzó temporalmente su límite de uso. ` +
          `${notaIntento} Espera unos minutos y vuelve a intentarlo.`
        : `El servicio de IA alcanzó temporalmente su límite de uso. ` +
          `${notaIntento} Espera unos minutos y vuelve a intentarlo.`,
    };
  }

  if (
    /timeout|timed out|deadline exceeded|ETIMEDOUT|AbortError/i.test(
      mensajeCrudo
    )
  ) {
    return {
      status: 504,
      code: "IA_TIMEOUT",
      error: esFormato
        ? `El formato automático tardó más de lo esperado. ` +
          `${notaIntento} Inténtalo nuevamente.`
        : `La IA tardó más de lo esperado en responder. ` +
          `${notaIntento} Inténtalo nuevamente.`,
    };
  }

  if (
    /APIConnectionError|UnexpectedClientError|Unexpected HTTP client error|fetch failed|network|socket|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|unusable/i.test(
      mensajeCrudo
    )
  ) {
    return {
      status: 503,
      code: "IA_TEMPORAL",
      retry_after_seconds: 10,
      error: esFormato
        ? `No se pudo establecer una conexión estable para aplicar el formato. ` +
          `${notaIntento} Espera unos segundos y vuelve a intentarlo.`
        : `No se pudo establecer una conexión estable con la IA. ` +
          `${notaIntento} Espera unos segundos y vuelve a intentarlo.`,
    };
  }

  if (
    [500, 502, 503, 504].includes(statusProveedor) ||
    /high demand|overload|temporar(?:y|ily)|try again later|service unavailable|UNAVAILABLE|INTERNAL/i.test(
      mensajeCrudo
    )
  ) {
    const segundos = leerEncabezadoRetryAfter(detalle);

    return {
      status: 503,
      code: "IA_TEMPORAL",
      retry_after_seconds: segundos,
      error: esFormato
        ? `El formato automático está recibiendo muchas solicitudes en este momento. ` +
          `${notaIntento} Espera ${segundos} segundos y vuelve a intentarlo.`
        : `La IA está recibiendo muchas solicitudes en este momento. ` +
          `${notaIntento} Espera ${segundos} segundos y vuelve a intentarlo.`,
    };
  }

  if (
    /la ia (?:no devolvi[oó]|intent[oó])|respuesta.+(?:inv[aá]lida|incompleta)|pregunta \d+.+(?:vac[ií]a|opciones|respuesta)/i.test(
      mensajeCrudo
    )
  ) {
    return {
      status: 502,
      code: "IA_RESPUESTA_INVALIDA",
      error: esFormato
        ? `El formato automático recibió una respuesta incompleta y FCC Academy la descartó. ` +
          `${notaIntento} Vuelve a intentarlo.`
        : `La IA devolvió una respuesta incompleta y FCC Academy la descartó para proteger el quiz. ` +
          `${notaIntento} Vuelve a intentarlo.`,
    };
  }

  if (
    /imagen(?:es)?.+(?:no se pudo|formato|l[ií]mite|supera)|no se pudo leer.+imagen/i.test(
      mensajeCrudo
    )
  ) {
    return {
      status: 422,
      code: "IA_RECURSO",
      error:
        "No se pudo preparar una de las imágenes del quiz para el análisis. Revisa ese recurso o prueba el análisis sin imágenes opcionales.",
    };
  }

  return {
    status: 500,
    code: "IA_NO_DISPONIBLE",
    error: esFormato
      ? `No se pudo aplicar el formato automático en este momento. ` +
        `${notaIntento} Vuelve a intentarlo más tarde.`
      : accion === "generar"
        ? "No se pudo completar la generación con IA en este momento. No se descontó ningún intento. Vuelve a intentarlo más tarde."
        : "No se pudo completar el análisis con IA en este momento. No se descontó ningún intento. Vuelve a intentarlo más tarde.",
  };
}
