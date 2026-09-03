"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ModalEditorAvatar from "./ModalEditorAvatar";
import {
  AvatarConfig,
  prepararRecursosAvatarFCC,
} from "./RenderizadorAvatar";
import { supabase } from "@/utils/supabaseClient";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";
import { precargarImagenes } from "@/lib/imagenes";
import { prepararRecursosCofreFCC } from "@/lib/recursosCofre";
import {
  completarAvatarConfigBaseEstudiante,
  crearAvatarConfigInicialEstudiante,
  esAvatarConfigV2,
} from "@/lib/avatarConfig";
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
  const [entradaTutorialVisible, setEntradaTutorialVisible] = useState(false);
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
  const [highlightRadius, setHighlightRadius] = useState("16px");

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
  const [transicionSuave, setTransicionSuave] = useState(false);
  const [ocultandoEditor, setOcultandoEditor] = useState(false);
  const ocultandoEditorRef = useRef(false);
  const [mostrarTooltip, setMostrarTooltip] = useState(true);
  const [tooltipVisibleMovil, setTooltipVisibleMovil] = useState(true);
  const [tooltipForzadoOculto, setTooltipForzadoOculto] = useState(false);
  const [tarjetaCrearAvatarFinalizada, setTarjetaCrearAvatarFinalizada] =
    useState(false);
  const [resaltadoVisible, setResaltadoVisible] = useState(true);
  const [suspenderOverlayTutorialEditor, setSuspenderOverlayTutorialEditor] =
    useState(false);
  const [overlayTutorialSaliendoEditor, setOverlayTutorialSaliendoEditor] =
    useState(false);
  const transicionPasoRef = useRef(false);
  const [mostrarCofre, setMostrarCofre] = useState(false);
  const [recompensasCofre, setRecompensasCofre] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;

    if (mostrarEditor || montarEditor) return;

    const bloquearScroll = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", bloquearScroll, { passive: false });
    window.addEventListener("touchmove", bloquearScroll, { passive: false });

    return () => {
      window.removeEventListener("wheel", bloquearScroll);
      window.removeEventListener("touchmove", bloquearScroll);
    };
  }, [visible, mostrarEditor, montarEditor]);

  const configAvatarFallback = crearAvatarConfigInicialEstudiante("masculino");
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    configAvatarFallback
  );
  const [editorInitialConfig, setEditorInitialConfig] =
    useState<AvatarConfig>(configAvatarFallback);
  const [avatarInicialListo, setAvatarInicialListo] = useState(false);
  const avatarConfigRef = useRef<AvatarConfig>(configAvatarFallback);

  useEffect(() => {
    avatarConfigRef.current = avatarConfig;
  }, [avatarConfig]);

  const tutorialListoParaEntrar =
    visible &&
    ready &&
    avatarInicialListo &&
    !cargando &&
    !errorRecursos;

  useEffect(() => {
    if (!tutorialListoParaEntrar) {
      setEntradaTutorialVisible(false);
      return;
    }

    // Importante: este efecto arranca únicamente cuando ya dejó de renderizarse
    // el cargador. Así existe al menos un frame real con opacity 0 antes de
    // iniciar el fade del overlay y de la tarjeta de bienvenida.
    setEntradaTutorialVisible(false);

    let raf1 = 0;
    let raf2 = 0;
    const entrada = window.setTimeout(() => {
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setEntradaTutorialVisible(true);
        });
      });
    }, 120);

    return () => {
      window.clearTimeout(entrada);
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [tutorialListoParaEntrar]);

  useEffect(() => {
    let activo = true;

    async function resolverAvatarInicial() {
      try {
        const {
          data: { user },
          error: errorSesion,
        } = await supabase.auth.getUser();

        if (errorSesion) throw errorSesion;
        if (!user) return;

        const { data: perfil, error: errorPerfil } = await supabase
          .from("usuarios")
          .select("avatar_config")
          .eq("id", user.id)
          .maybeSingle();

        if (errorPerfil) {
          console.warn(
            "[FCC Academy] No se pudo leer avatar_config antes del tutorial:",
            errorPerfil
          );
        }

        const configGuardada = perfil?.avatar_config as unknown;
        const avatarRegistro = (
          user.user_metadata as Record<string, unknown> | null
        )?.avatar_inicial;

        const generoRegistro =
          avatarRegistro === "femenino" ? "femenino" : "masculino";

        const configResuelta = esAvatarConfigV2(configGuardada)
          ? completarAvatarConfigBaseEstudiante(configGuardada)
          : crearAvatarConfigInicialEstudiante(generoRegistro);

        if (!activo) return;

        avatarConfigRef.current = configResuelta;
        setAvatarConfig(configResuelta);
        setEditorInitialConfig(configResuelta);
      } catch (error) {
        console.warn(
          "[FCC Academy] Se usara el avatar inicial de respaldo:",
          error
        );
      } finally {
        if (activo) setAvatarInicialListo(true);
      }
    }

    void resolverAvatarInicial();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || !avatarInicialListo) return;

    void prepararRecursosAvatarFCC(avatarConfigRef.current, 380);
  }, [visible, avatarInicialListo]);

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
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipCongelado, setTooltipCongelado] =
    useState<React.CSSProperties | null>(null);

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

  const obtenerRadioResaltadoPaso = (
    idPaso: string,
    elemento: HTMLElement
  ) => {
    if (idPaso === "menu-lateral" && !esMobile) return "0px";

    const estilo = window.getComputedStyle(elemento);
    const radio = Number.parseFloat(estilo.borderRadius || "0");

    if (Number.isFinite(radio) && radio >= 12) {
      return estilo.borderRadius;
    }

    return "28px";
  };

  const secuenciaResaltadoRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    const secuencia = ++secuenciaResaltadoRef.current;
    let timeoutOcultar: ReturnType<typeof setTimeout> | undefined;
    let timeoutScroll: ReturnType<typeof setTimeout> | undefined;
    let timeoutMostrar: ReturnType<typeof setTimeout> | undefined;
    let timeoutTooltip: ReturnType<typeof setTimeout> | undefined;
    let timeoutDescongelar: ReturnType<typeof setTimeout> | undefined;
    let timeoutOverlay: ReturnType<typeof setTimeout> | undefined;
    let rafId = 0;

    const sigueVigente = () =>
      secuencia === secuenciaResaltadoRef.current;

    const medir = (elemento: HTMLElement) => {
      const rect = elemento.getBoundingClientRect();

      setHighlightRect(rect);
      setHighlightRadius(obtenerRadioResaltadoPaso(paso.id, elemento));
      setStepTooltip(step);
    };

    const mostrarDestino = (elemento: HTMLElement) => {
      if (!sigueVigente()) return;

      if (paso.id === "avatar-explicacion") {
        // La tarjeta anterior ya no existe. Eliminamos su posición congelada
        // ANTES de montar la nueva para que jamás pueda verse ni un frame en
        // la ubicación vieja.
        setTooltipCongelado(null);
      }

      medir(elemento);
      setMostrarTooltip(true);
      setTooltipVisibleMovil(true);

      if (tooltipCongelado && paso.id !== "avatar-explicacion") {
        timeoutDescongelar = setTimeout(() => {
          if (!sigueVigente()) return;
          setTooltipCongelado(null);
        }, 70);
      }

      // La geometría cambia mientras el resaltado está oculto. Después se
      // desvanece hacia dentro en su NUEVA posición, sin recorrer la pantalla.
      if (paso.id === "avatar-explicacion") {
        // Primero montamos el nuevo oscurecimiento todavía invisible. Unos
        // milisegundos después aparecen juntos el hueco y el narrador.
        timeoutOverlay = setTimeout(() => {
          if (!sigueVigente()) return;
          setOverlayTutorialSaliendoEditor(false);
          setSuspenderOverlayTutorialEditor(false);
        }, 40);
      }

      timeoutMostrar = setTimeout(() => {
        if (!sigueVigente()) return;

        if (paso.id === "avatar-explicacion") {
          setOcultandoEditor(false);
          ocultandoEditorRef.current = false;
          setTooltipForzadoOculto(false);
        }

        setResaltadoVisible(true);
      }, paso.id === "avatar-explicacion" ? 90 : 34);
    };

    if (!paso.selector) {
      setResaltadoVisible(false);
      setHighlightRect(null);
      setHighlightRadius("16px");
      setStepTooltip(step);
      setMostrarTooltip(true);
      setTooltipVisibleMovil(true);
      return;
    }

    const elemento = obtenerElementoTutorial(paso.selector);

    if (!elemento) {
      setResaltadoVisible(false);
      setHighlightRect(null);
      setHighlightRadius("16px");
      setStepTooltip(step);
      setMostrarTooltip(true);
      setTooltipVisibleMovil(true);
      return;
    }

    // En móvil primero ocultamos el resaltado, desplazamos la página y sólo
    // después medimos el destino definitivo. Nunca se muestra un rectángulo
    // viajando mientras scrollIntoView sigue trabajando.
    if (esMobile && paso.id !== "menu-lateral") {
      setTooltipVisibleMovil(false);
      setResaltadoVisible(false);

      timeoutOcultar = setTimeout(() => {
        if (!sigueVigente()) return;

        setMostrarTooltip(false);
        setHighlightRect(null);
        setHighlightRadius("16px");

        elemento.scrollIntoView({
          behavior: "smooth",
          block: paso.id === "ranking" || paso.id === "xp" ? "end" : "start",
          inline: "nearest",
        });

        timeoutScroll = setTimeout(() => {
          if (!sigueVigente()) return;

          const actualizado = obtenerElementoTutorial(paso.selector!);
          if (!actualizado) return;

          mostrarDestino(actualizado);

          timeoutTooltip = setTimeout(() => {
            if (!sigueVigente()) return;
            setMostrarTooltip(true);
            setTooltipVisibleMovil(true);
          }, 720);
        }, 900);
      }, 260);

      return () => {
        if (timeoutOcultar) clearTimeout(timeoutOcultar);
        if (timeoutScroll) clearTimeout(timeoutScroll);
        if (timeoutMostrar) clearTimeout(timeoutMostrar);
        if (timeoutTooltip) clearTimeout(timeoutTooltip);
        if (timeoutDescongelar) clearTimeout(timeoutDescongelar);
        if (timeoutOverlay) clearTimeout(timeoutOverlay);
      };
    }

    // En escritorio el hueco anterior se desvanece por completo; se cambia la
    // geometría cuando ya no es visible y el nuevo hueco aparece suavemente.
    // Sólo la tarjeta de la mascota recorre físicamente A -> B.
    setResaltadoVisible(false);

    timeoutOcultar = setTimeout(() => {
      if (!sigueVigente()) return;

      const actualizado = obtenerElementoTutorial(paso.selector!);
      if (!actualizado) return;

      mostrarDestino(actualizado);
    }, paso.id === "avatar-explicacion" ? 0 : 220);

    const recalcularLigero = () => {
      if (!paso.selector) return;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!sigueVigente()) return;

        const actualizado = obtenerElementoTutorial(paso.selector!);
        if (!actualizado) return;

        const rect = actualizado.getBoundingClientRect();
        setHighlightRect(rect);
        setHighlightRadius(
          obtenerRadioResaltadoPaso(paso.id, actualizado)
        );
      });
    };

    window.addEventListener("resize", recalcularLigero);

    return () => {
      if (timeoutOcultar) clearTimeout(timeoutOcultar);
      if (timeoutScroll) clearTimeout(timeoutScroll);
      if (timeoutMostrar) clearTimeout(timeoutMostrar);
      if (timeoutTooltip) clearTimeout(timeoutTooltip);
      if (timeoutDescongelar) clearTimeout(timeoutDescongelar);
      if (timeoutOverlay) clearTimeout(timeoutOverlay);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalcularLigero);
    };
  }, [visible, step, esMobile, paso.selector, paso.id]);

  useEffect(() => {
    if (paso.id === "crear-avatar") {
      ocultandoEditorRef.current = false;
      setOcultandoEditor(false);
      setTarjetaCrearAvatarFinalizada(false);
      setTransicionSuave(true);
      setOverlayTutorialSaliendoEditor(false);
      setSuspenderOverlayTutorialEditor(false);
      setMostrarTooltip(false);
      setTooltipForzadoOculto(true);

      const abrir = setTimeout(() => {
        setEditorInitialConfig(avatarConfigRef.current);
        setMontarEditor(true);
      }, 180);

      return () => clearTimeout(abrir);
    }

    setTransicionSuave(false);

    // Tras Crear avatar, la tarjeta anterior ya fue desmontada. No permitimos
    // que este efecto genérico vuelva a montar el mismo contenedor durante el
    // cambio de step. avatar-explicacion se monta únicamente desde
    // mostrarDestino(), cuando su posición final ya está calculada.
    if (paso.id === "avatar-explicacion" && ocultandoEditorRef.current) {
      return;
    }

    if (paso.id === "preparar-avatar") {
      setTooltipForzadoOculto(false);
    }

    if (esMobile && paso.selector && paso.id !== "menu-lateral") {
      setMostrarTooltip(false);
      return;
    }

    setMostrarTooltip(true);
  }, [step, esMobile, paso.id, paso.selector]);
  

  if (cargando || !ready || !avatarInicialListo) {
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

      // Congelamos la tarjeta EXACTAMENTE en el punto donde está antes de
      // empezar el cierre. El modal puede cambiar su geometría al desvanecerse,
      // pero el lobito ya no vuelve a consultar esa posición ni puede "subir".
      const rectTooltipActual = tooltipRef.current?.getBoundingClientRect();

      if (rectTooltipActual) {
        setTooltipCongelado({
          top: rectTooltipActual.top,
          left: rectTooltipActual.left,
          right: "auto",
          bottom: "auto",
          width: rectTooltipActual.width,
          maxWidth: rectTooltipActual.width,
          transform: "none",
          transition: "opacity 0.68s ease",
        });
      }

      // Al terminar el editor NO desplazamos la tarjeta hacia el primer
      // objetivo. El narrador y el editor se desvanecen juntos; después el
      // siguiente paso aparece ya colocado sobre su destino.
      setTooltipForzadoOculto(true);
      setResaltadoVisible(false);

      ocultandoEditorRef.current = true;
      setOcultandoEditor(true);

      localStorage.setItem("avatar_config", JSON.stringify(newConfig));

      // El fade dura 680 ms. Damos 20 ms de margen para que el navegador
      // pinte realmente opacity 0 y ENTONCES desmontamos definitivamente la
      // tarjeta vieja. Desde ese punto ya no existe en el DOM y por lo tanto
      // no puede reaparecer ni un solo frame.
      window.setTimeout(() => {
        setTarjetaCrearAvatarFinalizada(true);
        setMostrarTooltip(false);
        setMontarEditor(false);
        setMostrarEditor(false);

        avatarConfigRef.current = newConfig;
        setAvatarConfig(newConfig);
        window.dispatchEvent(new Event("avatarActualizado"));

        // Dejamos un intervalo mínimo completamente limpio antes de crear el
        // siguiente paso. El nuevo mensaje nacerá ya en su destino.
        window.setTimeout(() => {
          setStep((s) => s + 1);
        }, 60);
      }, 700);

      return true;
    } catch (error) {
      console.error("Error guardando avatar:", error);
      return false;
    }
  }

  function siguiente() {
    if (paso.id === "crear-avatar") return;

    if (paso.id === "bienvenida") {
      if (transicionPasoRef.current) return;

      transicionPasoRef.current = true;
      setTooltipForzadoOculto(true);

      window.setTimeout(() => {
        setStep((actual) => actual + 1);
        transicionPasoRef.current = false;
      }, 240);

      return;
    }

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

      const { prepararLogroTutorial } = await import(
        "@/lib/finalizarTutorial"
      );
      const preparacion = await prepararLogroTutorial();

      if (!preparacion.ok) {
        throw new Error(
          preparacion.error ||
            "No se pudo preparar el logro del tutorial."
        );
      }

      const { procesarResultadoLogros } = await import(
        "@/utils/verificarLogros"
      );
      const nuevos = procesarResultadoLogros(
        preparacion.resultado ?? {},
        "tutorial"
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

  const tooltipStyleCalculado: React.CSSProperties = (() => {
    const anchoTooltip = esMobile
      ? window.innerWidth - 32
      : pasoTooltip.selector
        ? 430
        : 340;
    const margenPantalla = 16;
    const margin = 20;
    const altoTooltipActual =
      tooltipRef.current?.getBoundingClientRect().height ??
      (esMobile ? 300 : 300);

    const duracionMovimiento =
      pasoTooltip.id === "avatar-explicacion" ? "1.15s" : "0.72s";

    const base = {
      position: "fixed",
      backgroundColor: "var(--color-card)",
      color: "var(--color-text)",
      padding: esMobile ? "14px 16px" : "18px 22px",
      borderRadius: "12px",
      width: esMobile ? "auto" : `${anchoTooltip}px`,
      maxWidth: esMobile
        ? "none"
        : pasoTooltip.selector
          ? "430px"
          : "340px",
      boxShadow:
        "0 18px 48px rgba(2,8,23,0.32), 0 0 0 1px rgba(47,128,255,0.9)",
      border: "2px solid #2f80ff",
      zIndex: 10021,
      transition:
        pasoTooltip.id === "crear-avatar"
          ? "opacity 0.68s ease"
          : pasoTooltip.id === "avatar-explicacion"
            ? "opacity 0.55s ease, filter 0.55s ease"
            : esMobile
              ? "top 0.68s linear, left 0.68s linear, opacity 0.48s ease"
              : `top ${duracionMovimiento} linear, left ${duracionMovimiento} linear, opacity 0.55s ease`,
      opacity: 1,
      transform: "none",
    } as React.CSSProperties;

    if (
      esMobile &&
      pasoTooltip.pos !== "center" &&
      pasoTooltip.id !== "crear-avatar" &&
      highlightRect
    ) {
      const r = highlightRect;
      const margen = 12;
      const alto = altoTooltipActual;

      const hayEspacioAbajo =
        window.innerHeight - r.bottom > alto + margen;
      const hayEspacioArriba = r.top > alto + margen;

      if (r.top < window.innerHeight * 0.45 && hayEspacioAbajo) {
        return {
          ...base,
          left: 16,
          right: 16,
          top: r.bottom + margen,
          bottom: "auto",
          width: "auto",
          maxWidth: "none",
        };
      }

      if (hayEspacioArriba) {
        return {
          ...base,
          left: 16,
          right: 16,
          top: Math.max(margenPantalla, r.top - margen - alto),
          bottom: "auto",
          width: "auto",
          maxWidth: "none",
        };
      }

      return {
        ...base,
        left: 16,
        right: 16,
        top: Math.max(
          margenPantalla,
          window.innerHeight - alto - 20
        ),
        bottom: "auto",
        width: "auto",
        maxWidth: "none",
      };
    }

    if (pasoTooltip.pos === "left-modal") {
      const modal = document.querySelector(
        ".avatar-editor-modal"
      ) as HTMLElement | null;
      const rectModal = modal?.getBoundingClientRect();
      const separacionModal = 10;
      const anchoMinimoUtil = 220;

      if (rectModal) {
        const espacioIzquierda =
          rectModal.left - separacionModal - margenPantalla;
        const espacioDerecha =
          window.innerWidth -
          rectModal.right -
          separacionModal -
          margenPantalla;

        if (espacioIzquierda >= anchoMinimoUtil) {
          const anchoSeguro = Math.min(340, espacioIzquierda);
          const izquierda = Math.max(
            margenPantalla,
            rectModal.left - separacionModal - anchoSeguro
          );

          return {
            ...base,
            width: `${anchoSeguro}px`,
            maxWidth: `${anchoSeguro}px`,
            top: rectModal.top + rectModal.height / 2,
            left: izquierda,
            transform: "translateY(-50%)",
          };
        }

        if (espacioDerecha >= anchoMinimoUtil) {
          const anchoSeguro = Math.min(340, espacioDerecha);

          return {
            ...base,
            width: `${anchoSeguro}px`,
            maxWidth: `${anchoSeguro}px`,
            top: rectModal.top + rectModal.height / 2,
            left: rectModal.right + separacionModal,
            transform: "translateY(-50%)",
          };
        }
      }

      const anchoSeguro = Math.min(
        300,
        Math.max(210, window.innerWidth - margenPantalla * 2)
      );

      return {
        ...base,
        width: `${anchoSeguro}px`,
        maxWidth: `${anchoSeguro}px`,
        top: margenPantalla,
        left: margenPantalla,
      };
    }

    if (pasoTooltip.id === "bienvenida") {
      return {
        ...base,
        top: "50%",
        left: esMobile ? 16 : "50%",
        right: esMobile ? 16 : "auto",
        width: esMobile ? "auto" : `${anchoTooltip}px`,
        transform: esMobile
          ? "translateY(-50%)"
          : "translate(-50%, -50%)",
        transition: "opacity 0.68s ease",
      };
    }

    if (!highlightRect || pasoTooltip.pos === "center") {
      return {
        ...base,
        top: Math.max(
          margenPantalla,
          (window.innerHeight - altoTooltipActual) / 2
        ),
        left: Math.max(
          margenPantalla,
          (window.innerWidth - anchoTooltip) / 2
        ),
      };
    }

    const r = highlightRect;
    const alto = altoTooltipActual;
    const leftCentrado = limitar(
      r.left + r.width / 2 - anchoTooltip / 2,
      margenPantalla,
      window.innerWidth - anchoTooltip - margenPantalla
    );

    const hayEspacioArriba =
      r.top > alto + margin + margenPantalla;
    const hayEspacioAbajo =
      window.innerHeight - r.bottom >
      alto + margin + margenPantalla;
    const hayEspacioDerecha =
      window.innerWidth - r.right > anchoTooltip + margin;
    const hayEspacioIzquierda =
      r.left > anchoTooltip + margin;

    if (pasoTooltip.pos === "top" && hayEspacioArriba) {
      return {
        ...base,
        top: r.top - margin - alto,
        left: leftCentrado,
      };
    }

    if (pasoTooltip.pos === "bottom" && hayEspacioAbajo) {
      return {
        ...base,
        top: r.bottom + margin,
        left: leftCentrado,
      };
    }

    if (pasoTooltip.pos === "right" && hayEspacioDerecha) {
      return {
        ...base,
        top: limitar(
          r.top,
          margenPantalla,
          Math.max(
            margenPantalla,
            window.innerHeight - alto - margenPantalla
          )
        ),
        left: r.right + margin,
      };
    }

    if (pasoTooltip.pos === "left" && hayEspacioIzquierda) {
      return {
        ...base,
        top: limitar(
          r.top,
          margenPantalla,
          Math.max(
            margenPantalla,
            window.innerHeight - alto - margenPantalla
          )
        ),
        left: r.left - anchoTooltip - margin,
      };
    }

    if (hayEspacioArriba) {
      return {
        ...base,
        top: r.top - margin - alto,
        left: leftCentrado,
      };
    }

    if (hayEspacioAbajo) {
      return {
        ...base,
        top: r.bottom + margin,
        left: leftCentrado,
      };
    }

    if (hayEspacioDerecha) {
      return {
        ...base,
        top: limitar(
          r.top,
          margenPantalla,
          Math.max(
            margenPantalla,
            window.innerHeight - alto - margenPantalla
          )
        ),
        left: r.right + margin,
      };
    }

    if (hayEspacioIzquierda) {
      return {
        ...base,
        top: limitar(
          r.top,
          margenPantalla,
          Math.max(
            margenPantalla,
            window.innerHeight - alto - margenPantalla
          )
        ),
        left: r.left - anchoTooltip - margin,
      };
    }

    return {
      ...base,
      top: Math.max(
        margenPantalla,
        (window.innerHeight - alto) / 2
      ),
      left: Math.max(
        margenPantalla,
        (window.innerWidth - anchoTooltip) / 2
      ),
    };
  })();

  const tooltipStyle: React.CSSProperties = tooltipCongelado
    ? {
        ...tooltipStyleCalculado,
        ...tooltipCongelado,
      }
    : tooltipStyleCalculado;

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
      setResaltadoVisible(false);
      setHighlightRect(null);

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


    const radioResaltado = highlightRect
      ? Math.max(
          0,
          Math.min(
            Number.parseFloat(highlightRadius) || 0,
            highlightRect.width / 2,
            highlightRect.height / 2
          )
        )
      : 0;

  return (
  <>
    {/* Fondo completo únicamente cuando no hay un objetivo. Cuando existe
        un objetivo usamos cuatro paneles alrededor: el elemento real queda
        visible en el hueco, pero nunca se clona ni se vuelve interactivo. */}
    {!suspenderOverlayTutorialEditor && !highlightRect && (
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
          transition: overlayTutorialSaliendoEditor
            ? "opacity 0.68s ease"
            : "opacity 0.8s ease",
          opacity: overlayTutorialSaliendoEditor
            ? 0
            : entradaTutorialVisible
              ? transicionSuave
                ? 0.6
                : 1
              : 0,
        }}
      />
    )}

      {!suspenderOverlayTutorialEditor &&
        highlightRect &&
        createPortal(
          <>
            {[
              {
                key: "top",
                top: 0,
                left: 0,
                width: window.innerWidth,
                height: Math.max(0, highlightRect.top),
              },
              {
                key: "left",
                top: Math.max(0, highlightRect.top),
                left: 0,
                width: Math.max(0, highlightRect.left),
                height: Math.max(0, highlightRect.height),
              },
              {
                key: "right",
                top: Math.max(0, highlightRect.top),
                left: Math.min(window.innerWidth, highlightRect.right),
                width: Math.max(0, window.innerWidth - highlightRect.right),
                height: Math.max(0, highlightRect.height),
              },
              {
                key: "bottom",
                top: Math.min(window.innerHeight, highlightRect.bottom),
                left: 0,
                width: window.innerWidth,
                height: Math.max(0, window.innerHeight - highlightRect.bottom),
              },
            ].map((panel) => (
              <div
                key={panel.key}
                aria-hidden="true"
                style={{
                  position: "fixed",
                  top: panel.top,
                  left: panel.left,
                  width: panel.width,
                  height: panel.height,
                  zIndex: 9998,
                  backgroundColor: "rgba(0,0,0,0.48)",
                  backdropFilter: "blur(2px)",
                  pointerEvents: "auto",
                  transition: "opacity 0.38s ease",
                  opacity:
                    resaltadoVisible && !ocultandoEditor ? 1 : 0,
                }}
              />
            ))}

            {/* Las cuatro esquinas completan el oscurecimiento del hueco.
                Así el recorte respeta exactamente el border-radius real de
                la tarjeta señalada y no queda un rectángulo cuadrado. */}
            {radioResaltado > 0 &&
              [
                {
                  key: "corner-tl",
                  top: highlightRect.top,
                  left: highlightRect.left,
                  center: "100% 100%",
                },
                {
                  key: "corner-tr",
                  top: highlightRect.top,
                  left: highlightRect.right - radioResaltado,
                  center: "0% 100%",
                },
                {
                  key: "corner-bl",
                  top: highlightRect.bottom - radioResaltado,
                  left: highlightRect.left,
                  center: "100% 0%",
                },
                {
                  key: "corner-br",
                  top: highlightRect.bottom - radioResaltado,
                  left: highlightRect.right - radioResaltado,
                  center: "0% 0%",
                },
              ].map((corner) => (
                <div
                  key={corner.key}
                  aria-hidden="true"
                  style={{
                    position: "fixed",
                    top: corner.top,
                    left: corner.left,
                    width: radioResaltado,
                    height: radioResaltado,
                    zIndex: 9999,
                    pointerEvents: "auto",
                    background: `radial-gradient(circle at ${corner.center}, transparent 0 ${Math.max(
                      0,
                      radioResaltado - 1
                    )}px, rgba(0,0,0,0.48) ${radioResaltado}px)`,
                    transition: "opacity 0.38s ease",
                    opacity:
                      resaltadoVisible && !ocultandoEditor ? 1 : 0,
                  }}
                />
              ))}

            {/* Bloqueador transparente exactamente sobre el elemento señalado:
                conserva su apariencia real, pero impide navegar o pulsarlo. */}
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                top: highlightRect.top,
                left: highlightRect.left,
                width: highlightRect.width,
                height: highlightRect.height,
                zIndex: 10002,
                borderRadius: highlightRadius,
                border: "2px solid #2f80ff",
                boxShadow:
                  "0 0 38px 10px rgba(255,255,255,0.62), 0 0 24px 6px rgba(47,128,255,0.62)",
                background: "transparent",
                pointerEvents: "auto",
                transition: "opacity 0.38s ease",
                opacity:
                  resaltadoVisible && !ocultandoEditor ? 1 : 0,
              }}
            />
          </>,
          document.body
        )}

      {/* 🔹 Tooltip con mascota */}
      {mostrarTooltip &&
        !(pasoTooltip.id === "crear-avatar" && tarjetaCrearAvatarFinalizada) && (
        <div
          ref={tooltipRef}
          className="fcc-reward-overlay"
          style={{
            ...tooltipStyle,
            opacity:
              entradaTutorialVisible &&
              !tooltipForzadoOculto &&
              !ocultandoEditor &&
              (esMobile ? tooltipVisibleMovil : true)
                ? 1
                : 0,
            filter: "none",
            // Durante la salida del editor la tarjeta depende UNICAMENTE
            // de opacity. Desactivamos cualquier animation CSS que pudiera
            // competir con ese valor (las animaciones CSS tienen prioridad
            // sobre una declaración normal de opacity).
            transition:
              ocultandoEditor && pasoTooltip.id === "crear-avatar"
                ? "opacity 0.68s ease"
                : tooltipForzadoOculto
                  ? pasoTooltip.id === "crear-avatar"
                    ? "opacity 0.68s ease"
                    : "opacity 0.22s ease"
                  : tooltipStyle.transition,
            animation:
              ocultandoEditor && pasoTooltip.id === "crear-avatar"
                ? "none"
                : esMobile && pasoTooltip.id !== "crear-avatar"
                  ? "aparecerTooltipSuave 1.1s ease-out"
                  : undefined,
            willChange:
              pasoTooltip.id === "crear-avatar" ? "opacity" : undefined,
            pointerEvents: ocultandoEditor ? "none" : "auto",
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
                {pasoTooltip.id === "bienvenida"
                  ? "Comenzar"
                  : step < pasos.length - 1
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
          transform: "none",
          transition: "opacity 0.68s ease",
          zIndex: 10020,
          position: mostrarEditor ? "fixed" : "absolute",
          inset: 0,
          pointerEvents: mostrarEditor ? "auto" : "none",
          backgroundColor: "transparent",
          overflow: "hidden",
          touchAction: mostrarEditor ? "auto" : "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {montarEditor && (
          <ModalEditorAvatar
            open={montarEditor}
            onClose={() => {}}
            initialConfig={editorInitialConfig}
            onSave={guardarAvatar}
            forzado={true}
            desvanecerSalida={ocultandoEditor}
            duracionTransicionMs={680}
            desactivarAnimacionEntrada
            onReady={() => {
              if (mostrarEditor || ocultandoEditorRef.current) return;

              // Modal y tarjeta arrancan en el MISMO render y duran 680 ms.
              // El overlay del tutorial no desaparece de golpe: hace un
              // crossfade de 680 ms contra el overlay nativo del editor.
              setMostrarEditor(true);
              setMostrarTooltip(true);
              setTooltipVisibleMovil(true);
              setTooltipForzadoOculto(false);
              setOverlayTutorialSaliendoEditor(true);

              window.setTimeout(() => {
                if (!ocultandoEditorRef.current) {
                  setSuspenderOverlayTutorialEditor(true);
                  setOverlayTutorialSaliendoEditor(false);
                }
              }, 680);
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
