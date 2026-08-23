"use client";

import { CloudOff } from "lucide-react";

export default function AvisoModoRespaldo({
  mensaje = "La conexión no permitió confirmar la versión remota. Se muestra una copia local identificada como respaldo.",
}: {
  mensaje?: string;
}) {
  return (
    <div
      className="fcc-backup-notice"
      role="status"
      aria-live="polite"
    >
      <CloudOff size={18} strokeWidth={2.3} aria-hidden="true" />
      <span>{mensaje}</span>

      <style jsx>{`
        .fcc-backup-notice {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 14px;
          padding: 10px 13px;
          color: #92400e;
          background: #fffbeb;
          border: 1px solid #fbbf24;
          font-size: 0.82rem;
          font-weight: 800;
          line-height: 1.35;
          text-align: left;
        }

        :global(.theme-oscuro) .fcc-backup-notice {
          color: #fde68a;
          background: rgba(120, 53, 15, 0.42);
          border-color: rgba(251, 191, 36, 0.48);
        }
      `}</style>
    </div>
  );
}
