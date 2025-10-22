"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { rarezaConfig, Rareza } from "@/lib/rarezaConfig";
import { registrarRecompensas } from "@/lib/registrarRecompensas";

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
}

export default function AnimacionCofre({ userId, recompensas, nivel, tipo, onFinish }: Props) {
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

  const rarezaActual: Rareza = recompensasOrdenadas[indiceActual]?.rareza || "comun";
  const rarezaMax = tipo === "bienvenida" ? "legendario" : (recompensasOrdenadas[0]?.rareza || "comun");
  const auraPrincipal = rarezaConfig[rarezaMax].aura;

  const [frameIndex, setFrameIndex] = useState(0);

  const framesCofre = [
    "/cofre/frame1.png",
    "/cofre/frame2.png",
    "/cofre/frame3.png",
    "/cofre/frame4.png",
    "/cofre/frame5.png",
  ];

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
      let i = 0;
      const intervalo = setInterval(() => {
        i++;
        if (i < framesCofre.length) {
          setFrameIndex(i);
        } else {
          clearInterval(intervalo);
          setAbierto(true); 
          setContador((c) => (c !== null ? Math.max(0, c - 1) : c));
        }
      }, 50);
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
      await registrarRecompensas(userId, recompensasOrdenadas);

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
          className="px-5 py-2 rounded-lg text-white font-semibold shadow-md hover:opacity-90"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center h-[100vh] w-full overflow-hidden select-none bg-transparent"
      onClick={(e) => {
        if (bloquearClicks) {
          e.stopPropagation();
          return;
        }
        handleOpen(e);
      }}
    >
      {/* ✨ Aura energética */}
      <motion.div
        className="absolute rounded-full blur-[150px]"
        style={{
          background: `radial-gradient(circle, ${auraPrincipal} 0%, transparent 70%)`,
          width: "600px",
          height: "600px",
          zIndex: 0,
        }}
        animate={{ opacity: [0.6, 0.9, 0.6], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* 🏆 Mensaje de subida de nivel */}
      {!abierto && (
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute top-[18%] text-center z-20"
      >
        {tipo === "bienvenida" ? (
          <>
            <motion.h2
              className="text-4xl font-extrabold text-amber-400 drop-shadow-[0_0_12px_rgba(255,220,100,0.9)]"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              🎁 ¡Cofre de Bienvenida!
            </motion.h2>
            <p className="text-white/90 text-lg mt-2 font-medium">
              Gracias por unirte a FCC Maths, estas son tus primeras recompensas.
            </p>
          </>
        ) : (
          <>
            <motion.h2
              className="text-4xl font-extrabold text-yellow-300 drop-shadow-[0_0_12px_rgba(255,220,100,0.9)]"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              🎉 ¡Has subido al Nivel {nivel ?? "?"}!
            </motion.h2>
            <p className="text-white/90 text-lg mt-2 font-medium">
              Recibes un cofre con nuevas recompensas
            </p>
          </>
        )}
      </motion.div>
    )}

      {/* 🧭 Cofre */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ y: 300, scale: 0.1, opacity: 0 }}
        animate={
          mostrarMensajeFinal
            ? { y: -120, scale: 0.85, opacity: 1 } // 🔹 se hace pequeño
            : animacionInicialTerminada
            ? { y: 0, scale: 1, opacity: 1 }
            : { y: 0, scale: 1, opacity: 1 }
        }
        transition={{
          duration: skipRapido ? 0 : 2.2,
          ease: "easeOut",
          onComplete: () => {
            setCofreVisible(true);
            setAnimacionInicialTerminada(true);
          },
        }}
      >
        <motion.div
          animate={
            abierto
              ? { y: [0, -5, 0], scale: [1, 1.02, 1] }
              : cofreVisible
              ? { y: [0, -6, 0], scale: [1, 1.03, 1] }
              : {}
          }
          transition={{
            y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          }}
          className="relative"
        >
          <Image
            src={framesCofre[frameIndex]}
            alt="Cofre"
            width={360}
            height={360}
            style={{ width: "auto", height: "auto" }}
            className="select-none"
          />

          {/* 🔢 Contador */}
          {cofreVisible && contadorVisible && contador !== null && contador >= 0 && (
            <motion.div
              key={contador}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute -top-4 -right-10 w-[60px] h-[60px] flex items-center justify-center rounded-lg font-bold text-white text-2xl shadow-lg"
              style={{
                background: colorContador,
                boxShadow: `0 0 15px ${colorContador}`,
                transition: "background 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {contador}
            </motion.div>
          )}
        </motion.div>

        {/* 🧾 Mensaje y recompensas finales */}
        {mostrarMensajeFinal && (
          <motion.div
            initial={skipRapido ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={skipRapido ? { duration: 0 } : { duration: 1.2, ease: "easeOut" }}
            className="absolute flex flex-col items-center text-center top-full mt-2 z-30"
          >
            <p className="text-white text-2xl font-semibold mb-4 drop-shadow-lg">
              Recompensas agregadas al inventario:
            </p>

            {mostrarListaFinal && (
              <motion.div
                initial={skipRapido ? false : { opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={skipRapido ? { duration: 0 } : { duration: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex gap-4 flex-wrap justify-center">
                  {recompensasOrdenadas.map((r, i) => {
                    const { color, aura } = rarezaConfig[r.rareza];
                    return (
                      <motion.div
                        key={`${r.nombre}-${i}`}
                        className="p-[6px] rounded-xl backdrop-blur-md shadow-lg"
                        style={{
                          border: `2px solid ${color}`,
                          background: `linear-gradient(145deg, rgba(255,255,255,0.15), ${aura})`,
                          boxShadow: `0 0 20px ${aura}`,
                        }}
                        initial={skipRapido ? false : { opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                          skipRapido
                            ? { duration: 0 }
                            : { delay: i * 0.25, duration: 0.5 }
                        }
                      >
                        <Image
                          src={r.imagen}
                          alt="Recompensa"
                          width={100}
                          height={100}
                          className="rounded-lg object-contain"
                        />
                      </motion.div>
                    );
                  })}
                </div>

                {/* 🟢 Botón para cerrar el cofre */}
                <motion.button
                  onClick={onFinish}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="mt-6 px-5 py-2 rounded-lg text-white font-semibold shadow-md hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Continuar
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* 💥 Recompensa actual */}
      {abierto &&
        mostrarRecompensaActual &&
        !mostrarListaFinal &&
        contador !== null &&
        contador >= 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={recompensasOrdenadas[indiceActual].nombre}
              className="absolute flex flex-col items-center justify-center z-20"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: -160 }}
              exit={{ opacity: 0, scale: 0.5, y: -250 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <motion.div
                key={explosionKey}
                className="absolute inset-0 flex items-center justify-center z-[-1]"
                initial={{ opacity: 0.9, scale: 0.6 }}
                animate={{
                  opacity: [0.9, 0.6, 0],
                  scale: [0.6, 2.2, 2.6],
                }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div
                  className="w-[200px] h-[200px] rounded-full blur-[60px]"
                  style={{ background: rarezaConfig[rarezaActual].aura }}
                />
              </motion.div>

              <motion.div
                className="p-[8px] rounded-xl backdrop-blur-md shadow-lg"
                style={{
                  border: `3px solid ${rarezaConfig[rarezaActual].color}`,
                  background: `linear-gradient(145deg, rgba(255,255,255,0.15), ${rarezaConfig[rarezaActual].aura})`,
                  boxShadow: `0 0 30px ${rarezaConfig[rarezaActual].aura}`,
                }}
                initial={{ scale: 0.7, y: 100 }}
                animate={{ scale: 1, y: -120 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <Image
                  src={recompensasOrdenadas[indiceActual].imagen}
                  alt="Recompensa"
                  width={130}
                  height={130}
                  className="rounded-lg object-contain"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
    </div>
  );
}
