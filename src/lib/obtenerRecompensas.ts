import { rarezaConfig, Rareza } from "./rarezaConfig";
import { supabase } from "../utils/supabaseClient";

const ordenRareza: Rareza[] = ["comun", "raro", "epico", "legendario"];

export async function obtenerRecompensasAleatorias(
  userId: string,
  tipo?: "normal" | "bienvenida"
) {
  let rarezaMax: Rareza = "comun";

  // 👑 Forzar legendario si es cofre de bienvenida
  if (tipo === "bienvenida") {
    rarezaMax = "legendario";
  } else {
    // Sorteo normal
    const random = Math.random();
    let acumulado = 0;
    for (const [key, conf] of Object.entries(rarezaConfig)) {
      acumulado += conf.probabilidad;
      if (random <= acumulado) {
        rarezaMax = key as Rareza;
        break;
      }
    }
  }

  // 2️⃣ Leer recompensas ya desbloqueadas del usuario
  const { data: desbloqueados } = await supabase
    .from("recompensas_usuario")
    .select("nombre, rareza")
    .eq("user_id", userId);

  const ya =
    desbloqueados?.map((d) =>
      d.nombre.toLowerCase().replace(/\.[^/.]+$/, "")
    ) ?? [];

  // 3️⃣ Leer catálogo local de recompensas
  let todasDeRareza: { nombre: string; rareza: Rareza }[] = [];

  try {
    const res = await fetch(`/recompensas/catalogo.json`);
    const catalogo = await res.json();

    for (const tipo in catalogo) {
      const items = catalogo[tipo];
      for (const [nombre, rareza] of Object.entries(items)) {
        const normalizado = nombre.toLowerCase().replace(/\.[^/.]+$/, "");
        todasDeRareza.push({ nombre: normalizado, rareza: rareza as Rareza });
      }
    }
  } catch (err) {
    console.warn("⚠️ No se pudo leer recompensas desde el catálogo local:", err);
  }

  // 4️⃣ Buscar rareza válida con recompensas disponibles (evita cofres vacíos)
  if (todasDeRareza.length > 0) {
    const rarezasDisponibles = ordenRareza.filter((r) => {
      const restantes = todasDeRareza.filter(
        (item) => item.rareza === r && !ya.includes(item.nombre)
      );
      return restantes.length > 0;
    });

    if (rarezasDisponibles.length === 0) {
      console.warn("⚠️ Usuario ya tiene todas las recompensas del juego.");
      return { rareza: "comun", recompensas: [] };
    }

    const idxMax = ordenRareza.indexOf(rarezaMax);
    let rarezaDisponible = rarezaMax;

    // Buscar rareza más cercana (puede ser superior o inferior)
    if (!rarezasDisponibles.includes(rarezaMax)) {
      let offset = 1;
      while (true) {
        const arriba = ordenRareza[idxMax + offset];
        const abajo = ordenRareza[idxMax - offset];
        if (arriba && rarezasDisponibles.includes(arriba)) {
          rarezaDisponible = arriba;
          break;
        }
        if (abajo && rarezasDisponibles.includes(abajo)) {
          rarezaDisponible = abajo;
          break;
        }
        offset++;
        if (offset > ordenRareza.length) break;
      }
    }

    if (rarezaDisponible !== rarezaMax) {
      console.log(
        `🔁 Ajustando rareza: ${rarezaMax} → ${rarezaDisponible} (para evitar cofres vacíos)`
      );
      rarezaMax = rarezaDisponible;
    }
  }

  // 5️⃣ Determinar cantidad total de recompensas (por ahora siempre 3)
  const cantidad = 3;
  const seleccionadas: { nombre: string; imagen: string; rareza: Rareza }[] = [];

  // 🔹 Auxiliar para obtener recompensa aleatoria de cierta rareza
  async function obtenerAleatoriaDeRareza(rareza: Rareza) {
    const res = await fetch(`/recompensas/${rareza}/index.json`);
    const archivos: { nombre: string; preview: string; tipo: string }[] =
      await res.json();
    const disponibles = archivos.filter(
      (a) =>
        !ya.includes(a.nombre.toLowerCase().replace(/\.[^/.]+$/, ""))
    );

    if (disponibles.length === 0) return null;

    const elegido = disponibles[Math.floor(Math.random() * disponibles.length)];
    return {
      nombre: elegido.nombre,
      imagen: elegido.preview,
      rareza,
    };
  }

  // 6️⃣ Agregar una recompensa de la rareza máxima válida
  const recompensaMax = await obtenerAleatoriaDeRareza(rarezaMax);
  if (recompensaMax) seleccionadas.push(recompensaMax);

  // 7️⃣ Las demás recompensas pueden ser de rarezas distintas
  const indiceMax = ordenRareza.indexOf(rarezaMax);
  const menores = ordenRareza.slice(0, indiceMax);

  for (let i = seleccionadas.length; i < cantidad; i++) {
    const rarezaAleatoria =
      menores.length > 0
        ? menores[Math.floor(Math.random() * menores.length)]
        : rarezaMax;

    const recompensa = await obtenerAleatoriaDeRareza(rarezaAleatoria);
    if (recompensa) seleccionadas.push(recompensa);
  }

  // 8️⃣ Limpiar duplicados y recompensas ya obtenidas
  const recompensasUnicas = seleccionadas.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.nombre === item.nombre)
  );

  const recompensasFinales = recompensasUnicas.filter(
    (r) => !ya.includes(r.nombre.toLowerCase().replace(/\.[^/.]+$/, ""))
  );

  console.log("🟢 Ya tiene:", ya);
  console.log(
    "🟣 Rarezas con recompensas disponibles:",
    todasDeRareza.reduce((acc, r) => {
      if (!acc[r.rareza]) acc[r.rareza] = 0;
      acc[r.rareza]++;
      return acc;
    }, {} as Record<string, number>)
  );
  console.log("🔵 Recompensas finales entregadas:", recompensasFinales);

  return {
    rareza: rarezaMax,
    recompensas: recompensasFinales,
  };
}
