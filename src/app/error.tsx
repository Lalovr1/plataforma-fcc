"use client";

import { useEffect } from "react";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error de interfaz en FCC Academy:", error);
  }, [error]);

  return (
    <main>
      <EstadoErrorCargaFCC
        pantallaCompleta
        titulo="La interfaz no se mostró incompleta"
        detalle="Se interrumpió una consulta necesaria. Puedes volver a intentarlo sin recargar datos anteriores."
        onRetry={reset}
      />
    </main>
  );
}
