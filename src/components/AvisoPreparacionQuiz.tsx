"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BookOpenCheck, X } from "lucide-react";

export type TemaPreparacionQuiz = {
  id: string;
  titulo: string;
};

type AvisoPreparacionQuizProps = {
  open: boolean;
  temas: TemaPreparacionQuiz[];
  onCancelar: () => void;
  onContinuar: () => void;
};

export default function AvisoPreparacionQuiz({
  open,
  temas,
  onCancelar,
  onContinuar,
}: AvisoPreparacionQuizProps) {
  useEffect(() => {
    if (!open) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="quiz-preparacion-overlay fcc-modal-backdrop-enter-standard">
      <style>{`
        .quiz-preparacion-overlay {
          position: fixed;
          inset: 0;
          z-index: 10030;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          background: color-mix(in srgb, #06152f 60%, transparent);
          backdrop-filter: blur(8px);
        }

        .quiz-preparacion-modal {
          position: relative;
          width: min(590px, 100%);
          padding: 30px;
          border-radius: 26px;
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface);
          border: 1px solid var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow);
        }

        .quiz-preparacion-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 999px;
          color: white;
          background: #ef4444;
          cursor: pointer;
        }

        .quiz-preparacion-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          border-radius: 18px;
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent);
        }

        .quiz-preparacion-modal h2 {
          margin: 0 46px 8px;
          text-align: center;
          font-size: clamp(1.35rem, 3vw, 1.85rem);
        }

        .quiz-preparacion-modal > p {
          margin: 0;
          text-align: center;
          line-height: 1.6;
          color: var(--fcc-premium-muted);
        }

        .quiz-preparacion-lista {
          display: grid;
          gap: 8px;
          margin: 20px 0;
          padding: 0;
          list-style: none;
        }

        .quiz-preparacion-lista li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 13px;
          border-radius: 13px;
          font-weight: 700;
          background: var(--fcc-premium-surface-soft);
          border: 1px solid var(--fcc-premium-border);
        }

        .quiz-preparacion-lista li::before {
          content: "";
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: var(--fcc-premium-accent);
        }

        .quiz-preparacion-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        @media (max-width: 560px) {
          .quiz-preparacion-overlay { padding: 10px; }
          .quiz-preparacion-modal { padding: 24px 18px 20px; }
          .quiz-preparacion-actions { flex-direction: column-reverse; }
          .quiz-preparacion-actions button { width: 100%; }
        }
      `}</style>

      <div className="quiz-preparacion-modal fcc-modal-enter-standard">
        <button
          type="button"
          className="quiz-preparacion-close"
          onClick={onCancelar}
          aria-label="Cerrar aviso"
        >
          <X size={20} strokeWidth={2.6} />
        </button>

        <div className="quiz-preparacion-icon" aria-hidden="true">
          <BookOpenCheck size={30} strokeWidth={2.2} />
        </div>

        <h2>Antes de responder</h2>
        <p>
          Para responder este quiz se recomienda haber revisado el contenido de
          los siguientes temas:
        </p>

        <ul className="quiz-preparacion-lista">
          {temas.map((tema) => (
            <li key={tema.id}>{tema.titulo}</li>
          ))}
        </ul>

        <p>
          Es una recomendación. Puedes volver al curso para estudiarlos o iniciar
          el quiz ahora.
        </p>

        <div className="quiz-preparacion-actions">
          <button
            type="button"
            className="quiz-secondary-button"
            onClick={onCancelar}
          >
            Volver al quiz
          </button>
          <button
            type="button"
            className="quiz-primary-button"
            onClick={onContinuar}
          >
            Iniciar de todos modos
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
