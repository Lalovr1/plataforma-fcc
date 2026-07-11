"use client";

/**
 * Personalización del mapa curricular.
 * Permite marcar materias cursadas/en curso, elegir optativas y guardar avance.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import LayoutGeneral from "@/components/LayoutGeneral";
import MapaCurricularICC from "@/components/MapaCurricularICC";

export default function MapaCurricularPage() {
  const searchParams = useSearchParams();
  const volverAlModalMapa = searchParams.get("volver") === "modal-mapa";
  const hrefVolver = volverAlModalMapa
    ? "/dashboard/estudiante?modal=mapa"
    : "/dashboard/estudiante";

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .curriculum-page-shell {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .curriculum-page-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: min(260px, 100%);
          min-height: 38px;
          border-radius: 16px;
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 7%, var(--fcc-premium-surface-strong));
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 20%, var(--fcc-premium-border));
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
          font-size: 0.84rem;
          font-weight: 950;
        }

        .curriculum-page-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 16px;
          background:
            radial-gradient(
              circle at 6% 0%,
              color-mix(in srgb, var(--fcc-premium-cyan) 4%, transparent),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface-strong),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            0 22px 50px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.78);
        }

        .curriculum-page-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(90deg, transparent, black 42%, transparent 86%);
          opacity: 0.2;
        }

        .curriculum-page-content {
          position: relative;
          z-index: 2;
          min-width: 0;
        }
      `}</style>

      <div className="curriculum-page-shell">
        <Link href={hrefVolver} className="curriculum-page-back">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <section className="curriculum-page-panel">
          <div className="curriculum-page-content">
            <MapaCurricularICC modo="editor" />
          </div>
        </section>
      </div>
    </LayoutGeneral>
  );
}
