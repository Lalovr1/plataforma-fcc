/**
 * Editor exclusivo para estudiantes con Cuerpo.png y expresiones propias.
 *
 * No comparte inventario/cofres con el editor estándar. Cuerpo.png se usa
 * mientras no exista una selección real de Ropa; luego la prenda la sustituye.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RenderizadorAvatar, {
  type AvatarConfig,
  prepararRecursosAvatarFCC,
} from "@/components/RenderizadorAvatar";
import CargadorFCC from "@/components/CargadorFCC";
import { obtenerUrlImagenOptimizada } from "@/lib/imagenes";
import {
  crearAvatarConfigPersonalizadoEstudiante,
  esAvatarConfigV2,
  establecerColorItemAvatarV2,
  establecerExpresionAvatarV2,
  establecerVarianteImagenAvatarV2,
  limpiarAvatarConfigV2,
  obtenerSlotItemAvatar,
  quitarSeleccionAvatarV2,
  seleccionarItemAvatarV2,
  type AvatarConfigV2,
} from "@/lib/avatarConfig";
import {
  obtenerAccesoriosEstudiantePersonalizado,
  obtenerRopaEstudiantePersonalizado,
  resolverOpcionImagenAvatar,
  resolverVarianteItemAvatar,
  type CapaSimpleAvatar,
  type CapaTintAvatar,
  type ExpresionAvatarPersonalizado,
  type ItemCatalogoAvatar,
  type SubseccionCatalogoAvatar,
  type UsuarioAvatarPersonalizado,
  type VarianteItemAvatar,
} from "@/lib/avatarCatalogo";

const RETRASO_LOADER_CAMBIO_MS = 2_000;
const DURACION_MINIMA_LOADER_CAMBIO_MS = 1_050;
const LIMITE_CAMBIO_AVATAR_MS = 30_000;
const TAMANO_AVATAR_EDITOR = 380;

interface Props {
  open: boolean;
  onClose: () => void;
  initialConfig: AvatarConfig;
  onSave: (
    newConfig: AvatarConfig
  ) => void | boolean | Promise<void | boolean>;
  usuario: UsuarioAvatarPersonalizado;
  forzado?: boolean;
  onReady?: () => void;
}

type TabPersonalizado = "ropa" | "expresion" | "accesorios";

type GrupoColorRopa = {
  familia: string;
  items: ItemCatalogoAvatar[];
};

function esperar(ms: number) {
  return new Promise<void>((resolve) =>
    window.setTimeout(resolve, ms)
  );
}

const PRIORIDAD_RAREZA: Record<string, number> = {
  inicial: 0,
  comun: 1,
  epico: 2,
  raro: 3,
  legendario: 4,
};

function prioridadItem(item: ItemCatalogoAvatar) {
  if (item.scope === "usuario") return -1;
  return PRIORIDAD_RAREZA[item.rarity ?? ""] ?? 99;
}

function ordenarItems(items: ItemCatalogoAvatar[]) {
  return [...items].sort((a, b) => {
    const prioridad =
      prioridadItem(a) - prioridadItem(b);

    if (prioridad !== 0) return prioridad;

    return a.name.localeCompare(b.name, "es", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function esCapaSimple(
  variante: VarianteItemAvatar
): variante is CapaSimpleAvatar {
  return typeof variante.image === "string";
}

function esCapaTint(
  variante: VarianteItemAvatar
): variante is CapaTintAvatar {
  return typeof variante.image === "object";
}

function itemCompatible(
  item: ItemCatalogoAvatar,
  gender: "masculino" | "femenino"
) {
  if (item.customization.type === "image_variants") {
    return item.customization.options.some((option) =>
      Boolean(
        option.variants[gender] ??
          option.variants.universal
      )
    );
  }

  return Boolean(
    resolverVarianteItemAvatar(item, gender)
  );
}

function separarFamiliaColorRopa(
  item: ItemCatalogoAvatar
) {
  if (item.customization.type !== "none") {
    return null;
  }

  const indice = item.name.lastIndexOf("__");

  if (
    indice <= 0 ||
    indice >= item.name.length - 2
  ) {
    return null;
  }

  return {
    familia: item.name.slice(0, indice),
    color: item.name.slice(indice + 2),
  };
}

function agruparItemsRopa(
  items: ItemCatalogoAvatar[]
): Array<ItemCatalogoAvatar | GrupoColorRopa> {
  const sueltos: ItemCatalogoAvatar[] = [];
  const grupos = new Map<string, ItemCatalogoAvatar[]>();

  for (const item of items) {
    const datos = separarFamiliaColorRopa(item);

    if (!datos) {
      sueltos.push(item);
      continue;
    }

    const actuales = grupos.get(datos.familia) ?? [];
    actuales.push(item);
    grupos.set(datos.familia, actuales);
  }

  const resultado: Array<
    ItemCatalogoAvatar | GrupoColorRopa
  > = [...sueltos];

  for (const [familia, itemsGrupo] of grupos) {
    resultado.push({
      familia,
      items: ordenarItems(itemsGrupo),
    });
  }

  return resultado.sort((a, b) => {
    const itemsA = "familia" in a ? a.items : [a];
    const itemsB = "familia" in b ? b.items : [b];

    const prioridad =
      Math.min(...itemsA.map(prioridadItem)) -
      Math.min(...itemsB.map(prioridadItem));

    if (prioridad !== 0) return prioridad;

    const nombreA =
      "familia" in a ? a.familia : a.name;
    const nombreB =
      "familia" in b ? b.familia : b.name;

    return nombreA.localeCompare(nombreB, "es", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function etiquetaSimple(valor: string) {
  return valor
    .replace(
      /([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,
      "$1 $2"
    )
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
}

function swatchColorRopa(color: string) {
  const normalizado = color
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const colores: Record<string, string> = {
    azul: "#2563eb",
    verde: "#3f7f4f",
    gris: "#a3a3a3",
    mostaza: "#d4a017",
    negra: "#171717",
    negro: "#171717",
    roja: "#b91c1c",
    rojo: "#b91c1c",
    cafe: "#8b5e3c",
    blanco: "#f5f5f5",
    blanca: "#f5f5f5",
    beige: "#e7d3ac",
    olivo: "#6b7034",
    naranja: "#f97316",
    azulmarino: "#1e3a5f",
  };

  return colores[normalizado] ?? null;
}

function estiloSwatch(color?: string | null) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
    return {};
  }

  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  const luminosidad =
    (r * 299 + g * 587 + b * 114) / 255000;

  if (luminosidad < 0.78) return {};

  return {
    borderColor: "#94a3b8",
    boxShadow:
      "inset 0 0 0 1px rgba(100,116,139,.42)",
  };
}

function fuentePreviewSimple(
  item: ItemCatalogoAvatar,
  config: AvatarConfigV2,
  override?: string | null
) {
  if (
    item.customization.type === "image_variants"
  ) {
    const resolved = resolverOpcionImagenAvatar(
      item,
      override ?? config.imageVariants[item.id],
      config.gender
    );

    return resolved?.layer
      ? resolved.layer.preview ??
          resolved.layer.image
      : null;
  }

  const variante = resolverVarianteItemAvatar(
    item,
    config.gender
  );

  if (!variante || !esCapaSimple(variante)) {
    return null;
  }

  return variante.preview ?? variante.image;
}

function VistaPreviaItem({
  item,
  config,
  varianteOverride,
  colorOverride,
}: {
  item: ItemCatalogoAvatar;
  config: AvatarConfigV2;
  varianteOverride?: string | null;
  colorOverride?: string | null;
}) {
  const optimizar = (src: string) =>
    obtenerUrlImagenOptimizada(src, 240, 80);

  if (
    item.customization.type === "image_variants"
  ) {
    const src = fuentePreviewSimple(
      item,
      config,
      varianteOverride
    );

    if (!src) {
      return (
        <span className="avatar-v2-empty">
          Sin preview
        </span>
      );
    }

    return (
      <img
        src={optimizar(src)}
        alt={item.name}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }

  const variante = resolverVarianteItemAvatar(
    item,
    config.gender
  );

  if (!variante) {
    return (
      <span className="avatar-v2-empty">
        Sin preview
      </span>
    );
  }

  if (esCapaSimple(variante)) {
    return (
      <img
        src={optimizar(
          variante.preview ?? variante.image
        )}
        alt={item.name}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (esCapaTint(variante)) {
    const fill =
      variante.preview.fill ??
      variante.image.fill;
    const outline =
      variante.preview.outline ??
      variante.image.outline;
    const color =
      colorOverride ??
      config.colors[item.id] ??
      item.customization.colors[0] ??
      "#ffffff";
    const fillOptimizado = optimizar(fill);

    return (
      <div className="relative h-full w-full">
        <img
          src={fillOptimizado}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
          decoding="async"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: color,
            opacity: 0.62,
            maskImage: `url(${fillOptimizado})`,
            WebkitMaskImage: `url(${fillOptimizado})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
        <img
          src={optimizar(outline)}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return null;
}

function VistaPreviaExpresion({
  expresion,
}: {
  expresion: ExpresionAvatarPersonalizado;
}) {
  const src =
    expresion.preview ?? expresion.image;

  return (
    <img
      src={obtenerUrlImagenOptimizada(src, 240, 80)}
      alt={expresion.name}
      className="h-full w-full object-contain"
      loading="lazy"
      decoding="async"
    />
  );
}

export default function ModalEditorAvatarPersonalizado({
  open,
  onClose,
  initialConfig,
  onSave,
  usuario,
  forzado = false,
  onReady,
}: Props) {
  const crearInicial = () =>
    crearAvatarConfigPersonalizadoEstudiante(
      usuario.email,
      esAvatarConfigV2(initialConfig)
        ? initialConfig
        : null
    );

  const [config, setConfig] =
    useState<AvatarConfigV2 | null>(
      () => crearInicial()
    );
  const [tab, setTab] =
    useState<TabPersonalizado>("ropa");
  const [guardando, setGuardando] =
    useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avatarListo, setAvatarListo] =
    useState(false);
  const [
    avatarActualizando,
    setAvatarActualizando,
  ] = useState(false);
  const [
    mostrarLoaderCambio,
    setMostrarLoaderCambio,
  ] = useState(false);
  const [
    itemPersonalizacionId,
    setItemPersonalizacionId,
  ] = useState<string | null>(null);

  const solicitudRef = useRef(0);
  const esperandoCommitRef = useRef(false);
  const loaderTimerRef =
    useRef<number | null>(null);
  const loaderVisibleDesdeRef =
    useRef<number | null>(null);
  const readyRef = useRef(false);
  const variantesSesionRef =
    useRef<Record<string, string>>({});
  const coloresSesionRef =
    useRef<Record<string, string>>({});
  const familiasRopaSesionRef =
    useRef<Record<string, string>>({});

  const ropa = useMemo(
    () =>
      obtenerRopaEstudiantePersonalizado(
        usuario.email
      ),
    [usuario.email]
  );

  const accesorios = useMemo(
    () =>
      obtenerAccesoriosEstudiantePersonalizado(
        usuario.email
      ),
    [usuario.email]
  );

  const tabsDisponibles = useMemo(() => {
    const resultado: Array<
      [TabPersonalizado, string]
    > = [];

    if (
      ropa.some(
        (subseccion) =>
          subseccion.items.length > 0
      )
    ) {
      resultado.push(["ropa", "Ropa"]);
    }

    if (usuario.expressions.length > 0) {
      resultado.push([
        "expresion",
        "Expresión",
      ]);
    }

    if (
      accesorios.some(
        (subseccion) =>
          subseccion.items.length > 0
      )
    ) {
      resultado.push([
        "accesorios",
        "Accesorios",
      ]);
    }

    return resultado;
  }, [
    ropa,
    accesorios,
    usuario.expressions,
  ]);

  const claveInicial = JSON.stringify(
    initialConfig
  );

  useEffect(() => {
    if (!open) {
      solicitudRef.current += 1;

      if (loaderTimerRef.current !== null) {
        window.clearTimeout(
          loaderTimerRef.current
        );
        loaderTimerRef.current = null;
      }

      setMostrarLoaderCambio(false);
      setAvatarActualizando(false);
      loaderVisibleDesdeRef.current = null;
      return;
    }

    const nueva = crearInicial();
    setConfig(nueva);
    setTab(tabsDisponibles[0]?.[0] ?? "expresion");
    setMensaje("");
    setAvatarListo(false);
    setAvatarActualizando(false);
    setMostrarLoaderCambio(false);
    setItemPersonalizacionId(null);
    readyRef.current = false;
    solicitudRef.current += 1;
    esperandoCommitRef.current = false;

    if (loaderTimerRef.current !== null) {
      window.clearTimeout(loaderTimerRef.current);
      loaderTimerRef.current = null;
    }

    loaderVisibleDesdeRef.current = null;

    if (nueva) {
      variantesSesionRef.current = {
        ...nueva.imageVariants,
      };
      coloresSesionRef.current = {
        ...nueva.colors,
      };
      familiasRopaSesionRef.current = {};

      for (const sub of ropa) {
        for (const item of sub.items) {
          if (
            nueva.selections[
              obtenerSlotItemAvatar(item)
            ] !== item.id
          ) {
            continue;
          }

          const datos =
            separarFamiliaColorRopa(item);

          if (datos) {
            familiasRopaSesionRef.current[
              `${sub.key}:${datos.familia}`
            ] = item.id;
          }
        }
      }
    }
  }, [
    open,
    claveInicial,
    usuario.email,
    ropa,
    tabsDisponibles,
  ]);

  useEffect(() => {
    return () => {
      if (loaderTimerRef.current !== null) {
        window.clearTimeout(
          loaderTimerRef.current
        );
      }
    };
  }, []);

  if (!open) return null;

  if (!config || !usuario.body || usuario.expressions.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-[10020] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-[min(92vw,520px)] rounded-[24px] bg-white p-6 text-center shadow-2xl">
          <h2 className="text-lg font-black">
            Avatar personalizado no disponible
          </h2>
          <p className="mt-2 text-sm">
            Se necesita Cuerpo.png y al menos una expresión PNG para esta cuenta.
          </p>
          {!forzado && (
            <button
              type="button"
              className="fcc-premium-button mt-5 px-5 py-2"
              onClick={onClose}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>,
      document.body
    );
  }

  const esperarMinimoLoader = async () => {
    const desde =
      loaderVisibleDesdeRef.current;

    if (desde === null) return;

    const restante =
      DURACION_MINIMA_LOADER_CAMBIO_MS -
      (performance.now() - desde);

    if (restante > 0) {
      await esperar(restante);
    }
  };

  const aplicarConfigAtomica = async (
    siguiente: AvatarConfigV2,
    itemActivo: string | null =
      itemPersonalizacionId
  ) => {
    const limpia = limpiarAvatarConfigV2(
      siguiente
    );

    if (
      JSON.stringify(limpia) ===
      JSON.stringify(config)
    ) {
      setItemPersonalizacionId(itemActivo);
      return true;
    }

    if (avatarActualizando) return false;

    const solicitud = ++solicitudRef.current;
    setAvatarActualizando(true);
    setMostrarLoaderCambio(false);
    loaderVisibleDesdeRef.current = null;
    setMensaje("");

    if (loaderTimerRef.current !== null) {
      window.clearTimeout(
        loaderTimerRef.current
      );
    }

    loaderTimerRef.current =
      window.setTimeout(() => {
        if (
          solicitudRef.current !== solicitud
        ) {
          return;
        }

        loaderVisibleDesdeRef.current =
          performance.now();
        setMostrarLoaderCambio(true);
      }, RETRASO_LOADER_CAMBIO_MS);

    const resultado = await Promise.race([
      prepararRecursosAvatarFCC(
        limpia,
        TAMANO_AVATAR_EDITOR
      ).then((completo) => ({
        tipo: "recursos" as const,
        completo,
      })),
      esperar(
        LIMITE_CAMBIO_AVATAR_MS
      ).then(() => ({
        tipo: "timeout" as const,
        completo: false,
      })),
    ]);

    if (loaderTimerRef.current !== null) {
      window.clearTimeout(
        loaderTimerRef.current
      );
      loaderTimerRef.current = null;
    }

    if (
      solicitudRef.current !== solicitud
    ) {
      return false;
    }

    if (
      resultado.tipo === "timeout" ||
      !resultado.completo
    ) {
      await esperarMinimoLoader();

      setMostrarLoaderCambio(false);
      loaderVisibleDesdeRef.current = null;
      setAvatarActualizando(false);
      setMensaje(
        resultado.tipo === "timeout"
          ? "⚠️ El cambio tardó demasiado y se canceló."
          : "⚠️ No se pudo preparar el cambio completo."
      );
      return false;
    }

    await esperarMinimoLoader();

    if (
      solicitudRef.current !== solicitud
    ) {
      return false;
    }

    esperandoCommitRef.current = true;
    setItemPersonalizacionId(itemActivo);
    setConfig(limpia);
    return true;
  };

  const seleccionarRopa = (
    item: ItemCatalogoAvatar
  ) => {
    if (avatarActualizando) return;

    let siguiente = config;

    for (const slot of Object.keys(
      siguiente.selections
    )) {
      if (slot.startsWith("ropa/")) {
        siguiente =
          quitarSeleccionAvatarV2(
            siguiente,
            slot
          );
      }
    }

    siguiente = seleccionarItemAvatarV2(
      siguiente,
      item
    );

    const variante =
      variantesSesionRef.current[item.id];

    if (
      variante &&
      item.customization.type ===
        "image_variants"
    ) {
      siguiente =
        establecerVarianteImagenAvatarV2(
          siguiente,
          item,
          variante
        );
    }

    const color =
      coloresSesionRef.current[item.id];

    if (
      color &&
      item.customization.type === "tint"
    ) {
      siguiente =
        establecerColorItemAvatarV2(
          siguiente,
          item,
          color
        );
    }

    const datos =
      separarFamiliaColorRopa(item);

    if (datos && item.subsection) {
      familiasRopaSesionRef.current[
        `${item.subsection}:${datos.familia}`
      ] = item.id;
    }

    void aplicarConfigAtomica(
      siguiente,
      item.id
    );
  };

  const seleccionarAccesorio = (
    item: ItemCatalogoAvatar
  ) => {
    if (avatarActualizando) return;

    let siguiente =
      seleccionarItemAvatarV2(
        config,
        item
      );

    const variante =
      variantesSesionRef.current[item.id];

    if (
      variante &&
      item.customization.type ===
        "image_variants"
    ) {
      siguiente =
        establecerVarianteImagenAvatarV2(
          siguiente,
          item,
          variante
        );
    }

    const color =
      coloresSesionRef.current[item.id];

    if (
      color &&
      item.customization.type === "tint"
    ) {
      siguiente =
        establecerColorItemAvatarV2(
          siguiente,
          item,
          color
        );
    }

    void aplicarConfigAtomica(
      siguiente,
      item.id
    );
  };

  const seleccionarExpresion = (
    expresion: ExpresionAvatarPersonalizado | null
  ) => {
    if (avatarActualizando) return;

    void aplicarConfigAtomica(
      establecerExpresionAvatarV2(
        config,
        expresion?.id ?? null
      ),
      null
    );
  };

  const todosItems = [
    ...ropa.flatMap((sub) => sub.items),
    ...accesorios.flatMap(
      (sub) => sub.items
    ),
  ];

  const itemSeleccionado =
    itemPersonalizacionId
      ? todosItems.find(
          (item) =>
            item.id === itemPersonalizacionId
        ) ?? null
      : null;

  const grupoSeleccionado = (() => {
    if (
      !itemSeleccionado ||
      itemSeleccionado.section !== "ropa"
    ) {
      return null;
    }

    const datos =
      separarFamiliaColorRopa(
        itemSeleccionado
      );

    if (
      !datos ||
      !itemSeleccionado.subsection
    ) {
      return null;
    }

    const sub = ropa.find(
      (candidate) =>
        candidate.key ===
        itemSeleccionado.subsection
    );

    if (!sub) return null;

    const items = ordenarItems(
      sub.items.filter((item) => {
        const candidato =
          separarFamiliaColorRopa(item);

        return (
          candidato?.familia ===
            datos.familia &&
          itemCompatible(
            item,
            config.gender
          )
        );
      })
    );

    return items.length > 1
      ? {
          familia: datos.familia,
          items,
        }
      : null;
  })();

  const mostrarPaleta =
    Boolean(grupoSeleccionado) ||
    itemSeleccionado?.customization.type ===
      "tint" ||
    itemSeleccionado?.customization.type ===
      "image_variants";

  const renderTarjetaItem = (
    entrada:
      | ItemCatalogoAvatar
      | GrupoColorRopa,
    seleccionadoId: string | null
  ) => {
    const esGrupo = "familia" in entrada;
    const itemsGrupo = esGrupo
      ? entrada.items
      : [entrada];

    const seleccionado = itemsGrupo.find(
      (item) => item.id === seleccionadoId
    );

    const claveFamilia =
      esGrupo &&
      itemsGrupo[0]?.subsection
        ? `${itemsGrupo[0].subsection}:${entrada.familia}`
        : null;

    const recordadoId = claveFamilia
      ? familiasRopaSesionRef.current[
          claveFamilia
        ]
      : null;

    const recordado = recordadoId
      ? itemsGrupo.find(
          (item) => item.id === recordadoId
        )
      : null;

    const representante =
      seleccionado ??
      recordado ??
      itemsGrupo[0];

    if (!representante) return null;

    const nombre = esGrupo
      ? entrada.familia
      : representante.name;

    return (
      <button
        key={
          esGrupo
            ? `grupo:${entrada.familia}`
            : representante.id
        }
        type="button"
        className={`avatar-editor-option group ${
          seleccionado ? "is-selected" : ""
        }`}
        onClick={() =>
          representante.section === "ropa"
            ? seleccionarRopa(representante)
            : seleccionarAccesorio(
                representante
              )
        }
        aria-label={etiquetaSimple(nombre)}
        disabled={avatarActualizando}
      >
        <div className="avatar-editor-option-inner">
          <VistaPreviaItem
            item={representante}
            config={config}
            varianteOverride={
              variantesSesionRef.current[
                representante.id
              ]
            }
            colorOverride={
              coloresSesionRef.current[
                representante.id
              ]
            }
          />
        </div>
      </button>
    );
  };

  const renderRopa = (
    subsecciones: SubseccionCatalogoAvatar[]
  ) => {
    const ropaSeleccionadaReal =
      Object.entries(config.selections).find(
        ([slot]) =>
          slot.startsWith("ropa/")
      )?.[1] ?? null;

    let primeraRopaVisualId: string | null = null;

    if (!ropaSeleccionadaReal) {
      for (const sub of subsecciones) {
        const items = ordenarItems(
          sub.items.filter((item) =>
            itemCompatible(
              item,
              config.gender
            )
          )
        );

        const primeraEntrada = agruparItemsRopa(items)[0];

        if (!primeraEntrada) continue;

        primeraRopaVisualId =
          "familia" in primeraEntrada
            ? primeraEntrada.items[0]?.id ?? null
            : primeraEntrada.id;

        if (primeraRopaVisualId) break;
      }
    }

    const ropaSeleccionada =
      ropaSeleccionadaReal ?? primeraRopaVisualId;

    return subsecciones.map((sub) => {
      const items = ordenarItems(
        sub.items.filter((item) =>
          itemCompatible(
            item,
            config.gender
          )
        )
      );

      if (items.length === 0) {
        return null;
      }

      const visuales =
        agruparItemsRopa(items);

      return (
        <div
          key={sub.key}
          className="mb-5 last:mb-0"
        >
          <h3 className="avatar-editor-section-title mb-3 text-center text-sm font-semibold">
            {sub.label}
          </h3>

          <div className="grid grid-cols-3 gap-3 overflow-visible px-1">
            {visuales.map((entrada) =>
              renderTarjetaItem(
                entrada,
                ropaSeleccionada
              )
            )}
          </div>
        </div>
      );
    });
  };

  const renderAccesorios = (
    subsecciones: SubseccionCatalogoAvatar[]
  ) =>
    subsecciones.map((sub) => {
      const items = ordenarItems(
        sub.items.filter((item) =>
          itemCompatible(
            item,
            config.gender
          )
        )
      );

      if (items.length === 0) {
        return null;
      }

      const slot =
        `accesorios/${sub.key}`;
      const seleccionado =
        config.selections[slot] ?? null;

      return (
        <div
          key={sub.key}
          className="mb-5 last:mb-0"
        >
          <h3 className="avatar-editor-section-title mb-3 text-center text-sm font-semibold">
            {sub.label}
          </h3>

          <div className="grid grid-cols-3 gap-3 overflow-visible px-1">
            <button
              type="button"
              className={`avatar-editor-option group ${
                !seleccionado
                  ? "is-selected"
                  : ""
              }`}
              onClick={() => {
                if (
                  avatarActualizando
                ) {
                  return;
                }

                void aplicarConfigAtomica(
                  quitarSeleccionAvatarV2(
                    config,
                    slot
                  ),
                  null
                );
              }}
              disabled={
                avatarActualizando
              }
              aria-label="Ninguno"
            >
              <div className="avatar-editor-option-inner">
                <span className="avatar-editor-none-text">
                  Ninguno
                </span>
              </div>
            </button>

            {items.map((item) =>
              renderTarjetaItem(
                item,
                seleccionado
              )
            )}
          </div>
        </div>
      );
    });

  const guardar = async () => {
    if (
      guardando ||
      avatarActualizando
    ) {
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const limpia =
        limpiarAvatarConfigV2(config);

      const resultado =
        await onSave(limpia);

      if (resultado === false) {
        return;
      }
    } catch (error) {
      console.error(
        "[FCC Academy] Error guardando avatar personalizado:",
        error
      );
      setMensaje(
        "⚠️ No se pudieron guardar los cambios."
      );
    } finally {
      setGuardando(false);
    }
  };

  const modal = (
    <div
      className="avatar-editor-overlay fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={{
        zIndex: 10020,
        opacity: avatarListo ? 1 : 0.001,
        pointerEvents: avatarListo
          ? "auto"
          : "none",
        transform: avatarListo ? "scale(1)" : "scale(0.992)",
        transition: "opacity 180ms ease-out, transform 180ms ease-out",
        animation: "none",
      }}
      aria-hidden={!avatarListo}
      onClick={
        forzado ? undefined : onClose
      }
    >
      <div
        className="avatar-editor-modal relative flex max-h-[94vh] w-[96vw] max-w-[1240px] flex-col overflow-hidden rounded-[28px] p-3 sm:p-6"
        style={{ animation: "none" }}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {!forzado && (
          <button
            type="button"
            onClick={onClose}
            className="avatar-editor-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none"
            title="Cerrar"
          >
            ×
          </button>
        )}

        <div className="mb-3 px-8 text-center sm:mb-5">
          <p className="avatar-editor-eyebrow">
            Personalización
          </p>
          <h2 className="avatar-editor-title">
            Editor de Avatar
          </h2>
        </div>

        <div className="avatar-editor-body flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5">
          <div className="avatar-editor-preview-shell flex min-h-0 w-full flex-shrink-0 flex-col items-center lg:w-[500px] xl:w-[520px]">
            <div className="avatar-editor-avatar-stage relative flex items-center justify-center">
              <span className="avatar-editor-avatar-orbit" />

              <div className="avatar-editor-avatar-render relative z-[2]">
                <RenderizadorAvatar
                  config={config}
                  size={
                    TAMANO_AVATAR_EDITOR
                  }
                  mantenerAnteriorDuranteCarga
                  onReady={() => {
                    setAvatarListo(true);

                    if (
                      esperandoCommitRef.current
                    ) {
                      esperandoCommitRef.current =
                        false;
                      setMostrarLoaderCambio(
                        false
                      );
                      loaderVisibleDesdeRef.current =
                        null;
                      setAvatarActualizando(
                        false
                      );
                    }

                    if (
                      !readyRef.current
                    ) {
                      readyRef.current = true;
                      onReady?.();
                    }
                  }}
                />

                {mostrarLoaderCambio && (
                  <div
                    className="avatar-editor-update-overlay absolute inset-0 z-[8] flex items-center justify-center"
                    aria-live="polite"
                    aria-label="Actualizando avatar"
                  >
                    <div className="avatar-editor-update-loader">
                      <CargadorFCC
                        compacto
                        mensaje="Actualizando avatar"
                        detalle=""
                        className="avatar-editor-inline-loader"
                      />
                    </div>
                  </div>
                )}
              </div>

              {mostrarPaleta && (
                <div
                  className="avatar-editor-side-palette"
                  aria-label="Variantes"
                >
                  {grupoSeleccionado && (
                    <div className="avatar-editor-side-palette-list">
                      {grupoSeleccionado.items.map(
                        (item) => {
                          const datos =
                            separarFamiliaColorRopa(
                              item
                            );
                          const color =
                            datos?.color ??
                            item.name;
                          const swatch =
                            swatchColorRopa(
                              color
                            );

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`avatar-editor-color-dot ${
                                config.selections[
                                  obtenerSlotItemAvatar(
                                    item
                                  )
                                ] === item.id
                                  ? "is-selected"
                                  : ""
                              }`}
                              style={{
                                backgroundColor:
                                  swatch ??
                                  undefined,
                                ...estiloSwatch(
                                  swatch
                                ),
                              }}
                              onClick={() =>
                                seleccionarRopa(
                                  item
                                )
                              }
                              disabled={
                                avatarActualizando
                              }
                              title={etiquetaSimple(
                                color
                              )}
                            >
                              {!swatch
                                ? etiquetaSimple(
                                    color
                                  )
                                    .slice(0, 1)
                                    .toUpperCase()
                                : null}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {itemSeleccionado?.customization.type ===
                    "tint" && (
                    <div className="avatar-editor-side-palette-list">
                      {itemSeleccionado.customization.colors.map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            className={`avatar-editor-color-dot ${
                              config.colors[
                                itemSeleccionado
                                  .id
                              ] === color
                                ? "is-selected"
                                : ""
                            }`}
                            style={{
                              backgroundColor:
                                color,
                              ...estiloSwatch(
                                color
                              ),
                            }}
                            onClick={() => {
                              if (
                                avatarActualizando
                              ) {
                                return;
                              }

                              coloresSesionRef.current[
                                itemSeleccionado.id
                              ] = color;

                              void aplicarConfigAtomica(
                                establecerColorItemAvatarV2(
                                  config,
                                  itemSeleccionado,
                                  color
                                ),
                                itemSeleccionado.id
                              );
                            }}
                            disabled={
                              avatarActualizando
                            }
                            title="Color"
                          />
                        )
                      )}
                    </div>
                  )}

                  {itemSeleccionado?.customization.type ===
                    "image_variants" && (
                    <div className="avatar-editor-side-palette-list">
                      {itemSeleccionado.customization.options
                        .filter(
                          (option) =>
                            Boolean(
                              option.variants[
                                config
                                  .gender
                              ] ??
                                option
                                  .variants
                                  .universal
                            )
                        )
                        .map(
                          (option) => (
                            <button
                              key={
                                option.key
                              }
                              type="button"
                              className={`avatar-editor-color-dot ${
                                config
                                  .imageVariants[
                                  itemSeleccionado
                                    .id
                                ] ===
                                option.key
                                  ? "is-selected"
                                  : ""
                              }`}
                              style={
                                option.swatch
                                  ? {
                                      backgroundColor:
                                        option.swatch,
                                      ...estiloSwatch(
                                        option.swatch
                                      ),
                                    }
                                  : undefined
                              }
                              onClick={() => {
                                if (
                                  avatarActualizando
                                ) {
                                  return;
                                }

                                variantesSesionRef.current[
                                  itemSeleccionado.id
                                ] =
                                  option.key;

                                void aplicarConfigAtomica(
                                  establecerVarianteImagenAvatarV2(
                                    config,
                                    itemSeleccionado,
                                    option.key
                                  ),
                                  itemSeleccionado.id
                                );
                              }}
                              disabled={
                                avatarActualizando
                              }
                              title={
                                option.label
                              }
                            >
                              {!option.swatch
                                ? option.label
                                    .slice(
                                      0,
                                      1
                                    )
                                    .toUpperCase()
                                : null}
                            </button>
                          )
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="avatar-editor-controls flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="avatar-editor-tabs mb-3 flex justify-start gap-2 overflow-x-auto">
              {tabsDisponibles.map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`avatar-editor-tab ${
                      tab === key
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() => {
                      setTab(key);
                      setItemPersonalizacionId(
                        null
                      );
                    }}
                    disabled={
                      avatarActualizando
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="avatar-editor-options-scroll min-h-0 flex-1 overflow-y-auto pr-2">
              {tab === "ropa" &&
                renderRopa(ropa)}

              {tab === "expresion" && (
                <div className="grid grid-cols-3 gap-3 overflow-visible px-1">
                  {usuario.expressions.map(
                    (expresion) => (
                      <button
                        key={
                          expresion.id
                        }
                        type="button"
                        className={`avatar-editor-option group ${
                          config.expression ===
                          expresion.id
                            ? "is-selected"
                            : ""
                        }`}
                        onClick={() =>
                          seleccionarExpresion(
                            expresion
                          )
                        }
                        disabled={
                          avatarActualizando
                        }
                        aria-label={
                          expresion.name
                        }
                      >
                        <div className="avatar-editor-option-inner">
                          <VistaPreviaExpresion
                            expresion={
                              expresion
                            }
                          />
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}

              {tab === "accesorios" &&
                renderAccesorios(
                  accesorios
                )}
            </div>
          </div>
        </div>

        {mensaje && (
          <div className="mt-2 text-center text-xs font-bold text-amber-700">
            {mensaje}
          </div>
        )}

        <div className="avatar-editor-footer mt-3 flex flex-col-reverse items-stretch justify-end gap-3 sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
          {!forzado && (
            <button
              type="button"
              className="avatar-editor-secondary-button px-4 py-2"
              onClick={onClose}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            className="fcc-premium-button px-5 py-2"
            disabled={
              guardando ||
              !avatarListo ||
              avatarActualizando
            }
            onClick={() =>
              void guardar()
            }
          >
            {guardando
              ? "Confirmando…"
              : forzado
                ? "Crear avatar"
                : "Guardar cambios"}
          </button>
        </div>
      </div>

      <style jsx global>{`

        @keyframes avatar-editor-fade-zoom-in {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(10px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes avatar-editor-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .avatar-editor-overlay {
          background:
            radial-gradient(
              circle at 18% 16%,
              color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent),
              transparent 34%
            ),
            radial-gradient(
              circle at 84% 78%,
              color-mix(in srgb, var(--fcc-premium-cyan) 14%, transparent),
              transparent 36%
            ),
            rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(7px);
          animation: avatar-editor-fade-zoom-in 0.28s ease-out;
        }

        .avatar-editor-modal {
          height: auto;
          max-height: calc(100dvh - 2rem);
          color: var(--fcc-premium-text);
          background:
            radial-gradient(
              circle at 88% 90%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface-strong),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            0 30px 90px rgba(2, 8, 23, 0.28),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
          animation: avatar-editor-fade-zoom-in 0.24s ease-out;
        }

        .theme-oscuro .avatar-editor-modal {
          box-shadow:
            0 34px 96px rgba(0, 0, 0, 0.72),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .avatar-editor-close {
          color: #ffffff;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 1px solid color-mix(in srgb, #ef4444 70%, white);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
        }

        .avatar-editor-close:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, #ef4444 82%, white);
          color: #ffffff;
          filter: brightness(1.05);
        }

        .avatar-editor-eyebrow {
          margin-bottom: 0.2rem;
          color: var(--fcc-premium-accent);
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .avatar-editor-title {
          color: var(--fcc-premium-text);
          font-size: clamp(1.35rem, 3vw, 1.9rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .avatar-editor-preview-shell {
          --fcc-user-avatar-core: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 18%,
            transparent
          );
          --fcc-user-avatar-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 34%,
            transparent
          );
          --fcc-user-avatar-b: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 28%,
            transparent
          );
          --fcc-user-avatar-c: color-mix(
            in srgb,
            var(--fcc-premium-accent) 26%,
            transparent
          );
          --fcc-user-avatar-border: color-mix(
            in srgb,
            var(--fcc-premium-accent) 28%,
            transparent
          );
          --fcc-user-avatar-shadow-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 4%,
            transparent
          );
          --fcc-user-avatar-shadow-b: color-mix(
            in srgb,
            var(--fcc-premium-accent) 18%,
            transparent
          );
          --fcc-user-orbit-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 20%,
            transparent
          );
          --fcc-user-orbit-b: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 22%,
            transparent
          );

          position: relative;
          justify-content: center;
          padding-top: 0;
          overflow: visible;
        }

        .avatar-editor-avatar-stage {
          --avatar-editor-stage-size: min(100%, 520px);
          --avatar-editor-render-scale: 1.48;
          --avatar-editor-render-bottom: -18px;
          --avatar-editor-avatar-circle-size: min(82%, 388px);
          --avatar-editor-avatar-ring-size: min(70%, 330px);
          --avatar-editor-avatar-orbit-size: min(66%, 310px);

          position: relative;
          flex: 0 0 auto;
          width: var(--avatar-editor-stage-size);
          height: var(--avatar-editor-stage-size);
          max-width: 100%;
          display: grid;
          place-items: end center;
          overflow: visible;
          isolation: isolate;
        }

        .avatar-editor-avatar-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-circle-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(
              circle,
              var(--fcc-user-avatar-core),
              transparent 62%
            ),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--fcc-user-avatar-a) 42deg,
              transparent 84deg,
              var(--fcc-user-avatar-b) 145deg,
              transparent 210deg,
              var(--fcc-user-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .avatar-editor-avatar-stage::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-ring-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          border: 1px solid var(--fcc-user-avatar-border);
          box-shadow:
            0 0 0 14px var(--fcc-user-avatar-shadow-a),
            0 0 42px var(--fcc-user-avatar-shadow-b);
          z-index: -2;
        }

        .avatar-editor-avatar-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-orbit-size);
          aspect-ratio: 1 / 1;
          z-index: -1;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(-18deg);
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--fcc-user-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--fcc-user-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          opacity: 0.95;
        }

        .avatar-editor-avatar-render {
          position: absolute !important;
          left: 50%;
          bottom: var(--avatar-editor-render-bottom);
          z-index: 2;
          display: grid;
          place-items: center;
          transform: translateX(-50%)
            scale(var(--avatar-editor-render-scale)) !important;
          transform-origin: center bottom;
        }

        .avatar-editor-avatar-render > * {
          max-width: none !important;
          max-height: none !important;
        }

        .avatar-editor-update-overlay {
          border-radius: 999px;
          pointer-events: none;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 54%,
            transparent
          );
          backdrop-filter: blur(1.5px);
        }

        .avatar-editor-update-loader {
          width: 184px;
          max-width: 58%;
          transform: scale(0.72);
          transform-origin: center;
        }

        .avatar-editor-inline-loader {
          min-height: 0 !important;
          padding: 8px !important;
        }

        .avatar-editor-side-palette {
          position: absolute;
          right: clamp(2px, 1.5vw, 14px);
          top: 50%;
          z-index: 7;
          display: flex;
          max-height: 88%;
          align-items: center;
          justify-content: center;
          transform: translateY(-50%);
          pointer-events: auto;
        }

        .avatar-editor-side-palette-list {
          display: flex;
          max-height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 7px;
          overflow-y: auto;
          overflow-x: visible;
          padding: 4px;
          scrollbar-width: none;
        }

        .avatar-editor-side-palette-list::-webkit-scrollbar {
          display: none;
        }

        .avatar-editor-side-palette .avatar-editor-color-dot {
          width: 2.1rem;
          height: 2.1rem;
          flex: 0 0 auto;
        }

        .avatar-editor-color-dot {
          display: grid;
          place-items: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          color: var(--fcc-premium-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 92%,
            transparent
          );
          border: 2px solid var(--fcc-premium-border);
          box-shadow: none;
          opacity: 0.96;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .avatar-editor-color-dot:hover {
          transform: translateY(-1px) scale(1.04);
        }

        .avatar-editor-color-dot.is-selected {
          transform: scale(1.08);
          border: 4px solid var(--fcc-premium-accent);
          box-shadow: none;
        }

        .avatar-editor-color-dot.is-locked-color {
          filter: grayscale(35%);
        }

        .avatar-editor-color-lock {
          color: #ffffff;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.82);
          pointer-events: none;
        }

        .avatar-editor-tabs {
          scrollbar-width: thin;
          box-sizing: border-box;
          padding: 6px 4px 8px;
          scroll-padding-inline: 4px;
        }

        .avatar-editor-tab {
          min-height: 34px;
          border-radius: 999px;
          padding: 0 0.85rem;
          color: var(--fcc-premium-muted);
          background: transparent;
          border: 1px solid transparent;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .avatar-editor-tab:hover {
          color: var(--fcc-premium-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-accent) 8%,
            transparent
          );
          border-color: var(--fcc-premium-border);
        }

        .avatar-editor-tab.is-active {
          color: white;
          background: var(--fcc-premium-button);
          border-color: color-mix(
            in srgb,
            var(--fcc-premium-accent) 32%,
            transparent
          );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .theme-oscuro .avatar-editor-tab.is-active {
          color: #050505;
        }

        .avatar-editor-options-scroll {
          box-sizing: border-box;
          min-height: 0;
          flex: 1 1 auto;
          height: auto !important;
          padding: 4px 6px 8px 4px;
          scroll-padding-top: 4px;
        }

        .avatar-editor-section-title {
          color: var(--fcc-premium-text);
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .avatar-editor-option {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          cursor: pointer;
          overflow: visible;
          border-radius: 18px;
          padding: 0;
          border: 1px solid var(--fcc-premium-border);
          background:
            radial-gradient(
              circle at 72% 18%,
              color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
          transition:
            transform var(--fcc-transition),
            box-shadow var(--fcc-transition),
            border-color var(--fcc-transition),
            filter var(--fcc-transition),
            opacity var(--fcc-transition);
        }

        .theme-oscuro .avatar-editor-option {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .avatar-editor-option:hover {
          transform: translateY(-2px);
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-option.is-selected {
          transform: translateY(-1px);
          border-width: 2px;
          border-color: var(--fcc-premium-accent);
          box-shadow:
            inset 0 0 0 3px
              color-mix(
                in srgb,
                var(--fcc-premium-accent) 20%,
                transparent
              ),
            inset 0 0 0 1px
              color-mix(
                in srgb,
                var(--fcc-premium-accent) 18%,
                transparent
              );
        }

        .avatar-editor-option-inner {
          position: relative;
          display: flex;
          width: 100%;
          height: 100%;
          aspect-ratio: 1 / 1;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 88%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft) 94%,
                transparent
              )
            );
        }

        .avatar-editor-option-inner img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .avatar-editor-none-text,
        .avatar-v2-empty {
          color: var(--fcc-premium-muted);
          font-size: 0.88rem;
          font-weight: 700;
        }

        .avatar-editor-options-scroll.is-gender-tab {
          overflow-y: hidden !important;
          padding: 0.35rem;
        }

        .avatar-editor-gender-grid {
          width: 100%;
          min-width: 0;
          min-height: 100%;
          height: 100%;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
          overflow: visible;
          padding: 0.25rem;
          box-sizing: border-box;
        }

        .avatar-editor-gender-option {
          display: flex !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0;
          align-items: center !important;
          justify-content: center !important;
          text-align: center;
          box-sizing: border-box;
        }

        .avatar-editor-gender-label {
          display: block;
          width: 100%;
          color: var(--fcc-premium-text);
          font-size: 1rem;
          font-weight: 900;
          text-align: center;
        }

        .avatar-editor-option.is-locked {
          z-index: 1;
        }

        .avatar-editor-option.is-locked:hover {
          z-index: 80;
        }

        .avatar-editor-lock-layer {
          z-index: 30;
          background: rgba(0, 0, 0, 0.28);
          overflow: visible;
          pointer-events: none;
        }

        .avatar-editor-tooltip {
          width: max-content;
          max-width: 124px;
          white-space: normal;
          word-break: normal;
          line-height: 1.08rem;
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface-strong);
          border: 1px solid var(--fcc-premium-border);
          border-radius: 10px;
          box-shadow: none;
          opacity: 0;
          transform: translate(-50%, -50%);
          transition: opacity var(--fcc-transition);
        }

        .group:hover .avatar-editor-tooltip {
          opacity: 1;
          transform: translate(-50%, -50%);
        }

        .avatar-editor-secondary-button {
          min-height: 40px;
          border-radius: 12px;
          color: var(--fcc-premium-text);
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 94%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft) 94%,
                transparent
              )
            );
          border: 1px solid var(--fcc-premium-border);
          font-weight: 850;
          box-shadow: var(--fcc-premium-shadow-soft);
        }

        .avatar-editor-secondary-button:hover {
          transform: translateY(-1px);
          color: var(--fcc-premium-accent);
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-toast {
          animation: avatar-editor-fade-in 0.3s ease-out;
        }


        @media (min-width: 1024px) {
          .avatar-editor-modal {
            height: min(760px, calc(100dvh - 28px));
            max-height: min(760px, calc(100dvh - 28px));
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            height: 100%;
            min-height: 0;
            justify-content: center;
            overflow: visible;
          }

          .avatar-editor-controls {
            height: 100%;
            min-height: 0;
            overflow: hidden !important;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            flex: 1 1 auto;
            height: auto !important;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            overflow-y: hidden !important;
          }

          .avatar-editor-gender-grid {
            height: 100%;
            min-height: 100%;
          }

          .avatar-editor-gender-option {
            min-height: 0 !important;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
          }
        }

        @media (min-width: 1180px) {
          .avatar-editor-tabs {
            justify-content: center !important;
            overflow-x: visible !important;
            gap: 0.3rem !important;
          }

          .avatar-editor-tab {
            padding-left: 0.58rem;
            padding-right: 0.58rem;
            font-size: 0.73rem;
          }
        }

        @media (min-width: 641px) and (max-width: 1023px) {
          .avatar-editor-modal {
            height: calc(100dvh - 1.5rem) !important;
            max-height: calc(100dvh - 1.5rem) !important;
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.75rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(62vw, 300px);
            --avatar-editor-render-scale: 0.74;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette {
            right: 2px;
            max-height: 90%;
          }

          .avatar-editor-side-palette-list {
            gap: 6px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.9rem;
            height: 1.9rem;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            flex: 0 0 auto;
            margin-bottom: 0.5rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.35rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-option.is-selected {
            transform: none;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 128px !important;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.75rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 42px;
            flex: 1 1 0;
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (max-width: 640px) {
          .avatar-editor-overlay {
            align-items: center;
            padding: 0.5rem;
          }

          .avatar-editor-modal {
            width: calc(100vw - 1rem) !important;
            height: calc(100dvh - 1rem) !important;
            max-height: calc(100dvh - 1rem) !important;
            border-radius: 24px;
            padding: 0.75rem !important;
            overflow: hidden;
          }

          .avatar-editor-close {
            right: 0.75rem;
            top: 0.75rem;
            height: 2.5rem;
            width: 2.5rem;
          }

          .avatar-editor-modal > .mb-3 {
            margin-bottom: 0.35rem !important;
            padding-left: 3rem !important;
            padding-right: 3rem !important;
          }

          .avatar-editor-eyebrow {
            margin-bottom: 0.08rem;
            font-size: 0.64rem;
            letter-spacing: 0.18em;
          }

          .avatar-editor-title {
            font-size: clamp(1.18rem, 5.7vw, 1.42rem);
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.45rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(76vw, 246px);
            --avatar-editor-render-scale: 0.62;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette {
            right: 0;
            max-height: 92%;
          }

          .avatar-editor-side-palette-list {
            gap: 5px;
            padding: 3px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.62rem;
            height: 1.62rem;
            flex: 0 0 auto;
          }

          .avatar-editor-color-dot.is-selected {
            border-width: 3px;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            position: relative;
            z-index: 5;
            flex: 0 0 auto;
            margin-bottom: 0.35rem !important;
            padding-bottom: 0.35rem;
            gap: 0.42rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-tab {
            min-height: 30px;
            flex: 0 0 auto;
            padding: 0 0.68rem;
            font-size: 0.68rem;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.3rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-options-scroll .grid {
            gap: 0.55rem !important;
          }

          .avatar-editor-section-title {
            margin-bottom: 0.5rem !important;
            font-size: 0.78rem;
          }

          .avatar-editor-option {
            border-radius: 16px;
          }

          .avatar-editor-option-inner {
            border-radius: 14px;
          }

          .avatar-editor-option.is-selected {
            transform: none;
          }

          .avatar-editor-gender-option {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            height: 100% !important;
            min-height: 120px !important;
            margin: 0 !important;
          }

          .avatar-editor-gender-label {
            font-size: 0.9rem;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.55rem !important;
            gap: 0.55rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 40px;
            flex: 1 1 0;
            border-radius: 14px;
            padding: 0.45rem 0.6rem !important;
            font-size: clamp(0.76rem, 3.4vw, 0.9rem);
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (max-width: 640px) and (max-height: 760px) {
          .avatar-editor-modal {
            padding: 0.62rem !important;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(62vw, 198px);
            --avatar-editor-render-scale: 0.50;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.45rem;
            height: 1.45rem;
          }

          .avatar-editor-tab {
            min-height: 28px;
            padding: 0 0.62rem;
            font-size: 0.64rem;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 96px !important;
          }

          .avatar-editor-footer {
            margin-top: 0.42rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 36px;
            border-radius: 12px;
          }
        }
      
      `}</style>
    </div>
  );

  return typeof document === "undefined"
    ? modal
    : createPortal(
        modal,
        document.body
      );
}