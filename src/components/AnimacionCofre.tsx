"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rarezaConfig, Rareza } from "@/lib/rarezaConfig";
import CargadorFCC from "@/components/CargadorFCC";
import {
  obtenerUrlImagenOptimizada,
  precargarImagenes,
} from "@/lib/imagenes";
import { FRAMES_COFRE_FCC } from "@/lib/recursosCofre";
interface Recompensa {
  nombre: string;
  imagen: string;
  rareza: Rareza;
}

interface Props {
  userId: string;
  recompensas: Recompensa[];
  nivel?: number;
  tipo?: "nivel" | "bienvenida";
  onFinish?: () => void;
  recursosPrecargados?: boolean;
}

const FRAMES_COFRE = FRAMES_COFRE_FCC;
const AJUSTE_CENTRO_COFRE_X = "50%";
const POSICION_COFRE_Y = "55dvh";
const POSICION_RECOMPENSA_Y = "14.25dvh";

const prepararImagenRecompensa = (src: string) =>
  obtenerUrlImagenOptimizada(src || "/ui/trophy-default.svg", 256, 75);

interface AuraExteriorRender {
  src: string;
  contentWidthPct: number;
  contentHeightPct: number;
  auraOffsetXPct: number;
  auraOffsetYPct: number;
  auraWidthPct: number;
  auraHeightPct: number;
}

const auraExteriorCache = new Map<
  string,
  Promise<AuraExteriorRender | null>
>();

function crearAuraExterior(
  src: string,
  color: string
): Promise<AuraExteriorRender | null> {
  const clave = `${src}|${color}`;

  const existente = auraExteriorCache.get(clave);
  if (existente) return existente;

  const promesa = new Promise<AuraExteriorRender | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const imagen = new Image();
    imagen.decoding = "async";

    if (
      !src.startsWith("/") &&
      !src.startsWith("data:") &&
      !src.startsWith("blob:")
    ) {
      imagen.crossOrigin = "anonymous";
    }

    imagen.onload = () => {
      try {
        const anchoNatural = Math.max(1, imagen.naturalWidth || 1);
        const altoNatural = Math.max(1, imagen.naturalHeight || 1);
        const ladoMaximo = 240;
        const escala = Math.min(
          1,
          ladoMaximo / Math.max(anchoNatural, altoNatural)
        );

        const ancho = Math.max(1, Math.round(anchoNatural * escala));
        const alto = Math.max(1, Math.round(altoNatural * escala));

        const origen = document.createElement("canvas");
        origen.width = ancho;
        origen.height = alto;

        const ctxOrigen = origen.getContext("2d", {
          willReadFrequently: true,
        });

        if (!ctxOrigen) {
          resolve(null);
          return;
        }

        ctxOrigen.clearRect(0, 0, ancho, alto);
        ctxOrigen.drawImage(imagen, 0, 0, ancho, alto);

        const pixeles = ctxOrigen.getImageData(
          0,
          0,
          ancho,
          alto
        );

        const totalPixeles = ancho * alto;
        const exterior = new Uint8Array(totalPixeles);
        const cola = new Int32Array(totalPixeles);
        let inicio = 0;
        let fin = 0;
        const umbralAlpha = 18;

        const agregarSiExterior = (indice: number) => {
          if (
            indice < 0 ||
            indice >= totalPixeles ||
            exterior[indice]
          ) {
            return;
          }

          const alpha = pixeles.data[indice * 4 + 3];
          if (alpha > umbralAlpha) return;

          exterior[indice] = 1;
          cola[fin] = indice;
          fin += 1;
        };

        for (let x = 0; x < ancho; x += 1) {
          agregarSiExterior(x);
          agregarSiExterior((alto - 1) * ancho + x);
        }

        for (let y = 0; y < alto; y += 1) {
          agregarSiExterior(y * ancho);
          agregarSiExterior(y * ancho + (ancho - 1));
        }

        while (inicio < fin) {
          const indice = cola[inicio];
          inicio += 1;

          const x = indice % ancho;
          const y = Math.floor(indice / ancho);

          if (x > 0) agregarSiExterior(indice - 1);
          if (x < ancho - 1) agregarSiExterior(indice + 1);
          if (y > 0) agregarSiExterior(indice - ancho);
          if (y < alto - 1) agregarSiExterior(indice + ancho);
        }

        // Todo lo que NO está conectado con el borde se considera parte de
        // la silueta exterior. Esto rellena huecos internos como los cristales
        // transparentes de unos lentes y evita que el aura aparezca dentro.
        const mascara = document.createElement("canvas");
        mascara.width = ancho;
        mascara.height = alto;

        const ctxMascara = mascara.getContext("2d");
        if (!ctxMascara) {
          resolve(null);
          return;
        }

        const datosMascara = ctxMascara.createImageData(
          ancho,
          alto
        );

        for (let i = 0; i < totalPixeles; i += 1) {
          if (exterior[i]) continue;

          const offset = i * 4;
          datosMascara.data[offset] = 255;
          datosMascara.data[offset + 1] = 255;
          datosMascara.data[offset + 2] = 255;
          datosMascara.data[offset + 3] = 255;
        }

        ctxMascara.putImageData(datosMascara, 0, 0);

        const padding = Math.max(
          22,
          Math.ceil(Math.max(ancho, alto) * 0.12)
        );

        const aura = document.createElement("canvas");
        aura.width = ancho + padding * 2;
        aura.height = alto + padding * 2;

        const ctxAura = aura.getContext("2d");
        if (!ctxAura) {
          resolve(null);
          return;
        }

        const dibujarCapa = (
          blur: number,
          opacidad: number
        ) => {
          const capa = document.createElement("canvas");
          capa.width = aura.width;
          capa.height = aura.height;

          const ctxCapa = capa.getContext("2d");
          if (!ctxCapa) return;

          ctxCapa.filter = `blur(${blur}px)`;
          ctxCapa.drawImage(mascara, padding, padding);
          ctxCapa.filter = "none";
          ctxCapa.globalCompositeOperation = "source-in";
          ctxCapa.fillStyle = color;
          ctxCapa.fillRect(0, 0, capa.width, capa.height);

          ctxAura.globalAlpha = opacidad;
          ctxAura.drawImage(capa, 0, 0);
          ctxAura.globalAlpha = 1;
        };

        dibujarCapa(18, 0.38);
        dibujarCapa(8, 0.82);

        // Borramos la silueta completa (incluidos sus huecos internos
        // rellenados) para conservar únicamente el halo EXTERIOR.
        ctxAura.globalCompositeOperation = "destination-out";
        ctxAura.drawImage(mascara, padding, padding);
        ctxAura.globalCompositeOperation = "source-over";

        const mayor = Math.max(ancho, alto);
        const contentWidthPct = (ancho / mayor) * 100;
        const contentHeightPct = (alto / mayor) * 100;
        const auraWidthPct = ((ancho + padding * 2) / ancho) * 100;
        const auraHeightPct = ((alto + padding * 2) / alto) * 100;
        const auraOffsetXPct = -(padding / ancho) * 100;
        const auraOffsetYPct = -(padding / alto) * 100;

        resolve({
          src: aura.toDataURL("image/png"),
          contentWidthPct,
          contentHeightPct,
          auraOffsetXPct,
          auraOffsetYPct,
          auraWidthPct,
          auraHeightPct,
        });
      } catch {
        resolve(null);
      }
    };

    imagen.onerror = () => resolve(null);
    imagen.src = src;
  });

  auraExteriorCache.set(clave, promesa);
  return promesa;
}

const etiquetaRareza: Record<Rareza, string> = {
  comun: "COMÚN",
  raro: "RARO",
  epico: "ÉPICO",
  legendario: "LEGENDARIO",
};

function RecompensaVisual({
  recompensa,
  variante = "principal",
  pulseKey = 0,
}: {
  recompensa: Recompensa;
  variante?: "principal" | "resumen";
  pulseKey?: number;
}) {
  const { color } = rarezaConfig[recompensa.rareza];
  const imagenRender = prepararImagenRecompensa(recompensa.imagen);
  const principal = variante === "principal";

  return (
    <div
      className={
        principal
          ? "relative flex aspect-square w-[min(270px,64vw,32dvh)] items-center justify-center"
          : "relative flex aspect-square w-[min(94px,16vw,12dvh)] items-center justify-center"
      }
    >
      <motion.img
        key={`${recompensa.imagen}-${pulseKey}-aura`}
        src={imagenRender}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        style={{
          filter: principal
            ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 18px ${color}) drop-shadow(0 0 34px ${color})`
            : `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color}) drop-shadow(0 0 18px ${color})`,
        }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={
          principal
            ? { opacity: [0.56, 0.92, 0.72], scale: [0.985, 1.018, 0.995] }
            : { opacity: 0.74, scale: 1 }
        }
        transition={
          principal
            ? { duration: 1.1, ease: "easeInOut" }
            : { duration: 0.35, ease: "easeOut" }
        }
      />

      <img
        src={imagenRender}
        alt={recompensa.nombre}
        draggable={false}
        decoding="async"
        className="relative z-10 h-full w-full select-none object-contain"
      />
    </div>
  );
}

export default function AnimacionCofre({
  recompensas,
  nivel,
  tipo,
  onFinish,
  recursosPrecargados = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);
  const [mostrarListaFinal, setMostrarListaFinal] = useState(false);
  const [explosionKey, setExplosionKey] = useState(0);
  const [contador, setContador] = useState<number | null>(null);
  const [cofreVisible, setCofreVisible] = useState(false);
  const [animacionInicialTerminada, setAnimacionInicialTerminada] = useState(false);
  const [mostrarMensajeFinal, setMostrarMensajeFinal] = useState(false);
  const [contadorVisible, setContadorVisible] = useState(true);
  const [mostrarRecompensaActual, setMostrarRecompensaActual] = useState(true);
  const [skipRapido, setSkipRapido] = useState(false);
  const [animandoFinal, setAnimandoFinal] = useState(false);
  const [animandoApertura, setAnimandoApertura] = useState(false);
  const [frameApertura, setFrameApertura] = useState(0);
  const [recursosListos, setRecursosListos] = useState(recursosPrecargados);
  const [errorRecursos, setErrorRecursos] = useState(false);
  const [reintentoRecursos, setReintentoRecursos] = useState(0);
  const aperturaTimerRef = useRef<number | null>(null);

  const [bloquearClicks, setBloquearClicks] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBloquearClicks(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const rarezaPrioridad = ["comun", "raro", "epico", "legendario"];
  const recompensasOrdenadas = useMemo(
    () =>
      [...recompensas].sort(
        (a, b) => rarezaPrioridad.indexOf(b.rareza) - rarezaPrioridad.indexOf(a.rareza)
      ),
    [recompensas]
  );

  const total = recompensasOrdenadas.length;

  const rarezaMax = tipo === "bienvenida" ? "legendario" : (recompensasOrdenadas[0]?.rareza || "comun");
  const auraPrincipal = rarezaConfig[rarezaMax].aura;

  const recursosVisuales = useMemo(
    () => [
      ...FRAMES_COFRE,
      ...recompensasOrdenadas.map((recompensa) =>
        prepararImagenRecompensa(recompensa.imagen)
      ),
    ],
    [recompensasOrdenadas]
  );

  useEffect(() => {
    let activo = true;

    if (recursosPrecargados) {
      setRecursosListos(true);
      setErrorRecursos(false);
      return () => {
        activo = false;
      };
    }

    setRecursosListos(false);
    setErrorRecursos(false);

    void precargarImagenes(recursosVisuales, 30_000).then((completo) => {
      if (!activo) return;

      setRecursosListos(completo);
      setErrorRecursos(!completo);
    });

    return () => {
      activo = false;
    };
  }, [recursosVisuales, reintentoRecursos, recursosPrecargados]);

  useEffect(() => {
    return () => {
      if (aperturaTimerRef.current !== null) {
        window.clearTimeout(aperturaTimerRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (!animandoApertura) {
      if (!abierto) setFrameApertura(0);
      return;
    }

    setFrameApertura(0);

    const timers = FRAMES_COFRE.slice(1).map((_, indice) =>
      window.setTimeout(() => {
        setFrameApertura(indice + 1);
      }, (indice + 1) * 90)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [animandoApertura, abierto]);

  const indiceFrameVisible = abierto
    ? Math.max(0, FRAMES_COFRE.length - 1)
    : animandoApertura
      ? frameApertura
      : 0;

  useEffect(() => {
    if (cofreVisible && contador === null) {
      const timer = setTimeout(() => setContador(total), 600);
      return () => clearTimeout(timer);
    }
  }, [cofreVisible, total, contador]);

  useEffect(() => {
    if (abierto && indiceActual < total) setExplosionKey((k) => k + 1);
  }, [indiceActual, abierto, total]);

  async function handleOpen(event: any) {
    const fastSkip = (event?.detail && event.detail > 1) || false;

    if (animandoFinal) {
      setSkipRapido(true);
      setMostrarMensajeFinal(true);
      setMostrarListaFinal(true);
      setAnimandoFinal(false);
      return;
    }

    if (fastSkip) setSkipRapido(true);

    if (!animacionInicialTerminada && !cofreVisible) {
      setAnimacionInicialTerminada(true);
      setCofreVisible(true);
      setContador(total);
      return;
    }

    if (!abierto) {
      if (animandoApertura) return;

      setAnimandoApertura(true);
      aperturaTimerRef.current = window.setTimeout(() => {
        setAnimandoApertura(false);
        setAbierto(true);
        setContador((c) => (c !== null ? Math.max(0, c - 1) : c));
        aperturaTimerRef.current = null;
      }, 480);
      return;
    }

    if (indiceActual < total - 1) {
      setIndiceActual((i) => i + 1);
      setContador((c) => (c !== null ? Math.max(0, c - 1) : c));
      if (fastSkip) setExplosionKey((k) => k + 1);
      return;
    }

    // Si ya se mostró la última recompensa y contador sigue arriba de 0, forzamos cierre
    if (indiceActual === total - 1 && contador !== 0) {
      setContador(0);
    }

    if (contador === 0 && contadorVisible) {
      setContadorVisible(false);
      setMostrarRecompensaActual(false);
      if (fastSkip) {
        setSkipRapido(true);
        setMostrarMensajeFinal(true);
        setMostrarListaFinal(true);
      } else {
        setAnimandoFinal(true);
        const tiempoBase =
          total === 1 ? 500 :
          total === 2 ? 700 :
          900;
        setTimeout(() => {
          setMostrarMensajeFinal(true);
          setTimeout(() => {
            setMostrarListaFinal(true);
            setAnimandoFinal(false);
          }, tiempoBase);
        }, tiempoBase);
      }
      return;
    }
  }

  let colorContador: string;
  if (contador === 0) {
    colorContador = "#777";
  } else {
    const siguienteIndex = total - (contador ?? 0);
    const siguienteRareza: Rareza =
      recompensasOrdenadas[siguienteIndex]?.rareza || "comun";
    colorContador = rarezaConfig[siguienteRareza].color;
  }

  // Si no hay recompensas, mostramos un mensaje
  if (!recompensasOrdenadas.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[100vh] text-white text-center">
        <h2 className="text-3xl font-bold mb-2">🎉 ¡Ya tienes todas las recompensas!</h2>
        <p className="text-white/80 text-lg mb-6">
          No hay nuevas recompensas que mostrar.
        </p>
        <button
          onClick={onFinish}
          className="px-5 py-2 rounded-[14px] text-white font-black shadow-md hover:opacity-90"
          style={{
            backgroundColor: "var(--fcc-premium-accent, var(--color-primary))",
            border: "1px solid color-mix(in srgb, var(--fcc-premium-accent, var(--color-primary)) 64%, white)",
            boxShadow:
              "0 12px 26px color-mix(in srgb, var(--fcc-premium-accent, var(--color-primary)) 16%, transparent)",
          }}
        >
          Continuar
        </button>
      </div>
    );
  }

  if (!recursosListos) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 text-center">
        <CargadorFCC
          mensaje={
            errorRecursos
              ? "No pudimos preparar la recompensa"
              : "Preparando tu cofre"
          }
          detalle={
            errorRecursos
              ? "La conexión se interrumpió antes de completar todas las imágenes."
              : "Cargando y decodificando la animación completa…"
          }
        />

        {errorRecursos && (
          <div className="relative z-10 -mt-20 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setReintentoRecursos((actual) => actual + 1);
              }}
              className="rounded-xl bg-white px-5 py-2.5 font-black text-slate-900 shadow-lg"
            >
              Reintentar
            </button>
            {onFinish && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFinish();
                }}
                className="rounded-xl border border-white/40 px-5 py-2.5 font-black text-white"
              >
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden select-none bg-[rgba(4,10,20,0.28)] px-3 backdrop-blur-[2px] sm:px-4"
      onClick={(e) => {
        if (bloquearClicks) {
          e.stopPropagation();
          return;
        }
        handleOpen(e);
      }}
    >
      {/* Fondo energético sutil: mantiene el color de la rareza sin encerrar la recompensa */}
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: AJUSTE_CENTRO_COFRE_X, top: POSICION_COFRE_Y }}
      >
        <div className="absolute left-1/2 top-1/2 h-[min(620px,128vw)] w-[min(620px,128vw)] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="h-full w-full rounded-full blur-[72px]"
            style={{
              background: `radial-gradient(circle, ${auraPrincipal} 0%, transparent 68%)`,
            }}
            animate={{ opacity: [0.42, 0.66, 0.42], scale: [0.98, 1.06, 0.98] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="absolute left-1/2 top-1/2 h-[min(460px,100vw)] w-[min(460px,100vw)] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="h-full w-full rounded-full border border-white/10"
            style={{
              boxShadow: `0 0 44px color-mix(in srgb, ${auraPrincipal} 30%, transparent)`,
            }}
            animate={{ rotate: 360, opacity: [0.18, 0.34, 0.18] }}
            transition={{
              rotate: { duration: 22, repeat: Infinity, ease: "linear" },
              opacity: { duration: 3.2, repeat: Infinity },
            }}
          />
        </div>
      </div>

      {/* Encabezado */}
      {!abierto && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.48, ease: "easeOut" }}
          className="absolute inset-x-0 top-[5dvh] z-30 mx-auto flex w-[94vw] max-w-[780px] flex-col items-center text-center sm:top-[6.5dvh]"
        >
          <div className="relative flex w-full flex-col items-center">
            <div className="absolute left-1/2 top-[58px] h-10 w-[min(520px,82vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,198,82,0.22)_0%,rgba(255,255,255,0)_72%)] blur-2xl" />
            <p className="relative mb-3 inline-flex items-center gap-3 rounded-full border border-white/28 bg-[rgba(255,255,255,0.07)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.34em] text-[#f7f3e6] shadow-[0_0_18px_rgba(255,255,255,0.08)] backdrop-blur-md sm:text-xs">
              <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#f5c652]" />
              FCC Academy
              <span className="h-px w-7 bg-gradient-to-l from-transparent to-[#f5c652]" />
            </p>

            {tipo === "bienvenida" ? (
              <>
                <motion.h2
                  className="relative bg-gradient-to-b from-white via-[#fff8e4] to-[#f5c652] bg-clip-text text-[clamp(2.15rem,5.2vw,4.1rem)] font-black tracking-[-0.05em] text-transparent drop-shadow-[0_10px_30px_rgba(245,198,82,0.16)]"
                  animate={{ opacity: [0.92, 1, 0.92] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  Cofre de Bienvenida
                </motion.h2>
                <p className="mx-auto mt-2 max-w-[680px] text-sm font-semibold leading-relaxed text-white sm:text-[1.05rem] drop-shadow-[0_4px_18px_rgba(0,0,0,0.28)]">
                  Tus primeras recompensas ya están listas.
                </p>
              </>
            ) : (
              <>
                <motion.h2
                  className="relative bg-gradient-to-b from-white via-[#fff8e4] to-[#7bd8ff] bg-clip-text text-[clamp(2.15rem,5.2vw,4.1rem)] font-black tracking-[-0.05em] text-transparent drop-shadow-[0_10px_30px_rgba(123,216,255,0.18)]"
                  animate={{ opacity: [0.92, 1, 0.92] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  Nivel {nivel ?? "?"} desbloqueado
                </motion.h2>
                <p className="mx-auto mt-2 max-w-[680px] text-sm font-semibold leading-relaxed text-white sm:text-[1.05rem] drop-shadow-[0_4px_18px_rgba(0,0,0,0.28)]">
                  Tu cofre contiene nuevas recompensas.
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Cofre: ~62.5% de la altura de la pantalla; en móvil usa hasta 80% del ancho */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: AJUSTE_CENTRO_COFRE_X, top: POSICION_COFRE_Y }}
      >
        <motion.div
          className="relative flex flex-col items-center"
          initial={{ y: 300, scale: 0.1, opacity: 0 }}
          animate={
            mostrarMensajeFinal
              ? { y: -74, scale: 0.9, opacity: 1 }
              : { y: 0, scale: 1, opacity: 1 }
          }
          transition={{
            duration: skipRapido ? 0 : 0.82,
            ease: "easeOut",
            onComplete: () => {
              setCofreVisible(true);
              setAnimacionInicialTerminada(true);
            },
          }}
        >
          <motion.div
            animate={
              cofreVisible
                ? { y: [0, -5, 0], scale: [1, 1.02, 1] }
                : {}
            }
            transition={{
              y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="relative aspect-[978/1024] w-[min(360px,78vw,48dvh)]"
          >
            {FRAMES_COFRE.map((frame, index) => (
              <img
                key={frame}
                src={frame}
                alt={
                  index === FRAMES_COFRE.length - 1
                    ? "Cofre abierto"
                    : "Cofre"
                }
                aria-hidden={index !== indiceFrameVisible}
                draggable={false}
                decoding="async"
                className="absolute inset-0 h-full w-full select-none object-contain"
                style={{
                  opacity: index === indiceFrameVisible ? 1 : 0,
                  zIndex: index === indiceFrameVisible ? 2 : 1,
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Contador moderno: píldora + progreso, sin bloque cuadrado */}
            {cofreVisible &&
              contadorVisible &&
              contador !== null &&
              contador >= 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  className="absolute inset-x-0 top-[calc(100%+14px)] z-20 mx-auto w-fit min-w-[122px] rounded-full border px-3.5 py-2.5 backdrop-blur-xl sm:min-w-[136px] sm:px-4"
                  style={{
                    borderColor: `color-mix(in srgb, ${colorContador} 55%, transparent)`,
                    background:
                      "linear-gradient(135deg, rgba(4,10,24,0.94), rgba(8,18,38,0.82))",
                    boxShadow: `0 12px 30px rgba(0,0,0,0.24), 0 0 24px color-mix(in srgb, ${colorContador} 26%, transparent)`,
                    transition:
                      "border-color 0.4s ease, box-shadow 0.4s ease",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[8px] font-black uppercase tracking-[0.22em] text-white/80 sm:text-[9px]">
                      Restantes
                    </span>
                    <motion.span
                      key={contador}
                      initial={{ opacity: 0, y: -5, scale: 0.82 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="text-lg font-black leading-none sm:text-xl"
                      style={{
                        color: colorContador,
                        textShadow: `0 0 14px color-mix(in srgb, ${colorContador} 70%, transparent)`,
                      }}
                    >
                      {contador}
                    </motion.span>
                  </div>

                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: total }).map((_, index) => (
                      <span
                        key={index}
                        className="h-[3px] flex-1 rounded-full"
                        style={{
                          background:
                            index < contador
                              ? colorContador
                              : "rgba(255,255,255,0.12)",
                          boxShadow:
                            index < contador
                              ? `0 0 8px color-mix(in srgb, ${colorContador} 58%, transparent)`
                              : "none",
                          transition:
                            "background 0.35s ease, box-shadow 0.35s ease",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
          </motion.div>
        </motion.div>
      </div>

      {/* Recompensa actual: preview limpio, ~75% del ancho del cofre y aura sólo exterior */}
      {abierto &&
        mostrarRecompensaActual &&
        !mostrarListaFinal &&
        contador !== null &&
        contador >= 0 && (
          <div
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
          style={{ left: AJUSTE_CENTRO_COFRE_X, top: POSICION_RECOMPENSA_Y }}
        >
            <AnimatePresence mode="wait">
              <motion.div
                key={recompensasOrdenadas[indiceActual].nombre}
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.18, y: 250 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.84, y: -54 }}
                transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              >
                <RecompensaVisual
                  recompensa={recompensasOrdenadas[indiceActual]}
                  pulseKey={explosionKey}
                />

              </motion.div>
            </AnimatePresence>
          </div>
        )}

      {/* Resumen final: las recompensas quedan abajo, sin tarjetas ni recuadros */}
      {mostrarMensajeFinal && (
        <div className="absolute inset-0 z-30">
          <motion.div
            initial={skipRapido ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              skipRapido
                ? { duration: 0 }
                : { duration: 0.7, ease: "easeOut" }
            }
            className="pointer-events-none absolute inset-x-0 top-[7dvh] flex justify-center px-4 sm:top-[8dvh]"
          >
            <div
              className="flex w-full max-w-[600px] flex-col items-center"
              style={{ textAlign: "center" }}
            >
              <p
                className="w-full text-[10px] font-black uppercase tracking-[0.3em] sm:text-[11px]"
                style={{
                  color: "rgba(255,255,255,0.72)",
                  textAlign: "center",
                }}
              >
                Inventario actualizado
              </p>

              <p
                className="mt-1 w-full text-[1.08rem] font-bold sm:text-[1.6rem]"
                style={{
                  color: "#ffffff",
                  textAlign: "center",
                  textShadow: "0 4px 18px rgba(0,0,0,0.30)",
                }}
              >
                Recompensas agregadas
              </p>

              {mostrarListaFinal && (
                <motion.div
                  initial={skipRapido ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    skipRapido
                      ? { duration: 0 }
                      : { duration: 0.62, ease: "easeOut" }
                  }
                  className="mt-2 flex w-full flex-col items-center"
                >
                  <div className="flex w-full flex-wrap items-start justify-center gap-x-1.5 gap-y-2 sm:gap-x-3">
                    {recompensasOrdenadas.map((r, i) => {
                      const { color } = rarezaConfig[r.rareza];

                      return (
                        <motion.div
                          key={`${r.nombre}-${i}`}
                          className="flex w-[82px] shrink-0 flex-col items-center sm:w-[108px]"
                          style={{ textAlign: "center" }}
                          initial={
                            skipRapido
                              ? false
                              : { opacity: 0, scale: 0.72, y: 12 }
                          }
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={
                            skipRapido
                              ? { duration: 0 }
                              : {
                                  delay: i * 0.11,
                                  duration: 0.42,
                                  ease: "easeOut",
                                }
                          }
                        >
                          <div className="flex w-full justify-center">
                            <RecompensaVisual
                              recompensa={r}
                              variante="resumen"
                              pulseKey={i}
                            />
                          </div>

                          <span
                            className="mt-0.5 block w-full text-[7px] font-black uppercase tracking-[0.16em] sm:text-[8px]"
                            style={{
                              color,
                              textAlign: "center",
                            }}
                          >
                            {etiquetaRareza[r.rareza]}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[23dvh] flex justify-center px-4 sm:bottom-[24dvh]">
            <div className="pointer-events-auto flex w-full justify-center">
              <motion.button
                onClick={(event) => {
                  event.stopPropagation();
                  onFinish?.();
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.45 }}
                className="rounded-full px-6 py-2 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.03] sm:px-7 sm:py-2.5"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--fcc-premium-accent, var(--color-primary)) 88%, white), var(--fcc-premium-accent, var(--color-primary)))",
                  border:
                    "1px solid color-mix(in srgb, var(--fcc-premium-accent, var(--color-primary)) 58%, white)",
                  boxShadow:
                    "0 14px 32px color-mix(in srgb, var(--fcc-premium-accent, var(--color-primary)) 20%, transparent)",
                }}
              >
                Continuar
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
