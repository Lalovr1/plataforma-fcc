"use client";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import ModalEditorAvatar from "./ModalEditorAvatar";
import { AvatarConfig } from "./RenderizadorAvatar";
import { supabase } from "@/utils/supabaseClient";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";


export default function TutorialInicio() {
  const [yaVisto, setYaVisto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const rol = localStorage.getItem("rol_usuario");
    if (rol === "profesor") {
      setYaVisto(true);
      setCargando(false);
      return;
    }
  }, []);

  useEffect(() => {
    async function verificarLogroTutorial() {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) {
          setCargando(false);
          return;
        }

        const { data: logros, error } = await supabase
          .from("logros_usuarios")
          .select("logro_id")
          .eq("usuario_id", user.user.id);

        if (error) {
          console.error("Error al verificar logros del tutorial:", error);
          setCargando(false);
          return;
        }

        const yaTieneTutorial = logros?.some(
          (l) =>
            l.logro_id === "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610" ||
            l.logro_id === "tutorial"
        );

        //  Primero actualizamos el estado (para no mostrar el tutorial)
        setYaVisto(!!yaTieneTutorial);

        //  Solo si no lo tiene, marcamos tutorial_visto = true
        if (!yaTieneTutorial) {
          await supabase
            .from("usuarios")
            .update({ tutorial_visto: true })
            .eq("id", user.user.id);

          setVisible(true);
        }else {
          (window as any).__tutorialActivo = false;
          window.dispatchEvent(new CustomEvent("tutorial:estado", { detail: { activo: false } }));
        }

        setCargando(false);
      } catch (e) {
        console.error("Error general al verificar logro tutorial:", e);
        setCargando(false);
      }
    }

    verificarLogroTutorial();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const bloquearScroll = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", bloquearScroll, { passive: false });
    window.addEventListener("touchmove", bloquearScroll, { passive: false });

    return () => {
      window.removeEventListener("wheel", bloquearScroll);
      window.removeEventListener("touchmove", bloquearScroll);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      (window as any).__tutorialActivo = false;
      window.dispatchEvent(
        new CustomEvent("tutorial:estado", { detail: { activo: false } })
      );
      return;
    }

    (window as any).__tutorialActivo = true;
    window.dispatchEvent(
      new CustomEvent("tutorial:estado", { detail: { activo: true } })
    );

    return () => {
      (window as any).__tutorialActivo = false;
      window.dispatchEvent(
        new CustomEvent("tutorial:estado", { detail: { activo: false } })
      );
    };
  }, [visible]);

  useEffect(() => {
    const imagenes = [
      "/mascota/Saludando.png",
      "/mascota/Posando.png",
      "/mascota/ApuntandoFeliz.png",
      "/mascota/ApuntandoSerio.png",
      "/mascota/ExplicandoFeliz.png",

      "/cofre/frame1.png",
      "/cofre/frame2.png",
      "/cofre/frame3.png",
      "/cofre/frame4.png",
      "/cofre/frame5.png",
    ];

    imagenes.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [esMobile, setEsMobile] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [highlightContent, setHighlightContent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const actualizarTamano = () => {
      setEsMobile(window.innerWidth < 1024);
    };

    actualizarTamano();
    window.addEventListener("resize", actualizarTamano);

    return () => window.removeEventListener("resize", actualizarTamano);
  }, []);

  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [animandoEditor, setAnimandoEditor] = useState(false);
  const [transicionSuave, setTransicionSuave] = useState(false);
  const [ocultandoEditor, setOcultandoEditor] = useState(false); 
  const [mostrarTooltip, setMostrarTooltip] = useState(true);
  const [tooltipVisibleMovil, setTooltipVisibleMovil] = useState(true);
  const [resaltadoVisibleMovil, setResaltadoVisibleMovil] = useState(true);
  const [mostrarCofre, setMostrarCofre] = useState(false);
  const [recompensasCofre, setRecompensasCofre] = useState<any[]>([]);
  const mostrarCofreRef = useRef(mostrarCofre);

  useEffect(() => {
    mostrarCofreRef.current = mostrarCofre;
  }, [mostrarCofre]);

  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
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
    collar: "none",
    pulsera: "none",
    accessory: "none",
  });

  const [finalizado, setFinalizado] = useState(false);

  const [logrosDesbloqueados, setLogrosDesbloqueados] = useState<any[]>([]);

  const pasos = [
    {
      id: "bienvenida",
      texto:
        "¡Bienvenido a FCC Academy! Esta plataforma te ayudará a aprender, practicar y subir de nivel resolviendo quizzes y consiguiendo logros.",
      selector: null,
      pos: "center",
    },
    ...(esMobile
      ? [
          {
            id: "preparar-avatar",
            texto:
              "A continuación se abrirá el editor de avatar. Ahí podrás crear tu personaje para usarlo en tu perfil, logros y ranking.",
            selector: null,
            pos: "center",
          },
        ]
      : []),
    {
      id: "crear-avatar",
      texto:
        "Crea tu avatar. Podrás personalizarlo con diferentes estilos y accesorios.",
      selector: null,
      pos: "left-modal",
    },
    {
      id: "avatar-explicacion",
      texto:
        "Este es tu avatar. Puedes personalizarlo más adelante en tu perfil. Cada vez que subas de nivel desbloquearás nuevos accesorios.",
      selector: ".avatar-principal",
      pos: "right",
    },
    {
      id: "menu-lateral",
      selector: esMobile ? ".boton-menu-mobile" : ".menu-lateral",
      texto: esMobile
        ? "Desde este botón puedes abrir el menú de navegación para entrar a tus cursos, ranking, amigos, profesores y configuración."
        : "Desde esta barra lateral puedes navegar entre las distintas secciones: tus cursos, ranking, amigos, profesores y configuración.",
      pos: esMobile ? "bottom" : "right",
    },
    {
      id: "cursos",
      selector: ".bloque-cursos, .seccion-cursos",
      texto:
        "Aquí aparecen tus cursos. Entra para estudiar el contenido y resolver quizzes que te darán experiencia.",
      pos: "top",
    },
    {
      id: "ranking",
      selector: ".widget-ranking",
      texto:
        "En esta sección verás el Top 5 Global de los estudiantes con más puntos.",
      pos: "left",
    },
    {
      id: "xp",
      selector: ".bloque-xp, .barra-xp",
      texto:
        "Este bloque muestra tu experiencia actual. Al llenarlo subirás de nivel y podrás obtener cofres con recompensas.",
      pos: "top",
    },
  ];

  const [stepTooltip, setStepTooltip] = useState(0);

  const paso = pasos[step];
  const pasoTooltip = pasos[stepTooltip] ?? paso;

  const limitar = (valor: number, minimo: number, maximo: number) => {
    return Math.min(Math.max(valor, minimo), maximo);
  };

  useEffect(() => {
    let timeoutOcultar: NodeJS.Timeout;
    let timeoutScroll: NodeJS.Timeout;
    let timeoutResaltar: NodeJS.Timeout;
    let timeoutTooltip: NodeJS.Timeout;

    const calcularResaltado = (elemento: HTMLElement) => {
      const rect = elemento.getBoundingClientRect();
      setHighlightRect(rect);
      setHighlightContent(elemento.cloneNode(true) as HTMLElement);
      setStepTooltip(step);
    };

    const actualizarResaltado = () => {
      if (!paso.selector) {
        setHighlightRect(null);
        setHighlightContent(null);
        setStepTooltip(step);
        setMostrarTooltip(true);
        setTooltipVisibleMovil(true);
        setResaltadoVisibleMovil(true);
        return;
      }

      const elemento = document.querySelector(paso.selector) as HTMLElement;

      if (!elemento) {
        setHighlightRect(null);
        setHighlightContent(null);
        setMostrarTooltip(false);
        return;
      }

      if (esMobile && paso.id !== "menu-lateral") {
        setTooltipVisibleMovil(false);
        setResaltadoVisibleMovil(false);

        timeoutOcultar = setTimeout(() => {
          setMostrarTooltip(false);
          setHighlightRect(null);
          setHighlightContent(null);

          elemento.scrollIntoView({
            behavior: "smooth",
            block: paso.id === "ranking" || paso.id === "xp" ? "end" : "start",
            inline: "nearest",
          });

          timeoutScroll = setTimeout(() => {
            calcularResaltado(elemento);

            timeoutResaltar = setTimeout(() => {
              setResaltadoVisibleMovil(true);
            }, 350);

            timeoutTooltip = setTimeout(() => {
              setMostrarTooltip(true);
              setTooltipVisibleMovil(true);
            }, 950);
          }, 1450);
        }, 650);

        return;
      }

      calcularResaltado(elemento);
      setMostrarTooltip(true);
      setTooltipVisibleMovil(true);
      setResaltadoVisibleMovil(true);
    };

    actualizarResaltado();

    window.addEventListener("resize", actualizarResaltado);

    return () => {
      clearTimeout(timeoutOcultar);
      clearTimeout(timeoutScroll);
      clearTimeout(timeoutResaltar);
      clearTimeout(timeoutTooltip);
      window.removeEventListener("resize", actualizarResaltado);
    };
  }, [step, esMobile, paso.selector]);

  useEffect(() => {
    if (paso.id === "crear-avatar") {
      setTransicionSuave(true);
      setAnimandoEditor(true);
      setMostrarTooltip(false);

      const abrir = setTimeout(() => {
        setMostrarEditor(true);

        if (!esMobile) {
          setTimeout(() => setMostrarTooltip(true), 800);
        }
      }, 400);

      return () => clearTimeout(abrir);
    } else {
      setTransicionSuave(false);
      setMostrarTooltip(true);
    }
  }, [step]);
  

  if (cargando || yaVisto || !visible || !ready) return null;

  async function guardarAvatar(newConfig: AvatarConfig) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        await supabase
          .from("usuarios")
          .update({
            avatar_config: newConfig,
          })
          .eq("id", user.user.id);
      }

      localStorage.setItem("avatar_config", JSON.stringify(newConfig));
      window.dispatchEvent(new Event("avatarActualizado"));

      setAvatarConfig(newConfig);

      setTimeout(() => {
        if (esMobile) {
          setMostrarTooltip(false);

          setTimeout(() => {
            setMostrarEditor(false);

            setTimeout(() => {
              setStep((s) => s + 1);
            }, 500);
          }, 250);

          return;
        }

        setStep((s) => s + 1);

        setTimeout(() => {
          setMostrarEditor(false);
        }, 250);
      }, 500);
    } catch (error) {
      console.error("Error guardando avatar:", error);
    }
  }

  function siguiente() {
    if (paso.id === "crear-avatar") return;

    if (paso.id === "preparar-avatar") {
      setStep(step + 1);
      return;
    }

    if (step < pasos.length - 1) setStep(step + 1);
    else finalizar();
  }

  async function finalizar() {
    console.log("✅ Finalizar llamado");
    if (finalizado) return;
    setFinalizado(true);
    console.log("🚀 Ejecutando verificación de logro...");

    await new Promise((r) => setTimeout(r, 200));

    const { data: user } = await supabase.auth.getUser();
    console.log("👤 Usuario:", user);

    if (user?.user) {
      const { verificarLogros } = await import("@/utils/verificarLogros");
      const nuevos = await verificarLogros(user.user.id, "tutorial", 1);
      console.log("🎯 Logros detectados:", nuevos);

      if (nuevos.length > 0) {
        setLogrosDesbloqueados((prev) => {
          const idsPrev = prev.map((x) => x.id);
          const nuevosUnicos = nuevos.filter((x) => !idsPrev.includes(x.id));
          return [...prev, ...nuevosUnicos];
        });

        // Esperar a que el logro se cierre antes del cofre
        const esperaCierre = new Promise<void>((resolve) => {
          const listener = () => {
            window.removeEventListener("logroCerrado", listener);
            resolve();
          };
          window.addEventListener("logroCerrado", listener);
        });

        await esperaCierre;
      }

      // Cofre de bienvenida (forzar rareza legendaria)
    const { obtenerRecompensasAleatorias } = await import("@/lib/obtenerRecompensas");
    const { recompensas } = await obtenerRecompensasAleatorias(user.user.id, "bienvenida");
    setRecompensasCofre(recompensas);
    setMostrarCofre(true);
      return; 
    }

    finalizarTutorial();
  }

  const tooltipStyle: React.CSSProperties = (() => {
    const anchoTooltip = esMobile ? window.innerWidth - 32 : pasoTooltip.selector ? 430 : 340;
    const margenPantalla = 16;
    const margin = 20;

    const base = {
      position: "fixed",
      backgroundColor: "var(--color-card)",
      color: "var(--color-text)",
      padding: esMobile ? "14px 16px" : "18px 22px",
      borderRadius: "12px",
      width: esMobile ? "auto" : `${anchoTooltip}px`,
      maxWidth: esMobile ? "none" : pasoTooltip.selector ? "430px" : "340px",
      boxShadow: "0 0 40px rgba(255,255,255,0.9), 0 0 30px var(--color-accent)",
      zIndex: 10021,
      transition: "all 0.6s ease-in-out",
      opacity: 1,
    } as React.CSSProperties;

    if (esMobile && pasoTooltip.pos !== "center" && pasoTooltip.id !== "crear-avatar" && highlightRect) {
      const r = highlightRect;
      const tooltipAlto = 310;
      const margen = 12;

      const hayEspacioAbajo = window.innerHeight - r.bottom > tooltipAlto + margen;
      const hayEspacioArriba = r.top > tooltipAlto + margen;

      if (r.top < window.innerHeight * 0.45 && hayEspacioAbajo) {
        return {
          ...base,
          left: "16px",
          right: "16px",
          top: r.bottom + margen,
          bottom: "auto",
          width: "auto",
          maxWidth: "none",
          transform: "none",
        };
      }

      if (hayEspacioArriba) {
        return {
          ...base,
          left: "16px",
          right: "16px",
          top: r.top - margen,
          bottom: "auto",
          width: "auto",
          maxWidth: "none",
          transform: "translateY(-100%)",
        };
      }

      return {
        ...base,
        left: "16px",
        right: "16px",
        bottom: "20px",
        top: "auto",
        width: "auto",
        maxWidth: "none",
        transform: "none",
      };
    }

    if (pasoTooltip.pos === "left-modal") {
      return {
        ...base,
        top: "50%",
        left: "3%",
        transform: "translateY(-50%)",
      };
    }

    if (!highlightRect || pasoTooltip.pos === "center") {
      return {
        ...base,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const r = highlightRect;

    const leftCentrado = limitar(
      r.left + r.width / 2 - anchoTooltip / 2,
      margenPantalla,
      window.innerWidth - anchoTooltip - margenPantalla
    );

    const hayEspacioArriba = r.top > 260;
    const hayEspacioAbajo = window.innerHeight - r.bottom > 260;
    const hayEspacioDerecha = window.innerWidth - r.right > anchoTooltip + margin;
    const hayEspacioIzquierda = r.left > anchoTooltip + margin;

    if (pasoTooltip.pos === "top" && hayEspacioArriba) {
      return {
        ...base,
        top: r.top - margin,
        left: leftCentrado,
        transform: "translateY(-100%)",
      };
    }

    if (pasoTooltip.pos === "bottom" && hayEspacioAbajo) {
      return {
        ...base,
        top: r.bottom + margin,
        left: leftCentrado,
        transform: "none",
      };
    }

    if (pasoTooltip.pos === "right" && hayEspacioDerecha) {
      return {
        ...base,
        top: limitar(r.top, margenPantalla, window.innerHeight - 260),
        left: r.right + margin,
        transform: "none",
      };
    }

    if (pasoTooltip.pos === "left" && hayEspacioIzquierda) {
      return {
        ...base,
        top: limitar(r.top, margenPantalla, window.innerHeight - 260),
        left: r.left - anchoTooltip - margin,
        transform: "none",
      };
    }

    if (hayEspacioArriba) {
      return {
        ...base,
        top: r.top - margin,
        left: leftCentrado,
        transform: "translateY(-100%)",
      };
    }

    if (hayEspacioAbajo) {
      return {
        ...base,
        top: r.bottom + margin,
        left: leftCentrado,
        transform: "none",
      };
    }

    if (hayEspacioDerecha) {
      return {
        ...base,
        top: margenPantalla,
        left: r.right + margin,
        transform: "none",
      };
    }

    if (hayEspacioIzquierda) {
      return {
        ...base,
        top: margenPantalla,
        left: r.left - anchoTooltip - margin,
        transform: "none",
      };
    }

    return {
      ...base,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  })();

  function obtenerImagenMascota(idPaso: string): string {
    switch (idPaso) {
      case "bienvenida":
        return "/mascota/Saludando.png";
      case "crear-avatar":
        return "/mascota/ExplicandoFeliz.png";
      case "avatar-explicacion":
        return "/mascota/Posando.png";
      case "menu-lateral":
        return "/mascota/ApuntandoSerio.png";
      case "cursos":
        return "/mascota/ExplicandoFeliz.png";
      case "ranking":
        return "/mascota/ApuntandoFeliz.png";
      case "xp":
        return "/mascota/ApuntandoSerio.png";
      default:
        return "/mascota/Posando.png";
    }
  }

  function finalizarTutorial() {
    setVisible(false);
    (window as any).__tutorialActivo = false;
    window.dispatchEvent(new CustomEvent("tutorial:estado", { detail: { activo: false } }));
    localStorage.setItem("tutorial_visto_finalizado", "1"); 
    localStorage.setItem("tutorial_visto", "true"); 
  }

  return (
  <>
    {/* 🔹 Fondo uniforme con animación */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9997,
        backgroundColor:
          paso.id === "bienvenida"
            ? "rgba(0,0,0,0.65)"
            : "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        transition: "all 0.8s ease-in-out",
        opacity: transicionSuave ? 0.6 : 1,
        animation: "fadeIn 0.6s ease-in-out",
      }}
    />

      {/* 🔹 Resaltado */}
      {highlightRect &&
        highlightContent &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              zIndex: 10002,
              borderRadius: "14px",
              boxShadow:
                "0 0 45px 15px rgba(255,255,255,0.9), 0 0 25px 10px var(--color-accent)",
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
              transition: "box-shadow 1s ease-in-out, opacity 0.8s ease",
              animation: "brilloFlotante 3s ease-in-out infinite",
              opacity: ocultandoEditor || (esMobile && !resaltadoVisibleMovil) ? 0 : 1,
              transitionDuration: "0.8s",
            }}
            dangerouslySetInnerHTML={{ __html: highlightContent.outerHTML }}
          />,
          document.body
        )}

      {/* 🔹 Tooltip con mascota */}
      {mostrarTooltip && (
        <div
          style={{
            ...tooltipStyle,
            opacity: esMobile ? (tooltipVisibleMovil ? 1 : 0) : 1,
            transition: esMobile ? "opacity 0.9s ease" : tooltipStyle.transition,
            animation:
              pasoTooltip.id === "crear-avatar"
                ? "aparecerTooltipSuave 0.9s ease-out"
                : undefined,
          }}
        >
          {/* 🐺 Imagen de mascota (centrada y más grande) */}
          <div
            style={{
              display: "flex",
              flexDirection: esMobile || !pasoTooltip.selector ? "column" : "row",
              alignItems: "center",
              justifyContent: "center",
              textAlign: esMobile || !pasoTooltip.selector ? "center" : "left",
              gap: esMobile || !pasoTooltip.selector ? "0px" : "16px",
              marginBottom: "18px",
            }}
          >
            <img
              src={obtenerImagenMascota(pasoTooltip.id)}
              alt="Mascota FCC Academy"
              style={{
                width: esMobile ? "90px" : "150px",
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 14px rgba(255,255,255,0.8))",
                marginBottom: esMobile || !pasoTooltip.selector ? "12px" : "0px",
                flexShrink: 0,
                transform: ready ? "scale(1)" : "scale(0.9)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                opacity: ready ? 1 : 0,
              }}
            />

            <p
              style={{
                fontSize: esMobile ? "14px" : "15px",
                marginBottom: 0,
                lineHeight: "1.6",
                opacity: mostrarTooltip ? 1 : 0,
                transition: "opacity 0.6s ease-in-out",
              }}
            >
              {pasoTooltip.texto}
            </p>
          </div>

          {/* 🟢 Botón siguiente */}
          {pasoTooltip.id !== "crear-avatar" && (
            <div style={{ textAlign: "center" }}>
              <button
                onClick={siguiente}
                style={{
                  backgroundColor: "#2ecc71",
                  color: "white",
                  border: "none",
                  padding: "10px 30px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  boxShadow:
                    "0 0 40px rgba(255,255,255,0.9), 0 0 30px var(--color-accent)",
                  transition: "transform 0.3s ease",
                }}
              >
                {step < pasos.length - 1 ? "Siguiente" : "Finalizar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🔹 Editor de avatar animado */}
      <div
        style={{
          opacity: mostrarEditor ? (ocultandoEditor ? 0 : 1) : 0,
          transform: mostrarEditor ? (ocultandoEditor ? "scale(0.97)" : "scale(1)") : "scale(0.97)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
          zIndex: 10020,
          position: mostrarEditor ? "fixed" : "absolute",
          inset: 0,
          pointerEvents: mostrarEditor ? "auto" : "none",
          backgroundColor: mostrarEditor ? "rgba(0,0,0,0.4)" : "transparent",
        }}
      >
        {mostrarEditor && (
          <ModalEditorAvatar
            open={mostrarEditor}
            onClose={() => {}}
            initialConfig={avatarConfig}
            onSave={guardarAvatar}
            forzado={true}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes brilloFlotante {
          0% {
            box-shadow: 0 0 40px 12px rgba(255, 255, 255, 0.8),
              0 0 30px 10px var(--color-accent);
          }
          50% {
            box-shadow: 0 0 50px 14px rgba(255, 255, 255, 0.95),
              0 0 40px 12px var(--color-accent);
          }
          100% {
            box-shadow: 0 0 40px 12px rgba(255, 255, 255, 0.8),
              0 0 30px 10px var(--color-accent);
          }
        }
        @keyframes aparecerTooltipSuave {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }
      `}</style>

      {logrosDesbloqueados.map((l) =>
      createPortal(
        <ModalLogroDesbloqueado
          key={l.id}
          logro={l}
          onClose={() =>
            setLogrosDesbloqueados((prev) => {
              const arr = prev.filter((x) => x.id !== l.id);

              if (arr.length === 0) {
                console.log("⏳ Esperando cofre antes de cerrar tutorial...");

                let intentos = 0;
                const intervalo = setInterval(() => {
                  const cofreVisible = mostrarCofreRef.current;
                  console.log(`🔍 Intento ${intentos}: mostrarCofre =`, cofreVisible);

                  if (cofreVisible) {
                    console.log("🚫 No se cierra, cofre activo");
                    clearInterval(intervalo);
                  } else if (intentos >= 15) {
                    console.log("✅ Cerrando tutorial (no hay cofre visible tras 3s)");
                    clearInterval(intervalo);
                    finalizarTutorial();
                  }

                  intentos++;
                }, 200); 
              }

              return arr;
            })
          }
        />,
        document.body
      )
    )}


        {mostrarCofre && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 25000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
          }}
        >
        <AnimacionCofre
          userId={
            typeof window !== "undefined"
              ? localStorage.getItem("user_id") || ""
              : ""
          }
          recompensas={recompensasCofre}
          nivel={1}
          tipo="bienvenida"
          onFinish={async () => {
            await new Promise((r) => setTimeout(r, 800));
            setMostrarCofre(false);
            finalizarTutorial();
          }}
        />
        </div>
      )}
    </>
  );
}
