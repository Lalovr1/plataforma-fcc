"use client";

/**
 * Tarjeta de usuario que muestra el avatar, nombre, nivel,
 * acceso al perfil y accesos rápidos académicos.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3, Map, X } from "lucide-react";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";

interface TarjetaUsuarioProps {
  name?: string;
  level?: number;
  avatarConfig?: AvatarConfig | null;
  rol?: "estudiante" | "profesor";
}

type AccionRapida = "horario" | "calendario" | "mapa";

export default function TarjetaUsuario({
  name = "Usuario",
  level = 0,
  avatarConfig,
  rol = "estudiante",
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
      descripcion:
        "Aquí se mostrará el horario del estudiante en una vista rápida para consultar clases sin salir del inicio.",
      icono: Clock3,
    },
    calendario: {
      titulo: "Calendario",
      descripcion:
        "Aquí se mostrarán eventos, entregas y fechas importantes guardadas por el estudiante.",
      icono: CalendarDays,
    },
    mapa: {
      titulo: "Mapa curricular",
      descripcion:
        "Aquí se mostrará el avance visual dentro del plan de estudios y materias relacionadas.",
      icono: Map,
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
          position: fixed;
          inset: 0;
          z-index: 24000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.38);
          backdrop-filter: blur(8px);
        }

        .fcc-quick-modal {
          position: relative;
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
        }

        .fcc-quick-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
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

        .fcc-quick-modal-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow: 0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
        }

        .fcc-quick-modal-close:hover {
          color: var(--fcc-user-text);
          transform: translateY(-1px);
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
                    <Map size={17} strokeWidth={2.3} />
                    <span>Mapa curricular</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalActual && IconoModal && (
        <div
          className="fcc-quick-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={modalActual.titulo}
        >
          <div className="fcc-quick-modal">
            <div className="fcc-quick-modal-content">
              <div className="fcc-quick-modal-header">
                <div className="fcc-quick-modal-title-wrap">
                  <span className="fcc-quick-modal-icon">
                    <IconoModal size={22} strokeWidth={2.3} />
                  </span>

                  <div>
                    <h3>{modalActual.titulo}</h3>
                    <p>{modalActual.descripcion}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="fcc-quick-modal-close"
                  onClick={() => setAccionAbierta(null)}
                  aria-label="Cerrar"
                >
                  <X size={20} strokeWidth={2.4} />
                </button>
              </div>

              <div className="fcc-quick-modal-placeholder">
                <span>Vista rápida preparada</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
