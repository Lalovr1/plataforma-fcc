import { supabase } from "@/utils/supabaseClient";
import type { ResultadoLogros } from "@/utils/verificarLogros";

type ResultadoFinalizacionTutorial = {
  ok: boolean;
  error?: string;
};

type ResultadoPreparacionTutorial = {
  ok: boolean;
  error?: string;
  resultado?: ResultadoLogros;
  yaRegistrado?: boolean;
};

async function leerRespuestaJson(response: Response) {
  const texto = await response.text();

  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}

export async function prepararLogroTutorial(): Promise<ResultadoPreparacionTutorial> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/tutorial/preparar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      cache: "no-store",
    });

    const data = await leerRespuestaJson(response);

    if (!response.ok || data?.ok !== true) {
      return {
        ok: false,
        error:
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "No se pudo preparar el logro del tutorial.",
      };
    }

    return {
      ok: true,
      resultado:
        data?.resultado && typeof data.resultado === "object"
          ? (data.resultado as ResultadoLogros)
          : {},
      yaRegistrado: Boolean(data?.ya_registrado),
    };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error?.message ||
        "No se pudo conectar con el servicio de preparación del tutorial.",
    };
  }
}

export async function confirmarFinalizacionTutorial(): Promise<ResultadoFinalizacionTutorial> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/tutorial/finalizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      cache: "no-store",
    });

    const data = await leerRespuestaJson(response);

    if (!response.ok || data?.ok !== true) {
      return {
        ok: false,
        error:
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "No se pudo confirmar la finalización del tutorial.",
      };
    }

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error?.message ||
        "No se pudo conectar con el servicio de finalización del tutorial.",
    };
  }
}
