import type {
  GeneroAvatar,
  ItemCatalogoAvatar,
} from "@/lib/avatarCatalogo";
import {
  obtenerColoresPielAvatar,
  obtenerEstudiantePersonalizadoAvatar,
  obtenerExpresionEstudiantePersonalizadoPorId,
  obtenerItemAvatarPorId,
  obtenerItemEstudiantePersonalizadoPorId,
  obtenerTodosItemsEstudianteAvatar,
  obtenerProfesorAvatar,
  obtenerExpresionProfesorPersonalizadoPorId,
  obtenerItemProfesorPersonalizadoPorId,
  obtenerRopaProfesorPersonalizado,
} from "@/lib/avatarCatalogo";

/**
 * Configuración V2 definitiva de FCC Academy.
 *
 * No reconoce ni convierte configuraciones antiguas.
 * Si Supabase contiene el formato viejo, se trata como configuración ausente
 * hasta que el usuario guarde una configuración V2 válida.
 */
export type AvatarConfigV2 = {
  version: 2;

  /**
   * standard: cuerpo configurable normal.
   * custom: Cuerpo.png + al menos una expresión real detectados desde el catálogo.
   *
   * Las configuraciones V2 creadas antes de este campo se interpretan
   * automáticamente como standard.
   */
  mode?: "standard" | "custom";

  /**
   * Llave del usuario personalizado dentro del catálogo (correo normalizado).
   * Solo existe cuando mode === "custom".
   */
  customKey?: string | null;

  /**
   * Distingue de qué catálogo proviene un avatar custom.
   *
   * Configuraciones custom creadas antes de este campo se interpretan
   * como estudiante para conservar compatibilidad con el flujo ya aprobado.
   */
  customRole?: "estudiante" | "profesor" | null;

  /**
   * En estudiantes estándar lo elige el usuario.
   * En avatares personalizados/profesores se fuerza al género definido
   * por la carpeta del catálogo.
   */
  gender: GeneroAvatar;

  /**
   * Solo aplica al cuerpo configurable del estudiante estándar.
   */
  skinColor: string | null;

  /**
   * Una selección por slot visual.
   *
   * Ejemplos:
   * cabello
   * ojos
   * ropa/base
   * ropa/playeras
   * ropa/sueteres
   * accesorios/lentes
   */
  selections: Record<string, string>;

  /**
   * Colores elegidos para elementos Relleno + Contorno.
   * La llave es el ID canónico del elemento.
   */
  colors: Record<string, string>;

  /**
   * Opción elegida para elementos que sustituyen el PNG completo.
   *
   * Ejemplo:
   * ropa/prendas_unicas/SudaderaBUAP -> azul
   */
  imageVariants: Record<string, string>;

  /**
   * Expresión/cabeza seleccionada para profesor o estudiante personalizado.
   */
  expression: string | null;
};

export function obtenerSlotItemAvatar(
  item: Pick<ItemCatalogoAvatar, "section" | "subsection">
) {
  return item.subsection
    ? `${item.section}/${item.subsection}`
    : item.section;
}

export function crearAvatarConfigV2(
  gender: GeneroAvatar = "masculino"
): AvatarConfigV2 {
  const tonos = obtenerColoresPielAvatar();

  return {
    version: 2,
    mode: "standard",
    customKey: null,
    customRole: null,
    gender,
    skinColor: tonos[0] ?? null,
    selections: {},
    colors: {},
    imageVariants: {},
    expression: null,
  };
}

const ITEMS_BASE_ESTUDIANTE: Array<{
  slot: string;
  id: string;
}> = [
  { slot: "cabello", id: "cabello/Cabello1" },
  { slot: "ojos", id: "ojos/Ojos1" },
];

/**
 * Avatar base de un estudiante antes de personalizarlo.
 *
 * Nariz y boca ya no son piezas editables: forman parte de Cara.png.
 * La ropa NO se guarda como seleccion inicial: mientras no exista una
 * seleccion real de ropa, el renderizador muestra exclusivamente Cuerpo.
 * El editor puede remarcar visualmente su primera prenda sin persistirla.
 */
export function crearAvatarConfigInicialEstudiante(
  gender: GeneroAvatar = "masculino"
): AvatarConfigV2 {
  let config = crearAvatarConfigV2(gender);

  for (const base of ITEMS_BASE_ESTUDIANTE) {
    const item = obtenerItemAvatarPorId(base.id);

    if (!item || obtenerSlotItemAvatar(item) !== base.slot) {
      console.warn(
        `[FCC Academy] Falta elemento base del avatar: ${base.id}`
      );
      continue;
    }

    config = seleccionarItemAvatarV2(config, item);
  }

  return config;
}



export function esAvatarConfigPersonalizadoV2(
  value: unknown
): value is AvatarConfigV2 {
  if (!esAvatarConfigV2(value)) return false;

  const raw = value as AvatarConfigV2;

  return (
    raw.mode === "custom" &&
    typeof raw.customKey === "string" &&
    raw.customKey.length > 0
  );
}

export function crearAvatarConfigPersonalizadoEstudiante(
  email: string | null | undefined,
  actual?: AvatarConfigV2 | null
): AvatarConfigV2 | null {
  const usuario = obtenerEstudiantePersonalizadoAvatar(email);
  if (!usuario?.body || usuario.expressions.length === 0) return null;

  const key = usuario.email.trim().toLowerCase();

  if (
    actual &&
    esAvatarConfigPersonalizadoV2(actual) &&
    actual.customRole !== "profesor" &&
    actual.customKey?.trim().toLowerCase() === key
  ) {
    return limpiarAvatarConfigV2({
      ...actual,
      mode: "custom",
      customKey: key,
      customRole: "estudiante",
      gender: usuario.gender,
      skinColor: null,
      expression:
        obtenerExpresionEstudiantePersonalizadoPorId(
          key,
          actual.expression
        )?.id ??
        usuario.expressions[0]?.id ??
        null,
    });
  }

  return {
    version: 2,
    mode: "custom",
    customKey: key,
    customRole: "estudiante",
    gender: usuario.gender,
    skinColor: null,
    selections: {},
    colors: {},
    imageVariants: {},
    expression: usuario.expressions[0]?.id ?? null,
  };
}


export function crearAvatarConfigPersonalizadoProfesor(
  email: string | null | undefined,
  actual?: AvatarConfigV2 | null
): AvatarConfigV2 | null {
  const usuario = obtenerProfesorAvatar(email);
  if (!usuario?.body || usuario.expressions.length === 0) {
    return null;
  }

  const key = usuario.email.trim().toLowerCase();

  if (
    actual &&
    esAvatarConfigPersonalizadoV2(actual) &&
    actual.customRole === "profesor" &&
    actual.customKey?.trim().toLowerCase() === key
  ) {
    return limpiarAvatarConfigV2({
      ...actual,
      mode: "custom",
      customKey: key,
      customRole: "profesor",
      gender: usuario.gender,
      skinColor: null,
      expression:
        obtenerExpresionProfesorPersonalizadoPorId(
          key,
          actual.expression
        )?.id ??
        usuario.expressions[0]?.id ??
        null,
    });
  }

  return {
    version: 2,
    mode: "custom",
    customKey: key,
    customRole: "profesor",
    gender: usuario.gender,
    skinColor: null,
    selections: {},
    colors: {},
    imageVariants: {},
    expression: usuario.expressions[0]?.id ?? null,
  };
}

/**
 * Garantiza que un profesor que YA tenia una configuracion V2 guardada
 * nunca vuelva al estado visual basado en Cuerpo.png.
 *
 * Si no hay ropa seleccionada, equipa la primera prenda disponible y
 * prioriza una variante llamada "Blanca". Para una cuenta realmente nueva,
 * este helper no se aplica hasta que exista avatar_config V2 en Supabase.
 */
export function completarRopaInicialAvatarProfesor(
  config: AvatarConfigV2,
  email?: string | null
): AvatarConfigV2 {
  const limpia = limpiarAvatarConfigV2(config);

  if (
    !esAvatarConfigPersonalizadoV2(limpia) ||
    limpia.customRole !== "profesor" ||
    Object.keys(limpia.selections).some((slot) =>
      slot.startsWith("ropa/")
    )
  ) {
    return limpia;
  }

  const clave = email ?? limpia.customKey;

  const items = obtenerRopaProfesorPersonalizado(clave)
    .flatMap((subseccion) => subseccion.items);

  if (items.length === 0) {
    return limpia;
  }

  const esOpcionBlanca = (value: string) =>
    value.trim().toLowerCase() === "blanca";

  const prendaConBlanca =
    items.find((item) => {
      if (
        item.customization.type !==
        "image_variants"
      ) {
        return false;
      }

      return item.customization.options.some(
        (option) =>
          esOpcionBlanca(option.key) ||
          esOpcionBlanca(option.label)
      );
    }) ?? items[0];

  let siguiente = seleccionarItemAvatarV2(
    limpia,
    prendaConBlanca
  );

  if (
    prendaConBlanca.customization.type ===
    "image_variants"
  ) {
    const blanca =
      prendaConBlanca.customization.options.find(
        (option) =>
          esOpcionBlanca(option.key) ||
          esOpcionBlanca(option.label)
      );

    if (blanca) {
      siguiente =
        establecerVarianteImagenAvatarV2(
          siguiente,
          prendaConBlanca,
          blanca.key
        );
    }
  }

  return limpiarAvatarConfigV2(siguiente);
}

export function resolverAvatarConfigProfesorParaCuenta(
  email: string | null | undefined,
  actual: unknown
): AvatarConfigV2 | null {
  const usuario = obtenerProfesorAvatar(email);

  if (!usuario?.body || usuario.expressions.length === 0) {
    return null;
  }

  const actualV2 = esAvatarConfigV2(actual)
    ? actual
    : null;

  const config =
    crearAvatarConfigPersonalizadoProfesor(
      email,
      actualV2
    );

  if (!config) {
    return null;
  }

  // Primera entrada real: no habia avatar_config V2 y se conserva Cuerpo.png.
  // En cuanto esa configuracion ya existe en BD, Blanca pasa a ser la ropa
  // obligatoria de respaldo y Cuerpo.png deja de participar visualmente.
  return actualV2
    ? completarRopaInicialAvatarProfesor(
        config,
        email
      )
    : config;
}

export function resolverAvatarConfigEstudianteParaCuenta(
  email: string | null | undefined,
  actual: unknown,
  generoFallback: GeneroAvatar
): AvatarConfigV2 {
  const usuarioPersonalizado =
    obtenerEstudiantePersonalizadoAvatar(email);

  if (usuarioPersonalizado?.body && usuarioPersonalizado.expressions.length > 0) {
    const actualV2 = esAvatarConfigV2(actual)
      ? actual
      : null;

    const configPersonalizada =
      crearAvatarConfigPersonalizadoEstudiante(
        email,
        actualV2
      );

    if (!configPersonalizada) {
      return crearAvatarConfigInicialEstudiante(
        generoFallback
      );
    }

    // Mientras no exista una seleccion REAL de ropa, Cuerpo sigue siendo
    // la capa visible. El editor solo remarca visualmente la primera prenda.
    return configPersonalizada;
  }

  if (
    esAvatarConfigV2(actual) &&
    !esAvatarConfigPersonalizadoV2(actual)
  ) {
    return completarAvatarConfigBaseEstudiante(actual);
  }

  return crearAvatarConfigInicialEstudiante(generoFallback);
}

export function establecerExpresionAvatarV2(
  config: AvatarConfigV2,
  expressionId: string | null
): AvatarConfigV2 {
  return {
    ...config,
    expression: expressionId,
  };
}

function itemDisponibleParaGenero(
  item: ItemCatalogoAvatar,
  gender: GeneroAvatar
) {
  if (item.customization.type === "image_variants") {
    return item.customization.options.some((option) =>
      Boolean(option.variants[gender] ?? option.variants.universal)
    );
  }

  return Boolean(item.variants[gender] ?? item.variants.universal);
}

function obtenerVarianteGlobalCabello(
  config: AvatarConfigV2
) {
  const cabelloActualId =
    config.selections.cabello ?? null;

  if (cabelloActualId) {
    const actual = config.imageVariants[cabelloActualId];
    if (typeof actual === "string" && actual) {
      return actual;
    }
  }

  for (const [itemId, optionKey] of Object.entries(
    config.imageVariants
  )) {
    if (
      itemId.startsWith("cabello/") &&
      typeof optionKey === "string" &&
      optionKey
    ) {
      return optionKey;
    }
  }

  return null;
}

/**
 * Garantiza los rasgos editables obligatorios.
 * Nariz y boca ya no son slots editables y cualquier selección antigua se limpia
 * automáticamente al no existir en el catálogo. Si todavía no hay ropa
 * seleccionada, se conserva ese estado para que Cuerpo siga siendo visible.
 */
export function completarAvatarConfigBaseEstudiante(
  config: AvatarConfigV2
): AvatarConfigV2 {
  if (esAvatarConfigPersonalizadoV2(config)) {
    return limpiarAvatarConfigV2(config);
  }

  let siguiente = limpiarAvatarConfigV2(config);
  const base = crearAvatarConfigInicialEstudiante(
    siguiente.gender
  );

  for (const slot of ["cabello", "ojos"]) {
    const actualId = siguiente.selections[slot];
    const actual = actualId
      ? obtenerItemAvatarPorId(actualId)
      : null;

    if (
      actual &&
      obtenerSlotItemAvatar(actual) === slot &&
      itemDisponibleParaGenero(
        actual,
        siguiente.gender
      )
    ) {
      continue;
    }

    const baseId = base.selections[slot];
    const reemplazo = baseId
      ? obtenerItemAvatarPorId(baseId)
      : null;

    if (reemplazo) {
      siguiente = seleccionarItemAvatarV2(
        siguiente,
        reemplazo
      );
    }
  }

  const prendasSeleccionadas = Object.entries(
    siguiente.selections
  ).filter(([slot]) => slot.startsWith("ropa/"));

  if (prendasSeleccionadas.length > 1) {
    // Configuraciones anteriores podían conservar ropa/base debajo de otra
    // prenda. Se privilegia una prenda exterior y se deja solo una.
    const conservar =
      prendasSeleccionadas.find(
        ([slot]) => slot !== "ropa/base"
      ) ?? prendasSeleccionadas[0];

    for (const [slot] of prendasSeleccionadas) {
      if (slot !== conservar?.[0]) {
        siguiente = quitarSeleccionAvatarV2(
          siguiente,
          slot
        );
      }
    }
  }

  return siguiente;
}

export function esAvatarConfigV2(
  value: unknown
): value is AvatarConfigV2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as Record<string, unknown>;

  return (
    raw.version === 2 &&
    (raw.mode === undefined ||
      raw.mode === "standard" ||
      raw.mode === "custom") &&
    (raw.customKey === undefined ||
      raw.customKey === null ||
      typeof raw.customKey === "string") &&
    (raw.customRole === undefined ||
      raw.customRole === null ||
      raw.customRole === "estudiante" ||
      raw.customRole === "profesor") &&
    (raw.gender === "masculino" ||
      raw.gender === "femenino") &&
    (raw.skinColor === null ||
      typeof raw.skinColor === "string") &&
    !!raw.selections &&
    typeof raw.selections === "object" &&
    !!raw.colors &&
    typeof raw.colors === "object" &&
    !!raw.imageVariants &&
    typeof raw.imageVariants === "object" &&
    (raw.expression === null ||
      typeof raw.expression === "string")
  );
}

/**
 * No migra IDs históricos.
 *
 * Solo elimina referencias que ya no existen en el catálogo actual.
 * Esto permite borrar/renombrar PNG o carpetas sin provocar que el
 * renderizador intente precargar una ruta inexistente.
 */
export function limpiarAvatarConfigV2(
  config: AvatarConfigV2
): AvatarConfigV2 {
  const customKey =
    config.mode === "custom" &&
    typeof config.customKey === "string"
      ? config.customKey.trim().toLowerCase()
      : null;

  const customRole =
    config.mode === "custom" && config.customRole === "profesor"
      ? "profesor"
      : config.mode === "custom"
        ? "estudiante"
        : null;

  const usuarioPersonalizado = customKey
    ? customRole === "profesor"
      ? obtenerProfesorAvatar(customKey)
      : obtenerEstudiantePersonalizadoAvatar(customKey)
    : null;

  const esPersonalizado = Boolean(
    customKey &&
      customRole &&
      usuarioPersonalizado?.body &&
      usuarioPersonalizado.expressions.length > 0
  );

  const resolverItem = (id: string) =>
    esPersonalizado
      ? customRole === "profesor"
        ? obtenerItemProfesorPersonalizadoPorId(customKey, id)
        : obtenerItemEstudiantePersonalizadoPorId(customKey, id)
      : obtenerItemAvatarPorId(id);

  const selections: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const imageVariants: Record<string, string> = {};

  for (const [slot, itemId] of Object.entries(
    config.selections
  )) {
    const item = resolverItem(itemId);
    if (!item) continue;

    if (obtenerSlotItemAvatar(item) !== slot) {
      continue;
    }

    if (esPersonalizado) {
      if (
        item.section !== "ropa" &&
        item.section !== "accesorios"
      ) {
        continue;
      }

    }

    selections[slot] = itemId;

    if (
      item.customization.type === "tint" &&
      typeof config.colors[itemId] === "string"
    ) {
      const color = config.colors[itemId].toLowerCase();

      if (
        item.customization.colors.length === 0 ||
        item.customization.colors.includes(color)
      ) {
        colors[itemId] = color;
      }
    }

    if (item.customization.type === "image_variants") {
      const requested = config.imageVariants[itemId];

      const valid =
        item.customization.options.find(
          (option) => option.key === requested
        ) ??
        item.customization.options.find(
          (option) =>
            option.key ===
            item.customization.defaultOption
        ) ??
        item.customization.options[0];

      if (valid) {
        imageVariants[itemId] = valid.key;
      }
    }
  }

  if (esPersonalizado) {
    const expression =
      (customRole === "profesor"
        ? obtenerExpresionProfesorPersonalizadoPorId(
            customKey,
            config.expression
          )
        : obtenerExpresionEstudiantePersonalizadoPorId(
            customKey,
            config.expression
          )) ??
      usuarioPersonalizado!.expressions[0] ??
      null;

    return {
      version: 2,
      mode: "custom",
      customKey,
      customRole,
      gender: usuarioPersonalizado!.gender,
      skinColor: null,
      selections,
      colors,
      imageVariants,
      expression: expression?.id ?? null,
    };
  }

  const tonos = obtenerColoresPielAvatar();

  const skinColor =
    config.skinColor &&
    (tonos.length === 0 ||
      tonos.includes(config.skinColor.toLowerCase()))
      ? config.skinColor.toLowerCase()
      : tonos[0] ?? null;

  return {
    version: 2,
    mode: "standard",
    customKey: null,
    customRole: null,
    gender: config.gender,
    skinColor,
    selections,
    colors,
    imageVariants,
    expression: null,
  };
}

export function seleccionarItemAvatarV2(
  config: AvatarConfigV2,
  item: ItemCatalogoAvatar
): AvatarConfigV2 {
  const slot = obtenerSlotItemAvatar(item);

  const siguiente: AvatarConfigV2 = {
    ...config,
    selections: {
      ...config.selections,
      [slot]: item.id,
    },
    colors: {
      ...config.colors,
    },
    imageVariants: {
      ...config.imageVariants,
    },
  };

  if (item.customization.type === "tint") {
    const colorActual =
      siguiente.colors[item.id];

    if (
      !colorActual ||
      (item.customization.colors.length > 0 &&
        !item.customization.colors.includes(
          colorActual.toLowerCase()
        ))
    ) {
      siguiente.colors[item.id] =
        item.customization.colors[0] ??
        "#ffffff";
    }
  }

  if (
    item.customization.type ===
    "image_variants"
  ) {
    const actual =
      siguiente.imageVariants[item.id];

    const varianteGlobalCabello =
      slot === "cabello"
        ? obtenerVarianteGlobalCabello(config)
        : null;

    const preferida =
      varianteGlobalCabello &&
      item.customization.options.some(
        (option) => option.key === varianteGlobalCabello
      )
        ? varianteGlobalCabello
        : actual;

    const sigueExistiendo =
      item.customization.options.some(
        (option) => option.key === preferida
      );

    if (!sigueExistiendo) {
      siguiente.imageVariants[item.id] =
        item.customization.defaultOption ??
        item.customization.options[0]?.key ??
        "";
    } else if (preferida) {
      siguiente.imageVariants[item.id] = preferida;
    }
  }

  return siguiente;
}

export function quitarSeleccionAvatarV2(
  config: AvatarConfigV2,
  slot: string
): AvatarConfigV2 {
  const itemId = config.selections[slot];

  const selections = {
    ...config.selections,
  };

  delete selections[slot];

  const colors = {
    ...config.colors,
  };

  const imageVariants = {
    ...config.imageVariants,
  };

  if (itemId) {
    delete colors[itemId];
    delete imageVariants[itemId];
  }

  return {
    ...config,
    selections,
    colors,
    imageVariants,
  };
}

export function establecerColorItemAvatarV2(
  config: AvatarConfigV2,
  item: ItemCatalogoAvatar,
  color: string
): AvatarConfigV2 {
  if (item.customization.type !== "tint") {
    return config;
  }

  const normalizado = color.toLowerCase();

  if (
    item.customization.colors.length > 0 &&
    !item.customization.colors.includes(
      normalizado
    )
  ) {
    return config;
  }

  return {
    ...config,
    colors: {
      ...config.colors,
      [item.id]: normalizado,
    },
  };
}

export function establecerVarianteImagenAvatarV2(
  config: AvatarConfigV2,
  item: ItemCatalogoAvatar,
  optionKey: string
): AvatarConfigV2 {
  if (
    item.customization.type !==
    "image_variants"
  ) {
    return config;
  }

  if (
    !item.customization.options.some(
      (option) => option.key === optionKey
    )
  ) {
    return config;
  }

  return {
    ...config,
    imageVariants: {
      ...config.imageVariants,
      [item.id]: optionKey,
    },
  };
}
