/**
 * Renderiza el avatar del usuario en base a una configuración de capas.
 * Cada capa corresponde a una parte del avatar (piel, ojos, ropa, etc.)
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

export type AvatarConfig = {
  gender: "masculino" | "femenino";
  skin: string;
  skinColor?: string;
  eyes: string;
  mouth: string;
  nose: string;
  hair: string;
  playera: string;
  sueter: string;
  sueterColor?: string;
  glasses: string;
  collar: string;
  pulsera: string;
  accessory: string;
};

interface Props {
  config?: AvatarConfig | null;
  size?: number;
  mantenerAnteriorDuranteCarga?: boolean;
  onReady?: () => void;
}

const defaultConfig: AvatarConfig = {
  gender: "masculino",
  skin: "base/masculino/piel.png",
  skinColor: "#f1c27d",
  eyes: "Ojos1.png",
  mouth: "Boca1.png",
  nose: "Nariz1.png",
  glasses: "none",
  hair: "Cabello1.png",
  playera: "Playera1",
  sueter: "none",
  sueterColor: "#ffffff",
  collar: "none",
  pulsera: "none",
  accessory: "none",
};

function isNone(value?: string | null) {
  return !value || value === "none";
}

function isComplexSweater(name: string) {
  return /^Sueter\d+$/i.test(name);
}

function isComplexShirt(name: string) {
  return /^Playera\d+$/i.test(name);
}

function normalizeConfig(config?: AvatarConfig | null): AvatarConfig | null {
  if (!config) return null;

  const raw: any = config;

  const genderRaw = raw.gender ?? raw.bodyType;
  const gender =
    genderRaw === "femenino" || genderRaw === "female"
      ? "femenino"
      : "masculino";

  return {
    ...defaultConfig,
    ...raw,
    gender,
    skin: raw.skin ?? defaultConfig.skin,
    skinColor: raw.skinColor ?? defaultConfig.skinColor,
    eyes: raw.eyes ?? defaultConfig.eyes,
    mouth: raw.mouth ?? defaultConfig.mouth,
    nose: raw.nose ?? defaultConfig.nose,
    hair: raw.hair ?? defaultConfig.hair,
    playera: raw.playera ?? raw.clothes ?? defaultConfig.playera,
    sueter: raw.sueter ?? defaultConfig.sueter,
    sueterColor: raw.sueterColor ?? defaultConfig.sueterColor,
    glasses: raw.glasses ?? defaultConfig.glasses,
    collar: raw.collar ?? defaultConfig.collar,
    pulsera: raw.pulsera ?? defaultConfig.pulsera,
    accessory: raw.accessory ?? defaultConfig.accessory,
  };
}

function getConfigKey(config: AvatarConfig | null) {
  if (!config) return "null";

  return [
    config.gender,
    config.skinColor,
    config.eyes,
    config.mouth,
    config.nose,
    config.hair,
    config.playera,
    config.sueter,
    config.sueterColor,
    config.glasses,
    config.accessory,
  ].join("|");
}

const AvatarImageResolverContext = createContext<(src: string) => string>(
  (src) => src
);

function getVisibleSources(config: AvatarConfig) {
  const sources: string[] = [];
  const gender = config.gender;

  sources.push(`/elementos_avatar/base/${gender}/piel.png`);
  sources.push(`/elementos_avatar/base/${gender}/contorno.png`);

  if (!isNone(config.mouth)) {
    sources.push(`/elementos_avatar/cara/bocas/${config.mouth}`);
  }

  if (!isNone(config.nose)) {
    sources.push(`/elementos_avatar/cara/narices/${config.nose}`);
  }

  if (!isNone(config.eyes)) {
    const ojosGenericos = ["Ojos5.png", "Ojos6.png", "Ojos7.png"];

    sources.push(
      ojosGenericos.includes(config.eyes)
        ? `/elementos_avatar/cara/ojos/${config.eyes}`
        : `/elementos_avatar/cara/ojos/${gender}/${config.eyes}`
    );
  }

  if (!isNone(config.glasses)) {
    sources.push(`/elementos_avatar/cara/lentes/${config.glasses}`);
  }

  if (!isNone(config.hair)) {
    sources.push(`/elementos_avatar/cabello/${gender}/${config.hair}`);
  }

  if (!isNone(config.playera)) {
    const base = `/elementos_avatar/ropa/${gender}/playeras/${config.playera}`;

    if (isComplexShirt(config.playera)) {
      sources.push(`${base}_Relleno.png`);
      sources.push(`${base}_Contorno.png`);
    } else {
      sources.push(`${base}.png`);
    }
  }

  if (!isNone(config.sueter)) {
    if (/^Capa/i.test(config.sueter)) {
      sources.push(`/elementos_avatar/ropa_profesor/${gender}/${config.sueter}.png`);
    } else {
      const base = `/elementos_avatar/ropa/${gender}/sueteres/${config.sueter}`;

      if (isComplexSweater(config.sueter)) {
        sources.push(`${base}_Relleno.png`);
        sources.push(`${base}_Contorno.png`);
      } else {
        sources.push(`${base}.png`);
      }
    }
  }

  if (!isNone(config.accessory)) {
    sources.push(`/elementos_avatar/accesorios/${config.accessory}`);
  }

  return sources;
}

function getAnchoOptimizado(size: number) {
  return Math.min(640, Math.max(96, Math.ceil(size * 2)));
}

/**
 * Prepara exclusivamente las capas de la configuración que se va a mostrar.
 * No descarga el catálogo completo del editor y, por tanto, evita gastar
 * datos en prendas que el usuario quizá nunca seleccione.
 */
export async function prepararRecursosAvatarFCC(
  config?: AvatarConfig | null,
  size = 150
) {
  const normalizada = normalizeConfig(config);
  if (!normalizada) return false;

  const ancho = getAnchoOptimizado(size);
  const sources = getVisibleSources(normalizada).map((src) =>
    obtenerUrlImagenOptimizada(src, ancho, 82)
  );

  return precargarImagenes(sources);
}

function LayerImage({
  src,
  alt,
  zIndex,
}: {
  src: string;
  alt: string;
  zIndex?: number;
}) {
  const resolver = useContext(AvatarImageResolverContext);

  return (
    <img
      src={resolver(src)}
      className="absolute inset-0 w-full h-full object-contain"
      style={{ zIndex }}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}

function MaskTint({
  src,
  color,
  opacity = 0.5,
  zIndex,
}: {
  src: string;
  color: string;
  opacity?: number;
  zIndex?: number;
}) {
  const resolver = useContext(AvatarImageResolverContext);
  const resolvedSrc = resolver(src);

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex,
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

function PlayeraLayer({ config }: { config: AvatarConfig }) {
  const resolver = useContext(AvatarImageResolverContext);

  if (isNone(config.playera)) return null;

  const gender = config.gender;
  const name = config.playera;
  const base = `/elementos_avatar/ropa/${gender}/playeras/${name}`;

  if (isComplexShirt(name)) {
    const relleno = `${base}_Relleno.png`;
    const contorno = `${base}_Contorno.png`;

    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${resolver(relleno)})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "contain",
          }}
        />

        <MaskTint
          src={relleno}
          color={config.sueterColor ?? "#ffffff"}
          opacity={0.6}
        />

        <LayerImage src={contorno} alt="playera" />
      </div>
    );
  }

  return (
    <LayerImage
      src={`${base}.png`}
      alt="playera"
    />
  );
}

function SueterLayer({ config }: { config: AvatarConfig }) {
  const resolver = useContext(AvatarImageResolverContext);

  if (isNone(config.sueter)) return null;

  const gender = config.gender;
  const name = config.sueter;

  if (/^Capa/i.test(name)) {
    return (
      <LayerImage
        src={`/elementos_avatar/ropa_profesor/${gender}/${name}.png`}
        alt="ropa profesor"
      />
    );
  }

  const base = `/elementos_avatar/ropa/${gender}/sueteres/${name}`;

  if (isComplexSweater(name)) {
    const relleno = `${base}_Relleno.png`;
    const contorno = `${base}_Contorno.png`;

    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${resolver(relleno)})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "contain",
          }}
        />

        <MaskTint
          src={relleno}
          color={config.sueterColor ?? "#ffffff"}
          opacity={0.5}
        />

        <LayerImage src={contorno} alt="suéter" />
      </div>
    );
  }

  return (
    <LayerImage
      src={`${base}.png`}
      alt="suéter"
    />
  );
}

type AvatarFrame = {
  key: string;
  config: AvatarConfig;
  resolver: (src: string) => string;
};

function CapasAvatar({ frame }: { frame: AvatarFrame }) {
  const gender = frame.config.gender;
  const skinSrc = `/elementos_avatar/base/${gender}/piel.png`;
  const contornoSrc = `/elementos_avatar/base/${gender}/contorno.png`;

  return (
    <AvatarImageResolverContext.Provider value={frame.resolver}>
      <div className="relative h-full w-full fcc-avatar-completo">
        <div className="absolute inset-0 z-0">
          <LayerImage src={skinSrc} alt="base piel" />

          <MaskTint
            src={skinSrc}
            color={frame.config.skinColor ?? "#f1c27d"}
            opacity={0.5}
          />

          <LayerImage src={contornoSrc} alt="contorno" />
        </div>

        {!isNone(frame.config.mouth) && (
          <LayerImage
            src={`/elementos_avatar/cara/bocas/${frame.config.mouth}`}
            alt="boca"
          />
        )}

        {!isNone(frame.config.nose) && (
          <LayerImage
            src={`/elementos_avatar/cara/narices/${frame.config.nose}`}
            alt="nariz"
          />
        )}

        {!isNone(frame.config.eyes) && (
          <LayerImage
            src={
              ["Ojos5.png", "Ojos6.png", "Ojos7.png"].includes(
                frame.config.eyes
              )
                ? `/elementos_avatar/cara/ojos/${frame.config.eyes}`
                : `/elementos_avatar/cara/ojos/${gender}/${frame.config.eyes}`
            }
            alt="ojos"
          />
        )}

        {!isNone(frame.config.glasses) && (
          <LayerImage
            src={`/elementos_avatar/cara/lentes/${frame.config.glasses}`}
            alt="lentes"
          />
        )}

        {!isNone(frame.config.hair) && (
          <LayerImage
            src={`/elementos_avatar/cabello/${gender}/${frame.config.hair}`}
            alt="cabello"
          />
        )}

        <PlayeraLayer config={frame.config} />
        <SueterLayer config={frame.config} />

        {!isNone(frame.config.accessory) && (
          <LayerImage
            src={`/elementos_avatar/accesorios/${frame.config.accessory}`}
            alt="accesorio"
          />
        )}
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
  const normalizedConfig = useMemo(() => normalizeConfig(config), [config]);
  const configKey = useMemo(() => getConfigKey(normalizedConfig), [normalizedConfig]);
  const anchoOptimizado = useMemo(
    () => getAnchoOptimizado(size),
    [size]
  );
  const resolver = useMemo(
    () => (src: string) => obtenerUrlImagenOptimizada(src, anchoOptimizado, 82),
    [anchoOptimizado]
  );

  const [frames, setFrames] = useState<AvatarFrame[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [stagedKey, setStagedKey] = useState<string | null>(null);
  const [cargando, setCargando] = useState(Boolean(normalizedConfig));
  const [falloCarga, setFalloCarga] = useState(false);
  const activeKeyRef = useRef<string | null>(null);
  const latestRequestRef = useRef("");
  const onReadyRef = useRef(onReady);

  onReadyRef.current = onReady;

  useEffect(() => {
    if (!normalizedConfig) {
      latestRequestRef.current = "";
      activeKeyRef.current = null;
      setFrames([]);
      setActiveKey(null);
      setStagedKey(null);
      setCargando(false);
      setFalloCarga(false);
      return;
    }

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

    let activo = true;
    let primerFrame = 0;
    let segundoFrame = 0;

    primerFrame = window.requestAnimationFrame(() => {
      segundoFrame = window.requestAnimationFrame(() => {
        if (!activo || latestRequestRef.current !== stagedKey) return;

        activeKeyRef.current = stagedKey;
        setActiveKey(stagedKey);
        setStagedKey(null);
        setCargando(false);
        onReadyRef.current?.();

        window.setTimeout(() => {
          if (latestRequestRef.current !== stagedKey) return;
          setFrames((actuales) =>
            actuales.filter((frame) => frame.key === stagedKey)
          );
        }, 120);
      });
    });

    return () => {
      activo = false;
      window.cancelAnimationFrame(primerFrame);
      window.cancelAnimationFrame(segundoFrame);
    };
  }, [stagedKey]);

  const activeFrame = frames.find((frame) => frame.key === activeKey) ?? null;
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
          transform: translateZ(0);
          backface-visibility: hidden;
          pointer-events: none;
        }

        .fcc-avatar-frame.is-active {
          z-index: 2;
          opacity: 1;
          visibility: visible;
        }

        .fcc-avatar-frame.is-staging {
          z-index: 1;
          opacity: 0.001;
          visibility: visible;
        }
      `}</style>
    </div>
  );
}
