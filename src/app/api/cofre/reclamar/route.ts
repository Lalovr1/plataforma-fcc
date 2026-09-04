import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { rarezaConfig, type Rareza } from "@/lib/rarezaConfig";
import {
  obtenerTodosItemsEstudianteAvatar,
  resolverOpcionImagenAvatar,
  resolverVarianteItemAvatar,
  type GeneroAvatar,
  type ItemCatalogoAvatar,
} from "@/lib/avatarCatalogo";

export const runtime = "nodejs";

type RecompensaDisponible = {
  id: string;
  nombre: string;
  imagen: string;
  tipo: string;
  rareza: Rareza;
};

type PerfilCofre = {
  rol?: string | null;
  nivel?: number | null;
  tutorial_visto?: boolean | null;
  avatar_config?: {
    gender?: string | null;
  } | null;
};

const ORDEN_RAREZA: Rareza[] = [
  "comun",
  "raro",
  "epico",
  "legendario",
];

function esRarezaCofre(valor: unknown): valor is Rareza {
  return (
    typeof valor === "string" &&
    ORDEN_RAREZA.includes(valor as Rareza)
  );
}

function normalizarClave(valor: unknown) {
  if (typeof valor !== "string") return "";

  return valor
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .trim();
}

function obtenerGenero(perfil: PerfilCofre): GeneroAvatar {
  return perfil.avatar_config?.gender === "femenino"
    ? "femenino"
    : "masculino";
}

function obtenerImagenRecompensa(
  item: ItemCatalogoAvatar,
  genero: GeneroAvatar
) {
  if (item.customization.type === "image_variants") {
    const resuelta = resolverOpcionImagenAvatar(
      item,
      item.customization.defaultOption,
      genero
    );

    return (
      resuelta?.layer?.preview ??
      resuelta?.layer?.image ??
      null
    );
  }

  const variante = resolverVarianteItemAvatar(item, genero) as any;
  if (!variante) return null;

  if (
    typeof variante.preview === "string" &&
    variante.preview
  ) {
    return variante.preview;
  }

  if (
    typeof variante.image === "string" &&
    variante.image
  ) {
    return variante.image;
  }

  if (variante.preview && typeof variante.preview === "object") {
    if (
      typeof variante.preview.outline === "string" &&
      variante.preview.outline
    ) {
      return variante.preview.outline;
    }

    if (
      typeof variante.preview.fill === "string" &&
      variante.preview.fill
    ) {
      return variante.preview.fill;
    }
  }

  if (variante.image && typeof variante.image === "object") {
    if (
      typeof variante.image.outline === "string" &&
      variante.image.outline
    ) {
      return variante.image.outline;
    }

    if (
      typeof variante.image.fill === "string" &&
      variante.image.fill
    ) {
      return variante.image.fill;
    }

    if (
      variante.image.front &&
      typeof variante.image.front === "object"
    ) {
      if (
        typeof variante.image.front.outline === "string" &&
        variante.image.front.outline
      ) {
        return variante.image.front.outline;
      }

      if (
        typeof variante.image.front.fill === "string" &&
        variante.image.front.fill
      ) {
        return variante.image.front.fill;
      }
    }
  }

  return null;
}

function crearMapaVacio(): Record<Rareza, RecompensaDisponible[]> {
  return {
    comun: [],
    raro: [],
    epico: [],
    legendario: [],
  };
}

function crearCatalogoActual(genero: GeneroAvatar) {
  const porRareza = crearMapaVacio();
  const porId = new Map<string, RecompensaDisponible>();
  const porNombre = new Map<string, RecompensaDisponible>();

  for (const item of obtenerTodosItemsEstudianteAvatar()) {
    // "inicial" pertenece al starter pack y NUNCA debe salir de un cofre.
    if (!esRarezaCofre(item.rarity)) continue;

    const imagen = obtenerImagenRecompensa(item, genero);
    if (!imagen) continue;

    const recompensa: RecompensaDisponible = {
      id: item.id,
      nombre: item.name,
      imagen,
      // Se usa la sección principal. Así "accesorios/lentes" cuenta como
      // accesorios y no pueden salir dos accesorios en el mismo cofre.
      tipo: item.section,
      rareza: item.rarity,
    };

    porRareza[item.rarity].push(recompensa);
    porId.set(normalizarClave(item.id), recompensa);

    const nombreNormalizado = normalizarClave(item.name);
    if (!porNombre.has(nombreNormalizado)) {
      porNombre.set(nombreNormalizado, recompensa);
    }
  }

  return {
    porRareza,
    porId,
    porNombre,
  };
}

function resolverRecompensaHistorica(
  valor: any,
  catalogo: ReturnType<typeof crearCatalogoActual>
) {
  const candidatas = [
    valor?.id,
    valor?.nombre,
  ]
    .map(normalizarClave)
    .filter(Boolean);

  for (const candidata of candidatas) {
    const porId = catalogo.porId.get(candidata);
    if (porId) return porId;

    const porNombre = catalogo.porNombre.get(candidata);
    if (porNombre) return porNombre;
  }

  return null;
}

function recompensaYaDesbloqueada(
  item: RecompensaDisponible,
  inventario: Set<string>
) {
  return (
    inventario.has(normalizarClave(item.id)) ||
    inventario.has(normalizarClave(item.nombre))
  );
}

function crearDisponibles(
  catalogo: ReturnType<typeof crearCatalogoActual>,
  inventario: Set<string>,
  permitirIds: Set<string> = new Set()
) {
  const resultado = crearMapaVacio();

  for (const rareza of ORDEN_RAREZA) {
    resultado[rareza] = catalogo.porRareza[rareza].filter(
      (item) =>
        permitirIds.has(item.id) ||
        !recompensaYaDesbloqueada(item, inventario)
    );
  }

  return resultado;
}

function quitarSeleccionadas(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  seleccionadas: RecompensaDisponible[]
) {
  const ids = new Set(seleccionadas.map((item) => item.id));

  for (const rareza of ORDEN_RAREZA) {
    disponibles[rareza] = disponibles[rareza].filter(
      (item) => !ids.has(item.id)
    );
  }
}

function obtenerTiposUsados(
  seleccionadas: RecompensaDisponible[]
) {
  return new Set(
    seleccionadas
      .filter((item) => item.tipo !== "ropa")
      .map((item) => item.tipo)
  );
}

function disponiblesRespetandoTipos(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  tiposUsados: Set<string>
) {
  const resultado = crearMapaVacio();

  for (const rareza of ORDEN_RAREZA) {
    resultado[rareza] = disponibles[rareza].filter(
      (item) =>
        item.tipo === "ropa" ||
        !tiposUsados.has(item.tipo)
    );
  }

  return resultado;
}

function elegirRareza(
  disponibles: Record<Rareza, RecompensaDisponible[]>
): Rareza | null {
  const candidatas = ORDEN_RAREZA.filter(
    (rareza) => disponibles[rareza].length > 0
  );

  if (candidatas.length === 0) return null;

  const pesoTotal = candidatas.reduce(
    (total, rareza) =>
      total + rarezaConfig[rareza].probabilidad,
    0
  );

  let valor = Math.random() * pesoTotal;

  for (const rareza of candidatas) {
    valor -= rarezaConfig[rareza].probabilidad;

    if (valor <= 0) {
      return rareza;
    }
  }

  return candidatas[candidatas.length - 1] ?? null;
}

function extraerAleatoria(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  rareza: Rareza
) {
  const lista = disponibles[rareza];
  if (lista.length === 0) return null;

  const indice = Math.floor(Math.random() * lista.length);
  const [item] = lista.splice(indice, 1);

  return item ?? null;
}

function retirarDelMapaPrincipal(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  item: RecompensaDisponible
) {
  disponibles[item.rareza] = disponibles[item.rareza].filter(
    (candidato) => candidato.id !== item.id
  );
}

function seleccionarTresPorRondas(
  disponibles: Record<Rareza, RecompensaDisponible[]>
) {
  const seleccionadas: RecompensaDisponible[] = [];

  const planes: Rareza[][] = [
    ["legendario", "epico", "raro", "comun"],
    Math.random() < 0.5
      ? ["epico", "raro", "comun"]
      : ["raro", "epico", "comun"],
    Math.random() < 0.5
      ? ["raro", "comun"]
      : ["comun", "raro"],
  ];

  for (const planRarezas of planes) {
    const tiposUsados = obtenerTiposUsados(seleccionadas);
    const permitidas = disponiblesRespetandoTipos(
      disponibles,
      tiposUsados
    );

    let elegida: RecompensaDisponible | null = null;

    for (const rareza of planRarezas) {
      elegida = extraerAleatoria(permitidas, rareza);

      if (elegida) break;
    }

    if (!elegida) {
      continue;
    }

    seleccionadas.push(elegida);
    retirarDelMapaPrincipal(disponibles, elegida);
  }

  return seleccionadas;
}function barajar<T>(items: T[]) {
  const copia = [...items];

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

function rarezaHasta(maxima: Rareza): Rareza[] {
  const indice = ORDEN_RAREZA.indexOf(maxima);
  return ORDEN_RAREZA.slice(0, indice + 1);
}

function candidatosSlotBienvenida({
  disponibles,
  rarezasPermitidas,
  debeSerRopa,
  idsUsados,
  tiposNoRopaUsados,
}: {
  disponibles: Record<Rareza, RecompensaDisponible[]>;
  rarezasPermitidas: Rareza[];
  debeSerRopa: boolean;
  idsUsados: Set<string>;
  tiposNoRopaUsados: Set<string>;
}) {
  const porRareza = crearMapaVacio();

  for (const rareza of rarezasPermitidas) {
    porRareza[rareza] = disponibles[rareza].filter((item) => {
      if (idsUsados.has(item.id)) return false;

      if (debeSerRopa) {
        return item.tipo === "ropa";
      }

      return (
        item.tipo !== "ropa" &&
        !tiposNoRopaUsados.has(item.tipo)
      );
    });
  }

  // Conserva la lógica de probabilidades por rareza que ya usa el cofre,
  // pero sin sacrificar las reglas estructurales del cofre de bienvenida.
  const ordenRarezas: Rareza[] = [];
  const copiaRarezas = crearMapaVacio();

  for (const rareza of rarezasPermitidas) {
    copiaRarezas[rareza] = [...porRareza[rareza]];
  }

  while (true) {
    const rareza = elegirRareza(copiaRarezas);
    if (!rareza) break;

    ordenRarezas.push(rareza);
    copiaRarezas[rareza] = [];
  }

  const resultado: RecompensaDisponible[] = [];

  for (const rareza of ordenRarezas) {
    resultado.push(...barajar(porRareza[rareza]));
  }

  return resultado;
}

function completarBienvenidaCinco(
  disponibles: Record<Rareza, RecompensaDisponible[]>
) {
  const legendariasRopa = barajar(
    disponibles.legendario.filter(
      (item) => item.tipo === "ropa"
    )
  );

  if (legendariasRopa.length === 0) {
    return [] as RecompensaDisponible[];
  }

  // En las posiciones 2-5 deben existir EXACTAMENTE otras dos prendas.
  // Se prueban las seis distribuciones posibles en orden aleatorio.
  const patronesRopa = barajar([
    [true, true, false, false],
    [true, false, true, false],
    [true, false, false, true],
    [false, true, true, false],
    [false, true, false, true],
    [false, false, true, true],
  ]);

  // Posiciones 2 y 3: hasta épico.
  // Posiciones 4 y 5: la calidad baja y queda como máximo en raro.
  const limites: Rareza[] = [
    "epico",
    "epico",
    "raro",
    "raro",
  ];

  function completarSlots(
    seleccionadas: RecompensaDisponible[],
    patron: boolean[],
    indiceSlot: number,
    idsUsados: Set<string>,
    tiposNoRopaUsados: Set<string>
  ): RecompensaDisponible[] | null {
    if (indiceSlot >= 4) {
      return seleccionadas;
    }

    const candidatas = candidatosSlotBienvenida({
      disponibles,
      rarezasPermitidas: rarezaHasta(limites[indiceSlot]),
      debeSerRopa: patron[indiceSlot],
      idsUsados,
      tiposNoRopaUsados,
    });

    for (const candidata of candidatas) {
      const nuevosIds = new Set(idsUsados);
      nuevosIds.add(candidata.id);

      const nuevosTipos = new Set(tiposNoRopaUsados);
      if (candidata.tipo !== "ropa") {
        nuevosTipos.add(candidata.tipo);
      }

      const resultado = completarSlots(
        [...seleccionadas, candidata],
        patron,
        indiceSlot + 1,
        nuevosIds,
        nuevosTipos
      );

      if (resultado) return resultado;
    }

    return null;
  }

  for (const primera of legendariasRopa) {
    for (const patron of patronesRopa) {
      const resultado = completarSlots(
        [primera],
        patron,
        0,
        new Set([primera.id]),
        new Set()
      );

      if (resultado?.length === 5) {
        return resultado;
      }
    }
  }

  // Fallback seguro para catálogos que todavía no tienen suficientes
  // categorías no-ropa desbloqueables. Conserva todas las reglas esenciales:
  // 1) la primera recompensa sigue siendo ropa legendaria;
  // 2) las otras cuatro no pueden ser legendarias;
  // 3) posiciones 2-3 llegan como máximo a épico;
  // 4) posiciones 4-5 llegan como máximo a raro;
  // 5) nunca se repite el mismo objeto.
  //
  // Primero se intenta SIEMPRE la composición diversa de tres prendas.
  // Solo si el catálogo no puede construirla se permite completar con ropa.
  const patronSoloRopa = [true, true, true, true];

  for (const primera of legendariasRopa) {
    const resultado = completarSlots(
      [primera],
      patronSoloRopa,
      0,
      new Set([primera.id]),
      new Set()
    );

    if (resultado?.length === 5) {
      return resultado;
    }
  }

  return [] as RecompensaDisponible[];
}

function bienvenidaCincoEsValida(
  recompensas: RecompensaDisponible[]
) {
  if (recompensas.length !== 5) return false;

  // 1) Primera recompensa: prenda legendaria obligatoria.
  if (
    recompensas[0]?.tipo !== "ropa" ||
    recompensas[0]?.rareza !== "legendario"
  ) {
    return false;
  }

  // 2) Después de la primera ya no puede salir ninguna legendaria.
  if (
    recompensas
      .slice(1)
      .some((item) => item.rareza === "legendario")
  ) {
    return false;
  }

  // 3) Recompensas 2 y 3: máximo épico.
  if (
    recompensas
      .slice(1, 3)
      .some(
        (item) =>
          ORDEN_RAREZA.indexOf(item.rareza) >
          ORDEN_RAREZA.indexOf("epico")
      )
  ) {
    return false;
  }

  // 4) Recompensas 4 y 5: máximo raro.
  if (
    recompensas
      .slice(3, 5)
      .some(
        (item) =>
          ORDEN_RAREZA.indexOf(item.rareza) >
          ORDEN_RAREZA.indexOf("raro")
      )
  ) {
    return false;
  }

  // 5) Si hay recompensas no-ropa, cada categoría distinta de ropa
  // puede aparecer como máximo una vez. No se exige una cantidad fija
  // de prendas porque el catálogo puede estar en una etapa donde todavía
  // no existan suficientes categorías no-ropa desbloqueables.
  const tiposNoRopa = recompensas
    .filter((item) => item.tipo !== "ropa")
    .map((item) => item.tipo);

  if (new Set(tiposNoRopa).size !== tiposNoRopa.length) {
    return false;
  }

  // 7) Nunca repetir exactamente el mismo objeto.
  const ids = recompensas.map((item) => item.id);
  return new Set(ids).size === ids.length;
}

function canonizarBienvenidaCinco(
  historicas: any[],
  catalogo: ReturnType<typeof crearCatalogoActual>
) {
  const resueltas: RecompensaDisponible[] = [];
  const ids = new Set<string>();

  for (const historica of historicas.slice(0, 5)) {
    const actual = resolverRecompensaHistorica(
      historica,
      catalogo
    );

    if (!actual || ids.has(actual.id)) {
      return [] as RecompensaDisponible[];
    }

    resueltas.push(actual);
    ids.add(actual.id);
  }

  return bienvenidaCincoEsValida(resueltas)
    ? resueltas
    : [];
}

function completarSeleccion(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  iniciales: RecompensaDisponible[],
  tipoCofre: "bienvenida" | "nivel"
) {
  let seleccionadas = [...iniciales].slice(0, 3);

  // Corrige cofres históricos que contenían dos cabellos/lentes/etc.
  const tiposVistos = new Set<string>();

  seleccionadas = seleccionadas.filter((item) => {
    if (item.tipo === "ropa") return true;
    if (tiposVistos.has(item.tipo)) return false;

    tiposVistos.add(item.tipo);
    return true;
  });

  // Si una bienvenida histórica ya traía tres objetos pero ninguno era
  // legendario, liberamos un espacio ANTES de retirar las selecciones del
  // catálogo disponible.
  if (
    tipoCofre === "bienvenida" &&
    !seleccionadas.some((item) => item.rareza === "legendario") &&
    seleccionadas.length >= 3
  ) {
    seleccionadas = seleccionadas.slice(0, 2);
  }

  quitarSeleccionadas(disponibles, seleccionadas);

  // La bienvenida conserva la regla existente: una recompensa legendaria
  // siempre que el catálogo actual tenga alguna disponible.
  if (
    tipoCofre === "bienvenida" &&
    !seleccionadas.some((item) => item.rareza === "legendario")
  ) {
    const tiposUsados = obtenerTiposUsados(seleccionadas);
    const permitidas = disponiblesRespetandoTipos(
      disponibles,
      tiposUsados
    );
    const legendaria = extraerAleatoria(
      permitidas,
      "legendario"
    );

    if (legendaria) {
      seleccionadas.push(legendaria);
      retirarDelMapaPrincipal(disponibles, legendaria);
    }
  }

  while (seleccionadas.length < 3) {
    const tiposUsados = obtenerTiposUsados(seleccionadas);
    const permitidas = disponiblesRespetandoTipos(
      disponibles,
      tiposUsados
    );
    const rareza = elegirRareza(permitidas);

    if (!rareza) break;

    const item = extraerAleatoria(permitidas, rareza);
    if (!item) break;

    seleccionadas.push(item);
    retirarDelMapaPrincipal(disponibles, item);
  }

  return seleccionadas;
}

function obtenerRarezaMaxima(
  recompensas: RecompensaDisponible[]
): Rareza {
  if (recompensas.length === 0) return "comun";

  return recompensas.reduce<Rareza>((maxima, actual) => {
    return ORDEN_RAREZA.indexOf(actual.rareza) >
      ORDEN_RAREZA.indexOf(maxima)
      ? actual.rareza
      : maxima;
  }, "comun");
}

async function registrarDesbloqueos(
  admin: any,
  userId: string,
  recompensas: RecompensaDisponible[]
) {
  if (recompensas.length === 0) return;

  const fecha = new Date().toISOString();

  const registros = recompensas.map((item) => ({
    user_id: userId,
    tipo: item.tipo,
    // Desde ahora el inventario guarda el ID canónico del catálogo V2.
    // El editor mantiene compatibilidad de lectura con nombres antiguos.
    nombre: item.id,
    rareza: item.rareza,
    fecha_desbloqueo: fecha,
  }));

  const { error } = await admin
    .from("recompensas_usuario")
    .upsert(registros, {
      onConflict: "user_id,nombre",
      ignoreDuplicates: true,
    });

  if (error) throw error;
}

function canonizarHistoricas(
  recompensas: any[],
  catalogo: ReturnType<typeof crearCatalogoActual>
) {
  const resultado: RecompensaDisponible[] = [];
  const ids = new Set<string>();
  const tipos = new Set<string>();

  for (const historica of recompensas) {
    const actual = resolverRecompensaHistorica(
      historica,
      catalogo
    );

    // Si el objeto ya no existe en elementos_avatar_nuevo, se descarta.
    if (!actual || ids.has(actual.id)) continue;

    if (actual.tipo !== "ropa" && tipos.has(actual.tipo)) {
      continue;
    }

    resultado.push(actual);
    ids.add(actual.id);

    if (actual.tipo !== "ropa") {
      tipos.add(actual.tipo);
    }

    if (resultado.length >= 3) break;
  }

  return resultado;
}

async function repararCofreExistente({
  admin,
  existente,
  userId,
  tipo,
  catalogo,
  inventario,
}: {
  admin: any;
  existente: { id: string; recompensas: any };
  userId: string;
  tipo: "bienvenida" | "nivel";
  catalogo: ReturnType<typeof crearCatalogoActual>;
  inventario: Set<string>;
}) {
  const historicas = Array.isArray(existente.recompensas)
    ? existente.recompensas
    : [];

  // Un cofre histórico vacío sigue siendo un bloqueo histórico explícito.
  if (historicas.length === 0) {
    return {
      recompensas: [] as RecompensaDisponible[],
      bloqueadoHistorico: true,
    };
  }

  // Los cofres de bienvenida nuevos guardan cinco recompensas.
  // Si ya cumplen todas las reglas, se conservan exactamente.
  if (tipo === "bienvenida" && historicas.length >= 5) {
    const validasCinco = canonizarBienvenidaCinco(
      historicas,
      catalogo
    );

    if (validasCinco.length === 5) {
      await registrarDesbloqueos(
        admin,
        userId,
        validasCinco
      );

      return {
        recompensas: validasCinco,
        bloqueadoHistorico: false,
      };
    }

    // Si un futuro cambio del catálogo vuelve inválido un cofre nuevo,
    // se reconstruye respetando nuevamente las cinco reglas.
    const historicasResueltas = historicas
      .map((item) =>
        resolverRecompensaHistorica(item, catalogo)
      )
      .filter(
        (item): item is RecompensaDisponible => Boolean(item)
      );

    const permitirIds = new Set(
      historicasResueltas.map((item) => item.id)
    );

    const disponiblesCinco = crearDisponibles(
      catalogo,
      inventario,
      permitirIds
    );

    const reparadasCinco = completarBienvenidaCinco(
      disponiblesCinco
    );

    if (reparadasCinco.length === 5) {
      const { error: errorActualizarCinco } = await admin
        .from("cofres_reclamados")
        .update({ recompensas: reparadasCinco })
        .eq("id", existente.id);

      if (errorActualizarCinco) {
        throw errorActualizarCinco;
      }

      await registrarDesbloqueos(
        admin,
        userId,
        reparadasCinco
      );

      return {
        recompensas: reparadasCinco,
        bloqueadoHistorico: false,
      };
    }
  }

  // Los cofres de bienvenida antiguos de tres objetos se conservan como
  // históricos: no se agregan dos recompensas retroactivamente.
  const validas = canonizarHistoricas(
    historicas,
    catalogo
  );
  const permitirIds = new Set(validas.map((item) => item.id));
  const disponibles = crearDisponibles(
    catalogo,
    inventario,
    permitirIds
  );

  const reparadas = completarSeleccion(
    disponibles,
    validas,
    tipo
  );

  if (reparadas.length > 0) {
    const { error: errorActualizar } = await admin
      .from("cofres_reclamados")
      .update({ recompensas: reparadas })
      .eq("id", existente.id);

    if (errorActualizar) throw errorActualizar;

    await registrarDesbloqueos(
      admin,
      userId,
      reparadas
    );
  }

  return {
    recompensas: reparadas,
    bloqueadoHistorico: reparadas.length === 0,
  };
}

export async function GET(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const authorization = req.headers.get("authorization");
    const bearerToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : null;

    let user: { id: string } | null = null;
    let authError: any = null;

    if (bearerToken) {
      const resultadoAuth = await admin.auth.getUser(bearerToken);

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    } else {
      const cookieStore = await cookies();

      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(
                  ({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                  }
                );
              } catch {}
            },
          },
        }
      );

      const resultadoAuth = await supabaseAuth.auth.getUser();

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const tipo = new URL(req.url).searchParams.get("tipo");

    if (tipo !== "bienvenida") {
      return NextResponse.json(
        { error: "Tipo de cofre no válido" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("cofres_reclamados")
      .select("id")
      .eq("user_id", user.id)
      .eq("tipo", "bienvenida")
      .is("nivel", null)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      reclamado: Boolean(data?.id),
    });
  } catch (error: any) {
    console.error("Error consultando cofre de bienvenida:", error);

    return NextResponse.json(
      { error: "No se pudo consultar el cofre de bienvenida" },
      { status: 500 }
    );
  }
}export async function POST(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const authorization = req.headers.get("authorization");
    const bearerToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : null;

    let user: { id: string } | null = null;
    let authError: any = null;

    if (bearerToken) {
      const resultadoAuth = await admin.auth.getUser(bearerToken);

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    } else {
      const cookieStore = await cookies();

      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(
                  ({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                  }
                );
              } catch {}
            },
          },
        }
      );

      const resultadoAuth = await supabaseAuth.auth.getUser();

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const tipo =
      body?.tipo === "bienvenida"
        ? "bienvenida"
        : body?.tipo === "nivel"
          ? "nivel"
          : null;

    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo de cofre no válido" },
        { status: 400 }
      );
    }

    const { data: perfilRaw, error: perfilError } = await admin
      .from("usuarios")
      .select("rol,nivel,tutorial_visto,avatar_config")
      .eq("id", user.id)
      .single();

    if (perfilError || !perfilRaw) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const perfil = perfilRaw as PerfilCofre;

    if (perfil.rol !== "estudiante") {
      return NextResponse.json(
        { error: "Los cofres sólo aplican a estudiantes" },
        { status: 403 }
      );
    }

    const nivelActual = Number(perfil.nivel ?? 0);

    // El cofre de bienvenida es independiente del tutorial.
    // En móvil puede reclamarse antes del recorrido de PC y la unicidad
    // de cofres_reclamados evita que vuelva a entregarse.

    if (tipo === "nivel" && nivelActual < 1) {
      return NextResponse.json(
        { error: "No hay un cofre de nivel disponible" },
        { status: 403 }
      );
    }

    const genero = obtenerGenero(perfil);
    const catalogo = crearCatalogoActual(genero);

    const { data: desbloqueadas, error: errorDesbloqueadas } =
      await admin
        .from("recompensas_usuario")
        .select("nombre")
        .eq("user_id", user.id);

    if (errorDesbloqueadas) {
      throw errorDesbloqueadas;
    }

    const inventario = new Set(
      (desbloqueadas ?? [])
        .map((item: any) => normalizarClave(item.nombre))
        .filter(Boolean)
    );

    let consultaExistente = admin
      .from("cofres_reclamados")
      .select("id,recompensas")
      .eq("user_id", user.id)
      .eq("tipo", tipo);

    if (tipo === "nivel") {
      consultaExistente = consultaExistente.eq(
        "nivel",
        nivelActual
      );
    } else {
      consultaExistente = consultaExistente.is(
        "nivel",
        null
      );
    }

    const { data: existente, error: errorExistente } =
      await consultaExistente.maybeSingle();

    if (errorExistente) {
      throw errorExistente;
    }

    if (existente) {
      const reparado = await repararCofreExistente({
        admin,
        existente: existente as {
          id: string;
          recompensas: any;
        },
        userId: user.id,
        tipo,
        catalogo,
        inventario,
      });

      return NextResponse.json({
        rareza: obtenerRarezaMaxima(
          reparado.recompensas
        ),
        recompensas: reparado.recompensas,
        ya_reclamado: true,
        bloqueado_historico:
          reparado.bloqueadoHistorico,
      });
    }

    const disponibles = crearDisponibles(
      catalogo,
      inventario
    );

    const totalDisponibles = ORDEN_RAREZA.reduce(
      (total, rareza) =>
        total + disponibles[rareza].length,
      0
    );

    if (totalDisponibles === 0) {
      return NextResponse.json({
        rareza: "comun" as Rareza,
        recompensas: [],
        ya_reclamado: false,
        agotado: true,
      });
    }

    // Bienvenida y nivel comparten el mismo patrón de tres intentos:
    // 1) Legendario con descenso.
    // 2) 50/50 Épico/Raro y después Común.
    // 3) 50/50 Raro/Común.
    // Ropa puede repetirse como categoría; las demás categorías, máximo una.
    const seleccionadas = seleccionarTresPorRondas(disponibles);

    if (seleccionadas.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se pudieron seleccionar recompensas para el cofre",
          codigo: "COFRE_SIN_SELECCION",
        },
        { status: 409 }
      );
    }

    const registroCofre = {
      user_id: user.id,
      tipo,
      nivel:
        tipo === "nivel"
          ? nivelActual
          : null,
      recompensas: seleccionadas,
    };

    const { error: errorCofre } = await admin
      .from("cofres_reclamados")
      .insert(registroCofre);

    if (errorCofre) {
      if (errorCofre.code === "23505") {
        let repetido = admin
          .from("cofres_reclamados")
          .select("id,recompensas")
          .eq("user_id", user.id)
          .eq("tipo", tipo);

        repetido =
          tipo === "nivel"
            ? repetido.eq("nivel", nivelActual)
            : repetido.is("nivel", null);

        const {
          data: dataRepetido,
          error: errorRepetido,
        } = await repetido.maybeSingle();

        if (errorRepetido) {
          throw errorRepetido;
        }

        if (dataRepetido) {
          const reparado = await repararCofreExistente({
            admin,
            existente: dataRepetido as {
              id: string;
              recompensas: any;
            },
            userId: user.id,
            tipo,
            catalogo,
            inventario,
          });

          return NextResponse.json({
            rareza: obtenerRarezaMaxima(
              reparado.recompensas
            ),
            recompensas: reparado.recompensas,
            ya_reclamado: true,
            bloqueado_historico:
              reparado.bloqueadoHistorico,
          });
        }
      }

      throw errorCofre;
    }

    try {
      await registrarDesbloqueos(
        admin,
        user.id,
        seleccionadas
      );
    } catch (errorRecompensas) {
      let limpiezaCofre = admin
        .from("cofres_reclamados")
        .delete()
        .eq("user_id", user.id)
        .eq("tipo", tipo);

      limpiezaCofre =
        tipo === "nivel"
          ? limpiezaCofre.eq("nivel", nivelActual)
          : limpiezaCofre.is("nivel", null);

      await limpiezaCofre;
      throw errorRecompensas;
    }

    return NextResponse.json({
      rareza: obtenerRarezaMaxima(seleccionadas),
      recompensas: seleccionadas,
      ya_reclamado: false,
      agotado: false,
    });
  } catch (error: any) {
    console.error("Error reclamando cofre:", error);

    const detalle =
      typeof error?.message === "string"
        ? error.message
        : undefined;

    return NextResponse.json(
      {
        error: "No se pudo reclamar el cofre",
        codigo: "COFRE_ERROR_INTERNO",
        ...(process.env.NODE_ENV === "development" && detalle
          ? { detalle }
          : {}),
      },
      { status: 500 }
    );
  }
}
