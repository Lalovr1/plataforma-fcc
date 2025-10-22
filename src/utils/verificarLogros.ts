"use client";
import { supabase } from "@/utils/supabaseClient";

// 🧠 Candado global anti ejecución simultánea
const ejecucionesActivas = new Set<string>();

// 🧩 Cache local por sesión
function getLogrosLocales(usuarioId: string): Set<string> {
  try {
    const data = localStorage.getItem(`logros_local_${usuarioId}`);
    return new Set(data ? JSON.parse(data) : []);
  } catch {
    return new Set();
  }
}
function saveLogrosLocales(usuarioId: string, set: Set<string>) {
  try {
    localStorage.setItem(`logros_local_${usuarioId}`, JSON.stringify([...set]));
  } catch {}
}

export async function verificarLogros(
  usuarioId: string,
  tipo: string,
  valorActual: number
) {
  if (!usuarioId) return [];
  const key = `${usuarioId}-${tipo}`;

  // 🧩 Evita que el logro del tutorial se dispare accidentalmente al subir de nivel
  // ❌ Quita el bloqueo general
  // if (tipo !== "tutorial" && tipo.startsWith("nivel")) {

  // ✅ Sustitúyelo por:
  if (tipo === "tutorial") {
    const { data: yaTieneTutorial } = await supabase
      .from("logros_usuarios")
      .select("logro_id")
      .eq("usuario_id", usuarioId)
      .eq("logro_id", "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610")
      .maybeSingle();

    if (yaTieneTutorial) {
      console.log("🧩 Logro de tutorial ya otorgado, cancelando duplicado");
      return [];
    }
  }

  // 🚧 Si ya se está ejecutando una verificación igual, se cancela
  if (ejecucionesActivas.has(key)) {
    console.log(`⏳ Saltando verificación duplicada (${tipo})`);
    return [];
  }
  ejecucionesActivas.add(key);

  try {
    const logrosLocales = getLogrosLocales(usuarioId);

    const { data: posibles, error } = await supabase
      .from("logros")
      .select("*")
      .eq("tipo", tipo)
      .lte("valor_objetivo", valorActual)
      .eq("visible", true);

    if (error) {
      console.error("❌ Error al buscar logros:", error);
      return [];
    }

    const { data: desbloqueados } = await supabase
      .from("logros_usuarios")
      .select("logro_id")
      .eq("usuario_id", usuarioId);

    const idsDesbloqueados = new Set(desbloqueados?.map((l) => l.logro_id));

    const nuevos = posibles.filter(
      (l) => !idsDesbloqueados.has(l.id) && !logrosLocales.has(l.id)
    );

    if (nuevos.length === 0) return [];

    const nuevosInsertados: any[] = [];

    for (const logro of nuevos) {
      try {
        // Verificar de nuevo en Supabase si el logro ya fue insertado
        const { data: existe } = await supabase
          .from("logros_usuarios")
          .select("logro_id")
          .eq("usuario_id", usuarioId)
          .eq("logro_id", logro.id)
          .maybeSingle();

        if (existe) {
          console.log(`⏩ Logro ${logro.nombre} ya registrado, omitiendo...`);
          continue;
        }

        const { error: insertErr } = await supabase
          .from("logros_usuarios")
          .insert({
            usuario_id: usuarioId,
            logro_id: logro.id,
            fecha_desbloqueo: new Date().toISOString(),
            notificado: false,
          });

        if (!insertErr) {
          logrosLocales.add(logro.id);
          nuevosInsertados.push({
            id: logro.id,
            nombre: logro.nombre,
            descripcion: logro.descripcion,
            xp_recompensa: logro.xp_recompensa,
            icono_url: logro.icono_url,
          });
        } else {
          console.warn("⚠️ Logro duplicado o error al insertar:", insertErr);
        }
      } catch (e) {
        console.error("Error al insertar logro:", e);
      }
    }

        // 💾 Guardar cache actualizada
    saveLogrosLocales(usuarioId, logrosLocales);

    // 🔔 Emitir evento solo si NO es del tutorial
    if (nuevosInsertados.length > 0) {
      if (tipo !== "tutorial") {
        window.dispatchEvent(
          new CustomEvent("logrosDesbloqueados", { detail: nuevosInsertados })
        );
      }

      console.table(
        nuevosInsertados.map((l) => ({
          Logro: l.nombre,
          XP: l.xp_recompensa,
          Tipo: tipo,
        }))
      );
    }

    return nuevosInsertados;
  } finally {
    ejecucionesActivas.delete(key);
  }
}

