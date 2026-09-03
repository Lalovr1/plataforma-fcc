type RespuestaErrorIA = {
  code?: unknown;
  error?: unknown;
  retry_after_seconds?: unknown;
};

export class ErrorIAVisible extends Error {}

export function mensajeErrorIA(
  data: RespuestaErrorIA | null,
  accion: "generar" | "analizar"
) {
  const mensajeServidor =
    typeof data?.error === "string" ? data.error.trim() : "";

  if (mensajeServidor) return mensajeServidor;

  return accion === "generar"
    ? "No se pudo generar el quiz con IA en este momento. No se descontó ningún intento."
    : "No se pudo analizar el quiz con IA en este momento. No se descontó ningún intento.";
}
