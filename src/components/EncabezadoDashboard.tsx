/**
 * Encabezado del dashboard.
 * Muestra un saludo personalizado con el nombre, nivel y avatar del usuario.
 */

import Image from "next/image";

interface EncabezadoDashboardProps {
  name: string;
  level: number;
  avatarUrl?: string;
}

export default function EncabezadoDashboard({
  name,
  level,
  avatarUrl = "/avatar.png",
}: EncabezadoDashboardProps) {
  return (
    <header className="encabezado-dashboard">
      <style>{`
        .encabezado-dashboard {
          --encabezado-accent: var(--fcc-premium-accent, var(--color-accent));
          --encabezado-surface: var(--fcc-premium-surface, var(--color-card));
          --encabezado-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --encabezado-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
          --encabezado-text: var(--fcc-premium-text, var(--color-text));
          --encabezado-muted: var(--fcc-premium-muted, var(--color-muted));
          --encabezado-border: var(--fcc-premium-border, var(--color-border));

          position: relative;
          overflow: hidden;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          border-radius: 24px;
          padding: 18px 20px;
          color: var(--encabezado-text);
          background:
            radial-gradient(
              circle at 92% 10%,
              color-mix(in srgb, var(--encabezado-accent) 7%, transparent),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              var(--encabezado-surface),
              var(--encabezado-surface-soft)
            );
          border: 1px solid color-mix(in srgb, var(--encabezado-accent) 12%, var(--encabezado-border));
          box-shadow:
            var(--fcc-premium-shadow-soft, 0 18px 40px rgba(2, 8, 23, 0.12)),
            inset 0 1px 0 color-mix(in srgb, var(--encabezado-surface-strong) 68%, transparent);
        }

        .encabezado-dashboard::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at 92% 8%, black, transparent 68%);
          opacity: 0.28;
        }

        .encabezado-dashboard-info,
        .encabezado-dashboard-avatar-wrap {
          position: relative;
          z-index: 2;
        }

        .encabezado-dashboard-info {
          min-width: 0;
        }

        .encabezado-dashboard-title {
          margin: 0;
          color: var(--encabezado-text);
          font-size: clamp(1.35rem, 3vw, 1.65rem);
          font-weight: 950;
          line-height: 1.08;
          letter-spacing: -0.045em;
        }

        .encabezado-dashboard-level {
          margin: 5px 0 0;
          color: var(--encabezado-muted);
          font-size: 0.92rem;
          font-weight: 850;
        }

        .encabezado-dashboard-avatar-wrap {
          width: 52px;
          height: 52px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: color-mix(in srgb, var(--encabezado-accent) 7%, var(--encabezado-surface-strong));
          border: 1px solid color-mix(in srgb, var(--encabezado-accent) 20%, var(--encabezado-border));
          box-shadow: 0 10px 22px color-mix(in srgb, var(--encabezado-accent) 10%, transparent);
        }

        .encabezado-dashboard-avatar {
          border-radius: 999px;
          object-fit: cover;
        }

        @media (max-width: 520px) {
          .encabezado-dashboard {
            padding: 16px;
            border-radius: 22px;
          }

          .encabezado-dashboard-avatar-wrap {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>

      <div className="encabezado-dashboard-info">
        <h1 className="encabezado-dashboard-title">Bienvenido, {name}</h1>
        <p className="encabezado-dashboard-level">Nivel {level}</p>
      </div>

      <div className="encabezado-dashboard-avatar-wrap">
        <Image
          src={avatarUrl}
          alt="Avatar"
          width={40}
          height={40}
          className="encabezado-dashboard-avatar"
        />
      </div>
    </header>
  );
}
