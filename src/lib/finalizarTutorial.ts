import { supabase } from "@/utils/supabaseClient";

type ResultadoFinalizacionTutorial = {
  ok: boolean;
  error?: string;
};

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

    const texto = await response.text();
    let data: any = {};

    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      data = {};
    }

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
