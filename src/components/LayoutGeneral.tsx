/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral (según rol) y la barra superior,
 * dejando el área central para el contenido dinámico.
 */

"use client";

import { useEffect, useState } from "react";
import MenuLateral from "./MenuLateral";
import TutorialInicio from "./TutorialInicio";
import BarraSuperiorLogo from "./BarraSuperiorLogo";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";

function VerificarTutorial() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    async function verificar() {
      try {
        const { supabase } = await import("@/utils/supabaseClient");
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        const { data: logros } = await supabase
          .from("logros_usuarios")
          .select("logro_id")
          .eq("usuario_id", user.user.id);

        const tieneTutorial = logros?.some(
          (l) =>
            l.logro_id === "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610" ||
            l.logro_id === "tutorial"
        );

        setMostrar(!tieneTutorial);
      } catch (err) {
        console.error("Error verificando logro tutorial:", err);
      }
    }
    verificar();
  }, []);

  return mostrar ? <TutorialInicio /> : null;
}

export default function LayoutGeneral({
  children,
  rol = "estudiante",
}: {
  children: React.ReactNode;
  rol?: string;
}) {
  const [tema, setTema] = useState<"oscuro" | "claro">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("preferencias_usuario");
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.tema === "oscuro" || prefs.tema === "claro") {
            return prefs.tema;
          }
        }
      } catch {}
    }
    return "claro";
  });

  // Cambio de tema
  useEffect(() => {
    function handler(e: any) {
      if (e.detail?.tema === "oscuro" || e.detail?.tema === "claro") {
        setTema(e.detail.tema);
      }
    }
    window.addEventListener("app:preferencias", handler);
    return () => window.removeEventListener("app:preferencias", handler);
  }, []);

  useEffect(() => {
    document.body.classList.remove("theme-oscuro", "theme-claro");
    document.body.classList.add(`theme-${tema}`);
  }, [tema]);

  useEffect(() => {
    (window as any).__tutorialActivo = false;
    window.dispatchEvent(new CustomEvent("tutorial:estado", { detail: { activo: false } }));
  }, []);

    // Sincronizar rol_usuario con sesión activa
  useEffect(() => {
    const syncRol = async () => {
      try {
        const { data: user } = await import("@/utils/supabaseClient").then((m) =>
          m.supabase.auth.getUser()
        );
        if (user?.user?.id) {
          const { data: usuario } = await import("@/utils/supabaseClient").then((m) =>
            m.supabase.from("usuarios").select("rol").eq("id", user.user.id).single()
          );
          if (usuario?.rol) {
            localStorage.setItem("rol_usuario", usuario.rol);
          }
        }
      } catch (err) {
        console.error("Error sincronizando rol_usuario:", err);
      }
    };

    syncRol();

    // ✅ Reaccionar a eventos de cierre de sesión
    const handleLogout = () => {
      localStorage.removeItem("rol_usuario");
      localStorage.removeItem("tutorial_visto");
      localStorage.removeItem("tutorial_visto_finalizado");
    };

    window.addEventListener("logout", handleLogout);

    return () => window.removeEventListener("logout", handleLogout);
  }, []);

  // Limpieza de cache de logros si cambia o cierra sesión
  useEffect(() => {
    const currentUser = localStorage.getItem("user_id");
    const lastUser = localStorage.getItem("ultimo_user_id");

    if (lastUser && lastUser !== currentUser) {
      // Limpia caché de logros del usuario anterior
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith("logros_local_")) {
          localStorage.removeItem(k);
        }
      }
      console.log("🧹 Limpieza: cache de logros borrada por cambio de usuario");
    }

    if (currentUser) {
      localStorage.setItem("ultimo_user_id", currentUser);
    }

    // Escucha de cierre de sesión explícito
    const handleLogout = () => {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith("logros_local_")) {
          localStorage.removeItem(k);
        }
      }
      console.log("🧹 Limpieza: cache de logros borrada al cerrar sesión");
    };

    window.addEventListener("logout", handleLogout);
    return () => window.removeEventListener("logout", handleLogout);
  }, []);

  useEffect(() => {
    function logEventos(e: any) {
      console.log("📡 Evento recibido:", e.type, e.detail);
    }
    window.addEventListener("nivelSubido", logEventos);
    return () => window.removeEventListener("nivelSubido", logEventos);
  }, []);

  const [logrosDesbloqueados, setLogrosDesbloqueados] = useState<any[]>([]);
  const [nivelSubido, setNivelSubido] = useState<number | null>(null);
  const [recompensasCofre, setRecompensasCofre] = useState<any[]>([]);

  async function handleNivelSubido(e: any) {
    const { obtenerRecompensasAleatorias } = await import("@/lib/obtenerRecompensas");
    const user = localStorage.getItem("user_id") || "";
    const { recompensas } = await obtenerRecompensasAleatorias(user);
    setNivelSubido(e.detail);
    setRecompensasCofre(recompensas);
  }

  // Mostrar logros desbloqueados
  useEffect(() => {
    function mostrarLogros(e: any) {
      if (e.detail && Array.isArray(e.detail)) {
        const stamped = e.detail.map((l: any) => ({
          ...l,
          __key: `${l.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }));
        setLogrosDesbloqueados((prev) => [...prev, ...stamped]);
      }
    }

    window.addEventListener("logrosDesbloqueados", (e) => {
      if ((window as any).__tutorialActivo) {
        console.log("⏩ Ignorado evento logrosDesbloqueados (tutorial activo)");
        return;
      }
      console.log("🔥 EVENTO logrosDesbloqueados capturado EN LayoutGeneral");
      mostrarLogros(e);
    });
    window.addEventListener("nivelSubido", handleNivelSubido);

    return () => {
      window.removeEventListener("logrosDesbloqueados", mostrarLogros);
      window.removeEventListener("nivelSubido", handleNivelSubido);
    };
  }, []);

  return (
    <>
      {typeof window !== "undefined" && rol === "estudiante" && <VerificarTutorial />}
      <div
        className="flex app-root h-screen overflow-hidden"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      >
        <MenuLateral rol={rol} />

        <div className="flex flex-col ml-64">
          <BarraSuperiorLogo />

          <main
            className="fixed top-16 left-64 right-0 bottom-0 p-6 overflow-auto"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 🏅 Modales de logros */}
      {logrosDesbloqueados.map((l) => (
        <ModalLogroDesbloqueado
          key={l.__key}
          logro={l}
          onClose={() =>
            setLogrosDesbloqueados((prev) =>
              prev.filter((x) => x.__key !== l.__key)
            )
          }
        />
      ))}

      {/* 🎁 Cofre de nivel */}
      {nivelSubido !== null && (
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
            nivel={nivelSubido}
            onFinish={() => setNivelSubido(null)}
          />
        </div>
      )}
    </>
  );
}
