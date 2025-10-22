/**
 * Renderiza el avatar del usuario en base a una configuración de capas.
 * Cada capa corresponde a una parte del avatar (piel, ojos, ropa, etc.)
 */

"use client";

import React, { useState, useEffect, useRef } from "react";


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

export default function RenderizadorAvatar({ config, size = 150 }: Props) {
  if (!config) return null;
  const safeConfig = config;

const [renderedGender, setRenderedGender] = useState(safeConfig.gender);
const [prevSueter, setPrevSueter] = useState(safeConfig.sueter);
const [prevGender, setPrevGender] = useState(safeConfig.gender);
const [sueterReady, setSueterReady] = useState(true);
const [baseReady, setBaseReady] = useState(true);

// Ayuda a detectar si un suéter tiene Relleno+Contorno o es simple
function isComplexSweater(name: string) {
  return /^Sueter\d+$/i.test(name);
}

// Detecta si una playera tiene Relleno+Contorno o es simple
function isComplexShirt(name: string) {
  return /^Playera\d+$/i.test(name);
}

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.src = src;
    if (img.decode) img.decode().then(() => resolve()).catch(() => resolve());
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

useEffect(() => {
  const nextGender = safeConfig.gender;
  if (nextGender === renderedGender) return;

  let cancelled = false;
  setSueterReady(false);
  setBaseReady(false);

  (async () => {
    const name = safeConfig.sueter;

    // Precargamos todo lo visible del nuevo género: piel, contorno, cabello, playera y suéter
    const preloadBase = [
      `/elementos_avatar/base/${nextGender}/piel.png`,
      `/elementos_avatar/base/${nextGender}/contorno.png`,
    ];

    const preloadHair =
      safeConfig.hair && safeConfig.hair !== "none"
        ? [`/elementos_avatar/cabello/${nextGender}/${safeConfig.hair}`]
        : [];

    let preloadPlayera: string[] = [];
      if (safeConfig.playera && safeConfig.playera !== "none") {
        const name = safeConfig.playera;
        preloadPlayera = isComplexShirt(name)
          ? [
              `/elementos_avatar/ropa/${nextGender}/playeras/${name}_Relleno.png`,
              `/elementos_avatar/ropa/${nextGender}/playeras/${name}_Contorno.png`,
            ]
          : [`/elementos_avatar/ropa/${nextGender}/playeras/${name}.png`];
      }

    let preloadSweater: string[] = [];
    if (name && name !== "none") {
      preloadSweater = isComplexSweater(name)
        ? [
            `/elementos_avatar/ropa/${nextGender}/sueteres/${name}_Relleno.png`,
            `/elementos_avatar/ropa/${nextGender}/sueteres/${name}_Contorno.png`,
          ]
        : [`/elementos_avatar/ropa/${nextGender}/sueteres/${name}.png`];
    }

    const allUrls = [
      ...preloadBase,
      ...preloadHair,
      ...preloadPlayera,
      ...preloadSweater,
    ];

    // Esperamos a que TODO esté decodificado antes del cambio
    await Promise.all(
      allUrls.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.decode?.().then(() => resolve()).catch(() => resolve());
          })
      )
    );

    if (cancelled) return;

    setBaseReady(true);
    // Una vez listo todo, actualizamos de golpe (sin parpadeo intermedio)
    setPrevSueter(safeConfig.sueter);
    setPrevGender(renderedGender);
    setRenderedGender(nextGender);

    // Damos un frame para que se monte todo y recién entonces marcamos listo
    requestAnimationFrame(() => setSueterReady(true));
  })();

  return () => {
    cancelled = true;
  };
}, [
  safeConfig.gender,
  safeConfig.hair,
  safeConfig.playera,
  safeConfig.sueter,
  renderedGender,
]);



    //  Precargar las máscaras de piel para evitar parpadeo al cambiar de género
    useEffect(() => {
      const imgM = new Image();
      const imgF = new Image();
      imgM.src = "/elementos_avatar/base/masculino/piel.png";
      imgF.src = "/elementos_avatar/base/femenino/piel.png";
    }, []);

  function TransicionSueter({
    src,
    prevSrc,
  }: {
    src: string;
    prevSrc: string | null;
  }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
      let active = true;
      const img = new Image();
      img.src = src;
      img.decode?.().then(() => active && setReady(true)).catch(() => {});
      img.onload = () => active && setReady(true);
      return () => {
        active = false;
      };
    }, [src]);

    return (
      <div className="absolute inset-0 w-full h-full">
        {/* capa anterior se mantiene hasta que la nueva está lista */}
        {prevSrc && (
          <img
            src={prevSrc}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ease-in-out ${
              ready ? "opacity-0" : "opacity-100"
            }`}
            alt="suéter anterior"
          />
        )}
        {/* capa nueva (fade-in) */}
        <img
          src={src}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ease-in-out ${
            ready ? "opacity-100" : "opacity-0"
          }`}
          alt="suéter actual"
        />
      </div>
    );
  }

  // Versión extendida: maneja suéteres con y sin contorno+relleno
function SueterCrossfade({
  currentName,
  currentGender,
  prevName,
  prevGender,
  color,
  onReady,
}: {
  currentName: string;
  currentGender: "masculino" | "femenino";
  prevName?: string | null;
  prevGender?: "masculino" | "femenino" | null;
  color: string;
  onReady?: () => void;
}) {
  const [ready, setReady] = useState(true);
  const [showPrev, setShowPrev] = useState(false);
  const [visibleName, setVisibleName] = useState(currentName);

  // Detecta si es un suéter con _Relleno/_Contorno
  const isComplex = isComplexSweater;

  useEffect(() => {
    if (currentName === visibleName) return;

    setShowPrev(true);
    setReady(false);

    const loadImages = async () => {
      const base = `/elementos_avatar/ropa/${currentGender}/sueteres/${currentName}`;
      const sources = isComplex(currentName)
        ? [`${base}_Relleno.png`, `${base}_Contorno.png`]
        : [`${base}.png`];

      await Promise.all(
        sources.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.src = src;
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.decode?.().then(() => resolve()).catch(() => resolve());
            })
        )
      );

      requestAnimationFrame(() => {
        setVisibleName(currentName);
        setReady(true);
        onReady?.();
        setTimeout(() => setShowPrev(false), 200);
      });
    };

    loadImages();
  }, [currentName, currentGender]);

  const renderLayer = (
    gender: "masculino" | "femenino",
    name: string,
    isPrev = false
  ) => {
    const complex = isComplex(name);
    const base = `/elementos_avatar/ropa/${gender}/sueteres/${name}`;

    if (complex) {
      const relleno = `${base}_Relleno.png`;
      const contorno = `${base}_Contorno.png`;

      return (
        <div
          key={gender + name}
          className={`absolute inset-0 transition-opacity duration-200 ${
            ready && !isPrev ? "opacity-100" : isPrev ? "opacity-0" : "opacity-100"
          }`}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${relleno})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: color,
              opacity: 0.5,
              maskImage: `url(${relleno})`,
              WebkitMaskImage: `url(${relleno})`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              pointerEvents: "none",
            }}
          />
          <img
            src={contorno}
            className="absolute inset-0 w-full h-full object-contain"
            alt="sueter-previo"
          />
        </div>
      );
    } else {
      // Simple: una sola imagen
      return (
        <img
          key={gender + name}
          src={`${base}.png`}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
            ready && !isPrev ? "opacity-100" : isPrev ? "opacity-0" : "opacity-100"
          }`}
          alt="sueter-simple"
        />
      );
    }
  };

  const complexVisible = isComplex(visibleName);
  const basePath = `/elementos_avatar/ropa/${currentGender}/sueteres/${visibleName}`;

  return (
    <div className="absolute inset-0">
      {/* Suéter anterior (fade out) */}
      {showPrev && prevName && prevGender && renderLayer(prevGender, prevName, true)}

      {/* Suéter actual (fade in) */}
      {complexVisible ? (
        renderLayer(currentGender, visibleName, false)
      ) : (
        renderLayer(currentGender, visibleName, false)
      )}
    </div>
  );
}


  function SueterSimple({
    src,
    prevSrc,
  }: {
    src: string;
    prevSrc: string | null;
  }) {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      let active = true;
      const img = new Image();
      img.src = src;
      img.onload = () => active && setLoaded(true);
      img.decode?.().then(() => active && setLoaded(true)).catch(() => {});
      return () => {
        active = false;
      };
    }, [src]);

    return (
      <div className="absolute inset-0 w-full h-full">
        {/* Mantiene el anterior 1 frame extra */}
        {prevSrc && !loaded && (
          <img
            src={prevSrc}
            className="absolute inset-0 w-full h-full object-contain"
            alt="sueter previo"
          />
        )}
        {loaded && (
          <img
            src={src}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ease-in-out opacity-100"
            alt="sueter actual"
          />
        )}
        {prevSrc && loaded && (
          <img
            src={prevSrc}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ease-in-out opacity-0"
            alt="sueter previo"
          />
        )}
      </div>
    );
  }

  useEffect(() => {
  const complejos = ["Sueter1", "Sueter2", "Sueter3"];
  const simples = ["ArmaduraNegra", "ChaquetaNegra", "SudaderaBuap2", "SudaderaBuap","PlayeraNeon"];
  const playeras = ["Playera1", "Playera2", "Playera3", "Playera4"];

  const preload = (src: string) => {
    const img = new Image();
    img.src = src;
    img.onload = () => console.log("✅ Precargado:", src);
    img.onerror = () => console.warn("⚠️ No encontrado:", src);
  };

  ["masculino", "femenino"].forEach((gen) => {
    // Playeras
    playeras.forEach((name) => {
      preload(`/elementos_avatar/ropa/${gen}/playeras/${name}_Relleno.png`);
      preload(`/elementos_avatar/ropa/${gen}/playeras/${name}_Contorno.png`);
    });

    // Suéteres compuestos
    complejos.forEach((name) => {
      preload(`/elementos_avatar/ropa/${gen}/sueteres/${name}_Relleno.png`);
      preload(`/elementos_avatar/ropa/${gen}/sueteres/${name}_Contorno.png`);
    });

    // Suéteres simples (solo .png)
    simples.forEach((name) => {
      preload(`/elementos_avatar/ropa/${gen}/sueteres/${name}.png`);
    });
  });
}, []);



  // Precarga y decodificación instantánea en memoria (evita retraso del relleno)
  useEffect(() => {
    if (!safeConfig.sueter || safeConfig.sueter === "none") return;

    const gen = safeConfig.gender;
    const name = safeConfig.sueter;

    const base = `/elementos_avatar/ropa/${gen}/sueteres/${name}`;
    const sources = isComplexSweater(name)
      ? [`${base}_Relleno.png`, `${base}_Contorno.png`]
      : [`${base}.png`];

    // Se mantiene en caché global (evita recargar si ya se usó)
    if (!(window as any).__avatarImageCache) {
      (window as any).__avatarImageCache = new Map<string, HTMLImageElement>();
    }
    const cache = (window as any).__avatarImageCache;

    const ensureLoaded = (src: string) => {
      return new Promise<void>((resolve) => {
        if (cache.has(src)) return resolve();
        const img = new Image();
        img.src = src;
        img.decode?.().then(() => resolve()).catch(resolve);
        cache.set(src, img);
      });
    };

    Promise.allSettled(sources.map(ensureLoaded));
      }, [safeConfig.gender, safeConfig.sueter]);

      // Precarga y decodificación instantánea de playeras
    useEffect(() => {
      if (!safeConfig.playera || safeConfig.playera === "none") return;

      const gen = safeConfig.gender;
      const name = safeConfig.playera;

      const base = `/elementos_avatar/ropa/${gen}/playeras/${name}`;
      const sources = isComplexShirt(name)
        ? [`${base}_Relleno.png`, `${base}_Contorno.png`]
        : [`${base}.png`];

      if (!(window as any).__avatarImageCache) {
        (window as any).__avatarImageCache = new Map<string, HTMLImageElement>();
      }
      const cache = (window as any).__avatarImageCache;

      const ensureLoaded = (src: string) => {
        return new Promise<void>((resolve) => {
          if (cache.has(src)) return resolve();
          const img = new Image();
          img.src = src;
          img.decode?.().then(() => resolve()).catch(resolve);
          cache.set(src, img);
        });
      };

      Promise.allSettled(sources.map(ensureLoaded));
    }, [safeConfig.gender, safeConfig.playera]);

    // Precarga y fuerza render GPU de todas las bases una sola vez al abrir el modal
  useEffect(() => {
    const preloadAndDraw = async () => {
      const gens = ["masculino", "femenino"];
      for (const g of gens) {
        const baseImgs = [
          `/elementos_avatar/base/${g}/piel.png`,
          `/elementos_avatar/base/${g}/contorno.png`,
        ];
        for (const src of baseImgs) {
          const img = new Image();
          img.src = src;
          try {
            await img.decode?.();
          } catch {}
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, 1, 1);
        }
        const extraImgs = [
          `/elementos_avatar/ropa/${g}/sueteres/Sueter1_Relleno.png`,
          `/elementos_avatar/ropa/${g}/sueteres/Sueter1_Contorno.png`,
          `/elementos_avatar/ropa/${g}/playeras/Playera1_Relleno.png`,
          `/elementos_avatar/ropa/${g}/playeras/Playera1_Contorno.png`,
        ];
        for (const src of extraImgs) {
          const img = new Image();
          img.src = src;
          try {
            await img.decode?.();
          } catch {}
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, 1, 1);
        }
      }
    };
    preloadAndDraw();
  }, []);

  return (
  <div
    className={`relative transition-opacity duration-300 ${
      baseReady && sueterReady ? "opacity-100" : "opacity-0"
    }`}
    style={{ width: size, height: size }}
  >
      {/* --- BASE: piel relleno + contorno --- */}
      <div className="absolute inset-0 z-0">
        {/* Mantiene ambas capas montadas durante la transición */}
        {["masculino", "femenino"].map((gen) => {
  const switching =
  !baseReady &&
  prevGender &&
  prevGender !== renderedGender;


  const shouldMount =
    switching
      ? gen === prevGender || gen === safeConfig.gender
      : gen === safeConfig.gender;

  const opacityClass =
    switching
      ? gen === prevGender
        ? "opacity-100"
        : "opacity-0"
      : "opacity-100";

  return (
    <div
      key={gen}
      className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
        shouldMount ? opacityClass : "hidden"
      }`}
    >
      <div
        key={gen}
        className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
          shouldMount ? opacityClass : "hidden"
        }`}
      >
        {/* --- Capa completa de piel (imagen + relleno dentro del mismo fade) --- */}
        <div className="absolute inset-0">
          <img
            src={`/elementos_avatar/base/${gen}/piel.png`}
            className="absolute inset-0 w-full h-full object-contain"
            alt="base piel"
          />
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundColor: safeConfig.skinColor ?? "#f1c27d",
              opacity: 0.5,
              maskImage: `url(/elementos_avatar/base/${gen}/piel.png)`,
              WebkitMaskImage: `url(/elementos_avatar/base/${gen}/piel.png)`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
})}


        {/* Contorno */}
        <img
          src={`/elementos_avatar/base/${safeConfig.gender}/contorno.png`}
          className="absolute inset-0 w-full h-full object-contain"
          alt="contorno"
        />
      </div>



      {/* --- CARA (boca → nariz → ojos → lentes) --- */}
      {safeConfig.mouth && safeConfig.mouth !== "none" && (
        <img
          src={`/elementos_avatar/cara/bocas/${safeConfig.mouth}`}
          className="absolute inset-0 w-full h-full object-contain"
          alt="boca"
        />
      )}

      {safeConfig.nose && safeConfig.nose !== "none" && (
        <img
          src={`/elementos_avatar/cara/narices/${safeConfig.nose}`}
          className="absolute inset-0 w-full h-full object-contain"
          alt="nariz"
        />
      )}

      {safeConfig.eyes && safeConfig.eyes !== "none" && (
        <img
          src={
            ["Ojos5.png", "Ojos6.png", "Ojos7.png"].includes(safeConfig.eyes)
              ? `/elementos_avatar/cara/ojos/${safeConfig.eyes}`
              : `/elementos_avatar/cara/ojos/${safeConfig.gender}/${safeConfig.eyes}`
          }
          className="absolute inset-0 w-full h-full object-contain"
          alt="ojos"
        />
      )}

      {safeConfig.glasses && safeConfig.glasses !== "none" && (
        <img
          src={`/elementos_avatar/cara/lentes/${safeConfig.glasses}`}
          className="absolute inset-0 w-full h-full object-contain"
          alt="lentes"
        />
      )}

      {/* --- CABELLO --- */}
{safeConfig.hair && safeConfig.hair !== "none" && (
  <>
    {["masculino", "femenino"].map((gen) => {
      const switching = !baseReady && prevGender && prevGender !== safeConfig.gender;
      const shouldMount = switching
        ? gen === prevGender || gen === safeConfig.gender
        : gen === safeConfig.gender;
      const opacityClass = switching
        ? gen === prevGender
          ? "opacity-100"
          : "opacity-0"
        : "opacity-100";
      return shouldMount ? (
        <img
          key={gen}
          src={`/elementos_avatar/cabello/${gen}/${safeConfig.hair}`}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${opacityClass}`}
          alt="cabello"
        />
      ) : null;
    })}
  </>
)}


      {/* --- PLAYERA --- */}
{safeConfig.playera && safeConfig.playera !== "none" && (
  <>
    {["masculino", "femenino"].map((gen) => {
      const switching = !sueterReady && prevGender && prevGender !== safeConfig.gender;
      const shouldMount = switching
        ? gen === prevGender || gen === safeConfig.gender
        : gen === safeConfig.gender;
      const opacityClass = switching
        ? gen === prevGender
          ? "opacity-100"
          : "opacity-0"
        : "opacity-100";
      return shouldMount ? (
        <div
          key={gen}
          className={`absolute inset-0 transition-opacity duration-150 ${opacityClass}`}
        >
          {isComplexShirt(safeConfig.playera) ? (
            <>
              {/* Relleno + color + contorno */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(/elementos_avatar/ropa/${gen}/playeras/${safeConfig.playera}_Relleno.png)`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                }}
              />
              <div
                className="absolute inset-0 will-change-transform"
                style={{
                  backgroundColor: safeConfig.sueterColor ?? "#ffffff",
                  opacity: 0.6,
                  maskImage: `url(/elementos_avatar/ropa/${gen}/playeras/${safeConfig.playera}_Relleno.png)`,
                  WebkitMaskImage: `url(/elementos_avatar/ropa/${gen}/playeras/${safeConfig.playera}_Relleno.png)`,
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  pointerEvents: "none",
                }}
              />
              <img
                src={`/elementos_avatar/ropa/${gen}/playeras/${safeConfig.playera}_Contorno.png`}
                className="absolute inset-0 w-full h-full object-contain"
                alt="playera"
              />
            </>
          ) : (
            <img
              src={`/elementos_avatar/ropa/${gen}/playeras/${safeConfig.playera}.png`}
              className="absolute inset-0 w-full h-full object-contain"
              alt="playera simple"
            />
          )}
        </div>
      ) : null;
    })}
  </>
)}


      {/* --- SUÉTER o PRENDA EXTERIOR --- */}
      {safeConfig.sueter && safeConfig.sueter !== "none" && (
        (() => {
          const rolUsuario =
            typeof window !== "undefined"
              ? localStorage.getItem("rol_usuario") || "estudiante"
              : "estudiante";

          //  Si es una capa 
          if (/^Capa/i.test(safeConfig.sueter)) {
            return (
              <img
                src={`/elementos_avatar/ropa_profesor/${safeConfig.gender}/${safeConfig.sueter}.png`}
                className="absolute inset-0 w-full h-full object-contain"
                alt="ropa profesor"
              />
            );
          }

          // ESTUDIANTE
          return (
            <SueterCrossfade
              currentName={safeConfig.sueter}
              currentGender={safeConfig.gender}
              prevName={!sueterReady && prevSueter !== "none" ? prevSueter : null}
              prevGender={!sueterReady ? prevGender : null}
              color={safeConfig.sueterColor ?? "#ffffff"}
              onReady={() => setSueterReady(true)}
            />
          );
        })()
      )}

      {/* --- ACCESORIO --- */}
      {safeConfig.accessory && safeConfig.accessory !== "none" && (
        <img
          src={`/elementos_avatar/accesorios/${safeConfig.accessory}`}
          className="absolute inset-0 w-full h-full object-contain"
          alt="accesorio"
        />
      )}

      {/* --- Precargador invisible para evitar flash inicial --- */}
      <div style={{ display: "none" }}>
        <img src="/elementos_avatar/base/masculino/piel.png" alt="" />
        <img src="/elementos_avatar/base/femenino/piel.png" alt="" />
        <img src="/elementos_avatar/ropa/masculino/playeras/Playera1_Relleno.png" alt="" />
        <img src="/elementos_avatar/ropa/masculino/sueteres/Sueter1_Relleno.png" alt="" />
      </div>

    </div>
  );
}