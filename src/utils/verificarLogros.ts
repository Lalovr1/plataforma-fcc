"use client";

import { supabase } from "@/utils/supabaseClient";

type LogroDesbloqueado = {
  id: string;
  nombre: string;
  descripcion: string | null;
  xp_recompensa: number;
  icono_url?: string | null;
};

type ResultadoLogros = {
  logros?: LogroDesbloqueado[];
  xp_agregado?: number;
  xp_total?: number;
  nivel_anterior?: number;
  nivel_actual?: number;
  nuevo_nivel?: boolean;
};

let nivelesPendientes: number[] = [];
let esperaNivelActiva = false;

function programarNivelSubido(nivel: number) {
  nivelesPendientes.push(nivel);

  if (esperaNivelActiva) return;

  esperaNivelActiva = true;

  const esperar = () => {
    const modalesAbiertos = document.querySelectorAll(
      "[data-logro-modal]"
    ).length;

    if (modalesAbiertos === 0) {
      const nivelFinal = Math.max(...nivelesPendientes);

      nivelesPendientes = [];
      esperaNivelActiva = false;

      window.dispatchEvent(
        new CustomEvent("nivelSubido", {
          detail: nivelFinal,
        })
      );

      return;
    }

    setTimeout(esperar, 500);
  };

  setTimeout(esperar, 1200);
}

export async function verificarLogros(
  usuarioId: string,
  tipo: string,
  _valorActual: number
) {
  if (!usuarioId) return [];

  try {
    const { data: sesion, error: errorSesion } =
      await supabase.auth.getUser();

    if (
      errorSesion ||
      !sesion.user ||
      sesion.user.id !== usuarioId
    ) {
      return [];
    }

    const { data, error } = await supabase.rpc(
      "verificar_y_otorgar_logros",
      {
        p_tipo: tipo,
      }
    );

    if (error) {
      console.error("Error al verificar logros:", error);
      return [];
    }

    const resultado = (data ?? {}) as ResultadoLogros;

    const nuevos = Array.isArray(resultado.logros)
      ? resultado.logros
      : [];

    if (
      typeof resultado.xp_agregado === "number" &&
      resultado.xp_agregado > 0
    ) {
      window.dispatchEvent(new Event("xpActualizada"));
    }

    if (
      resultado.nuevo_nivel === true &&
      typeof resultado.nivel_actual === "number"
    ) {
      programarNivelSubido(resultado.nivel_actual);
    }

    if (tipo !== "tutorial" && nuevos.length > 0) {
      window.dispatchEvent(
        new CustomEvent("logrosDesbloqueados", {
          detail: nuevos,
        })
      );
    }

    return nuevos;
  } catch (error) {
    console.error("Error al verificar logros:", error);
    return [];
  }
}