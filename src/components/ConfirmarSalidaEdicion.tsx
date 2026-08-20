"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LogOut, Save, Undo2 } from "lucide-react";

type Props = {
  open: boolean;
  titulo?: string;
  descripcion?: string;
  guardando?: boolean;
  onContinuar: () => void;
  onDescartar: () => void;
  onGuardar: () => void | Promise<void>;
};

export default function ConfirmarSalidaEdicion({
  open,
  titulo = "Hay cambios sin guardar",
  descripcion = "Antes de salir, elige qué quieres hacer con los cambios realizados.",
  guardando = false,
  onContinuar,
  onDescartar,
  onGuardar,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !guardando) {
        onContinuar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, guardando, onContinuar]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fcc-salida-edicion-overlay"
      onClick={() => {
        if (!guardando) onContinuar();
      }}
    >
      <style>{`
        .fcc-salida-edicion-overlay {
          --salida-surface: var(--fcc-premium-surface, var(--color-card));
          --salida-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --salida-text: var(--fcc-premium-text, var(--color-text));
          --salida-muted: var(--fcc-premium-muted, var(--color-muted));
          --salida-border: var(--fcc-premium-border, var(--color-border));

          position: fixed;
          inset: 0;
          z-index: 60000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(2, 8, 23, 0.66);
          backdrop-filter: blur(10px);
        }

        .fcc-salida-edicion-modal {
          width: min(94vw, 560px);
          overflow: hidden;
          border-radius: 26px;
          padding: clamp(22px, 4vw, 30px);
          color: var(--salida-text);
          background:
            radial-gradient(
              circle at 50% 0%,
              color-mix(in srgb, #3b82f6 8%, transparent),
              transparent 42%
            ),
            linear-gradient(
              135deg,
              var(--salida-surface),
              var(--salida-surface-soft)
            );
          border: 1px solid color-mix(in srgb, #3b82f6 18%, var(--salida-border));
          box-shadow:
            0 28px 80px rgba(2, 8, 23, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .fcc-salida-edicion-title {
          margin: 0;
          text-align: center;
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .fcc-salida-edicion-description {
          max-width: 460px;
          margin: 10px auto 0;
          color: var(--salida-muted);
          text-align: center;
          font-size: 0.94rem;
          font-weight: 720;
          line-height: 1.5;
        }

        .fcc-salida-edicion-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 24px;
        }

        .fcc-salida-edicion-button {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 14px;
          padding: 0 14px;
          border: 1px solid transparent;
          color: #ffffff;
          font-size: 0.87rem;
          font-weight: 950;
          line-height: 1.15;
          text-align: center;
          transition:
            transform 170ms ease,
            opacity 170ms ease,
            filter 170ms ease;
        }

        .fcc-salida-edicion-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .fcc-salida-edicion-button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .fcc-salida-edicion-button.continue {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        .fcc-salida-edicion-button.discard {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        .fcc-salida-edicion-button.save {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        @media (max-width: 640px) {
          .fcc-salida-edicion-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section
        className="fcc-salida-edicion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fcc-salida-edicion-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="fcc-salida-edicion-title" className="fcc-salida-edicion-title">
          {titulo}
        </h2>

        <p className="fcc-salida-edicion-description">{descripcion}</p>

        <div className="fcc-salida-edicion-actions">
          <button
            type="button"
            className="fcc-salida-edicion-button discard"
            onClick={onDescartar}
            disabled={guardando}
          >
            <LogOut size={17} strokeWidth={2.6} />
            Descartar y salir
          </button>

          <button
            type="button"
            className="fcc-salida-edicion-button continue"
            onClick={onContinuar}
            disabled={guardando}
          >
            <Undo2 size={17} strokeWidth={2.6} />
            Seguir editando
          </button>

          <button
            type="button"
            className="fcc-salida-edicion-button save"
            onClick={() => void onGuardar()}
            disabled={guardando}
          >
            <Save size={17} strokeWidth={2.6} />
            {guardando ? "Guardando..." : "Guardar y salir"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
