/**
 * Renderizador de avatar V2 de FCC Academy.
 *
 * La fuente de verdad es el catálogo generado desde
 * public/elementos_avatar_nuevo. No convierte IDs del sistema anterior.
 * Las configuraciones antiguas se consideran ausentes y muestran únicamente
 * una configuración visual inicial del catálogo nuevo mientras termina la
 * transición del editor.
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  obtenerUrlImagenOptimizada,
  precargarImagenes,
} from "@/lib/imagenes";
import {
  completarAvatarConfigBaseEstudiante,
  crearAvatarConfigInicialEstudiante,
  esAvatarConfigPersonalizadoV2,
  esAvatarConfigV2,
  limpiarAvatarConfigV2,
  obtenerSlotItemAvatar,
  type AvatarConfigV2,
} from "@/lib/avatarConfig";
import {
  obtenerEstudiantePersonalizadoAvatar,
  obtenerExpresionEstudiantePersonalizadoPorId,
  obtenerItemAvatarPorId,
  obtenerItemEstudiantePersonalizadoPorId,
  obtenerProfesorAvatar,
  obtenerExpresionProfesorPersonalizadoPorId,
  obtenerItemProfesorPersonalizadoPorId,
  obtenerSeccionCuerpoAvatar,
  resolverOpcionImagenAvatar,
  resolverVarianteItemAvatar,
  type CapaSimpleAvatar,
  type CapaTintAvatar,
  type GeneroAvatar,
  type ItemCatalogoAvatar,
  type VarianteItemAvatar,
} from "@/lib/avatarCatalogo";

/**
 * Forma antigua conservada SOLO como superficie TypeScript durante la
 * sustitución progresiva de componentes. El renderizador no traduce ninguno
 * de estos IDs al catálogo V2.
 */
export type AvatarConfigAnterior = {
  gender: "masculino" | "femenino";
  skin?: string;
  skinColor?: string;
  eyes?: string;
  mouth?: string;
  nose?: string;
  hair?: string;
  playera?: string;
  sueter?: string;
  sueterColor?: string;
  glasses?: string;
  collar?: string;
  pulsera?: string;
  accessory?: string;
};

export type AvatarConfig = AvatarConfigV2 | AvatarConfigAnterior;


function obtenerUsuarioPersonalizadoDeConfig(
  config: AvatarConfigV2
) {
  if (!esAvatarConfigPersonalizadoV2(config)) {
    return null;
  }

  return config.customRole === "profesor"
    ? obtenerProfesorAvatar(config.customKey)
    : obtenerEstudiantePersonalizadoAvatar(config.customKey);
}

function obtenerItemPersonalizadoDeConfig(
  config: AvatarConfigV2,
  itemId: string
) {
  if (!esAvatarConfigPersonalizadoV2(config)) {
    return null;
  }

  return config.customRole === "profesor"
    ? obtenerItemProfesorPersonalizadoPorId(
        config.customKey,
        itemId
      )
    : obtenerItemEstudiantePersonalizadoPorId(
        config.customKey,
        itemId
      );
}

function obtenerExpresionPersonalizadaDeConfig(
  config: AvatarConfigV2
) {
  if (!esAvatarConfigPersonalizadoV2(config)) {
    return null;
  }

  const usuario = obtenerUsuarioPersonalizadoDeConfig(config);
  if (!usuario) return null;

  return (
    (config.customRole === "profesor"
      ? obtenerExpresionProfesorPersonalizadoPorId(
          config.customKey,
          config.expression
        )
      : obtenerExpresionEstudiantePersonalizadoPorId(
          config.customKey,
          config.expression
        )) ??
    usuario.expressions[0] ??
    null
  );
}

interface Props {
  config?: AvatarConfig | null;
  size?: number;
  mantenerAnteriorDuranteCarga?: boolean;
  onReady?: () => void;
}

const AvatarImageResolverContext = createContext<(src: string) => string>(
  (src) => src
);

function inferirGeneroConfig(config?: AvatarConfig | null): GeneroAvatar {
  if (
    config &&
    typeof config === "object" &&
    (config.gender === "masculino" || config.gender === "femenino")
  ) {
    return config.gender;
  }

  return "masculino";
}

function itemSirveParaGenero(
  item: ItemCatalogoAvatar,
  gender: GeneroAvatar
) {
  if (item.customization.type === "image_variants") {
    return Boolean(
      resolverOpcionImagenAvatar(
        item,
        item.customization.defaultOption,
        gender
      )?.layer
    );
  }

  return Boolean(resolverVarianteItemAvatar(item, gender));
}

/**
 * Configuración visual temporal para una cuenta que todavía no tiene
 * avatar_config V2. No toma IDs del formato anterior ni los migra.
 */
function crearConfigVisualInicial(gender: GeneroAvatar): AvatarConfigV2 {
  return crearAvatarConfigInicialEstudiante(gender);
}

function normalizarConfigRender(
  config?: AvatarConfig | null
): AvatarConfigV2 {
  if (esAvatarConfigV2(config)) {
    if (esAvatarConfigPersonalizadoV2(config)) {
      const usuario =
        obtenerUsuarioPersonalizadoDeConfig(config);

      if (
        usuario?.body &&
        usuario.expressions.length > 0
      ) {
        return limpiarAvatarConfigV2(config);
      }

      // Un custom solo permanece activo si su propio catalogo
      // (estudiante o profesor) conserva Cuerpo.png + expresion real.
      return crearConfigVisualInicial(config.gender);
    }

    return completarAvatarConfigBaseEstudiante(config);
  }

  return crearConfigVisualInicial(inferirGeneroConfig(config));
}

function getConfigKey(config: AvatarConfigV2) {
  return JSON.stringify(config);
}

function getAnchoOptimizado(size: number) {
  // Mantiene suficiente densidad para que el avatar siga nítido incluso
  // cuando un contenedor responsivo aplica escalas fraccionarias.
  return Math.min(1024, Math.max(128, Math.ceil(size * 3)));
}

function esCapaSimple(
  variante: VarianteItemAvatar
): variante is CapaSimpleAvatar {
  return typeof variante.image === "string";
}

function esCapaTint(
  variante: VarianteItemAvatar
): variante is CapaTintAvatar {
  return (
    typeof variante.image === "object" &&
    "fill" in variante.image
  );
}

function obtenerFuentesItem(
  item: ItemCatalogoAvatar,
  config: AvatarConfigV2
) {
  if (item.customization.type === "image_variants") {
    const resolved = resolverOpcionImagenAvatar(
      item,
      config.imageVariants[item.id],
      config.gender
    );

    return resolved?.layer?.image ? [resolved.layer.image] : [];
  }

  const variante = resolverVarianteItemAvatar(item, config.gender);
  if (!variante) return [];

  if (esCapaSimple(variante)) {
    return [variante.image];
  }

  if (esCapaTint(variante)) {
    return [variante.image.fill, variante.image.outline];
  }

  return [];
}

function obtenerItemsSeleccionados(config: AvatarConfigV2) {
  const items: Array<{
    slot: string;
    item: ItemCatalogoAvatar;
  }> = [];

  const resolverItem = (itemId: string) =>
    esAvatarConfigPersonalizadoV2(config)
      ? obtenerItemPersonalizadoDeConfig(config, itemId)
      : obtenerItemAvatarPorId(itemId);

  for (const [slot, itemId] of Object.entries(config.selections)) {
    const item = resolverItem(itemId);
    if (!item) continue;
    if (obtenerSlotItemAvatar(item) !== slot) continue;
    if (!itemSirveParaGenero(item, config.gender)) continue;

    items.push({ slot, item });
  }

  const pesoSlot = (slot: string) => {
    if (slot === "ojos") return 30;
    if (slot === "accesorios/lentes") return 40;
    if (slot === "cabello") return 50;
    if (slot === "ropa/base") return 65;
    if (slot.startsWith("ropa/")) return 70;
    if (slot.startsWith("accesorios/")) return 90;
    return 100;
  };

  return items.sort((a, b) => {
    const diferencia = pesoSlot(a.slot) - pesoSlot(b.slot);
    return diferencia || a.slot.localeCompare(b.slot, "es");
  });
}

function getVisibleSources(config: AvatarConfigV2) {
  const sources: string[] = [];

  const tieneRopa = Object.keys(
    config.selections
  ).some((slot) => slot.startsWith("ropa/"));

  if (esAvatarConfigPersonalizadoV2(config)) {
    const usuario =
      obtenerUsuarioPersonalizadoDeConfig(config);

    if (usuario?.body && !tieneRopa) {
      sources.push(usuario.body);
    }

    const expresion =
      obtenerExpresionPersonalizadaDeConfig(config);

    if (expresion?.image) {
      sources.push(expresion.image);
    }
  } else {
    const cuerpo = obtenerSeccionCuerpoAvatar();
    const bodyVariant = cuerpo?.variants[config.gender];

    if (!tieneRopa) {
      if (bodyVariant?.image) {
        sources.push(bodyVariant.image);
      }

      if (bodyVariant?.fill) {
        sources.push(bodyVariant.fill);
      }

      if (bodyVariant?.outline) {
        sources.push(bodyVariant.outline);
      }
    }

    // Cara.png es independiente de Cuerpo y nunca desaparece al cambiar ropa.
    if (bodyVariant?.face) {
      sources.push(bodyVariant.face);
    }
  }

  for (const { item } of obtenerItemsSeleccionados(config)) {
    sources.push(...obtenerFuentesItem(item, config));
  }

  return Array.from(new Set(sources.filter(Boolean)));
}

/**
 * Precarga únicamente las capas visibles de la configuración solicitada.
 */
export async function prepararRecursosAvatarFCC(
  config?: AvatarConfig | null,
  size = 150
) {
  const normalizada = normalizarConfigRender(config);
  const ancho = getAnchoOptimizado(size);
  const sources = getVisibleSources(normalizada).map((src) =>
    obtenerUrlImagenOptimizada(src, ancho, 88)
  );

  if (sources.length === 0) return false;
  return precargarImagenes(sources);
}

function LayerImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const resolver = useContext(AvatarImageResolverContext);

  return (
    <img
      src={resolver(src)}
      className="absolute inset-0 h-full w-full object-contain"
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}

function MaskTint({
  src,
  color,
  opacity = 0.62,
}: {
  src: string;
  color: string;
  opacity?: number;
}) {
  const resolver = useContext(AvatarImageResolverContext);
  const resolvedSrc = resolver(src);

  return (
    <div
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{
        backgroundColor: color,
        opacity,
        maskImage: `url(${resolvedSrc})`,
        WebkitMaskImage: `url(${resolvedSrc})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function CuerpoLayer({ config }: { config: AvatarConfigV2 }) {
  const cuerpo = obtenerSeccionCuerpoAvatar();
  const variante = cuerpo?.variants[config.gender];

  if (variante?.image) {
    return (
      <LayerImage
        src={variante.image}
        alt="cuerpo"
      />
    );
  }

  if (!variante?.fill || !variante?.outline) {
    return null;
  }

  return (
    <div className="absolute inset-0">
      <LayerImage src={variante.fill} alt="cuerpo" />
      <MaskTint
        src={variante.fill}
        color={config.skinColor ?? "#f1c27d"}
        opacity={0.72}
      />
      <LayerImage
        src={variante.outline}
        alt="contorno del cuerpo"
      />
    </div>
  );
}

function CaraLayer({ config }: { config: AvatarConfigV2 }) {
  const cuerpo = obtenerSeccionCuerpoAvatar();
  const variante = cuerpo?.variants[config.gender];

  if (!variante?.face) {
    return null;
  }

  return (
    <LayerImage
      src={variante.face}
      alt="cara"
    />
  );
}

function ItemLayer({
  item,
  config,
}: {
  item: ItemCatalogoAvatar;
  config: AvatarConfigV2;
}) {
  if (item.customization.type === "image_variants") {
    const resolved = resolverOpcionImagenAvatar(
      item,
      config.imageVariants[item.id],
      config.gender
    );

    if (!resolved?.layer?.image) return null;

    return <LayerImage src={resolved.layer.image} alt={item.name} />;
  }

  const variante = resolverVarianteItemAvatar(item, config.gender);
  if (!variante) return null;

  if (esCapaSimple(variante)) {
    return <LayerImage src={variante.image} alt={item.name} />;
  }

  if (esCapaTint(variante)) {
    const color =
      config.colors[item.id] ??
      (item.customization.type === "tint"
        ? item.customization.colors[0]
        : null) ??
      "#ffffff";

    return (
      <div className="absolute inset-0">
        <LayerImage src={variante.image.fill} alt={`${item.name} relleno`} />
        <MaskTint src={variante.image.fill} color={color} opacity={0.66} />
        <LayerImage src={variante.image.outline} alt={`${item.name} contorno`} />
      </div>
    );
  }

  return null;
}

type AvatarFrame = {
  key: string;
  config: AvatarConfigV2;
  resolver: (src: string) => string;
};

async function esperarImagenDOM(img: HTMLImageElement) {
  if (!img.complete) {
    const cargo = await new Promise<boolean>((resolve) => {
      const listo = () => {
        limpiar();
        resolve(true);
      };
      const fallo = () => {
        limpiar();
        resolve(false);
      };
      const limpiar = () => {
        img.removeEventListener("load", listo);
        img.removeEventListener("error", fallo);
      };

      img.addEventListener("load", listo, { once: true });
      img.addEventListener("error", fallo, { once: true });
    });

    if (!cargo) return false;
  }

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return false;
  }

  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      // Algunos navegadores pueden rechazar decode() aun con la imagen ya
      // disponible. naturalWidth/naturalHeight siguen siendo la comprobacion.
    }
  }

  return img.naturalWidth > 0 && img.naturalHeight > 0;
}

async function esperarFrameDOMListo(nodo: HTMLDivElement | null) {
  if (!nodo) return false;

  const imagenes = Array.from(
    nodo.querySelectorAll<HTMLImageElement>("img")
  );

  const resultados = await Promise.all(
    imagenes.map((img) => esperarImagenDOM(img))
  );

  return resultados.every(Boolean);
}

function siguienteFrameNavegador() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function CapasAvatar({ frame }: { frame: AvatarFrame }) {
  const items = obtenerItemsSeleccionados(frame.config);
  const personalizado =
    obtenerUsuarioPersonalizadoDeConfig(frame.config);

  const expresion = personalizado
    ? obtenerExpresionPersonalizadaDeConfig(frame.config)
    : null;

  const ropa = items.filter(({ slot }) =>
    slot.startsWith("ropa/")
  );

  const elementosEstandar = personalizado
    ? []
    : items.filter(
        ({ slot }) => !slot.startsWith("ropa/")
      );

  const accesoriosPersonalizados = personalizado
    ? items.filter(({ slot }) =>
        slot.startsWith("accesorios/")
      )
    : [];

  const tieneRopa = ropa.length > 0;

  return (
    <AvatarImageResolverContext.Provider value={frame.resolver}>
      <div className="relative h-full w-full fcc-avatar-completo">
        {personalizado ? (
          personalizado.body && !tieneRopa ? (
            <LayerImage
              src={personalizado.body}
              alt="cuerpo personalizado"
            />
          ) : null
        ) : !tieneRopa ? (
          <CuerpoLayer config={frame.config} />
        ) : null}

        {ropa.map(({ slot, item }) => (
          <ItemLayer
            key={`${slot}:${item.id}`}
            item={item}
            config={frame.config}
          />
        ))}

        {/* En estudiantes estándar, Cara.png nunca depende de la ropa.
            Nariz y boca forman parte de esta misma capa fija. */}
        {!personalizado && (
          <CaraLayer config={frame.config} />
        )}

        {elementosEstandar.map(({ slot, item }) => (
          <ItemLayer
            key={`${slot}:${item.id}`}
            item={item}
            config={frame.config}
          />
        ))}

        {expresion?.image && (
          <LayerImage
            src={expresion.image}
            alt={expresion.name}
          />
        )}

        {accesoriosPersonalizados.map(({ slot, item }) => (
          <ItemLayer
            key={`${slot}:${item.id}`}
            item={item}
            config={frame.config}
          />
        ))}
      </div>
    </AvatarImageResolverContext.Provider>
  );
}

function PlaceholderAvatar({ fallo }: { fallo: boolean }) {
  return (
    <div className="fcc-avatar-placeholder" aria-hidden="true">
      <span className="fcc-avatar-placeholder-head" />
      <span className="fcc-avatar-placeholder-body" />
      {!fallo && <span className="fcc-avatar-placeholder-shimmer" />}

      <style jsx>{`
        .fcc-avatar-placeholder {
          position: absolute;
          inset: 0;
          z-index: 3;
          overflow: hidden;
          border-radius: 28%;
          background:
            radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--fcc-premium-cyan) 11%, transparent), transparent 34%),
            color-mix(in srgb, var(--fcc-premium-surface-soft) 88%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 14%, var(--fcc-premium-border));
        }

        .fcc-avatar-placeholder-head,
        .fcc-avatar-placeholder-body {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          background: color-mix(in srgb, var(--fcc-premium-muted) 28%, transparent);
        }

        .fcc-avatar-placeholder-head {
          top: 24%;
          width: 30%;
          aspect-ratio: 1;
          border-radius: 50%;
        }

        .fcc-avatar-placeholder-body {
          bottom: 17%;
          width: 58%;
          height: 34%;
          border-radius: 50% 50% 22% 22%;
        }

        .fcc-avatar-placeholder-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.5) 48%, transparent 66%);
          transform: translateX(-110%);
          animation: fcc-avatar-shimmer 1.45s ease-in-out infinite;
        }

        @keyframes fcc-avatar-shimmer {
          to { transform: translateX(110%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .fcc-avatar-placeholder-shimmer { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default function RenderizadorAvatar({
  config,
  size = 150,
  mantenerAnteriorDuranteCarga = false,
  onReady,
}: Props) {
  const normalizedConfig = useMemo(
    () => normalizarConfigRender(config),
    [config]
  );
  const configKey = useMemo(
    () => getConfigKey(normalizedConfig),
    [normalizedConfig]
  );
  const anchoOptimizado = useMemo(
    () => getAnchoOptimizado(size),
    [size]
  );
  const resolver = useMemo(
    () => (src: string) =>
      obtenerUrlImagenOptimizada(src, anchoOptimizado, 88),
    [anchoOptimizado]
  );

  const [frames, setFrames] = useState<AvatarFrame[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [stagedKey, setStagedKey] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [falloCarga, setFalloCarga] = useState(false);
  const activeKeyRef = useRef<string | null>(null);
  const latestRequestRef = useRef("");
  const onReadyRef = useRef(onReady);
  const frameRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  onReadyRef.current = onReady;

  useEffect(() => {
    let active = true;
    const requestKey = `${configKey}@${anchoOptimizado}`;
    latestRequestRef.current = requestKey;
    setCargando(true);
    setFalloCarga(false);
    setStagedKey(null);

    if (activeKeyRef.current === requestKey) {
      setCargando(false);
      onReadyRef.current?.();
      return;
    }

    if (!mantenerAnteriorDuranteCarga) {
      activeKeyRef.current = null;
      setActiveKey(null);
      setFrames([]);
    } else {
      setFrames((actuales) =>
        actuales.filter((frame) => frame.key === activeKeyRef.current)
      );
    }

    const sources = getVisibleSources(normalizedConfig).map(resolver);

    if (sources.length === 0) {
      setFalloCarga(true);
      setCargando(false);
      return;
    }

    void precargarImagenes(sources).then((completo) => {
      if (!active || latestRequestRef.current !== requestKey) return;

      if (completo) {
        const siguiente: AvatarFrame = {
          key: requestKey,
          config: normalizedConfig,
          resolver,
        };

        setFrames((actuales) => {
          const vigente = actuales.find(
            (frame) => frame.key === activeKeyRef.current
          );
          return vigente ? [vigente, siguiente] : [siguiente];
        });
        setStagedKey(requestKey);
      } else {
        setFalloCarga(true);
        setCargando(false);
      }
    });

    return () => {
      active = false;
    };
  }, [
    anchoOptimizado,
    configKey,
    normalizedConfig,
    resolver,
    mantenerAnteriorDuranteCarga,
  ]);

  useLayoutEffect(() => {
    if (!stagedKey) return;

    let cancelado = false;
    const clave = stagedKey;

    const confirmarYActivar = async () => {
      // El nuevo frame ya esta montado pero completamente invisible.
      // Esperamos a que SUS <img> reales esten cargados y decodificados;
      // precargar la URL por separado no garantiza que Chromium ya haya
      // pintado el nodo que React acaba de montar.
      const nodo = frameRefs.current.get(clave) ?? null;
      const domListo = await esperarFrameDOMListo(nodo);

      if (
        cancelado ||
        latestRequestRef.current !== clave ||
        !domListo
      ) {
        if (!cancelado && latestRequestRef.current === clave && !domListo) {
          setFalloCarga(true);
          setCargando(false);
          setStagedKey(null);
        }
        return;
      }

      // Dos cuadros completos con el frame nuevo ya decodificado. El anterior
      // sigue siendo el unico visible durante toda esta espera.
      await siguienteFrameNavegador();
      await siguienteFrameNavegador();

      if (cancelado || latestRequestRef.current !== clave) return;

      // Un solo commit cambia las clases: el anterior deja de ser activo y el
      // nuevo pasa a activo. Nunca existe un estado visual sin uno de los dos.
      activeKeyRef.current = clave;
      setActiveKey(clave);
      setStagedKey(null);
      setCargando(false);
      onReadyRef.current?.();

      window.setTimeout(() => {
        if (latestRequestRef.current !== clave) return;
        setFrames((actuales) =>
          actuales.filter((frame) => frame.key === clave)
        );
      }, 120);
    };

    void confirmarYActivar();

    return () => {
      cancelado = true;
    };
  }, [stagedKey]);

  const activeFrame =
    frames.find((frame) => frame.key === activeKey) ?? null;
  const estadoAvatar = activeFrame
    ? cargando
      ? "updating"
      : "ready"
    : falloCarga
      ? "error"
      : "loading";

  return (
    <div
      className="relative fcc-avatar-atomic"
      data-avatar-status={estadoAvatar}
      role="img"
      aria-label={
        falloCarga && !activeFrame
          ? "Avatar no disponible temporalmente"
          : "Avatar completo"
      }
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    >
      {!activeFrame && <PlaceholderAvatar fallo={falloCarga} />}

      {frames.map((frame) => {
        const esActivo = frame.key === activeKey;

        return (
          <div
            key={frame.key}
            ref={(node) => {
              if (node) {
                frameRefs.current.set(frame.key, node);
              } else {
                frameRefs.current.delete(frame.key);
              }
            }}
            className={`fcc-avatar-frame ${
              esActivo ? "is-active" : "is-staging"
            }`}
            aria-hidden={!esActivo}
          >
            <CapasAvatar frame={frame} />
          </div>
        );
      })}

      <style jsx>{`
        .fcc-avatar-atomic {
          isolation: isolate;
        }

        .fcc-avatar-frame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          contain: layout paint style;
          pointer-events: none;
        }

        .fcc-avatar-frame.is-active {
          z-index: 2;
          opacity: 1;
          visibility: visible;
        }

        .fcc-avatar-frame.is-staging {
          z-index: 1;
          opacity: 0;
          visibility: visible;
        }
      `}</style>
    </div>
  );
}
