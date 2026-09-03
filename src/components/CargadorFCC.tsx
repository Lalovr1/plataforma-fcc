"use client";

import { useId, type CSSProperties } from "react";

export const DURACION_MINIMA_CARGADOR_FCC_MS = 950;

type CargadorFCCProps = {
  mensaje?: string;
  detalle?: string;
  compacto?: boolean;
  pantallaCompleta?: boolean;
  pagina?: boolean;
  flotante?: boolean;
  sobreModal?: boolean;
  temaPublico?: boolean;
  className?: string;
};

export default function CargadorFCC({
  mensaje = "Preparando FCC Academy",
  detalle = "Sincronizando la información más reciente…",
  compacto = false,
  pantallaCompleta = false,
  pagina = false,
  flotante = false,
  sobreModal = false,
  temaPublico = false,
  className = "",
}: CargadorFCCProps) {
  const id = useId().replace(/:/g, "");
  const clipId = `fcc-loader-clip-${id}`;
  const gradientId = `fcc-loader-gradient-${id}`;
  const esFlotante = flotante || sobreModal;

  // Las rutas públicas siempre usan la identidad azul predeterminada. Este
  // override también mantiene estable Login -> Dashboard mientras, por debajo,
  // se prepara el tema real del usuario.
  const estiloTemaPublico = temaPublico
    ? ({
        "--fcc-premium-accent": "#2563eb",
        "--fcc-premium-cyan": "#23d4ff",
        "--fcc-premium-heading": "#10213f",
        "--fcc-premium-muted": "#64748b",
        "--fcc-premium-surface": "rgba(255,255,255,.96)",
        "--fcc-premium-border": "rgba(125,181,255,.22)",
        "--gradient-soft":
          "radial-gradient(circle at 8% 4%, rgba(37,99,235,.11), transparent 28%), radial-gradient(circle at 92% 86%, rgba(14,165,233,.11), transparent 32%), #f4f8ff",
      } as CSSProperties)
    : {};

  const estiloContenedor: CSSProperties = esFlotante
    ? {
        position: "fixed",
        right: "max(18px, env(safe-area-inset-right))",
        bottom: "max(18px, env(safe-area-inset-bottom))",
        zIndex: sobreModal ? 120000 : 30000,
        width: "auto",
        maxWidth: "min(360px, calc(100vw - 36px))",
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 11,
        padding: "9px 13px 9px 10px",
        borderRadius: 18,
        pointerEvents: "none",
        textAlign: "left",
        background: "var(--fcc-premium-surface, rgba(255,255,255,.96))",
        border: "1px solid var(--fcc-premium-border, rgba(15,23,42,.12))",
        boxShadow: "0 18px 48px rgba(15,23,42,.18)",
      }
    : pantallaCompleta
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 32000,
        width: "100vw",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "32px 20px",
        textAlign: "center",
        pointerEvents: "auto",
        background: "var(--gradient-soft, #f7f9fc)",
      }
    : pagina
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 29000,
        width: "auto",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "32px 20px",
        textAlign: "center",
        pointerEvents: "auto",
        background: "var(--gradient-soft, #f7f9fc)",
      }
    : {
        width: "100%",
        minHeight: compacto ? 190 : "min(62dvh, 520px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compacto ? 10 : 18,
        padding: compacto ? 18 : "32px 20px",
        textAlign: "center",
      };

  const estiloMarca: CSSProperties = {
    position: "relative",
    width: esFlotante ? 42 : compacto ? 76 : 134,
    height: esFlotante ? 48 : compacto ? 88 : 154,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
  };

  return (
    <div
      className={`fcc-loader ${compacto ? "is-compact" : ""} ${
        pantallaCompleta ? "is-screen" : ""
      } ${pagina ? "is-page" : ""} ${esFlotante ? "is-floating" : ""} ${
        sobreModal ? "is-over-modal" : ""
      } ${className}`}
      style={{ ...estiloContenedor, ...estiloTemaPublico }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="fcc-loader-mark" style={estiloMarca} aria-hidden="true">
        <span className="fcc-loader-orbit orbit-a" />
        <span className="fcc-loader-orbit orbit-b" />

        <svg
          viewBox="0 0 160 184"
          focusable="false"
          width="160"
          height="184"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            <clipPath id={clipId}>
              <path d="M80 8 143 31v55c0 39-25 72-63 90C42 158 17 125 17 86V31L80 8Z" />
            </clipPath>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--fcc-loader-cyan)" />
              <stop offset="1" stopColor="var(--fcc-loader-accent)" />
            </linearGradient>
          </defs>

          <path
            className="fcc-loader-shield"
            d="M80 8 143 31v55c0 39-25 72-63 90C42 158 17 125 17 86V31L80 8Z"
            fill="rgba(255,255,255,.94)"
            stroke="#3b82f6"
            strokeWidth="4"
          />

          <g clipPath={`url(#${clipId})`}>
            <rect
              className="fcc-loader-fill"
              x="0"
              y="0"
              width="160"
              height="190"
              fill={`url(#${gradientId})`}
            />
            <path
              className="fcc-loader-wave"
              d="M-24 54c24-17 47 17 72 0s48 17 73 0 48 17 73 0v148H-24Z"
              fill="rgba(255,255,255,.18)"
            />
          </g>

          <path
            className="fcc-loader-inner"
            d="M80 18 133 37v48c0 33-20 61-53 78-33-17-53-45-53-78V37L80 18Z"
            fill="none"
            stroke="rgba(255,255,255,.72)"
            strokeWidth="2"
          />
          <text
            className="fcc-loader-letters"
            x="80"
            y="93"
            textAnchor="middle"
            fill="white"
          >
            FCC
          </text>
          <path
            className="fcc-loader-book"
            d="M55 108h22l3 5 3-5h22v18H84l-4 5-4-5H55Z"
            fill="rgba(255,255,255,.94)"
          />
          <text
            className="fcc-loader-academy"
            x="80"
            y="148"
            textAnchor="middle"
            fill="white"
          >
            ACADEMY
          </text>
        </svg>
      </div>

      <div className="fcc-loader-copy">
        <strong>{mensaje}</strong>
        {detalle && <span>{detalle}</span>}
        <i className="fcc-loader-dots" aria-hidden="true">
          <b />
          <b />
          <b />
        </i>
      </div>

      <style jsx>{`
        .fcc-loader {
          --fcc-loader-accent: var(--fcc-premium-accent, #0b57d0);
          --fcc-loader-cyan: var(--fcc-premium-cyan, #20bce8);
          --fcc-loader-text: var(--fcc-premium-heading, #10213d);
          --fcc-loader-muted: var(--fcc-premium-muted, #64748b);
          --fcc-loader-surface: var(--fcc-premium-surface, rgba(255, 255, 255, 0.92));
          --fcc-loader-border: var(--fcc-premium-border, rgba(15, 23, 42, 0.1));

          width: 100%;
          min-height: min(62dvh, 520px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 32px 20px;
          text-align: center;
          color: var(--fcc-loader-text);
        }

        .fcc-loader.is-screen {
          min-height: 100dvh;
          background:
            radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--fcc-loader-cyan) 12%, transparent), transparent 30%),
            var(--gradient-soft, #f7f9fc);
        }

        .fcc-loader.is-page {
          min-height: 100dvh;
          background:
            radial-gradient(circle at 50% 44%, color-mix(in srgb, var(--fcc-loader-cyan) 9%, transparent), transparent 31%),
            var(--gradient-soft, #f7f9fc);
        }

        .fcc-loader.is-compact {
          min-height: 190px;
          gap: 10px;
          padding: 18px;
        }

        .fcc-loader.is-floating {
          color: var(--fcc-loader-text);
          animation: fcc-loader-floating-in 180ms ease-out both;
        }

        .is-floating .fcc-loader-mark {
          filter: drop-shadow(0 8px 14px color-mix(in srgb, var(--fcc-loader-accent) 18%, transparent));
        }

        .is-floating .fcc-loader-copy {
          justify-items: start;
          gap: 2px;
          min-width: 0;
        }

        .is-floating .fcc-loader-copy strong {
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.82rem;
          letter-spacing: -0.012em;
        }

        .is-floating .fcc-loader-copy span {
          display: none;
        }

        .is-floating .fcc-loader-dots {
          margin-top: 2px;
        }

        .is-floating .fcc-loader-dots b {
          width: 4px;
          height: 4px;
        }

        .fcc-loader-mark {
          position: relative;
          width: 134px;
          height: 154px;
          display: grid;
          place-items: center;
          filter: drop-shadow(0 18px 28px color-mix(in srgb, var(--fcc-loader-accent) 20%, transparent));
        }

        .is-compact .fcc-loader-mark {
          width: 76px;
          height: 88px;
        }

        .fcc-loader-mark svg {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .fcc-loader-shield {
          fill: color-mix(in srgb, var(--fcc-loader-surface) 92%, transparent);
          stroke: color-mix(in srgb, var(--fcc-loader-accent) 60%, var(--fcc-loader-border));
          stroke-width: 4;
        }

        .fcc-loader-inner {
          fill: none;
          stroke: rgba(255, 255, 255, 0.68);
          stroke-width: 2;
          opacity: 0.75;
        }

        .fcc-loader-fill {
          animation: fcc-loader-fill 2.2s cubic-bezier(.45, 0, .25, 1) infinite;
          transform-origin: center bottom;
        }

        .fcc-loader-wave {
          animation: fcc-loader-wave 1.55s ease-in-out infinite alternate;
        }

        .fcc-loader-letters {
          fill: white;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 38px;
          font-weight: 950;
          letter-spacing: -4px;
          paint-order: stroke;
          stroke: rgba(5, 22, 52, 0.32);
          stroke-width: 2px;
        }

        .fcc-loader-academy {
          fill: white;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .fcc-loader-book {
          fill: rgba(255, 255, 255, 0.92);
        }

        .fcc-loader-orbit {
          position: absolute;
          inset: 10px -8px;
          border: 1px solid color-mix(in srgb, var(--fcc-loader-cyan) 38%, transparent);
          border-radius: 50%;
          transform: rotate(24deg);
          animation: fcc-loader-orbit 3.8s linear infinite;
        }

        .fcc-loader-orbit::after {
          content: "";
          position: absolute;
          width: 7px;
          height: 7px;
          top: 12px;
          right: 15px;
          border-radius: 999px;
          background: var(--fcc-loader-cyan);
          box-shadow: 0 0 14px var(--fcc-loader-cyan);
        }

        .fcc-loader-orbit.orbit-b {
          inset: 24px -18px;
          transform: rotate(-34deg);
          animation-direction: reverse;
          animation-duration: 5.2s;
          opacity: 0.58;
        }

        .fcc-loader-copy {
          display: grid;
          justify-items: center;
          gap: 7px;
          max-width: 430px;
        }

        .fcc-loader-copy strong {
          font-size: clamp(1rem, 2vw, 1.2rem);
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .fcc-loader-copy span {
          color: var(--fcc-loader-muted);
          font-size: 0.9rem;
          font-weight: 700;
        }

        .is-compact .fcc-loader-copy span {
          display: none;
        }

        .fcc-loader-dots {
          display: flex;
          gap: 5px;
          margin-top: 3px;
        }

        .fcc-loader-dots b {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--fcc-loader-accent);
          animation: fcc-loader-dot 1.15s ease-in-out infinite;
        }

        .fcc-loader-dots b:nth-child(2) { animation-delay: 120ms; }
        .fcc-loader-dots b:nth-child(3) { animation-delay: 240ms; }

        @keyframes fcc-loader-fill {
          0% { transform: translateY(82%); opacity: 0.7; }
          55% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-10%); opacity: 0.86; }
        }

        @keyframes fcc-loader-wave {
          from { transform: translateX(-10px) translateY(4px); }
          to { transform: translateX(10px) translateY(-5px); }
        }

        @keyframes fcc-loader-orbit {
          to { transform: rotate(384deg); }
        }

        @keyframes fcc-loader-dot {
          0%, 70%, 100% { transform: translateY(0); opacity: 0.38; }
          35% { transform: translateY(-4px); opacity: 1; }
        }

        @keyframes fcc-loader-floating-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .fcc-loader-fill,
          .fcc-loader-wave,
          .fcc-loader-orbit,
          .fcc-loader-dots b {
            animation-duration: 8s;
          }
        }

        @media (min-width: 1024px) {
          .fcc-loader.is-page {
            left: var(--fcc-sidebar-width, 16rem) !important;
          }
        }
      `}</style>
    </div>
  );
}
