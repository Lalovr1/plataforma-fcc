/**
 * Renderiza el avatar del usuario en base a una configuración de capas.
 * Cada capa corresponde a una parte del avatar (piel, ojos, ropa, etc.)
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";

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

function getImageCache(): Map<string, Promise<void>> {
  if (typeof window === "undefined") {
    return new Map();
  }

  const w = window as any;

  if (!w.__avatarImageCache) {
    w.__avatarImageCache = new Map<string, Promise<void>>();
  }

  return w.__avatarImageCache;
}

function preloadImage(src: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const cache = getImageCache();

  if (cache.has(src)) {
    return cache.get(src)!;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new Image();

    img.onload = () => resolve();
    img.onerror = () => resolve();

    img.src = src;

    if (img.decode) {
      img.decode().then(() => resolve()).catch(() => {});
    }
  });

  cache.set(src, promise);
  return promise;
}

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

function LayerImage({
  src,
  alt,
  zIndex,
}: {
  src: string;
  alt: string;
  zIndex?: number;
}) {
  return (
    <img
      src={src}
      className="absolute inset-0 w-full h-full object-contain"
      style={{ zIndex }}
      alt={alt}
      draggable={false}
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
  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex,
        backgroundColor: color,
        opacity,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
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
            backgroundImage: `url(${relleno})`,
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
            backgroundImage: `url(${relleno})`,
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

export default function RenderizadorAvatar({ config, size = 150 }: Props) {
  const normalizedConfig = useMemo(() => normalizeConfig(config), [config]);
  const configKey = useMemo(() => getConfigKey(normalizedConfig), [normalizedConfig]);

  const [displayConfig, setDisplayConfig] = useState<AvatarConfig | null>(
    normalizedConfig
  );

  useEffect(() => {
    if (!normalizedConfig) {
      setDisplayConfig(null);
      return;
    }

    let active = true;

    const sources = getVisibleSources(normalizedConfig);

    Promise.allSettled(sources.map((src) => preloadImage(src))).then(() => {
      if (!active) return;
      setDisplayConfig(normalizedConfig);
    });

    return () => {
      active = false;
    };
  }, [configKey, normalizedConfig]);

  if (!displayConfig) return null;

  const gender = displayConfig.gender;
  const skinSrc = `/elementos_avatar/base/${gender}/piel.png`;
  const contornoSrc = `/elementos_avatar/base/${gender}/contorno.png`;

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    >
      <div className="absolute inset-0 z-0">
        <LayerImage src={skinSrc} alt="base piel" />

        <MaskTint
          src={skinSrc}
          color={displayConfig.skinColor ?? "#f1c27d"}
          opacity={0.5}
        />

        <LayerImage src={contornoSrc} alt="contorno" />
      </div>

      {!isNone(displayConfig.mouth) && (
        <LayerImage
          src={`/elementos_avatar/cara/bocas/${displayConfig.mouth}`}
          alt="boca"
        />
      )}

      {!isNone(displayConfig.nose) && (
        <LayerImage
          src={`/elementos_avatar/cara/narices/${displayConfig.nose}`}
          alt="nariz"
        />
      )}

      {!isNone(displayConfig.eyes) && (
        <LayerImage
          src={
            ["Ojos5.png", "Ojos6.png", "Ojos7.png"].includes(displayConfig.eyes)
              ? `/elementos_avatar/cara/ojos/${displayConfig.eyes}`
              : `/elementos_avatar/cara/ojos/${gender}/${displayConfig.eyes}`
          }
          alt="ojos"
        />
      )}

      {!isNone(displayConfig.glasses) && (
        <LayerImage
          src={`/elementos_avatar/cara/lentes/${displayConfig.glasses}`}
          alt="lentes"
        />
      )}

      {!isNone(displayConfig.hair) && (
        <LayerImage
          src={`/elementos_avatar/cabello/${gender}/${displayConfig.hair}`}
          alt="cabello"
        />
      )}

      <PlayeraLayer config={displayConfig} />

      <SueterLayer config={displayConfig} />

      {!isNone(displayConfig.accessory) && (
        <LayerImage
          src={`/elementos_avatar/accesorios/${displayConfig.accessory}`}
          alt="accesorio"
        />
      )}
    </div>
  );
}