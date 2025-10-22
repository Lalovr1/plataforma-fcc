"use client";

import { supabase } from "@/utils/supabaseClient";

/**
 * Registra recompensas obtenidas por el usuario (cabellos, ropa, accesorios, etc.)
 * Evita duplicados gracias al índice UNIQUE (user_id, nombre).
 */
export async function registrarRecompensas(
  userId: string,
  recompensas: { nombre: string; rareza: string }[]
) {
  if (!userId) {
    console.error("❌ No se proporcionó userId al registrar recompensas");
    return;
  }

  if (!recompensas?.length) {
    console.warn("⚠️ No se proporcionaron recompensas para registrar");
    return;
  }

  // 🔹 Prepara los registros con fecha e inferencia de tipo
  const registros = recompensas.map((r) => ({
    user_id: userId,
    tipo: inferirTipoDesdeNombre(r.nombre),
    nombre: r.nombre,
    rareza: r.rareza,
    fecha_desbloqueo: new Date().toISOString(),
  }));

  console.log("📦 Intentando guardar recompensas:", registros);

  // 🔹 Importante: requiere índice UNIQUE(user_id, nombre)
  const { data, error, status, statusText } = await supabase
    .from("recompensas_usuario")
    .upsert(registros, { onConflict: "user_id,nombre" });

  if (error && status !== 409) {
    console.error("❌ Error al registrar desbloqueos:", { error, status, statusText, registros });
  } else {
    console.log(`✅ ${data?.length ?? 0} desbloqueos guardados correctamente.`);
  }
  return data ?? [];
}

/**
 * Deducción automática del tipo según el nombre de la recompensa.
 */
function inferirTipoDesdeNombre(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("cabello")) return "cabello";
  if (n.includes("ojos")) return "ojos";
  if (n.includes("boca")) return "boca";
  if (n.includes("nariz")) return "nariz";
  if (n.includes("playera")) return "ropa";
  if (n.includes("sueter") || n.includes("chaqueta") || n.includes("sudadera"))
    return "ropa";
  if (n.includes("lentes") || n.includes("collar") || n.includes("pulsera"))
    return "accesorio";
  return "otro";
}
