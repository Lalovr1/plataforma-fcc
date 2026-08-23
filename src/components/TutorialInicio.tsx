"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ModalEditorAvatar from "./ModalEditorAvatar";
import { AvatarConfig } from "./RenderizadorAvatar";
import { supabase } from "@/utils/supabaseClient";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";
import { precargarImagenes } from "@/lib/imagenes";
import { prepararRecursosCofreFCC } from "@/lib/recursosCofre";
import toast from "react-hot-toast";

const RECURSOS_TUTORIAL = [
  "/ui/mascota/Saludando.webp",
  "/ui/mascota/Posando.webp",
  "/ui/mascota/ApuntandoFeliz.webp",
  "/ui/mascota/ApuntandoSerio.webp",
  "/ui/mascota/ExplicandoFeliz.webp",
  "/ui/cofre/frame1.webp",
  "/ui/cofre/frame2.webp",
  "/ui/cofre/frame3.webp",
  "/ui/cofre/frame4.webp",
  "/ui/cofre/frame5.webp",
];

export default function TutorialInicio() {
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);
  const [errorRecursos, setErrorRecursos] = useState(false);
  const [reintentoRecursos, setReintentoRecursos] = useState(0);

  useEffect(() => {
    let activo = true;

    setCargando(true);
    setErrorRecursos(false);

    void precargarImagenes(RECURSOS_TUTORIAL, 30_000).then((completo) => {
      if (!activo) return;

      setErrorRecursos(!completo);
      setVisible(completo);
      setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [reintentoRecursos]);

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
  const [montarEditor, setMontarEditor] = useState(false);
  const [animandoEditor, setAnimandoEditor] = useState(false);
  const [transicionSuave, setTransicionSuave] = useState(false);
  const [ocultandoEditor, setOcultandoEditor] = useState(false); 
  const [mostrarTooltip, setMostrarTooltip] = useState(true);
  const [tooltipVisibleMovil, setTooltipVisibleMovil] = useState(true);
  const [resaltadoVisibleMovil, setResaltadoVisibleMovil] = useState(true);
  const [mostrarCofre, setMostrarCofre] = useState(false);
  const [recompensasCofre, setRecompensasCofre] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;

    if (mostrarEditor) return;

    const bloquearScroll = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", bloquearScroll, { passive: false });
    window.addEventListener("touchmove", bloquearScroll, { passive: false });

    return () => {
      window.removeEventListener("wheel", bloquearScroll);
      window.removeEventListener("touchmove", bloquearScroll);
    };
  }, [visible, mostrarEditor]);

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
        "¡Bienvenido a FCC Academy! Aquí podrás repasar tus cursos, practicar con quizzes y ver tu progreso dentro de la plataforma mientras ganas experiencia, logros y recompensas.",
      selector: null,
      pos: "center",
    },
    ...(esMobile
      ? [
          {
            id: "preparar-avatar",
            texto:
              "Antes de comenzar, crearás tu avatar. Este personaje será parte de tu perfil dentro de FCC Academy",
            selector: null,
            pos: "center",
          },
        ]
      : []),
    {
      id: "crear-avatar",
      texto:
        "Antes de comenzar, crea tu avatar. Este personaje será parte de tu perfil dentro de FCC Academy, podrás personalizarlo con distintos estilos y accesorios.",
      selector: null,
      pos: "left-modal",
    },
    {
      id: "avatar-explicacion",
      texto:
        "En esta sección podrás editar tu perfil y consultar tus desbloqueables conforme avances.",
      selector: ".dashboard-estudiante-shell .avatar-principal, .avatar-principal, [data-tutorial='avatar-principal']",
      pos: "right",
    },
    {
      id: "menu-lateral",
      selector: esMobile
        ? ".boton-menu-mobile, button[aria-label='Abrir menú'], button[aria-label='Abrir menu'], [data-tutorial='menu-mobile']"
        : ".menu-lateral, nav.menu-lateral, aside .menu-lateral, [data-tutorial='menu-lateral']",
      texto: esMobile
        ? "Desde este botón puedes abrir el menú principal para navegar en las diferentes interfaces de FCC Academy."
        : "Está es la barra de navegación,  desde ella podrás navegar entre las diferentes interfaces de FCC Academy",
      pos: esMobile ? "bottom" : "right",
    },
    {
      id: "cursos",
      selector: ".dashboard-estudiante-shell .bloque-cursos, .bloque-cursos, .seccion-cursos, [data-tutorial='cursos']",
      texto:
        "Aquí aparecerán tus cursos. Al entrar a alguno podrás revisar el contenido, estudiar los temas y resolver quizzes relacionados con cada tema.",
      pos: "top",
    },
    {
      id: "ranking",
      selector: ".dashboard-estudiante-shell .widget-ranking, .widget-ranking, [data-tutorial='ranking']",
      texto:
        "En el ranking podrás comparar tu avance con otros estudiantes. Mientras más experiencia y puntos consigas, mejor podrás posicionarte.",
      pos: "left",
    },
    {
      id: "xp",
      selector: ".dashboard-estudiante-shell .barra-xp, .barra-xp, .bloque-xp, [data-tutorial='xp']",
      texto:
        "Esta barra muestra tu experiencia. Al resolver quizzes o desbloquear logros podrás llenarla, subir de nivel y desbloquear recompensas dentro de la plataforma.",
      pos: "top",
    },
  ];

  const [stepTooltip, setStepTooltip] = useState(0);

  const paso = pasos[step];
  const pasoTooltip = pasos[stepTooltip] ?? paso;

  const limitar = (valor: number, minimo: number, maximo: number) => {
    return Math.min(Math.max(valor, minimo), maximo);
  };

  const obtenerElementoTutorial = (selector: string) => {
    const elementos = Array.from(
      document.querySelectorAll(selector)
    ) as HTMLElement[];

    return (
      elementos.find((elemento) => {
        const rect = elemento.getBoundingClientRect();
        const style = window.getComputedStyle(elemento);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      }) || null
    );
  };

  useEffect(() => {
    if (!visible) return;

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

      const elemento = obtenerElementoTutorial(paso.selector);

      if (!elemento) {
        setHighlightRect(null);
        setHighlightContent(null);
        setStepTooltip(step);
        setMostrarTooltip(true);
        setTooltipVisibleMovil(true);
        setResaltadoVisibleMovil(true);
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
            }, 500);

            timeoutTooltip = setTimeout(() => {
              setMostrarTooltip(true);
              setTooltipVisibleMovil(true);
            }, 2000);
          }, 1000);
        }, 650);

        return;
      }

      calcularResaltado(elemento);
      setMostrarTooltip(true);
      setTooltipVisibleMovil(true);
      setResaltadoVisibleMovil(true);
    };

    actualizarResaltado();

    let rafId = 0;

    const recalcularLigero = () => {
      if (!paso.selector) return;

      cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const elemento = obtenerElementoTutorial(paso.selector);

        if (!elemento) return;

        calcularResaltado(elemento);
      });
    };

    window.addEventListener("resize", recalcularLigero);
    window.addEventListener("scroll", recalcularLigero, true);

    return () => {
      clearTimeout(timeoutOcultar);
      clearTimeout(timeoutScroll);
      clearTimeout(timeoutResaltar);
      clearTimeout(timeoutTooltip);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalcularLigero);
      window.removeEventListener("scroll", recalcularLigero, true);
    };
  }, [visible, step, esMobile, paso.selector]);

  useEffect(() => {
    if (paso.id === "crear-avatar") {
      setTransicionSuave(true);
      setAnimandoEditor(true);
      setMostrarTooltip(false);

      const abrir = setTimeout(() => {
        setMontarEditor(true);
      }, 400);

      return () => clearTimeout(abrir);
    } else {
      setTransicionSuave(false);

      if (esMobile && paso.selector && paso.id !== "menu-lateral") {
        setMostrarTooltip(false);
        return;
      }

      setMostrarTooltip(true);
    }
  }, [step]);
  

  if (cargando || !ready) {
    return (
      <CargadorFCC
        flotante
        mensaje="Preparando tu bienvenida"
        detalle=""
      />
    );
  }

  if (errorRecursos || !visible) {
    return (
      <div
        style={{
          position: "fixed",
          right: "max(18px, env(safe-area-inset-right))",
          bottom: "max(18px, env(safe-area-inset-bottom))",
          zIndex: 31000,
          width: "min(560px, calc(100vw - 36px))",
        }}
      >
        <EstadoErrorCargaFCC
          compacto
          titulo="La bienvenida todavía no está completa"
          detalle="La conexión se interrumpió mientras preparábamos sus imágenes. El tutorial seguirá oculto para no mostrar elementos a medias."
          onRetry={() => setReintentoRecursos((actual) => actual + 1)}
        />
      </div>
    );
  }

  async function guardarAvatar(newConfig: AvatarConfig) {
    try {
      const {
        data: { user },
        error: errorSesion,
      } = await supabase.auth.getUser();

      if (errorSesion) throw errorSesion;
      if (!user) throw new Error("No se pudo confirmar la sesión activa.");

      const { error: errorActualizacion } = await supabase
        .from("usuarios")
        .update({
          avatar_config: newConfig,
        })
        .eq("id", user.id);

      if (errorActualizacion) throw errorActualizacion;

      localStorage.setItem("avatar_config", JSON.stringify(newConfig));
      window.dispatchEvent(new Event("avatarActualizado"));

      setAvatarConfig(newConfig);

      setTimeout(() => {
        if (esMobile) {
          setMostrarTooltip(false);

          setTimeout(() => {
            setMostrarEditor(false);
            setMontarEditor(false);

            setTimeout(() => {
              setStep((s) => s + 1);
            }, 500);
          }, 250);

          return;
        }

        setStep((s) => s + 1);

        setTimeout(() => {
          setMostrarEditor(false);
          setMontarEditor(false);
        }, 250);
      }, 500);

      return true;
    } catch (error) {
      console.error("Error guardando avatar:", error);
      return false;
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
    if (finalizado) return;
    setFinalizado(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const { data: sesion, error: errorSesion } =
        await supabase.auth.getUser();

      if (errorSesion) throw errorSesion;
      if (!sesion.user) {
        throw new Error("No se pudo confirmar la sesión activa.");
      }

      const { verificarLogros } = await import("@/utils/verificarLogros");
      const nuevos = await verificarLogros(
        sesion.user.id,
        "tutorial",
        1
      );

      if (nuevos.length > 0) {
        const esperaCierre = new Promise<void>((resolve) => {
          const listener = () => {
            window.removeEventListener("logroCerrado", listener);
            resolve();
          };

          window.addEventListener("logroCerrado", listener);
        });

        setLogrosDesbloqueados((prev) => {
          const idsPrev = prev.map((logro) => logro.id);
          const nuevosUnicos = nuevos.filter(
            (logro) => !idsPrev.includes(logro.id)
          );
          return [...prev, ...nuevosUnicos];
        });

        await esperaCierre;
      }

      const { obtenerRecompensasAleatorias } = await import(
        "@/lib/obtenerRecompensas"
      );
      const resultado = await obtenerRecompensasAleatorias(
        sesion.user.id,
        "bienvenida"
      );

      if (resultado.error) {
        throw new Error(resultado.error);
      }

      if (resultado.recompensas.length === 0) {
        if (resultado.agotado || resultado.bloqueadoHistorico) {
          const confirmado = await confirmarYCerrarTutorial();

          if (!confirmado) {
            setFinalizado(false);
          }

          return;
        }

        throw new Error(
          "El cofre no devolvió recompensas y no se marcará el tutorial como terminado."
        );
      }

      const recursosListos = await prepararRecursosCofreFCC(
        resultado.recompensas
      );

      if (!recursosListos) {
        throw new Error(
          "No se pudieron descargar completamente las imágenes del cofre."
        );
      }

      setRecompensasCofre(resultado.recompensas);
      setMostrarCofre(true);
    } catch (error: any) {
      console.error("No se pudo finalizar la bienvenida:", error);
      setFinalizado(false);
      setMostrarCofre(false);
      setRecompensasCofre([]);

      toast.error(
        error?.message ||
          "La bienvenida sigue pendiente. Intenta finalizarla nuevamente."
      );
    }
  }

  async function confirmarYCerrarTutorial() {
    const { confirmarFinalizacionTutorial } = await import(
      "@/lib/finalizarTutorial"
    );
    const resultado = await confirmarFinalizacionTutorial();

    if (!resultado.ok) {
      toast.error(
        resultado.error ||
          "No se pudo confirmar el cierre del tutorial. Intenta nuevamente."
      );
      return false;
    }

    finalizarTutorial();
    return true;
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
      transition: esMobile ? "all 0.9s ease-in-out" : "all 0.6s ease-in-out",
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
        return "/ui/mascota/Saludando.webp";
      case "crear-avatar":
        return "/ui/mascota/ExplicandoFeliz.webp";
      case "avatar-explicacion":
        return "/ui/mascota/Posando.webp";
      case "menu-lateral":
        return "/ui/mascota/ApuntandoSerio.webp";
      case "cursos":
        return "/ui/mascota/ExplicandoFeliz.webp";
      case "ranking":
        return "/ui/mascota/ApuntandoFeliz.webp";
      case "xp":
        return "/ui/mascota/ApuntandoSerio.webp";
      default:
        return "/ui/mascota/Posando.webp";
    }
  }

    function cancelarScrollTutorial() {
      if (typeof window === "undefined") return;

      const x = window.scrollX;
      const y = window.scrollY;

      const html = document.documentElement;
      const body = document.body;

      const scrollBehaviorHtmlAnterior = html.style.scrollBehavior;
      const scrollBehaviorBodyAnterior = body.style.scrollBehavior;
      const overflowAnchorHtmlAnterior = html.style.overflowAnchor;
      const overflowAnchorBodyAnterior = body.style.overflowAnchor;

      html.style.scrollBehavior = "auto";
      body.style.scrollBehavior = "auto";
      html.style.overflowAnchor = "none";
      body.style.overflowAnchor = "none";

      let intentos = 0;

      const fijarScroll = () => {
        window.scrollTo({
          left: x,
          top: y,
          behavior: "auto",
        });
      };

      fijarScroll();

      const intervalo = window.setInterval(() => {
        fijarScroll();
        intentos++;

        if (intentos >= 12) {
          window.clearInterval(intervalo);

          html.style.scrollBehavior = scrollBehaviorHtmlAnterior;
          body.style.scrollBehavior = scrollBehaviorBodyAnterior;
          html.style.overflowAnchor = overflowAnchorHtmlAnterior;
          body.style.overflowAnchor = overflowAnchorBodyAnterior;
        }
      }, 50);
    }

    function finalizarTutorial() {
      cancelarScrollTutorial();

      setMostrarTooltip(false);
      setTooltipVisibleMovil(false);
      setResaltadoVisibleMovil(false);
      setHighlightRect(null);
      setHighlightContent(null);

      setVisible(false);
      (window as any).__tutorialActivo = false;
      window.dispatchEvent(new CustomEvent("tutorial:estado", { detail: { activo: false } }));
      localStorage.setItem("tutorial_visto_finalizado", "1"); 
      localStorage.setItem("tutorial_visto", "true"); 
      const usuarioLocal = localStorage.getItem("user_id");
      if (usuarioLocal) {
        localStorage.setItem(`fcc_tutorial_completo_${usuarioLocal}`, "1");
      }
      window.dispatchEvent(new Event("tutorial:completado"));
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
          className="fcc-reward-overlay"
          style={{
            ...tooltipStyle,
            opacity: esMobile ? (tooltipVisibleMovil ? 1 : 0) : 1,
            transition:
              esMobile && pasoTooltip.id !== "menu-lateral"
                ? "opacity 1.1s ease, filter 1.1s ease"
                : tooltipStyle.transition,
            animation:
              pasoTooltip.id === "crear-avatar" || esMobile
                ? "aparecerTooltipSuave 1.1s ease-out"
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
                disabled={finalizado}
                style={{
                  backgroundColor: "#2ecc71",
                  color: "white",
                  border: "none",
                  padding: "10px 30px",
                  borderRadius: "8px",
                  cursor: finalizado ? "wait" : "pointer",
                  fontWeight: 600,
                  boxShadow:
                    "0 0 40px rgba(255,255,255,0.9), 0 0 30px var(--color-accent)",
                  transition: "transform 0.3s ease, opacity 0.2s ease",
                  opacity: finalizado ? 0.72 : 1,
                }}
              >
                {step < pasos.length - 1
                  ? "Siguiente"
                  : finalizado
                  ? "Preparando bienvenida..."
                  : "Finalizar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🔹 Editor de avatar animado */}
      <div
        className="tutorial-editor-avatar"
        style={{
          opacity: mostrarEditor ? (ocultandoEditor ? 0 : 1) : 0,
          transform: mostrarEditor ? (ocultandoEditor ? "scale(0.97)" : "scale(1)") : "scale(0.97)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
          zIndex: 10020,
          position: mostrarEditor ? "fixed" : "absolute",
          inset: 0,
          pointerEvents: mostrarEditor ? "auto" : "none",
          backgroundColor: mostrarEditor ? "rgba(0,0,0,0.4)" : "transparent",
          overflowY: mostrarEditor ? "auto" : "hidden",
          touchAction: mostrarEditor ? "auto" : "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {montarEditor && (
          <ModalEditorAvatar
            open={montarEditor}
            onClose={() => {}}
            initialConfig={avatarConfig}
            onSave={guardarAvatar}
            forzado={true}
            onReady={() => {
              if (mostrarEditor) return;

              setMostrarEditor(true);

              if (!esMobile) {
                window.setTimeout(() => setMostrarTooltip(true), 800);
              }
            }}
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
            filter: blur(3px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }
      `}</style>

      {finalizado &&
        logrosDesbloqueados.length === 0 &&
        !mostrarCofre && (
          <CargadorFCC
            flotante
            mensaje="Preparando tu cofre de bienvenida"
            detalle=""
          />
        )}

      {logrosDesbloqueados.map((l) =>
      createPortal(
        <ModalLogroDesbloqueado
          key={l.id}
          logro={l}
          onClose={() =>
            setLogrosDesbloqueados((prev) =>
              prev.filter((x) => x.id !== l.id)
            )
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
          recursosPrecargados
          onFinish={async () => {
            await new Promise((r) => setTimeout(r, 800));
            const confirmado = await confirmarYCerrarTutorial();

            if (confirmado) {
              setMostrarCofre(false);
            }
          }}
        />
        </div>
      )}
    </>
  );
}
