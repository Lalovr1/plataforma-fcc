"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

type EstadoErrorCargaFCCProps = {
  titulo?: string;
  detalle?: string;
  onRetry?: () => void;
  compacto?: boolean;
  pantallaCompleta?: boolean;
};

export default function EstadoErrorCargaFCC({
  titulo = "No fue posible confirmar la información",
  detalle = "La interfaz se mantuvo protegida para no mostrar datos anteriores o incompletos.",
  onRetry,
  compacto = false,
  pantallaCompleta = false,
}: EstadoErrorCargaFCCProps) {
  return (
    <div
      className={`fcc-load-error ${compacto ? "is-compact" : ""} ${
        pantallaCompleta ? "is-screen" : ""
      }`}
      role="alert"
    >
      <div className="fcc-load-error-card">
        <div className="fcc-load-error-mark" aria-hidden="true">
          <svg viewBox="0 0 80 92" focusable="false">
            <path d="M40 4 72 16v28c0 20-13 37-32 46C21 81 8 64 8 44V16L40 4Z" />
          </svg>
          <AlertTriangle size={27} strokeWidth={2.5} />
        </div>

        <div className="fcc-load-error-copy">
          <strong>{titulo}</strong>
          <span>{detalle}</span>
        </div>

        {onRetry && (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={17} strokeWidth={2.6} aria-hidden="true" />
            Reintentar
          </button>
        )}
      </div>

      <style jsx>{`
        .fcc-load-error {
          width: 100%;
          min-height: min(58dvh, 470px);
          display: grid;
          place-items: center;
          padding: 24px;
          color: var(--fcc-premium-text, #172033);
        }

        .fcc-load-error.is-screen {
          min-height: 100dvh;
          background:
            radial-gradient(circle at 50% 42%, rgba(239, 68, 68, 0.09), transparent 32%),
            var(--gradient-soft, #f7f9fc);
        }

        .fcc-load-error.is-compact {
          min-height: 180px;
          padding: 16px;
        }

        .fcc-load-error-card {
          width: min(100%, 560px);
          display: grid;
          justify-items: center;
          gap: 15px;
          padding: clamp(22px, 5vw, 38px);
          text-align: center;
          border-radius: 28px;
          border: 1px solid color-mix(in srgb, #ef4444 24%, var(--fcc-premium-border, #dbe3ef));
          background:
            radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.08), transparent 40%),
            var(--fcc-premium-surface, rgba(255, 255, 255, 0.94));
          box-shadow: var(--fcc-premium-shadow, 0 22px 60px rgba(15, 23, 42, 0.12));
        }

        .is-compact .fcc-load-error-card {
          grid-template-columns: auto 1fr auto;
          justify-items: start;
          gap: 12px;
          padding: 16px;
          text-align: left;
          border-radius: 18px;
        }

        .fcc-load-error-mark {
          position: relative;
          width: 74px;
          height: 84px;
          display: grid;
          place-items: center;
          color: #ef4444;
        }

        .is-compact .fcc-load-error-mark {
          width: 42px;
          height: 48px;
        }

        .fcc-load-error-mark svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          fill: color-mix(in srgb, #ef4444 8%, var(--fcc-premium-surface, white));
          stroke: color-mix(in srgb, #ef4444 72%, #991b1b);
          stroke-width: 2.5;
        }

        .fcc-load-error-mark :global(svg:last-child) {
          position: relative;
          z-index: 1;
        }

        .fcc-load-error-copy {
          display: grid;
          gap: 7px;
        }

        .fcc-load-error-copy strong {
          color: var(--fcc-premium-heading, #111827);
          font-size: clamp(1.05rem, 2.5vw, 1.3rem);
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .fcc-load-error-copy span {
          color: var(--fcc-premium-muted, #64748b);
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1.5;
        }

        .fcc-load-error button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 10px 17px;
          border: 0;
          border-radius: 13px;
          color: white;
          background: linear-gradient(135deg, var(--fcc-premium-accent, #0b57d0), #1787d8);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--fcc-premium-accent, #0b57d0) 25%, transparent);
          font-weight: 900;
          cursor: pointer;
          transition: transform 160ms ease, filter 160ms ease;
        }

        .fcc-load-error button:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }

        @media (max-width: 620px) {
          .is-compact .fcc-load-error-card {
            grid-template-columns: auto 1fr;
          }

          .is-compact .fcc-load-error button {
            grid-column: 1 / -1;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
