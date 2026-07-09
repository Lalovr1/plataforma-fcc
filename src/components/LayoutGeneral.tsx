"use client";

/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral según rol y deja el área central para contenido.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import MenuLateral from "./MenuLateral";
import TutorialInicio from "./TutorialInicio";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";
import {
  CLASES_TEMA,
  TEMA_PREDETERMINADO,
  normalizarTema,
  type Tema,
} from "@/lib/temas";

const CLASES_TEMA_ANTERIORES = [
  "theme-azul",
  "theme-grafito",
  "theme-lavanda",
  "theme-aurora",
  "theme-bosque",
  "theme-arena",
];

function aplicarTema(tema: Tema) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.remove(
    ...CLASES_TEMA,
    ...CLASES_TEMA_ANTERIORES
  );
  document.documentElement.classList.add(`theme-${tema}`);

  document.body.classList.remove(...CLASES_TEMA, ...CLASES_TEMA_ANTERIORES);
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
  useLayoutEffect(() => {
    function guardarTemaLocal(tema: Tema) {
      try {
        const saved = localStorage.getItem("preferencias_usuario");
        const prefs = saved ? JSON.parse(saved) : {};

        localStorage.setItem(
          "preferencias_usuario",
          JSON.stringify({
            ...prefs,
            tema,
          })
        );
      } catch {
        localStorage.setItem("preferencias_usuario", JSON.stringify({ tema }));
      }
    }

    function cargarPreferenciasLocales(): Tema | null {
      try {
        const saved = localStorage.getItem("preferencias_usuario");

        if (!saved) {
          aplicarTema(TEMA_PREDETERMINADO);
          return null;
        }

        const prefs = JSON.parse(saved);
        const temaNormalizado = normalizarTema(prefs.tema);

        if (temaNormalizado) {
          aplicarTema(temaNormalizado);
          return temaNormalizado;
        }

        guardarTemaLocal(TEMA_PREDETERMINADO);
      } catch {}

      aplicarTema(TEMA_PREDETERMINADO);
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

        const temaSupabase = normalizarTema(pref?.tema);

        if (!temaSupabase) return;

        guardarTemaLocal(temaSupabase);
        aplicarTema(temaSupabase);

        window.dispatchEvent(
          new CustomEvent("app:preferencias", {
            detail: {
              tema: temaSupabase,
            },
          })
        );
      } catch (err) {
        console.error("Error cargando preferencias desde Supabase:", err);
      }
    }

    function handler(e: any) {
      const temaNormalizado = normalizarTema(e.detail?.tema);

      if (temaNormalizado) {
        guardarTemaLocal(temaNormalizado);
        aplicarTema(temaNormalizado);
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
    window.dispatchEvent(
      new CustomEvent("tutorial:estado", { detail: { activo: false } })
    );
  }, []);

  useEffect(() => {
    const syncRol = async () => {
      try {
        const { data: user } = await import("@/utils/supabaseClient").then((m) =>
          m.supabase.auth.getUser()
        );

        if (user?.user?.id) {
          const { data: usuario } = await import("@/utils/supabaseClient").then(
            (m) =>
              m.supabase
                .from("usuarios")
                .select("rol")
                .eq("id", user.user.id)
                .single()
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

    const handleLogout = () => {
      localStorage.removeItem("rol_usuario");
      localStorage.removeItem("tutorial_visto");
      localStorage.removeItem("tutorial_visto_finalizado");
    };

    window.addEventListener("logout", handleLogout);

    return () => window.removeEventListener("logout", handleLogout);
  }, []);

  useEffect(() => {
    const currentUser = localStorage.getItem("user_id");
    const lastUser = localStorage.getItem("ultimo_user_id");

    if (lastUser && lastUser !== currentUser) {
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
    const { obtenerRecompensasAleatorias } = await import(
      "@/lib/obtenerRecompensas"
    );

    const user = localStorage.getItem("user_id") || "";
    const { recompensas } = await obtenerRecompensasAleatorias(user);

    setNivelSubido(e.detail);
    setRecompensasCofre(recompensas);
  }

  useEffect(() => {
    function mostrarLogros(e: any) {
      if (e.detail && Array.isArray(e.detail)) {
        const stamped = e.detail.map((l: any) => ({
          ...l,
          __key: `${l.id}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
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
      <style>{`
        :root {
          --fcc-sidebar-width: 16rem;
        }

        .menu-lateral {
          width: var(--fcc-sidebar-width) !important;
        }

        .app-main-fcc {
          left: 0;
        }

        @media (min-width: 1024px) {
          .app-main-fcc {
            left: var(--fcc-sidebar-width);
          }
        }
      `}</style>

      {typeof window !== "undefined" && rol === "estudiante" && (
        <VerificarTutorial />
      )}

      <div
        className="app-root h-screen overflow-hidden"
        style={{
          background: "var(--gradient-soft)",
          color: "var(--color-text)",
        }}
      >
        <MenuLateral rol={rol} />

        <main
          className="app-main-fcc fixed top-0 right-0 bottom-0 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0"
          style={{
            background: "var(--gradient-soft)",
            color: "var(--color-text)",
          }}
        >
          <div className="w-full max-w-full min-w-0">{children}</div>
        </main>
      </div>

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