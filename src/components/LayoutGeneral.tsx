"use client";

/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral según rol y deja el área central para contenido.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import MenuLateral from "./MenuLateral";
import TutorialInicio from "./TutorialInicio";
import ModalLogroDesbloqueado from "./ModalLogroDesbloqueado";
import AnimacionCofre from "@/components/AnimacionCofre";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";
import { precargarImagenes } from "@/lib/imagenes";
import { prepararRecursosCofreFCC } from "@/lib/recursosCofre";
import toast from "react-hot-toast";
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

const LOGO_POR_TEMA: Record<Tema, string> = {
  claro: "/ui/logos/logo-azul.webp",
  blanco: "/ui/logos/logo-blanco.webp",
  oscuro: "/ui/logos/logo-negro.webp",
  gris: "/ui/logos/logo-gris.webp",
  esmeralda: "/ui/logos/logo-esmeralda.webp",
  morado: "/ui/logos/logo-morado.webp",
  indigo: "/ui/logos/logo-indigo.webp",
  rojo: "/ui/logos/logo-rojo.webp",
  rosa: "/ui/logos/logo-rosa.webp",
};

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

type EstadoTutorial =
  | "verificando"
  | "mostrar"
  | "recuperar-cofre"
  | "completo"
  | "error";

const TUTORIAL_LOGRO_ID = "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610";

function ErrorTutorialFlotante({
  titulo,
  detalle,
  onRetry,
}: {
  titulo: string;
  detalle: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        right: "max(18px, env(safe-area-inset-right))",
        bottom: "max(18px, env(safe-area-inset-bottom))",
        zIndex: 31000,
        width: "min(540px, calc(100vw - 36px))",
      }}
    >
      <EstadoErrorCargaFCC
        compacto
        titulo={titulo}
        detalle={detalle}
        onRetry={onRetry}
      />
    </div>
  );
}

function RecuperarCofreBienvenida({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [estado, setEstado] = useState<"cargando" | "cofre" | "error">(
    "cargando"
  );
  const [recompensas, setRecompensas] = useState<any[]>([]);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let activo = true;

    async function recuperar() {
      setEstado("cargando");

      try {
        const { obtenerRecompensasAleatorias } = await import(
          "@/lib/obtenerRecompensas"
        );
        const resultado = await obtenerRecompensasAleatorias(
          userId,
          "bienvenida"
        );

        if (resultado.error) {
          throw new Error(resultado.error);
        }

        if (resultado.recompensas.length === 0) {
          if (!resultado.agotado && !resultado.bloqueadoHistorico) {
            throw new Error(
              "El cofre quedó registrado sin recompensas para mostrar."
            );
          }

          const { confirmarFinalizacionTutorial } = await import(
            "@/lib/finalizarTutorial"
          );
          const finalizacion = await confirmarFinalizacionTutorial();

          if (!finalizacion.ok) {
            throw new Error(finalizacion.error);
          }

          if (activo) onComplete();
          return;
        }

        const recursosListos = await prepararRecursosCofreFCC(
          resultado.recompensas
        );

        if (!recursosListos) {
          throw new Error(
            "No se pudieron descargar completamente las imágenes del cofre."
          );
        }

        if (!activo) return;

        setRecompensas(resultado.recompensas);
        setEstado("cofre");
      } catch (error) {
        console.error("Error recuperando cofre de bienvenida:", error);
        if (activo) setEstado("error");
      }
    }

    void recuperar();

    return () => {
      activo = false;
    };
  }, [userId, reintento]);

  if (estado === "error") {
    return (
      <ErrorTutorialFlotante
        titulo="Tu bienvenida quedó pendiente"
        detalle="El tutorial ya fue reconocido, pero todavía falta entregar el cofre. No se marcará como terminado hasta completar esa entrega."
        onRetry={() => setReintento((actual) => actual + 1)}
      />
    );
  }

  if (estado === "cargando") {
    return (
      <CargadorFCC
        flotante
        mensaje="Recuperando tu cofre de bienvenida"
        detalle=""
      />
    );
  }

  return (
    <div
      className="fcc-reward-overlay"
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
        userId={userId}
        recompensas={recompensas}
        nivel={1}
        tipo="bienvenida"
        recursosPrecargados
        onFinish={async () => {
          const { confirmarFinalizacionTutorial } = await import(
            "@/lib/finalizarTutorial"
          );
          const finalizacion = await confirmarFinalizacionTutorial();

          if (!finalizacion.ok) {
            toast.error(
              finalizacion.error ||
                "No se pudo confirmar el cierre de tu bienvenida."
            );
            setEstado("error");
            return;
          }

          onComplete();
        }}
      />
    </div>
  );
}

function VerificarTutorial() {
  const [estado, setEstado] = useState<EstadoTutorial>("verificando");
  const [userId, setUserId] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  function completarLocalmente(id?: string | null) {
    const usuario = id || localStorage.getItem("user_id");

    if (usuario) {
      localStorage.setItem(`fcc_tutorial_completo_${usuario}`, "1");
    }

    setEstado("completo");
  }

  useEffect(() => {
    let activo = true;
    let completadoDuranteConsulta = false;

    async function verificar() {
      setEstado("verificando");

      try {
        const { supabase } = await import("@/utils/supabaseClient");
        const {
          data: { user },
          error: errorSesion,
        } = await supabase.auth.getUser();

        if (errorSesion) throw errorSesion;
        if (!user) throw new Error("No se pudo confirmar la sesión activa.");
        if (!activo || completadoDuranteConsulta) return;

        setUserId(user.id);

        const [resultadoPerfil, resultadoLogros] = await Promise.all([
          supabase
            .from("usuarios")
            .select("tutorial_visto")
            .eq("id", user.id)
            .single(),
          supabase
            .from("logros_usuarios")
            .select("logro_id")
            .eq("usuario_id", user.id),
        ]);

        if (resultadoPerfil.error) throw resultadoPerfil.error;
        if (resultadoLogros.error) throw resultadoLogros.error;
        if (!activo || completadoDuranteConsulta) return;

        const tutorialVisto = Boolean(resultadoPerfil.data?.tutorial_visto);
        const tieneLogroTutorial = (resultadoLogros.data ?? []).some(
          (logro) =>
            logro.logro_id === TUTORIAL_LOGRO_ID ||
            logro.logro_id === "tutorial"
        );

        if (tutorialVisto) {
          completarLocalmente(user.id);
          return;
        }

        setEstado(tieneLogroTutorial ? "recuperar-cofre" : "mostrar");
      } catch (error) {
        console.error("Error verificando estado del tutorial:", error);

        if (activo && !completadoDuranteConsulta) {
          setEstado("error");
        }
      }
    }

    void verificar();

    const completar = () => {
      completadoDuranteConsulta = true;
      completarLocalmente(userId);
    };

    window.addEventListener("tutorial:completado", completar);

    return () => {
      activo = false;
      window.removeEventListener("tutorial:completado", completar);
    };
  }, [reintento]);

  if (estado === "error") {
    return (
      <ErrorTutorialFlotante
        titulo="No pudimos confirmar tu recorrido inicial"
        detalle="La interfaz seguirá disponible, pero el tutorial no se omitirá ni se marcará como visto sin consultar su estado real."
        onRetry={() => setReintento((actual) => actual + 1)}
      />
    );
  }

  if (estado === "verificando") {
    return (
      <CargadorFCC
        flotante
        mensaje="Verificando tu bienvenida"
        detalle=""
      />
    );
  }

  if (estado === "mostrar") return <TutorialInicio />;

  if (estado === "recuperar-cofre" && userId) {
    return (
      <RecuperarCofreBienvenida
        userId={userId}
        onComplete={() => completarLocalmente(userId)}
      />
    );
  }

  return null;
}

export default function LayoutGeneral({
  children,
  rol = "estudiante",
}: {
  children: React.ReactNode;
  rol?: string;
}) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    let montado = true;
    let aceptarRespuestaRemota = true;

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

    async function aplicarTemaCuandoEsteListo(tema: Tema) {
      const logoListo = await precargarImagenes([LOGO_POR_TEMA[tema]], 12_000);

      if (!logoListo || !montado) return false;

      guardarTemaLocal(tema);
      aplicarTema(tema);
      document.documentElement.setAttribute("data-fcc-logo-ready", tema);
      return true;
    }

    async function cargarPreferenciasDesdeSupabase() {
      try {
        const { supabase } = await import("@/utils/supabaseClient");

        const {
          data: { user },
          error: errorSesion,
        } = await supabase.auth.getUser();

        if (errorSesion) throw errorSesion;
        if (!user) return false;

        const { data: pref, error: errorPreferencias } = await supabase
          .from("configuraciones_usuario")
          .select("tema")
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (errorPreferencias) throw errorPreferencias;

        const temaSupabase = normalizarTema(pref?.tema);

        if (!temaSupabase || !montado || !aceptarRespuestaRemota) return;

        await aplicarTemaCuandoEsteListo(temaSupabase);
      } catch (err) {
        console.error("Error cargando preferencias desde Supabase:", err);
      }
    }

    function handler(e: any) {
      const temaNormalizado = normalizarTema(e.detail?.tema);

      if (temaNormalizado) {
        const esCambioExplicito = e.detail?.origen !== "supabase";

        if (esCambioExplicito) {
          aceptarRespuestaRemota = false;
        }

        void aplicarTemaCuandoEsteListo(temaNormalizado);
      }
    }

    cargarPreferenciasLocales();

    window.addEventListener("app:preferencias", handler);

    void cargarPreferenciasDesdeSupabase();

    return () => {
      montado = false;
      window.removeEventListener("app:preferencias", handler);
    };
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
  const [preparandoCofreNivel, setPreparandoCofreNivel] = useState(false);

  async function handleNivelSubido(e: any) {
    if ((window as any).__tutorialActivo) {
      const nivelPendiente = e.detail;

      window.addEventListener(
        "tutorial:completado",
        () => {
          void handleNivelSubido({ detail: nivelPendiente });
        },
        { once: true }
      );
      return;
    }

    setPreparandoCofreNivel(true);

    const { obtenerRecompensasAleatorias } = await import(
      "@/lib/obtenerRecompensas"
    );

    const user = localStorage.getItem("user_id") || "";
    const resultado = await obtenerRecompensasAleatorias(user);

    if (resultado.error) {
      setNivelSubido(null);
      setRecompensasCofre([]);
      setPreparandoCofreNivel(false);

      toast.error(
        resultado.error ||
          "No se pudo reclamar el cofre de este nivel."
      );
      return;
    }

    if (resultado.yaReclamado) {
      setNivelSubido(null);
      setRecompensasCofre([]);
      setPreparandoCofreNivel(false);
      return;
    }

    if (resultado.agotado) {
      setNivelSubido(null);
      setRecompensasCofre([]);
      setPreparandoCofreNivel(false);

      toast.success(
        `¡Subiste al nivel ${e.detail}! Ya desbloqueaste todas las recompensas disponibles.`
      );
      return;
    }

    if (resultado.recompensas.length === 0) {
      setNivelSubido(null);
      setRecompensasCofre([]);
      setPreparandoCofreNivel(false);
      return;
    }

    const recursosListos = await prepararRecursosCofreFCC(
      resultado.recompensas
    );

    if (!recursosListos) {
      setPreparandoCofreNivel(false);
      toast.error(
        "No se mostrará el cofre hasta descargar completamente sus imágenes. Intenta de nuevo cuando mejore la conexión."
      );
      return;
    }

    setNivelSubido(e.detail);
    setRecompensasCofre(resultado.recompensas);
    setPreparandoCofreNivel(false);
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

      {rol === "estudiante" && pathname === "/dashboard/estudiante" && (
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

      {logrosDesbloqueados.length > 0 && (
        <ModalLogroDesbloqueado
          key={logrosDesbloqueados[0].__key}
          logro={logrosDesbloqueados[0]}
          onClose={() =>
            setLogrosDesbloqueados((prev) => prev.slice(1))
          }
        />
      )}

      {preparandoCofreNivel && (
        <CargadorFCC
          flotante
          mensaje="Preparando tu recompensa"
          detalle=""
        />
      )}

      {nivelSubido !== null && (
        <div
          className="fcc-reward-overlay"
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
            recursosPrecargados
            onFinish={() => setNivelSubido(null)}
          />
        </div>
      )}
    </>
  );
}
