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
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [highlightContent, setHighlightContent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [animandoEditor, setAnimandoEditor] = useState(false);
  const [transicionSuave, setTransicionSuave] = useState(false);
  const [ocultandoEditor, setOcultandoEditor] = useState(false); 
  const [mostrarTooltip, setMostrarTooltip] = useState(true);
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
    eyes: "cara/ojos/masculino/Ojos1.png",
    mouth: "cara/bocas/Boca1.png",
    nose: "cara/narices/Nariz1.png",
    glasses: "none",
    hair: "cabello/masculino/Cabello1.png",
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
        "¡Bienvenido a FCC Maths! Esta plataforma te ayudará a aprender, practicar y subir de nivel resolviendo quizzes y consiguiendo logros.",
      selector: null,
      pos: "center",
    },
    {
      id: "crear-avatar",
      texto:
        "Antes de comenzar, crea tu avatar. Podrás personalizarlo con diferentes estilos y accesorios, y lo verás reflejado en tus logros y ranking.",
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
      selector: ".menu-lateral",
      texto:
        "Desde esta barra lateral puedes navegar entre las distintas secciones: tus cursos, ranking, amigos, profesores y configuración.",
      pos: "right",
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

  const paso = pasos[step];

  useEffect(() => {
    if (!paso.selector) {
      setHighlightRect(null);
      setHighlightContent(null);
      return;
    }
    const elemento = document.querySelector(paso.selector) as HTMLElement;
    if (elemento) {
      const rect = elemento.getBoundingClientRect();
      setHighlightRect(rect);
      setHighlightContent(elemento.cloneNode(true) as HTMLElement);
    } else {
      setHighlightRect(null);
      setHighlightContent(null);
    }
  }, [step]);

  useEffect(() => {
    if (paso.id === "crear-avatar") {
      setTransicionSuave(true);
      setAnimandoEditor(true);
      setMostrarTooltip(false); 

      const abrir = setTimeout(() => {
        setMostrarEditor(true);
        setTimeout(() => setMostrarTooltip(true), 600);
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
        setMostrarEditor(false);
        setStep((s) => s + 1);
      }, 500); 
    } catch (error) {
      console.error("Error guardando avatar:", error);
    }
  }

  function siguiente() {
    if (paso.id === "crear-avatar") return;
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
    const base = {
      position: "absolute",
      backgroundColor: "var(--color-card)",
      color: "var(--color-text)",
      padding: "18px 22px",
      borderRadius: "12px",
      maxWidth: "340px",
      boxShadow: "0 0 40px rgba(255,255,255,0.9), 0 0 30px var(--color-accent)",
      zIndex: 10021,
      transition: "all 0.6s ease-in-out",
      opacity: 1,
    } as React.CSSProperties;

    if (paso.pos === "left-modal") {
      return { ...base, top: "50%", left: "3%", transform: "translateY(-50%)" };
    }

    if (!highlightRect || paso.pos === "center") {
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    const r = highlightRect;
    const margin = 20;

    //  Posición especial para el paso de "cursos"
    if (paso.id === "cursos" && highlightRect) {
      return {
        ...base,
        top: highlightRect.top + window.scrollY - 420, 
       left: Math.max(highlightRect.left + 320, 20),  
        transform: "none",
      };
    }

    //  Posición especial para el paso de "xp" 
    if (paso.id === "xp" && highlightRect) {
      return {
        ...base,
        top: highlightRect.top + window.scrollY - 120, 
        left: Math.max(highlightRect.left - 350, 20),
        transform: "none",
      };
    }

    switch (paso.pos) {
      case "right":
        return { ...base, top: r.top + window.scrollY, left: r.right + margin };
      case "left":
        return { ...base, top: r.top + window.scrollY, left: r.left - 360 };
      case "top":
        return { ...base, top: r.top + window.scrollY - 180, left: r.left + r.width / 2 - 170 };
      default:
        return { ...base, top: r.bottom + window.scrollY + margin, left: r.left + r.width / 2 - 170 };
    }
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
              transition: "box-shadow 1s ease-in-out",
              animation: "brilloFlotante 3s ease-in-out infinite",
              opacity: ocultandoEditor ? 0 : 1, 
              transitionDuration: "0.8s",
            }}
            dangerouslySetInnerHTML={{ __html: highlightContent.outerHTML }}
          />,
          document.body
        )}

      {/* 🔹 Tooltip con mascota */}
      {mostrarTooltip && (
        <div style={tooltipStyle}>
          {/* 🐺 Imagen de mascota (centrada y más grande) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: "18px",
            }}
          >
            <img
              src={obtenerImagenMascota(paso.id)}
              alt="Mascota FCC Maths"
              style={{
                width: "150px",
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 14px rgba(255,255,255,0.8))",
                marginBottom: "12px",
                transform: ready ? "scale(1)" : "scale(0.9)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                opacity: ready ? 1 : 0,
              }}
            />

            <p
              style={{
                fontSize: "15px",
                marginBottom: 0,
                lineHeight: "1.6",
                opacity: mostrarTooltip ? 1 : 0,
                transition: "opacity 0.6s ease-in-out",
              }}
            >
              {paso.texto}
            </p>
          </div>

          {/* 🟢 Botón siguiente */}
          {paso.id !== "crear-avatar" && (
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
