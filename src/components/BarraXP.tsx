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

          --fcc-xp-card-bg:
            radial-gradient(
              circle at 10% 12%,
              color-mix(in srgb, var(--fcc-premium-cyan) 10%, transparent),
              transparent 30%
            ),
            radial-gradient(
              circle at 92% 84%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );

          --fcc-xp-card-border: var(--fcc-premium-border);
          --fcc-xp-card-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 82%, transparent);

          --fcc-xp-grid-a:
            color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-xp-grid-b:
            color-mix(in srgb, var(--fcc-premium-accent) 3%, transparent);
          --fcc-xp-glow-a:
            color-mix(in srgb, var(--fcc-premium-cyan) 10%, transparent);
          --fcc-xp-glow-b:
            color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-xp-header-line:
            color-mix(in srgb, var(--fcc-premium-accent) 52%, transparent);

          --fcc-xp-track-bg:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--fcc-premium-muted) 20%, transparent),
              color-mix(in srgb, var(--fcc-premium-muted) 13%, transparent)
            );
          --fcc-xp-track-shadow:
            inset 0 1px 3px color-mix(in srgb, var(--fcc-premium-text) 10%, transparent),
            0 10px 20px color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);

          --fcc-xp-fill-bg: var(--fcc-premium-button);
          --fcc-xp-fill-shadow:
            color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent);

          --fcc-xp-insignia-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 78%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 52%, transparent)
            );
          --fcc-xp-insignia-border:
            color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          --fcc-xp-insignia-shadow:
            color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent);
          --fcc-xp-insignia-inner:
            color-mix(in srgb, var(--fcc-premium-cyan) 18%, transparent);
          --fcc-xp-insignia-slot-bg:
            radial-gradient(
              circle,
              color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent),
              transparent 68%
            );
          --fcc-xp-insignia-slot-text:
            color-mix(in srgb, var(--fcc-premium-accent) 50%, transparent);

          position: relative;
          overflow: hidden;
          border-radius: 28px;
          min-height: 190px;
          padding: 22px 24px;
          background: var(--fcc-xp-card-bg);
          border: 1px solid var(--fcc-xp-card-border);
          box-shadow: var(--fcc-xp-card-shadow);
          color: var(--fcc-xp-text);
        }

        .theme-oscuro .fcc-xp-card {
          --fcc-xp-card-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .fcc-xp-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-xp-grid-a) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-xp-grid-b) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at 86% 78%, black, transparent 66%);
          opacity: 0.38;
        }

        .fcc-xp-card::after {
          content: "";
          position: absolute;
          right: 7%;
          bottom: 8%;
          width: 150px;
          height: 150px;
          border-radius: 999px;
          pointer-events: none;
          background:
            radial-gradient(
              circle,
              var(--fcc-xp-glow-a),
              var(--fcc-xp-glow-b) 44%,
              transparent 68%
            );
          filter: blur(18px);
          opacity: 0.62;
        }

        .fcc-xp-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 26px;
          text-align: center;
        }

        .fcc-xp-header::before,
        .fcc-xp-header::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--fcc-xp-header-line)
          );
        }

        .fcc-xp-header::after {
          background: linear-gradient(
            90deg,
            var(--fcc-xp-header-line),
            transparent
          );
        }

        .fcc-xp-title {
          color: var(--fcc-xp-text);
          font-size: clamp(1.15rem, 1.8vw, 1.45rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .fcc-xp-content {
          position: relative;
          z-index: 2;
          min-width: 0;
        }

        .fcc-xp-level {
          color: var(--fcc-xp-muted);
          font-size: 0.95rem;
          font-weight: 850;
          margin-bottom: 14px;
        }

        .fcc-xp-track {
          position: relative;
          width: 100%;
          height: 15px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--fcc-xp-track-bg);
          box-shadow: var(--fcc-xp-track-shadow);
        }

        .fcc-xp-fill {
          position: relative;
          height: 100%;
          min-width: 0;
          border-radius: inherit;
          background: var(--fcc-xp-fill-bg);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.24),
            0 0 10px var(--fcc-xp-fill-shadow);
          transition: width 420ms ease;
        }

        .fcc-xp-fill::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.22), transparent 56%);
          pointer-events: none;
        }

        .fcc-xp-lower {
          margin-top: 20px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 64px;
          align-items: center;
          gap: 18px;
        }

        .fcc-xp-details {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .fcc-xp-detail {
          color: var(--fcc-xp-muted);
          font-size: 0.94rem;
          font-weight: 750;
        }

        .fcc-xp-detail strong {
          color: var(--fcc-xp-accent);
          font-weight: 950;
        }

        .fcc-xp-insignia {
          position: relative;
          z-index: 2;
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          justify-self: end;
          opacity: 0.48;
          pointer-events: none;
        }

        .fcc-xp-insignia-frame {
          position: absolute;
          inset: 7px;
          border-radius: 18px;
          transform: rotate(45deg);
          background: var(--fcc-xp-insignia-bg);
          border: 1px solid var(--fcc-xp-insignia-border);
          box-shadow:
            0 12px 24px var(--fcc-xp-insignia-shadow),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
        }

        .fcc-xp-insignia-frame::before {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 13px;
          border: 1px solid var(--fcc-xp-insignia-inner);
        }

        .fcc-xp-insignia-slot {
          position: relative;
          z-index: 2;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--fcc-xp-insignia-slot-bg);
          color: var(--fcc-xp-insignia-slot-text);
          font-size: 0.68rem;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        @media (max-width: 520px) {
          .fcc-xp-card {
            padding: 20px;
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
          <h3 className="fcc-xp-title">Experiencia</h3>
        </div>

        <div className="fcc-xp-content">
          <p className="fcc-xp-level">Nivel {level}</p>

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