import { Gauge } from "lucide-react";

interface BarraXPProps {
  xp?: number;
}

export default function BarraXP({ xp = 0 }: BarraXPProps) {
  const level = Math.floor(xp / 500);
  const currentXP = xp % 500;
  const progress = xp === 0 ? 0 : (currentXP / 500) * 100;
  const xpToNextLevel = 500 - currentXP;

  return (
    <>
      <style>{`
        .fcc-xp-card {
          --fcc-xp-text: var(--fcc-premium-text);
          --fcc-xp-muted: var(--fcc-premium-text-soft);
          --fcc-xp-accent: var(--fcc-premium-accent);
          --fcc-xp-cyan: var(--fcc-premium-cyan);

          position: relative;
          overflow: hidden;
          border-radius: 28px;
          min-height: 166px;
          padding: 17px 20px 18px;
          background:
            radial-gradient(
              circle at 8% 10%,
              color-mix(in srgb, var(--fcc-xp-cyan) 9%, transparent),
              transparent 29%
            ),
            linear-gradient(
              126deg,
              transparent 0 65%,
              color-mix(in srgb, var(--fcc-xp-cyan) 5%, transparent) 65% 69%,
              transparent 69% 75%,
              color-mix(in srgb, var(--fcc-xp-accent) 4%, transparent) 75% 78%,
              transparent 78% 100%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 72%,
              transparent
            );
          color: var(--fcc-xp-text);
        }

        .fcc-xp-card::before {
          content: "";
          position: absolute;
          right: 18px;
          bottom: 15px;
          width: 92px;
          height: 58px;
          pointer-events: none;
          opacity: 0.52;
          background-image: radial-gradient(
            circle,
            color-mix(in srgb, var(--fcc-xp-accent) 24%, transparent) 1.2px,
            transparent 1.55px
          );
          background-size: 8px 8px;
          mask-image: linear-gradient(135deg, transparent, black 34%, black 100%);
        }

        .fcc-xp-card::after {
          content: "";
          position: absolute;
          right: 3%;
          bottom: 2%;
          width: 130px;
          height: 130px;
          border-radius: 999px;
          pointer-events: none;
          background: radial-gradient(
            circle,
            color-mix(in srgb, var(--fcc-xp-cyan) 8%, transparent),
            color-mix(in srgb, var(--fcc-xp-accent) 3%, transparent) 44%,
            transparent 70%
          );
          filter: blur(18px);
          opacity: 0.68;
        }

        .fcc-xp-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 14px;
          text-align: center;
        }

        .fcc-xp-header::before,
        .fcc-xp-header::after {
          content: "";
          width: 38px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--fcc-xp-accent) 50%, transparent)
          );
        }

        .fcc-xp-header::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--fcc-xp-accent) 50%, transparent),
            transparent
          );
        }

        .fcc-xp-title-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--fcc-xp-accent);
          background: color-mix(in srgb, var(--fcc-xp-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-xp-accent) 18%, transparent);
          box-shadow: inset 0 1px 0 color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 90%,
            transparent
          );
          flex: 0 0 auto;
        }

        .fcc-xp-title {
          color: var(--fcc-xp-text);
          font-size: clamp(1.08rem, 1.5vw, 1.28rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .fcc-xp-content {
          position: relative;
          z-index: 2;
          min-width: 0;
        }

        .fcc-xp-level-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
        }

        .fcc-xp-level {
          margin: 0;
          color: var(--fcc-xp-muted);
          font-size: 0.86rem;
          font-weight: 850;
        }

        .fcc-xp-level-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 42px;
          min-height: 24px;
          border-radius: 999px;
          padding-inline: 9px;
          color: var(--fcc-xp-accent);
          background: color-mix(in srgb, var(--fcc-xp-accent) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-xp-accent) 14%, transparent);
          font-size: 0.7rem;
          font-weight: 950;
          letter-spacing: 0.04em;
        }

        .fcc-xp-track {
          position: relative;
          width: 100%;
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--fcc-premium-muted) 18%, transparent),
            color-mix(in srgb, var(--fcc-premium-muted) 11%, transparent)
          );
          box-shadow:
            inset 0 1px 3px color-mix(in srgb, var(--fcc-premium-text) 9%, transparent),
            0 8px 18px color-mix(in srgb, var(--fcc-xp-accent) 4%, transparent);
        }

        .fcc-xp-fill {
          position: relative;
          height: 100%;
          min-width: 0;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            var(--fcc-xp-accent),
            color-mix(in srgb, var(--fcc-xp-cyan) 78%, var(--fcc-xp-accent))
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.26),
            0 0 10px color-mix(in srgb, var(--fcc-xp-accent) 18%, transparent);
          transition: width 420ms ease;
        }

        .fcc-xp-fill::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.24), transparent 56%);
          pointer-events: none;
        }

        .fcc-xp-lower {
          margin-top: 13px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 52px;
          align-items: end;
          gap: 14px;
        }

        .fcc-xp-details {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .fcc-xp-detail {
          color: var(--fcc-xp-muted);
          font-size: 0.86rem;
          font-weight: 750;
          line-height: 1.2;
        }

        .fcc-xp-detail strong {
          color: var(--fcc-xp-accent);
          font-weight: 950;
        }

        .fcc-xp-insignia {
          position: relative;
          z-index: 2;
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          justify-self: end;
          opacity: 0.62;
          pointer-events: none;
        }

        .fcc-xp-insignia-frame {
          position: absolute;
          inset: 6px;
          border-radius: 15px;
          transform: rotate(45deg);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--fcc-premium-surface-strong) 82%, transparent),
            color-mix(in srgb, var(--fcc-premium-surface-soft) 58%, transparent)
          );
          border: 1px solid color-mix(in srgb, var(--fcc-xp-accent) 18%, transparent);
          box-shadow:
            0 10px 20px color-mix(in srgb, var(--fcc-xp-accent) 6%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
        }

        .fcc-xp-insignia-frame::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 10px;
          border: 1px solid color-mix(in srgb, var(--fcc-xp-cyan) 18%, transparent);
        }

        .fcc-xp-insignia-slot {
          position: relative;
          z-index: 2;
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            color-mix(in srgb, var(--fcc-xp-cyan) 9%, transparent),
            transparent 68%
          );
          color: color-mix(in srgb, var(--fcc-xp-accent) 62%, transparent);
          font-size: 0.62rem;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        @media (max-width: 520px) {
          .fcc-xp-card {
            padding: 16px;
          }

          .fcc-xp-lower {
            grid-template-columns: 1fr;
          }

          .fcc-xp-insignia {
            display: none;
          }
        }
      `}</style>

      <section className="fcc-xp-card">
        <div className="fcc-xp-header">
          <span className="fcc-xp-title-icon" aria-hidden="true">
            <Gauge size={16} strokeWidth={2.2} />
          </span>
          <h3 className="fcc-xp-title">Experiencia</h3>
        </div>

        <div className="fcc-xp-content">
          <div className="fcc-xp-level-row">
            <p className="fcc-xp-level">Nivel {level}</p>
            <span className="fcc-xp-level-pill">LV {level}</span>
          </div>

          <div
            className="fcc-xp-track"
            aria-label={`Progreso ${currentXP} de 500 XP`}
          >
            <div
              className="fcc-xp-fill"
              style={{
                width: `${progress}%`,
                minWidth: progress > 0 ? "8px" : "0",
              }}
            />
          </div>

          <div className="fcc-xp-lower">
            <div className="fcc-xp-details">
              <p className="fcc-xp-detail">
                XP actual: <strong>{currentXP}</strong> / 500
              </p>

              <p className="fcc-xp-detail">
                Siguiente nivel en <strong>{xpToNextLevel} XP</strong>
              </p>
            </div>

            <div className="fcc-xp-insignia" aria-hidden="true">
              <span className="fcc-xp-insignia-frame" />
              <span className="fcc-xp-insignia-slot">LV</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
