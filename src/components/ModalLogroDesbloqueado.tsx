"use client";

import { useEffect, useState } from "react";
import { aplicarXP } from "@/lib/aplicarXP";

interface Props {
  logro: {
    nombre: string;
    descripcion: string;
    xp_recompensa: number;
    icono_url?: string | null;
  };
  onClose: () => void;
}

export default function ModalLogroDesbloqueado({ logro, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const cerrarModal = async () => {
    const userId = localStorage.getItem("user_id");

    if (userId) {
      await aplicarXP(userId, logro.xp_recompensa);
    }

    window.dispatchEvent(new Event("logroCerrado"));

    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <div
      data-logro-modal
      className={`modal-logro-overlay ${visible ? "visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={logro.nombre || "Logro desbloqueado"}
    >
      <style>{`
        .modal-logro-overlay {
          --logro-accent: var(--fcc-premium-accent, var(--color-accent));
          --logro-cyan: var(--fcc-premium-cyan, var(--color-accent));
          --logro-surface: var(--fcc-premium-surface, var(--color-card));
          --logro-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --logro-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
          --logro-text: var(--fcc-premium-text, var(--color-text));
          --logro-muted: var(--fcc-premium-muted, var(--color-muted));
          --logro-border: var(--fcc-premium-border, var(--color-border));
          --logro-shadow: var(--fcc-premium-shadow, 0 24px 70px rgba(2, 8, 23, 0.22));

          position: fixed;
          inset: 0;
          z-index: 20000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(2, 8, 23, 0.54);
          backdrop-filter: blur(8px);
          opacity: 0;
          transform: scale(0.985);
          transition:
            opacity 420ms ease,
            transform 420ms ease;
        }

        .modal-logro-overlay.visible {
          opacity: 1;
          transform: scale(1);
        }

        .modal-logro-card {
          position: relative;
          width: min(92vw, 420px);
          overflow: hidden;
          border-radius: 28px;
          padding: 26px 22px 22px;
          color: var(--logro-text);
          background:
            radial-gradient(
              circle at 50% 0%,
              color-mix(in srgb, var(--logro-accent) 9%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--logro-surface),
              var(--logro-surface-soft)
            );
          border: 1px solid color-mix(in srgb, var(--logro-accent) 16%, var(--logro-border));
          box-shadow:
            var(--logro-shadow),
            inset 0 1px 0 color-mix(in srgb, var(--logro-surface-strong) 68%, transparent);
          text-align: center;
          animation: logro-aparecer 460ms ease-out;
        }

        .modal-logro-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(circle at 50% 4%, black, transparent 68%);
          opacity: 0.34;
        }

        .modal-logro-content {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          gap: 10px;
          min-width: 0;
        }

        .modal-logro-icon-stage {
          width: clamp(94px, 28vw, 124px);
          height: clamp(94px, 28vw, 124px);
          display: grid;
          place-items: center;
          border-radius: 999px;
          background:
            radial-gradient(
              circle,
              color-mix(in srgb, var(--logro-accent) 10%, transparent),
              transparent 68%
            );
          filter: drop-shadow(0 12px 22px color-mix(in srgb, var(--logro-accent) 14%, transparent));
        }

        .modal-logro-icon {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 0 10px color-mix(in srgb, var(--logro-accent) 26%, transparent));
        }

        .modal-logro-fallback {
          font-size: 3.2rem;
          line-height: 1;
        }

        .modal-logro-title {
          margin: 4px 0 0;
          color: var(--logro-text);
          font-size: clamp(1.28rem, 3vw, 1.62rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1.05;
        }

        .modal-logro-description {
          max-width: 330px;
          margin: 0;
          color: var(--logro-muted);
          font-size: 0.94rem;
          font-weight: 750;
          line-height: 1.42;
        }

        .modal-logro-xp {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          border-radius: 999px;
          padding: 0 13px;
          color: var(--logro-accent);
          background: color-mix(in srgb, var(--logro-accent) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--logro-accent) 20%, var(--logro-border));
          font-size: 0.9rem;
          font-weight: 950;
        }

        .modal-logro-button {
          min-height: 42px;
          min-width: 150px;
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 0 24px;
          color: #ffffff;
          background: var(--logro-accent);
          border: 1px solid color-mix(in srgb, var(--logro-accent) 64%, white);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--logro-accent) 16%, transparent);
          font-size: 0.9rem;
          font-weight: 950;
          cursor: pointer;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            box-shadow 170ms ease;
        }

        .modal-logro-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow: 0 15px 30px color-mix(in srgb, var(--logro-accent) 20%, transparent);
        }

        .theme-oscuro .modal-logro-button {
          color: #050505;
        }

        @keyframes logro-aparecer {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 520px) {
          .modal-logro-card {
            padding: 24px 18px 20px;
            border-radius: 24px;
          }

          .modal-logro-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="modal-logro-card">
        <div className="modal-logro-content">
          <div className="modal-logro-icon-stage">
            {logro.nombre ? (
              <img
                src={logro.icono_url || "/icons/trophy_default.png"}
                alt={logro.nombre}
                onError={(e) => {
                  e.currentTarget.src = "/icons/trophy_default.png";
                }}
                className="modal-logro-icon"
              />
            ) : (
              <div className="modal-logro-fallback">🏆</div>
            )}
          </div>

          <h2 className="modal-logro-title">{logro.nombre}</h2>

          <p className="modal-logro-description">{logro.descripcion}</p>

          <p className="modal-logro-xp">+{logro.xp_recompensa} XP</p>

          <button
            type="button"
            onClick={cerrarModal}
            className="modal-logro-button"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
