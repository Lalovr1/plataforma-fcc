"use client";

/**
 * Tarjeta de usuario que muestra el avatar, nombre, nivel,
 * acceso al perfil y accesos rápidos académicos.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import HorarioVistaRapida from "@/components/HorarioVistaRapida";
import CalendarioEscolar2026 from "@/components/CalendarioEscolar2026";
import MapaCurricularICC from "@/components/MapaCurricularICC";
import { CalendarDays, ChevronRight, Clock3, Download, Map as MapIcon, Settings, X } from "lucide-react";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";

interface TarjetaUsuarioProps {
  name?: string;
  level?: number;
  avatarConfig?: AvatarConfig | null;
  rol?: "estudiante" | "profesor";
  initialHorarioDatos?: unknown | null;
}

type AccionRapida = "horario" | "calendario" | "mapa";
const HORARIO_PERSONALIZACION_URL =
  "/dashboard/estudiante/herramientas/horario?volver=modal-horario";
const HORARIO_MODAL_QUERY = "modal";
const HORARIO_MODAL_VALUE = "horario";
const MAPA_MODAL_VALUE = "mapa";
const MAPA_PERSONALIZACION_URL =
  "/dashboard/estudiante/herramientas/mapa-curricular?volver=modal-mapa";

export default function TarjetaUsuario({
  name = "Usuario",
  level = 0,
  avatarConfig,
  rol = "estudiante",
  initialHorarioDatos = null,
}: TarjetaUsuarioProps) {
  const defaultConfig: AvatarConfig = {
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
  };

  const [avatar, setAvatar] = useState<AvatarConfig>(
    avatarConfig ?? defaultConfig,
  );

  const [accionAbierta, setAccionAbierta] = useState<AccionRapida | null>(null);
  const [salidaHerramienta, setSalidaHerramienta] =
    useState<AccionRapida | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function cerrarModalRapido() {
    if (salidaHerramienta) return;

    setSalidaHerramienta(null);
    setAccionAbierta(null);

    const modalQuery = searchParams.get(HORARIO_MODAL_QUERY);

    if (
      modalQuery === HORARIO_MODAL_VALUE ||
      modalQuery === MAPA_MODAL_VALUE
    ) {
      router.replace(pathname, { scroll: false });
    }
  }

  function prepararSalidaPersonalizarHorario() {
    setSalidaHerramienta("horario");

    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        "/dashboard/estudiante?modal=horario",
      );
    }
  }

  function prepararSalidaPersonalizarMapa() {
    setSalidaHerramienta("mapa");

    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        "/dashboard/estudiante?modal=mapa",
      );
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    router.prefetch(HORARIO_PERSONALIZACION_URL);
    router.prefetch(MAPA_PERSONALIZACION_URL);
  }, [router]);

  useEffect(() => {
    const modalQuery = searchParams.get(HORARIO_MODAL_QUERY);

    if (modalQuery === HORARIO_MODAL_VALUE) {
      setSalidaHerramienta(null);
      setAccionAbierta("horario");
      return;
    }

    if (modalQuery === MAPA_MODAL_VALUE) {
      setSalidaHerramienta(null);
      setAccionAbierta("mapa");
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => {
      const savedConfig = localStorage.getItem("avatar_config");
      if (savedConfig) {
        setAvatar(JSON.parse(savedConfig));
      }
    };

    window.addEventListener("avatarActualizado", handler);
    return () => window.removeEventListener("avatarActualizado", handler);
  }, []);

  useEffect(() => {
    if (avatarConfig) setAvatar(avatarConfig);
  }, [avatarConfig]);

  useEffect(() => {
    if (!accionAbierta) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [accionAbierta]);

  const perfilUrl =
    rol === "profesor"
      ? "/dashboard/profesor/perfil"
      : "/dashboard/estudiante/perfil";

  const [tutorialActivo, setTutorialActivo] = useState<boolean>(() =>
    typeof window !== "undefined" ? !!(window as any).__tutorialActivo : false,
  );

  useEffect(() => {
    const handler = (e: any) => setTutorialActivo(!!e.detail?.activo);
    window.addEventListener("tutorial:estado", handler);

    setTutorialActivo(
      typeof window !== "undefined"
        ? !!(window as any).__tutorialActivo
        : false,
    );

    return () => window.removeEventListener("tutorial:estado", handler);
  }, []);

  const contenidoModal = {
    horario: {
      titulo: "Mi horario",
      descripcion: "",
      icono: Clock3,
    },
    calendario: {
      titulo: "Calendario escolar",
      descripcion: "",
      icono: CalendarDays,
    },
    mapa: {
      titulo: "Mapa curricular",
      descripcion: "",
      icono: MapIcon,
    },
  } satisfies Record<
    AccionRapida,
    {
      titulo: string;
      descripcion: string;
      icono: typeof Clock3;
    }
  >;

  const modalActual = accionAbierta ? contenidoModal[accionAbierta] : null;
  const IconoModal = modalActual?.icono;

  const modalRapido =
    modalActual && IconoModal ? (
      <div
        className="fcc-quick-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={modalActual.titulo}
      >
        <button
          type="button"
          className="fcc-quick-modal-backdrop"
          onClick={cerrarModalRapido}
          aria-label="Cerrar"
          disabled={!!salidaHerramienta}
        />

        <div
          className={`fcc-quick-modal ${
            accionAbierta === "horario"
              ? "is-schedule"
              : accionAbierta === "mapa"
              ? "is-curriculum"
              : accionAbierta === "calendario"
              ? "is-calendar"
              : ""
          }`}
        >
          <div className="fcc-quick-modal-content">
            <div className="fcc-quick-modal-header">
              <div className="fcc-quick-modal-title-wrap">
                <span className="fcc-quick-modal-icon">
                  <IconoModal size={22} strokeWidth={2.3} />
                </span>

                <div>
                  <h3>{modalActual.titulo}</h3>
                  {modalActual.descripcion && <p>{modalActual.descripcion}</p>}
                </div>
              </div>

              {accionAbierta ? (
                <div className="fcc-schedule-modal-actions">
                  <button
                    type="button"
                    className="fcc-schedule-header-button"
                    disabled={!!salidaHerramienta}
                    onClick={() =>
                      window.dispatchEvent(
                        new Event(
                          accionAbierta === "horario"
                            ? "solicitarDescargaHorario"
                            : accionAbierta === "mapa"
                            ? "solicitarDescargaMapaCurricular"
                            : "solicitarDescargaCalendarioEscolar"
                        )
                      )
                    }
                    aria-label={
                      accionAbierta === "horario"
                        ? "Descargar horario"
                        : accionAbierta === "mapa"
                        ? "Descargar mapa curricular"
                        : "Descargar calendario escolar"
                    }
                    title={
                      accionAbierta === "horario"
                        ? "Descargar horario"
                        : accionAbierta === "mapa"
                        ? "Descargar mapa curricular"
                        : "Descargar calendario escolar"
                    }
                  >
                    <Download size={18} strokeWidth={2.35} />
                  </button>

                  {accionAbierta === "calendario" ? (
                    <button
                      type="button"
                      className="fcc-schedule-customize"
                      disabled={!!salidaHerramienta}
                      onClick={() =>
                        window.dispatchEvent(
                          new Event("abrirAjustesCalendarioEscolar")
                        )
                      }
                      aria-label="Ajustes del calendario"
                      title="Ajustes del calendario"
                    >
                      <Settings size={18} strokeWidth={2.35} />
                    </button>
                  ) : (
                    <Link
                      href={
                        accionAbierta === "horario"
                          ? HORARIO_PERSONALIZACION_URL
                          : MAPA_PERSONALIZACION_URL
                      }
                      className="fcc-schedule-customize"
                      aria-disabled={!!salidaHerramienta}
                      onClick={
                        accionAbierta === "horario"
                          ? prepararSalidaPersonalizarHorario
                          : prepararSalidaPersonalizarMapa
                      }
                      aria-label={
                        accionAbierta === "horario"
                          ? "Personalizar horario"
                          : "Personalizar mapa curricular"
                      }
                      title={
                        accionAbierta === "horario"
                          ? "Personalizar horario"
                          : "Personalizar mapa curricular"
                      }
                    >
                      <Settings size={18} strokeWidth={2.35} />
                    </Link>
                  )}

                  <button
                    type="button"
                    className="fcc-quick-modal-close"
                    disabled={!!salidaHerramienta}
                    onClick={cerrarModalRapido}
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="fcc-quick-modal-close"
                  disabled={!!salidaHerramienta}
                  onClick={cerrarModalRapido}
                  aria-label="Cerrar"
                >
                  <X size={20} strokeWidth={2.4} />
                </button>
              )}
            </div>

            {accionAbierta === "horario" ? (
              <HorarioVistaRapida initialHorarioDatos={initialHorarioDatos} />
            ) : accionAbierta === "mapa" ? (
              <MapaCurricularICC modo="vista" />
            ) : accionAbierta === "calendario" ? (
              <CalendarioEscolar2026 />
            ) : (
              <div className="fcc-quick-modal-placeholder">
                <span>Vista rápida preparada</span>
              </div>
            )}

            {salidaHerramienta && (
              <div className="fcc-quick-modal-loading" role="status">
                <span className="fcc-quick-modal-spinner" />
                <strong>
                  {salidaHerramienta === "horario"
                    ? "Abriendo ajustes del horario..."
                    : "Abriendo ajustes del mapa..."}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <style>{`
        .fcc-user-card {
          --fcc-user-card-bg:
            radial-gradient(
              circle at 21% 48%,
              color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent),
              transparent 25%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft) 48%,
              var(--fcc-premium-surface)
            );

          --fcc-user-card-before:
            radial-gradient(
              circle at 18% 48%,
              color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent),
              transparent 30%
            ),
            radial-gradient(
              circle at 92% 82%,
              color-mix(in srgb, var(--fcc-premium-cyan) 7%, transparent),
              transparent 26%
            );

          --fcc-user-card-border: var(--fcc-premium-border);
          --fcc-user-card-shadow: var(--fcc-premium-shadow);
          --fcc-user-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.82);

          --fcc-user-text: var(--fcc-premium-text);
          --fcc-user-muted: var(--fcc-premium-muted);
          --fcc-user-soft-text: var(--fcc-premium-text-soft);
          --fcc-user-accent: var(--fcc-premium-accent);
          --fcc-user-accent-hover: var(--fcc-premium-accent-hover);
          --fcc-user-cyan: var(--fcc-premium-cyan);

          --fcc-user-avatar-core: color-mix(in srgb, var(--fcc-premium-cyan) 18%, transparent);
          --fcc-user-avatar-a: color-mix(in srgb, var(--fcc-premium-accent) 34%, transparent);
          --fcc-user-avatar-b: color-mix(in srgb, var(--fcc-premium-cyan) 28%, transparent);
          --fcc-user-avatar-c: color-mix(in srgb, var(--fcc-premium-accent) 26%, transparent);
          --fcc-user-avatar-border: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);
          --fcc-user-avatar-shadow-a: color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-user-avatar-shadow-b: color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          --fcc-user-orbit-a: color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent);
          --fcc-user-orbit-b: color-mix(in srgb, var(--fcc-premium-cyan) 22%, transparent);

          --fcc-user-level-bg: color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent);
          --fcc-user-level-border: color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent);

          --fcc-user-button-bg: var(--fcc-premium-button);
          --fcc-user-button-text: #ffffff;
          --fcc-user-button-shadow: color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);
          --fcc-user-button-shadow-hover: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);

          --fcc-user-quick-color: var(--fcc-premium-accent);
          --fcc-user-quick-color-hover: var(--fcc-premium-accent-hover);
          --fcc-user-quick-bg:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--fcc-premium-surface) 92%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 84%, transparent)
            );
          --fcc-user-quick-bg-hover:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--fcc-premium-surface) 98%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 92%, transparent)
            );
          --fcc-user-quick-border: color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent);
          --fcc-user-quick-border-hover: color-mix(in srgb, var(--fcc-premium-accent) 34%, transparent);
          --fcc-user-quick-shadow: color-mix(in srgb, var(--fcc-premium-accent) 7%, transparent);
          --fcc-user-quick-shadow-hover: color-mix(in srgb, var(--fcc-premium-accent) 11%, transparent);

          --fcc-user-node-a: var(--fcc-premium-cyan);
          --fcc-user-node-b: var(--fcc-premium-accent);

          --fcc-user-modal-bg:
            radial-gradient(
              circle at 12% 10%,
              color-mix(in srgb, var(--fcc-premium-cyan) 12%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          --fcc-user-modal-border: var(--fcc-premium-border-strong);
          --fcc-user-modal-grid-a: var(--fcc-premium-grid);
          --fcc-user-modal-grid-b: color-mix(in srgb, var(--fcc-premium-grid) 72%, transparent);
          --fcc-user-modal-placeholder-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface) 76%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 80%, transparent)
            );
          --fcc-user-modal-placeholder-border: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);

          position: relative;
          container-type: inline-size;
          min-height: clamp(210px, 25vw, 270px);
          overflow: hidden;
          border-radius: 28px;
          background: var(--fcc-user-card-bg);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow:
            var(--fcc-user-card-shadow),
            var(--fcc-user-card-inset);
          color: var(--fcc-user-text);
        }

        .theme-oscuro .fcc-user-card {
          --fcc-user-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          --fcc-user-button-text: #050505;
        }

        .fcc-user-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: var(--fcc-user-card-before);
          opacity: 0.95;
        }

        .fcc-user-card::after {
          content: none;
        }

        .fcc-user-card-content {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: clamp(18px, 4vw, 54px);
          min-height: inherit;
          padding: clamp(18px, 3.5vw, 42px);
        }

        .fcc-user-avatar-stage {
          --fcc-user-avatar-circle-size: 82%;
          --fcc-user-avatar-ring-size: 70%;
          --fcc-user-avatar-orbit-size: 66%;
          --fcc-user-avatar-render-scale: 1;

          position: relative;
          flex: 0 0 auto;
          width: clamp(168px, 25vw, 300px);
          height: clamp(168px, 25vw, 300px);
          display: grid;
          place-items: end center;
          isolation: isolate;
        }

        .fcc-user-avatar-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--fcc-user-avatar-circle-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(circle, var(--fcc-user-avatar-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--fcc-user-avatar-a) 42deg,
              transparent 84deg,
              var(--fcc-user-avatar-b) 145deg,
              transparent 210deg,
              var(--fcc-user-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .fcc-user-avatar-stage::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--fcc-user-avatar-ring-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          border: 1px solid var(--fcc-user-avatar-border);
          box-shadow:
            0 0 0 14px var(--fcc-user-avatar-shadow-a),
            0 0 42px var(--fcc-user-avatar-shadow-b);
          z-index: -2;
        }

        .fcc-avatar-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--fcc-user-avatar-orbit-size);
          aspect-ratio: 1 / 1;
          z-index: -1;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(-18deg);
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--fcc-user-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--fcc-user-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          opacity: 0.95;
        }

        .fcc-avatar-render {
          position: absolute;
          left: 50%;
          bottom: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          transform: translateX(-50%) scale(var(--fcc-user-avatar-render-scale)) !important;
          transform-origin: center bottom;
        }

        .fcc-user-copy {
          position: relative;
          flex: 1;
          min-width: 0;
        }

        .fcc-user-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--fcc-user-accent);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .fcc-user-eyebrow::before {
          content: "";
          width: 26px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--fcc-user-accent),
            var(--fcc-user-cyan)
          );
        }

        .fcc-user-title {
          max-width: 780px;
          color: var(--fcc-user-text);
          font-weight: 900;
          letter-spacing: -0.055em;
          line-height: 0.98;
          font-size: clamp(1.95rem, 4.6vw, 4.45rem);
          text-wrap: balance;
        }

        .fcc-user-level {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          width: fit-content;
          border-radius: 999px;
          padding: 7px 12px;
          color: var(--fcc-user-accent);
          background: var(--fcc-user-level-bg);
          border: 1px solid var(--fcc-user-level-border);
          font-size: 15px;
          font-weight: 800;
        }

        .fcc-user-actions {
          margin-top: 22px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .fcc-profile-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          border-radius: 14px;
          padding: 0 20px;
          color: var(--fcc-user-button-text);
          font-weight: 850;
          background: var(--fcc-user-button-bg);
          box-shadow:
            0 16px 26px var(--fcc-user-button-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            filter 180ms ease;
        }

        .fcc-profile-button:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow:
            0 18px 32px var(--fcc-user-button-shadow-hover),
            inset 0 1px 0 rgba(255, 255, 255, 0.26);
        }

        .fcc-profile-button svg {
          transition: transform 180ms ease;
        }

        .fcc-profile-button:hover svg {
          transform: translateX(2px);
        }

        .fcc-quick-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border-radius: 14px;
          padding: 0 14px;
          color: var(--fcc-user-quick-color);
          background: var(--fcc-user-quick-bg);
          border: 1px solid var(--fcc-user-quick-border);
          box-shadow:
            0 12px 22px var(--fcc-user-quick-shadow),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
          font-size: 0.92rem;
          font-weight: 850;
          transition:
            transform 180ms ease,
            color 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }

        .fcc-quick-action:hover {
          transform: translateY(-1px);
          color: var(--fcc-user-quick-color-hover);
          border-color: var(--fcc-user-quick-border-hover);
          background: var(--fcc-user-quick-bg-hover);
          box-shadow:
            0 14px 26px var(--fcc-user-quick-shadow-hover),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 84%, transparent);
        }

        .fcc-user-tech-node {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          background: var(--fcc-user-node-a);
          opacity: 0.8;
        }

        .fcc-user-tech-node.node-1 {
          right: 13%;
          top: 18%;
          width: 7px;
          height: 7px;
        }

        .fcc-user-tech-node.node-2 {
          right: 22%;
          bottom: 22%;
          width: 5px;
          height: 5px;
          background: var(--fcc-user-node-b);
        }

        .fcc-user-tech-node.node-3 {
          left: 34%;
          bottom: 14%;
          width: 4px;
          height: 4px;
        }

        .fcc-quick-modal-overlay {
          --fcc-user-card-border: var(--fcc-premium-border);
          --fcc-user-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.82);

          --fcc-user-text: var(--fcc-premium-text);
          --fcc-user-muted: var(--fcc-premium-muted);
          --fcc-user-soft-text: var(--fcc-premium-text-soft);
          --fcc-user-accent: var(--fcc-premium-accent);
          --fcc-user-accent-hover: var(--fcc-premium-accent-hover);
          --fcc-user-cyan: var(--fcc-premium-cyan);

          --fcc-user-level-bg: color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent);
          --fcc-user-level-border: color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent);

          --fcc-user-modal-bg:
            radial-gradient(
              circle at 12% 10%,
              color-mix(in srgb, var(--fcc-premium-cyan) 12%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          --fcc-user-modal-border: var(--fcc-premium-border-strong);
          --fcc-user-modal-grid-a: var(--fcc-premium-grid);
          --fcc-user-modal-grid-b: color-mix(in srgb, var(--fcc-premium-grid) 72%, transparent);
          --fcc-user-modal-placeholder-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface) 76%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 80%, transparent)
            );
          --fcc-user-modal-placeholder-border: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);

          position: fixed;
          inset: 0;
          z-index: 24000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .fcc-quick-modal-backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(15, 23, 42, 0.38);
          backdrop-filter: blur(8px);
        }

        .theme-oscuro .fcc-quick-modal-overlay {
          --fcc-user-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .theme-oscuro .fcc-quick-modal-backdrop {
          background: rgba(0, 0, 0, 0.62);
        }

        .fcc-quick-modal {
          position: relative;
          z-index: 1;
          width: min(760px, 100%);
          overflow: hidden;
          border-radius: 28px;
          padding: 24px;
          background: var(--fcc-user-modal-bg);
          border: 1px solid var(--fcc-user-modal-border);
          box-shadow:
            0 28px 80px rgba(15, 23, 42, 0.22),
            var(--fcc-user-card-inset);
          color: var(--fcc-user-text);
        }

        .theme-oscuro .fcc-quick-modal {
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.52),
            var(--fcc-user-card-inset);
        }

        .fcc-quick-modal.is-schedule,
        .fcc-quick-modal.is-curriculum,
        .fcc-quick-modal.is-calendar {
          width: min(1160px, 100%);
          max-height: calc(100dvh - 36px);
          padding: 18px;
          display: flex;
          flex-direction: column;
        }

        .fcc-quick-modal.is-curriculum {
          width: min(1280px, 100%);
        }

        .fcc-quick-modal.is-calendar {
          width: min(1180px, 100%);
        }

        .fcc-quick-modal::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-user-modal-grid-a) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-user-modal-grid-b) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at 86% 18%, black, transparent 62%);
          opacity: 0.7;
        }

        .fcc-quick-modal-content {
          position: relative;
          z-index: 2;
          min-height: 0;
        }

        .fcc-quick-modal.is-schedule .fcc-quick-modal-content,
        .fcc-quick-modal.is-curriculum .fcc-quick-modal-content,
        .fcc-quick-modal.is-calendar .fcc-quick-modal-content {
          display: flex;
          flex: 1;
          flex-direction: column;
        }

        .fcc-quick-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .fcc-quick-modal.is-schedule .fcc-quick-modal-header,
        .fcc-quick-modal.is-curriculum .fcc-quick-modal-header,
        .fcc-quick-modal.is-calendar .fcc-quick-modal-header {
          align-items: center;
          margin-bottom: 14px;
        }

        .fcc-quick-modal-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .fcc-quick-modal-icon {
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          color: var(--fcc-user-accent);
          background: var(--fcc-user-level-bg);
          border: 1px solid var(--fcc-user-level-border);
        }

        .fcc-quick-modal h3 {
          color: var(--fcc-user-text);
          font-size: clamp(1.35rem, 2.4vw, 2rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .fcc-quick-modal p {
          margin-top: 8px;
          max-width: 560px;
          color: var(--fcc-user-muted);
          font-size: 0.98rem;
          font-weight: 650;
          line-height: 1.5;
        }

        .fcc-schedule-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex: 0 0 auto;
        }

        .fcc-schedule-header-button,
        .fcc-schedule-customize,
        .fcc-quick-modal-close {
          flex: 0 0 auto;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 900;
          transition:
            transform 180ms ease,
            color 180ms ease,
            border-color 180ms ease,
            background 180ms ease;
        }

        .fcc-schedule-header-button,
        .fcc-schedule-customize {
          width: 40px;
          height: 40px;
          color: #ffffff;
          background: var(--fcc-premium-button);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);
          box-shadow: 0 14px 28px color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent);
        }

        .fcc-schedule-header-button {
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow: 0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
        }

        .theme-oscuro .fcc-schedule-customize {
          color: #050505;
        }

        .fcc-quick-modal-close {
          width: 40px;
          height: 40px;
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow: 0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
        }

        .fcc-quick-modal-close.with-label {
          width: auto;
          padding: 0 14px;
        }

        .fcc-quick-modal-close:hover,
        .fcc-schedule-header-button:hover,
        .fcc-schedule-customize:hover {
          color: var(--fcc-user-text);
          transform: translateY(-1px);
        }

        .fcc-schedule-customize:hover {
          color: #ffffff;
          filter: saturate(1.08);
        }

        .theme-oscuro .fcc-schedule-customize:hover {
          color: #050505;
        }

        .fcc-schedule-header-button:disabled,
        .fcc-quick-modal-close:disabled,
        .fcc-quick-modal-backdrop:disabled,
        .fcc-schedule-customize[aria-disabled="true"] {
          cursor: wait;
          pointer-events: none;
          opacity: 0.72;
        }

        .fcc-quick-modal-loading {
          position: absolute;
          inset: 0;
          z-index: 18;
          display: grid;
          place-items: center;
          gap: 10px;
          text-align: center;
          border-radius: inherit;
          color: var(--fcc-user-text);
          background:
            radial-gradient(
              circle at 50% 42%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 34%
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
          backdrop-filter: blur(8px);
        }

        .fcc-quick-modal-loading strong {
          color: var(--fcc-user-text);
          font-size: 0.92rem;
          font-weight: 950;
        }

        .fcc-quick-modal-spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          border-top-color: var(--fcc-premium-accent);
          animation: fcc-quick-modal-spin 780ms linear infinite;
        }

        @keyframes fcc-quick-modal-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .fcc-schedule-confirm {
          position: fixed;
          inset: 0;
          z-index: 140;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(2, 8, 23, 0.28);
          backdrop-filter: blur(4px);
        }

        .fcc-schedule-confirm-card {
          width: min(360px, calc(100vw - 32px));
          display: grid;
          gap: 10px;
          border-radius: 22px;
          padding: 16px;
          color: var(--fcc-user-text);
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent),
              transparent 66%
            ),
            var(--fcc-premium-surface-strong);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow: 0 24px 54px rgba(15, 23, 42, 0.18);
          text-align: center;
        }

        .fcc-schedule-confirm-card strong {
          font-size: 1rem;
          font-weight: 950;
        }

        .fcc-schedule-confirm-card span {
          color: var(--fcc-user-muted);
          font-size: 0.84rem;
          font-weight: 760;
          line-height: 1.35;
        }

        .fcc-schedule-confirm-card div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 2px;
        }

        .fcc-schedule-confirm-card button {
          min-height: 38px;
          border-radius: 14px;
          border: 1px solid var(--fcc-user-card-border);
          font-size: 0.84rem;
          font-weight: 900;
        }

        .fcc-schedule-confirm-card button:first-child {
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface) 90%, transparent);
        }

        .fcc-schedule-confirm-card button:last-child {
          color: #ffffff;
          background: var(--fcc-premium-button);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);
        }

        .theme-oscuro .fcc-schedule-confirm-card button:last-child {
          color: #050505;
        }

        .fcc-quick-modal-placeholder {
          position: relative;
          z-index: 2;
          min-height: 220px;
          display: grid;
          place-items: center;
          text-align: center;
          border-radius: 22px;
          background: var(--fcc-user-modal-placeholder-bg);
          border: 1px dashed var(--fcc-user-modal-placeholder-border);
        }

        .fcc-quick-modal-placeholder span {
          color: var(--fcc-user-accent);
          font-weight: 900;
        }

        .fcc-schedule-quick {
          position: relative;
          min-height: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 10px;
        }

        .fcc-schedule-scroll {
          min-height: 0;
          overflow: hidden;
          overscroll-behavior: contain;
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 8% 8%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 28%
            ),
            radial-gradient(
              circle at 92% 92%,
              color-mix(in srgb, var(--fcc-premium-cyan) 9%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface) 88%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 92%, transparent)
            );
          border: 1px solid var(--fcc-user-card-border);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 70%, transparent),
            inset 0 -24px 48px color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
        }

        .fcc-schedule-grid {
          --fcc-schedule-row-height: clamp(52px, 7.6vw, 70px);

          position: relative;
          display: grid;
          width: 100%;
          min-width: 0;
          overflow: hidden;
          border-radius: 21px;
          font-family: system-ui, sans-serif;
        }

        .fcc-schedule-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
        }

        .fcc-schedule-head {
          position: sticky;
          top: 0;
          z-index: 10;
          color: var(--fcc-user-text);
          background:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 94%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 88%, transparent)
            );
          font-size: clamp(0.62rem, 1.25vw, 0.9rem);
          font-weight: 950;
          box-shadow: 0 10px 22px color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);
        }

        .fcc-schedule-hour-head,
        .fcc-schedule-hour-cell {
          position: sticky;
          left: 0;
          z-index: 11;
        }

        .fcc-schedule-hour-cell {
          color: var(--fcc-user-muted);
          background: color-mix(in srgb, var(--fcc-premium-surface) 90%, transparent);
          font-size: clamp(0.58rem, 1.15vw, 0.84rem);
          font-weight: 950;
        }

        .fcc-schedule-hour-head {
          z-index: 12;
          color: var(--fcc-user-muted);
        }

        .fcc-schedule-base-cell {
          background: color-mix(in srgb, var(--fcc-premium-surface) 86%, transparent);
        }

        .fcc-schedule-day-short {
          display: none;
        }

        .fcc-schedule-subject {
          z-index: 20;
          margin: 6px;
          min-width: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          text-align: center;
          border-radius: 16px;
          padding: 8px;
          line-height: 1.12;
          box-shadow:
            0 10px 18px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.24),
            inset 0 -1px 0 rgba(15, 23, 42, 0.06);
        }

        .theme-oscuro .fcc-schedule-subject {
          box-shadow:
            0 14px 26px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        }

        .fcc-schedule-subject strong {
          max-width: 100%;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          font-size: clamp(0.58rem, 1.1vw, 0.92rem);
          font-weight: 950;
          line-height: 1.02;
        }

        .fcc-schedule-subject div {
          max-width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1px;
          opacity: 0.94;
        }

        .fcc-schedule-subject span {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: clamp(0.48rem, 0.95vw, 0.72rem);
          font-weight: 800;
          line-height: 1.1;
        }

        .fcc-schedule-scroll.is-loading {
          min-height: min(520px, 58dvh);
          display: grid;
          place-items: center;
        }

        .fcc-schedule-empty.stable {
          min-height: min(480px, 52dvh);
          width: 100%;
        }

        .fcc-schedule-empty,
        .fcc-schedule-empty-inside {
          min-height: 220px;
          display: grid;
          place-items: center;
          text-align: center;
          border-radius: 22px;
          color: var(--fcc-user-muted);
          background: var(--fcc-user-modal-placeholder-bg);
          border: 1px dashed var(--fcc-user-modal-placeholder-border);
        }

        .fcc-schedule-empty span {
          color: var(--fcc-user-accent);
          font-weight: 900;
        }

        .fcc-schedule-empty-inside {
          z-index: 30;
          grid-column: 2 / -1;
          grid-row: 2 / span 2;
          align-self: stretch;
          justify-self: stretch;
          margin: 10px;
          padding: 22px;
        }

        .fcc-schedule-empty-inside strong {
          color: var(--fcc-user-text);
          font-size: 1rem;
          font-weight: 950;
        }

        .fcc-schedule-empty-inside span {
          margin-top: 8px;
          max-width: 360px;
          color: var(--fcc-user-muted);
          font-size: 0.88rem;
          font-weight: 700;
          line-height: 1.45;
        }

        @media (max-width: 1279px) {
          .fcc-user-avatar-stage {
            --fcc-user-avatar-render-scale: 0.9;
          }
        }

        @media (max-width: 1023px) {
          .fcc-user-avatar-stage {
            --fcc-user-avatar-render-scale: 0.84;
          }
        }

        @container (max-width: 860px) {
          .fcc-user-card-content {
            flex-direction: column;
            text-align: center;
            gap: 0;
            padding: 22px 18px 28px;
          }

          .fcc-user-avatar-stage {
            --fcc-user-avatar-render-scale: 0.72;
            width: min(74vw, 222px);
            height: 226px;
            margin-top: -8px;
            margin-bottom: 8px;
          }

          .fcc-user-eyebrow {
            justify-content: center;
          }

          .fcc-user-eyebrow::before {
            display: none;
          }

          .fcc-user-level {
            margin-left: auto;
            margin-right: auto;
          }

          .fcc-user-actions {
            justify-content: center;
          }

          .fcc-profile-button,
          .fcc-quick-action {
            min-height: 42px;
          }
        }

        @media (max-width: 860px) {
          .fcc-user-card-content {
            flex-direction: column;
            text-align: center;
            gap: 0;
            padding: 22px 18px 28px;
          }

          .fcc-user-avatar-stage {
            --fcc-user-avatar-render-scale: 0.72;
            width: min(74vw, 222px);
            height: 226px;
            margin-top: -8px;
            margin-bottom: 8px;
          }

          .fcc-user-eyebrow {
            justify-content: center;
          }

          .fcc-user-eyebrow::before {
            display: none;
          }

          .fcc-user-level {
            margin-left: auto;
            margin-right: auto;
          }

          .fcc-user-actions {
            justify-content: center;
          }

          .fcc-profile-button,
          .fcc-quick-action {
            min-height: 42px;
          }
        }

        @media (max-width: 640px) {
          .fcc-quick-modal-overlay {
            align-items: stretch;
            padding: 10px;
          }

          .fcc-quick-modal,
          .fcc-quick-modal.is-schedule,
          .fcc-quick-modal.is-curriculum,
          .fcc-quick-modal.is-calendar {
            width: 100%;
            max-height: calc(100dvh - 20px);
            border-radius: 24px;
            padding: 14px;
          }

          .fcc-quick-modal-header {
            gap: 10px;
          }

          .fcc-quick-modal.is-schedule .fcc-quick-modal-header,
          .fcc-quick-modal.is-curriculum .fcc-quick-modal-header,
          .fcc-quick-modal.is-calendar .fcc-quick-modal-header {
            align-items: flex-start;
          }

          .fcc-quick-modal-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
          }

          .fcc-schedule-modal-actions {
            align-items: center;
            gap: 8px;
          }

          .fcc-schedule-customize,
          .fcc-quick-modal-close {
            width: 36px;
            height: 36px;
            min-height: 36px;
          }

          .fcc-schedule-quick {
            }

          .fcc-schedule-grid {
            --fcc-schedule-row-height: clamp(44px, 13vw, 62px);
            min-width: 0;
          }

          .fcc-schedule-day-full {
            display: none;
          }

          .fcc-schedule-day-short {
            display: inline;
          }

          .fcc-schedule-subject {
            margin: 4px;
            border-radius: 14px;
            padding: 6px;
          }

          .fcc-schedule-subject strong {
            font-size: 0.74rem;
          }

          .fcc-schedule-subject span {
            font-size: 0.6rem;
          }
        }

        @media (max-width: 380px) {
          .fcc-user-avatar-stage {
            --fcc-user-avatar-render-scale: 0.68;
            width: min(74vw, 210px);
            height: 216px;
          }
        }
      `}</style>

      <div
        className="fcc-user-card"
        style={{
          pointerEvents: tutorialActivo ? "none" : "auto",
        }}
      >
        <span className="fcc-user-tech-node node-1" />
        <span className="fcc-user-tech-node node-2" />
        <span className="fcc-user-tech-node node-3" />

        <div className="fcc-user-card-content">
          <div className="fcc-user-avatar-stage">
            <span className="fcc-avatar-orbit" />

            <div className="fcc-avatar-render">
              <RenderizadorAvatar config={avatar} size={300} />
            </div>
          </div>

          <div className="fcc-user-copy">
            <p className="fcc-user-eyebrow">
              {rol === "profesor" ? "Panel docente" : "Panel estudiante"}
            </p>

            <h2 className="fcc-user-title">
              {rol === "profesor"
                ? `Bienvenido, profesor ${name}`
                : `Bienvenido, ${name}`}
            </h2>

            {rol === "estudiante" && (
              <p className="fcc-user-level">Nivel {level}</p>
            )}

            <div className="fcc-user-actions">
              <Link href={perfilUrl} className="fcc-profile-button">
                <span>Ver perfil</span>
                <ChevronRight size={18} strokeWidth={2.4} />
              </Link>

              {rol === "estudiante" && (
                <>
                  <button
                    type="button"
                    className="fcc-quick-action"
                    onClick={() => setAccionAbierta("horario")}
                  >
                    <Clock3 size={17} strokeWidth={2.3} />
                    <span>Horario</span>
                  </button>

                  <button
                    type="button"
                    className="fcc-quick-action"
                    onClick={() => setAccionAbierta("calendario")}
                  >
                    <CalendarDays size={17} strokeWidth={2.3} />
                    <span>Calendario</span>
                  </button>

                  <button
                    type="button"
                    className="fcc-quick-action"
                    onClick={() => setAccionAbierta("mapa")}
                  >
                    <MapIcon size={17} strokeWidth={2.3} />
                    <span>Mapa curricular</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {mounted && modalRapido && createPortal(modalRapido, document.body)}
    </>
  );
}
