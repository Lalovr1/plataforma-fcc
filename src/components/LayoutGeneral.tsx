/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral (según rol) y la barra superior,
 * dejando el área central para el contenido dinámico.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import MenuLateral from "./MenuLateral";
import TutorialInicio from "./TutorialInicio";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";

type Tema = "oscuro" | "claro";

function esTemaValido(valor: any): valor is Tema {
  return valor === "oscuro" || valor === "claro";
}

function aplicarTema(tema: Tema) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.remove("theme-oscuro", "theme-claro");
  document.documentElement.classList.add(`theme-${tema}`);

  document.body.classList.remove("theme-oscuro", "theme-claro");
  document.body.classList.add(`theme-${tema}`);
}

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
  // Cambio de tema
  useLayoutEffect(() => {
    function guardarTemaLocal(tema: Tema) {
      try {
        const saved = localStorage.getItem("preferencias_usuario");
        const prefs = saved ? JSON.parse(saved) : {};

        localStorage.setItem(
          "preferencias_usuario",
          JSON.stringify({ tema })
        );
      } catch {
        localStorage.setItem(
          "preferencias_usuario",
          JSON.stringify({ tema })
        );
      }
    }

    function cargarPreferenciasLocales(): Tema | null {
      try {
        const saved = localStorage.getItem("preferencias_usuario");
        if (!saved) {
          aplicarTema("claro");
          return null;
        }

        const prefs = JSON.parse(saved);

        if (esTemaValido(prefs.tema)) {
          aplicarTema(prefs.tema);
          return prefs.tema;
        }
      } catch {}

      aplicarTema("claro");
      return null;
    }

    async function cargarPreferenciasDesdeSupabase() {
      try {
        const { supabase } = await import("@/utils/supabaseClient");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: pref } = await supabase
          .from("configuraciones_usuario")
          .select("tema")
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (!pref || !esTemaValido(pref.tema)) return;

        guardarTemaLocal(pref.tema);
        aplicarTema(pref.tema);

        window.dispatchEvent(
          new CustomEvent("app:preferencias", {
            detail: {
              tema: pref.tema,
            },
          })
        );
      } catch (err) {
        console.error("Error cargando preferencias desde Supabase:", err);
      }
    }

    function handler(e: any) {
      if (esTemaValido(e.detail?.tema)) {
        guardarTemaLocal(e.detail.tema);
        aplicarTema(e.detail.tema);
      }
    }

    const temaLocal = cargarPreferenciasLocales();

    window.addEventListener("app:preferencias", handler);

    if (!temaLocal) {
      cargarPreferenciasDesdeSupabase();
    }

    return () => window.removeEventListener("app:preferencias", handler);
  }, []);

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

    window.addEventListener("logrosDesbloqueados", mostrarLogros);
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

        <div className="flex flex-col flex-1 min-w-0">
          <main
            className="fixed top-0 left-0 lg:left-56 right-0 bottom-0 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            }}
          >
            <div className="w-full max-w-full min-w-0">
              {children}
            </div>
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