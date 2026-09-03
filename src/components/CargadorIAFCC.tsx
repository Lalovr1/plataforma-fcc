"use client";

import { useEffect, useMemo, useState } from "react";
import CargadorFCC from "@/components/CargadorFCC";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type CargadorIAFCCProps = {
  mensaje: string;
  detalle?: string;
  frases?: string[];
};

const FRASES_PREDETERMINADAS = [
  "Analizando el contenido seleccionado…",
  "Creando nuevas preguntas…",
  "Preparando opciones de respuesta…",
  "Dando forma al borrador…",
];

function formatearTiempo(segundosTotales: number) {
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;
  const base = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;

  return horas > 0 ? `${String(horas).padStart(2, "0")}:${base}` : base;
}

export default function CargadorIAFCC({
  mensaje,
  detalle,
  frases = FRASES_PREDETERMINADAS,
}: CargadorIAFCCProps) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const actualizar = () => {
      setSegundos(Math.floor((Date.now() - inicio) / 1000));
    };
    const intervalo = window.setInterval(actualizar, 1000);

    actualizar();
    return () => window.clearInterval(intervalo);
  }, []);

  const frase = useMemo(() => {
    if (!frases.length) return "Trabajando en tu solicitud…";
    return frases[Math.floor(segundos / 6) % frases.length];
  }, [frases, segundos]);

  return (
    <div className="fcc-ai-wait" role="dialog" aria-modal="true">
      <div className="fcc-ai-wait-card">
        <CargadorFCC compacto mensaje={mensaje} detalle={detalle} />

        <div className="fcc-ai-wait-time" aria-label={`Tiempo transcurrido: ${formatearTiempo(segundos)}`}>
          <span>Tiempo transcurrido</span>
          <strong aria-hidden="true">{formatearTiempo(segundos)}</strong>
        </div>

        <p className="fcc-ai-wait-phrase">{frase}</p>
        <small>
          Esto puede tardar unos minutos. No cierres ni recargues esta ventana.
        </small>
      </div>

      <style jsx>{`
        .fcc-ai-wait {
          position: fixed;
          inset: 0;
          z-index: 150000;
          display: grid;
          place-items: center;
          min-height: 100dvh;
          padding: 22px;
          overflow: hidden;
          color: var(--fcc-premium-text, #10213f);
          background: rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(8px);
        }

        .fcc-ai-wait-card {
          width: min(540px, 100%);
          display: grid;
          justify-items: center;
          gap: 13px;
          padding: clamp(22px, 5vw, 38px);
          text-align: center;
          border-radius: 28px;
          background: var(--fcc-premium-surface, rgba(255, 255, 255, 0.97));
          border: 1px solid var(--fcc-premium-border-strong, rgba(37, 99, 235, 0.2));
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.2);
        }

        .fcc-ai-wait-card :global(.fcc-loader) {
          min-height: 0 !important;
          padding: 0 !important;
        }

        .fcc-ai-wait-time {
          display: grid;
          gap: 3px;
          padding: 10px 18px;
          border-radius: 16px;
          color: var(--fcc-premium-heading, #10213f);
          background: color-mix(in srgb, var(--fcc-premium-accent, #2563eb) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent, #2563eb) 18%, transparent);
        }

        .fcc-ai-wait-time span {
          color: var(--fcc-premium-muted, #64748b);
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .fcc-ai-wait-time strong {
          font-size: 1.35rem;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.03em;
        }

        .fcc-ai-wait-phrase {
          min-height: 1.5em;
          margin: 0;
          color: var(--fcc-premium-heading, #10213f);
          font-size: 0.94rem;
          font-weight: 800;
          line-height: 1.5;
        }

        .fcc-ai-wait-card small {
          color: var(--fcc-premium-muted, #64748b);
          font-weight: 700;
        }

        @media (max-width: 520px) {
          .fcc-ai-wait {
            padding: 14px;
          }

          .fcc-ai-wait-card {
            border-radius: 22px;
          }
        }
      `}</style>
    </div>
  );
}

type AvisoIAFCCProps = {
  tipo?: "listo" | "tiempo";
  etiqueta: string;
  titulo: string;
  descripcion: string;
  nota?: string;
  textoPrincipal: string;
  onPrincipal: () => void;
  textoSecundario?: string;
  onSecundario?: () => void;
};

export function AvisoIAFCC({
  tipo = "listo",
  etiqueta,
  titulo,
  descripcion,
  nota,
  textoPrincipal,
  onPrincipal,
  textoSecundario,
  onSecundario,
}: AvisoIAFCCProps) {
  const esTiempo = tipo === "tiempo";

  return (
    <div className="fcc-ai-notice" role="dialog" aria-modal="true">
      <div className={`fcc-ai-notice-card ${esTiempo ? "time" : "ready"}`}>
        <span className="fcc-ai-notice-icon" aria-hidden="true">
          {esTiempo ? (
            <AlertTriangle size={30} strokeWidth={2.35} />
          ) : (
            <CheckCircle2 size={31} strokeWidth={2.35} />
          )}
        </span>

        <span className="fcc-ai-notice-kicker">{etiqueta}</span>
        <h3>{titulo}</h3>
        <p>{descripcion}</p>
        {nota && <small>{nota}</small>}

        <div className="fcc-ai-notice-actions">
          {textoSecundario && onSecundario && (
            <button type="button" className="secondary" onClick={onSecundario}>
              {textoSecundario}
            </button>
          )}

          <button type="button" className="primary" onClick={onPrincipal}>
            {textoPrincipal}
          </button>
        </div>
      </div>

      <style jsx>{`
        .fcc-ai-notice {
          position: fixed;
          inset: 0;
          z-index: 150000;
          display: grid;
          place-items: center;
          min-height: 100dvh;
          padding: 22px;
          color: var(--fcc-premium-text, #10213f);
          background: rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(8px);
        }

        .fcc-ai-notice-card {
          width: min(520px, 100%);
          display: grid;
          justify-items: center;
          gap: 11px;
          padding: clamp(25px, 5vw, 38px);
          text-align: center;
          border-radius: 28px;
          background: var(--fcc-premium-surface, rgba(255, 255, 255, 0.98));
          border: 1px solid var(--fcc-premium-border-strong, rgba(37, 99, 235, 0.2));
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
        }

        .fcc-ai-notice-icon {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          border-radius: 21px;
        }

        .ready .fcc-ai-notice-icon {
          color: #6d4aff;
          background: color-mix(in srgb, #7c5cff 10%, transparent);
          border: 1px solid color-mix(in srgb, #7c5cff 24%, transparent);
        }

        .time .fcc-ai-notice-icon {
          color: #d97706;
          background: color-mix(in srgb, #f59e0b 10%, transparent);
          border: 1px solid color-mix(in srgb, #f59e0b 25%, transparent);
        }

        .fcc-ai-notice-kicker {
          color: var(--fcc-premium-accent, #6d4aff);
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .time .fcc-ai-notice-kicker {
          color: #d97706;
        }

        .fcc-ai-notice-card h3 {
          margin: 0;
          color: var(--fcc-premium-heading, #10213f);
          font-size: clamp(1.45rem, 4vw, 2rem);
          font-weight: 950;
          line-height: 1.08;
          letter-spacing: -0.045em;
        }

        .fcc-ai-notice-card p {
          max-width: 430px;
          margin: 0;
          color: var(--fcc-premium-text-soft, #43516a);
          font-size: 0.94rem;
          font-weight: 750;
          line-height: 1.52;
        }

        .fcc-ai-notice-card small {
          color: var(--fcc-premium-muted, #64748b);
          font-size: 0.8rem;
          font-weight: 750;
        }

        .fcc-ai-notice-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }

        .fcc-ai-notice-actions button {
          min-height: 42px;
          border-radius: 14px;
          padding: 0 17px;
          font-size: 0.88rem;
          font-weight: 950;
          transition: transform 170ms ease, filter 170ms ease;
        }

        .fcc-ai-notice-actions button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .fcc-ai-notice-actions .primary {
          color: #ffffff;
          background: linear-gradient(135deg, #8b5cf6, #6d4aff);
          border: 1px solid color-mix(in srgb, #8b5cf6 65%, white);
        }

        .time .fcc-ai-notice-actions .primary {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-color: color-mix(in srgb, #f59e0b 65%, white);
        }

        .fcc-ai-notice-actions .secondary {
          color: var(--fcc-premium-text, #10213f);
          background: var(--fcc-premium-surface-strong, #ffffff);
          border: 1px solid var(--fcc-premium-border, rgba(37, 99, 235, 0.18));
        }

        @media (max-width: 520px) {
          .fcc-ai-notice {
            padding: 14px;
          }

          .fcc-ai-notice-card {
            border-radius: 22px;
          }

          .fcc-ai-notice-actions {
            width: 100%;
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}
