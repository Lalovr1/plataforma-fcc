"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import {
  Check,
  Circle,
  Cpu,
  Flame,
  Heart,
  Leaf,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  CLASES_TEMA,
  TEMA_PREDETERMINADO,
  TEMAS_DISPONIBLES,
  normalizarTema,
  type Tema,
} from "@/lib/temas";

type Rol = "estudiante" | "profesor";

const CLASES_TEMA_ANTERIORES = [
  "theme-azul",
  "theme-grafito",
  "theme-lavanda",
  "theme-aurora",
  "theme-bosque",
  "theme-arena",
];

const ICONOS_TEMA: Record<Tema, LucideIcon> = {
  claro: Monitor,
  blanco: Sun,
  oscuro: Moon,
  gris: Circle,
  esmeralda: Leaf,
  morado: Sparkles,
  indigo: Cpu,
  rojo: Flame,
  rosa: Heart,
};

function leerTemaDesdeLocalStorage(): Tema | null {
  try {
    const saved = localStorage.getItem("preferencias_usuario");
    if (!saved) return null;

    const prefs = JSON.parse(saved);
    return normalizarTema(prefs.tema);
  } catch {}

  return null;
}

function leerTemaActual(): Tema {
  const temaLocal = leerTemaDesdeLocalStorage();
  if (temaLocal) return temaLocal;

  try {
    for (const tema of TEMAS_DISPONIBLES) {
      if (
        document.documentElement.classList.contains(`theme-${tema.id}`) ||
        document.body.classList.contains(`theme-${tema.id}`)
      ) {
        return tema.id;
      }
    }
  } catch {}

  return TEMA_PREDETERMINADO;
}

function aplicarClaseTema(nuevoTema: Tema) {
  try {
    document.documentElement.classList.remove(
      ...CLASES_TEMA,
      ...CLASES_TEMA_ANTERIORES
    );
    document.body.classList.remove(...CLASES_TEMA, ...CLASES_TEMA_ANTERIORES);

    document.documentElement.classList.add(`theme-${nuevoTema}`);
    document.body.classList.add(`theme-${nuevoTema}`);
  } catch {}
}

function aplicarTemaEnApp(nuevoTema: Tema) {
  aplicarClaseTema(nuevoTema);

  try {
    const saved = localStorage.getItem("preferencias_usuario");
    const prefs = saved ? JSON.parse(saved) : {};

    localStorage.setItem(
      "preferencias_usuario",
      JSON.stringify({
        ...prefs,
        tema: nuevoTema,
      })
    );
  } catch {
    localStorage.setItem(
      "preferencias_usuario",
      JSON.stringify({ tema: nuevoTema })
    );
  }

  window.dispatchEvent(
    new CustomEvent("app:preferencias", {
      detail: { tema: nuevoTema },
    })
  );
}

function obtenerPreviewSidebarBg(tema: Tema) {
  if (tema === "blanco") {
    return "linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)";
  }

  if (tema === "gris") {
    return "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)";
  }

  if (tema === "oscuro") {
    return "linear-gradient(180deg, #0a0a0a 0%, #050505 52%, #000000 100%)";
  }

  if (tema === "claro") {
    return "linear-gradient(180deg, #061d39 0%, #06172f 48%, #041021 100%)";
  }

  if (tema === "esmeralda") {
    return "linear-gradient(180deg, #073a35 0%, #062d29 48%, #031815 100%)";
  }

  if (tema === "morado") {
    return "linear-gradient(180deg, #2e1065 0%, #251044 48%, #16072d 100%)";
  }

  if (tema === "indigo") {
    return "linear-gradient(180deg, #1e1b4b 0%, #111947 48%, #0b102f 100%)";
  }

  if (tema === "rojo") {
    return "linear-gradient(180deg, #4a1010 0%, #300b0b 48%, #180606 100%)";
  }

  return "linear-gradient(180deg, #451234 0%, #301026 48%, #190915 100%)";
}

function obtenerPreviewSidebarLine(tema: Tema) {
  if (tema === "blanco" || tema === "gris") {
    return "rgba(15, 23, 42, 0.34)";
  }

  return "rgba(255, 255, 255, 0.58)";
}

export default function PaginaConfiguracion() {
  const [rol, setRol] = useState<Rol>(() => {
    if (typeof window === "undefined") return "estudiante";

    const rolLocal = localStorage.getItem("rol_usuario");
    return rolLocal === "profesor" ? "profesor" : "estudiante";
  });

  const [tema, setTema] = useState<Tema | null>(null);

  const temaActualRef = useRef<Tema | null>(null);
  const temaGuardadoRef = useRef<Tema | null>(null);
  const userIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const temaInicial = leerTemaActual();

    setTema(temaInicial);
    temaActualRef.current = temaInicial;
    aplicarClaseTema(temaInicial);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const temaLocal = leerTemaDesdeLocalStorage();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setRol("estudiante");
          return;
        }

        userIdRef.current = user.id;

        const { data: u } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", user.id)
          .single();

        const rolDetectado: Rol =
          u?.rol === "profesor" ? "profesor" : "estudiante";

        setRol(rolDetectado);
        localStorage.setItem("rol_usuario", rolDetectado);

        const { data: pref } = await supabase
          .from("configuraciones_usuario")
          .select("tema")
          .eq("usuario_id", user.id)
          .maybeSingle();

        const temaSupabase = normalizarTema(pref?.tema);

        if (temaSupabase) {
          temaGuardadoRef.current = temaSupabase;

          if (!temaLocal) {
            setTema(temaSupabase);
            temaActualRef.current = temaSupabase;
            aplicarTemaEnApp(temaSupabase);
          }
        } else {
          temaGuardadoRef.current = temaActualRef.current ?? leerTemaActual();
        }
      } catch (e) {
        console.error(e);
      }
    }

    init();

    return () => {
      const temaFinal = temaActualRef.current;
      const temaGuardado = temaGuardadoRef.current;

      if (!temaFinal || temaFinal === temaGuardado) return;

      void guardarTemaEnSupabase(temaFinal);
    };
  }, []);

  async function guardarTemaEnSupabase(temaParaGuardar: Tema) {
    try {
      let userId = userIdRef.current;

      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        userId = user?.id ?? null;
      }

      if (!userId) return;

      const { error } = await supabase.from("configuraciones_usuario").upsert(
        {
          usuario_id: userId,
          tema: temaParaGuardar,
        },
        { onConflict: "usuario_id" }
      );

      if (error) throw error;

      temaGuardadoRef.current = temaParaGuardar;
    } catch (e) {
      console.error("No se pudo guardar el tema:", e);
    }
  }

  function aplicarTemaSeleccionado(nuevoTema: Tema) {
    setTema(nuevoTema);
    temaActualRef.current = nuevoTema;
    aplicarTemaEnApp(nuevoTema);
  }

  function renderTemaCard(temaItem: (typeof TEMAS_DISPONIBLES)[number]) {
    const activo = tema === temaItem.id;
    const Icono = ICONOS_TEMA[temaItem.id] ?? Monitor;

    return (
      <button
        key={temaItem.id}
        type="button"
        onClick={() => aplicarTemaSeleccionado(temaItem.id)}
        className={`fcc-config-theme-card ${activo ? "is-active" : ""}`}
        style={
          {
            "--theme-preview-bg": temaItem.previewBg,
            "--theme-preview-accent": temaItem.previewAccent,
            "--theme-preview-soft": temaItem.previewSoft,
            "--theme-preview-text": temaItem.previewText,
            "--theme-preview-sidebar-bg": obtenerPreviewSidebarBg(temaItem.id),
            "--theme-preview-sidebar-line": obtenerPreviewSidebarLine(
              temaItem.id
            ),
          } as CSSProperties
        }
      >
        <div className="fcc-config-theme-preview">
          <div className="fcc-config-theme-sidebar">
            <span />
            <span />
            <span />
          </div>

          <div className="fcc-config-theme-screen">
            <div className="fcc-config-theme-hero">
              <div className="fcc-config-theme-avatar" />
              <div>
                <span />
                <span />
              </div>
            </div>

            <div className="fcc-config-theme-row">
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="fcc-config-theme-info">
          <div className="fcc-config-theme-icon">
            <Icono size={19} strokeWidth={2.2} />
          </div>

          <div className="min-w-0">
            <div className="fcc-config-theme-title-row">
              <h3>{temaItem.nombre}</h3>

              {activo && (
                <span className="fcc-config-theme-check">
                  <Check size={13} strokeWidth={2.6} />
                </span>
              )}
            </div>

            <p>{temaItem.descripcion}</p>
          </div>
        </div>
      </button>
    );
  }

  const temaBase = TEMAS_DISPONIBLES.filter((item) => item.tipo === "base");
  const variantes = TEMAS_DISPONIBLES.filter(
    (item) => item.tipo === "variante"
  );

  return (
    <LayoutGeneral rol={rol}>
      <style>{`
        .fcc-config-page {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .fcc-config-hero,
        .fcc-config-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent), transparent 24%),
            linear-gradient(135deg, var(--fcc-premium-surface), var(--fcc-premium-surface-soft));
          border: 1px solid var(--fcc-premium-border);
          box-shadow: var(--fcc-premium-shadow-soft);
          color: var(--fcc-premium-text);
        }

        .fcc-config-hero {
          padding: 16px 22px;
          border-radius: 22px;
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .fcc-config-hero::before,
        .fcc-config-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid) 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: radial-gradient(circle at 84% 18%, black, transparent 64%);
          opacity: 0.34;
        }

        .fcc-config-hero-content,
        .fcc-config-panel-content {
          position: relative;
          z-index: 2;
        }

        .fcc-config-hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .fcc-config-eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--fcc-premium-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .fcc-config-eyebrow::before,
        .fcc-config-eyebrow::after {
          content: "";
          width: 26px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--fcc-premium-accent),
            var(--fcc-premium-cyan)
          );
        }

        .fcc-config-description {
          max-width: 720px;
          margin: 0 auto;
          color: var(--fcc-premium-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .fcc-config-panel {
          padding: 22px;
        }

        .fcc-config-section-title {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 22px;
          text-align: center;
        }

        .fcc-config-section-title::before,
        .fcc-config-section-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--fcc-premium-accent) 55%, transparent));
        }

        .fcc-config-section-title::after {
          background: linear-gradient(90deg, color-mix(in srgb, var(--fcc-premium-accent) 55%, transparent), transparent);
        }

        .fcc-config-section-title h2 {
          color: var(--fcc-premium-text);
          font-size: clamp(1.2rem, 1.9vw, 1.5rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .fcc-config-theme-group {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 14px;
        }

        .fcc-config-theme-group + .fcc-config-theme-group {
          margin-top: 20px;
        }

        .fcc-config-group-label {
          color: var(--fcc-premium-muted);
          font-size: 0.82rem;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .fcc-config-theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }

        .fcc-config-theme-card {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 12px;
          text-align: left;
          background:
            linear-gradient(135deg, var(--fcc-premium-surface), var(--fcc-premium-surface-soft));
          border: 1px solid var(--fcc-premium-border);
          box-shadow: var(--fcc-premium-shadow-soft);
          color: var(--fcc-premium-text);
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .fcc-config-theme-card:hover {
          transform: translateY(-2px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .fcc-config-theme-card.is-active {
          border-color: var(--fcc-premium-accent);
          box-shadow:
            var(--fcc-premium-shadow),
            0 0 0 3px color-mix(in srgb, var(--fcc-premium-accent) 14%, transparent);
        }

        .fcc-config-theme-preview {
          height: 126px;
          border-radius: 17px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 44px 1fr;
          background: var(--theme-preview-bg);
          border: 1px solid color-mix(in srgb, var(--theme-preview-accent) 22%, transparent);
        }

        .fcc-config-theme-sidebar {
          padding: 10px 8px;
          display: grid;
          align-content: start;
          gap: 8px;
          background: var(--theme-preview-sidebar-bg);
        }

        .fcc-config-theme-sidebar span {
          height: 7px;
          border-radius: 999px;
          background: var(--theme-preview-sidebar-line);
        }

        .fcc-config-theme-sidebar span:first-child {
          height: 20px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--theme-preview-accent) 70%, white);
        }

        .fcc-config-theme-screen {
          padding: 10px;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .fcc-config-theme-hero {
          min-height: 58px;
          border-radius: 14px;
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 9px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(255,255,255,0.62);
          box-shadow: 0 10px 22px rgba(15, 39, 70, 0.08);
        }

        .theme-oscuro .fcc-config-theme-hero {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }

        .fcc-config-theme-avatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background:
            radial-gradient(circle, color-mix(in srgb, var(--theme-preview-accent) 24%, transparent), transparent 62%),
            conic-gradient(from 210deg, transparent, var(--theme-preview-accent), transparent, color-mix(in srgb, var(--theme-preview-accent) 55%, white), transparent);
        }

        .fcc-config-theme-hero div:last-child {
          flex: 1;
          display: grid;
          gap: 6px;
        }

        .fcc-config-theme-hero div:last-child span {
          height: 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--theme-preview-text) 24%, transparent);
        }

        .fcc-config-theme-hero div:last-child span:last-child {
          width: 56%;
          background: color-mix(in srgb, var(--theme-preview-accent) 38%, transparent);
        }

        .fcc-config-theme-row {
          display: grid;
          grid-template-columns: 1fr 0.8fr;
          gap: 8px;
        }

        .fcc-config-theme-row span {
          height: 36px;
          border-radius: 12px;
          background: rgba(255,255,255,0.68);
          border: 1px solid rgba(255,255,255,0.58);
        }

        .theme-oscuro .fcc-config-theme-row span {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }

        .fcc-config-theme-info {
          margin-top: 12px;
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }

        .fcc-config-theme-icon {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
        }

        .fcc-config-theme-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .fcc-config-theme-title-row h3 {
          color: var(--fcc-premium-text);
          font-size: 0.95rem;
          font-weight: 950;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .fcc-config-theme-check {
          flex: 0 0 auto;
          width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--fcc-premium-accent);
          color: white;
        }

        .theme-oscuro .fcc-config-theme-check {
          color: #050505;
        }

        .fcc-config-theme-info p {
          margin-top: 4px;
          color: var(--fcc-premium-muted);
          font-size: 0.78rem;
          font-weight: 650;
          line-height: 1.35;
        }

        @media (max-width: 640px) {
          .fcc-config-page {
            gap: 16px;
          }

          .fcc-config-hero,
          .fcc-config-panel {
            border-radius: 24px;
          }

          .fcc-config-hero {
            padding: 14px 16px;
          }

          .fcc-config-panel {
            padding: 18px;
          }
        }
      `}</style>

      <div className="fcc-config-page">
        <section className="fcc-config-hero">
          <div className="fcc-config-hero-content">
            <p className="fcc-config-eyebrow">Ajustes de plataforma</p>

            <p className="fcc-config-description">
              Personaliza la apariencia y preferencias de FCC Academy.
            </p>
          </div>
        </section>

        <section className="fcc-config-panel">
          <div className="fcc-config-panel-content">
            <div className="fcc-config-section-title">
              <h2>Color del tema</h2>
            </div>

            <div className="fcc-config-theme-group">
              <p className="fcc-config-group-label">Tema principal</p>
              <div className="fcc-config-theme-grid">
                {temaBase.map(renderTemaCard)}
              </div>
            </div>

            <div className="fcc-config-theme-group">
              <p className="fcc-config-group-label">Variantes disponibles</p>
              <div className="fcc-config-theme-grid">
                {variantes.map(renderTemaCard)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </LayoutGeneral>
  );
}