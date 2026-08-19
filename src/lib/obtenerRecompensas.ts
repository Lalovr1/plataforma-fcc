import type { Rareza } from "./rarezaConfig";

type Recompensa = {
  nombre: string;
  imagen: string;
  rareza: Rareza;
  tipo?: string;
};

export async function obtenerRecompensasAleatorias(
  _userId: string,
  tipo?: "normal" | "bienvenida"
): Promise<{
  rareza: Rareza;
  recompensas: Recompensa[];
}> {
  try {
    const response = await fetch("/api/cofre/reclamar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        tipo: tipo === "bienvenida" ? "bienvenida" : "nivel",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error reclamando cofre:", data);
      return {
        rareza: "comun",
        recompensas: [],
      };
    }

    return {
      rareza: (data?.rareza ?? "comun") as Rareza,
      recompensas: Array.isArray(data?.recompensas)
        ? data.recompensas
        : [],
    };
  } catch (error) {
    console.error("Error reclamando cofre:", error);

    return {
      rareza: "comun",
      recompensas: [],
    };
  }
}