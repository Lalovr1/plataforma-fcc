import type { Rareza } from "./rarezaConfig";
import { supabase } from "@/utils/supabaseClient";

type Recompensa = {
  nombre: string;
  imagen: string;
  rareza: Rareza;
  tipo?: string;
};

type ResultadoCofre = {
  rareza: Rareza;
  recompensas: Recompensa[];
  yaReclamado?: boolean;
  agotado?: boolean;
  bloqueadoHistorico?: boolean;
  error?: string;
};

export async function obtenerRecompensasAleatorias(
  _userId: string,
  tipo?: "normal" | "bienvenida"
): Promise<ResultadoCofre> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/cofre/reclamar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      cache: "no-store",
      body: JSON.stringify({
        tipo: tipo === "bienvenida" ? "bienvenida" : "nivel",
      }),
    });

    const texto = await response.text();

    let data: any = {};

    try {
      data = texto ? JSON.parse(texto) : {};
      console.log("[COFRE PRUEBA] respuesta API:", data);
    } catch {
      data = {};
    }

    if (!response.ok) {
      const mensaje =
        typeof data?.error === "string" && data.error.trim()
          ? data.error
          : `No se pudo reclamar el cofre (${response.status}).`;

      console.warn("No se pudo reclamar el cofre:", mensaje);

      return {
        rareza: "comun",
        recompensas: [],
        error: mensaje,
      };
    }

    return {
      rareza: (data?.rareza ?? "comun") as Rareza,
      recompensas: Array.isArray(data?.recompensas)
        ? data.recompensas
        : [],
      yaReclamado: Boolean(data?.ya_reclamado),
      agotado: Boolean(data?.agotado),
      bloqueadoHistorico: Boolean(data?.bloqueado_historico),
    };
  } catch (error: any) {
    const mensaje =
      error?.message || "No se pudo conectar con el servicio de cofres.";

    console.warn("No se pudo reclamar el cofre:", mensaje);

    return {
      rareza: "comun",
      recompensas: [],
      error: mensaje,
    };
  }
}
