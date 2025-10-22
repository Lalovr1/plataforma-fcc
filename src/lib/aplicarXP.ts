"use client";
import { supabase } from "@/utils/supabaseClient";
import { verificarLogros } from "@/utils/verificarLogros";

let nivelesPendientes: number[] = [];

export async function aplicarXP(usuarioId: string, xp: number) {
  const { data: usuarioActual } = await supabase
    .from("usuarios")
    .select("puntos, nivel")
    .eq("id", usuarioId)
    .single();

  const puntosActuales = usuarioActual?.puntos || 0;
  const nivelAnterior = usuarioActual?.nivel || 0;
  const nuevosPuntos = puntosActuales + xp;
  const nuevoNivel = Math.floor(nuevosPuntos / 500);

  await supabase
    .from("usuarios")
    .update({ puntos: nuevosPuntos, nivel: nuevoNivel })
    .eq("id", usuarioId);

  window.dispatchEvent(new Event("xpActualizada"));

  //  Verifica logros
  await verificarLogros(usuarioId, "nivel", nuevoNivel);

  if (nuevoNivel > nivelAnterior) {
    nivelesPendientes.push(nuevoNivel);
    console.log("📦 Nivel pendiente registrado:", nuevoNivel);
  }

    //  Mostrar cofre solo cuando no haya modales de logro visibles
    if (nuevoNivel > nivelAnterior && nivelesPendientes.length > 0) {
    const nivelFinal = Math.max(...nivelesPendientes);

    const esperarYCofre = () => {
        const abiertos = document.querySelectorAll("[data-logro-modal]").length;
        if (abiertos === 0) {
        nivelesPendientes = [];
        console.log("🎁 Mostrando cofre (nivel alcanzado):", nivelFinal);
        window.dispatchEvent(new CustomEvent("nivelSubido", { detail: nivelFinal }));
        } else {
        setTimeout(esperarYCofre, 500);
        }
    };

    setTimeout(esperarYCofre, 1200);
    }
}

