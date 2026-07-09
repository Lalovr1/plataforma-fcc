"use client";

/**
 * Sección de cursos en el dashboard del usuario.
 * Muestra los cursos con su progreso, acceso directo y opción para quitarlos de inicio.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import Link from "next/link";
import CirculoProgreso from "@/components/CirculoProgreso";
import { ChevronRight, X } from "lucide-react";

interface Curso {
  id: string;
  name: string;
  progress: number;
  progresoId: string;
}

interface Props {
  initialCourses: Curso[];
  userId: string;
}

export default function SeccionCursos({ initialCourses, userId }: Props) {
  const [misCursos, setMisCursos] = useState<Curso[]>(initialCourses);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchCursos = async () => {
    const { data: cursos, error } = await supabase
      .from("progreso")
      .select(
        `
        id,
        progreso,
        visible,
        materia:materias ( id, nombre )
      `
      )
      .eq("usuario_id", userId)
      .eq("visible", true);

    if (error) {
      console.error("Error al traer cursos:", error.message);
      return;
    }

    if (!cursos) return;

    const mapped = cursos
      .filter((c: any) => c.materia?.id)
      .map((c: any) => ({
        id: c.materia.id,
        name: c.materia.nombre,
        progress: c.progreso,
        progresoId: c.id,
      }));

    mapped.sort((a, b) => {
      if (b.progress !== a.progress) {
        return b.progress - a.progress;
      }

      return a.name.localeCompare(b.name);
    });

    setMisCursos(mapped);
  };

  useEffect(() => {
    fetchCursos();
  }, [userId]);

  const removeCourse = async (progresoId: string) => {
    setLoadingId(progresoId);

    const { error } = await supabase
      .from("progreso")
      .update({ visible: false })
      .eq("id", progresoId);

    if (error) {
      toast.error("Error al quitar curso de inicio");
    } else {
      toast.success("Curso eliminado de inicio");
      setMisCursos((prev) => prev.filter((c) => c.progresoId !== progresoId));
    }

    setLoadingId(null);
  };

  return (
    <>
      <style>{`
        .fcc-courses-section {
          --fcc-courses-text: var(--fcc-premium-text);
          --fcc-courses-muted: var(--fcc-premium-muted);
          --fcc-courses-accent: var(--fcc-premium-accent);
          --fcc-courses-cyan: var(--fcc-premium-cyan);

          --fcc-courses-section-glow:
            color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent);
          --fcc-courses-grid-a:
            color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);
          --fcc-courses-grid-b:
            color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-courses-heading-line:
            color-mix(in srgb, var(--fcc-premium-accent) 52%, transparent);

          --fcc-course-card-bg:
            radial-gradient(
              circle at 10% 18%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          --fcc-course-card-border: var(--fcc-premium-border);
          --fcc-course-card-shadow: var(--fcc-premium-shadow-soft);
          --fcc-course-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.82);

          --fcc-course-diagonal-a:
            color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent);
          --fcc-course-diagonal-b:
            color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent);
          --fcc-course-card-grid-a:
            color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent);
          --fcc-course-card-grid-b:
            color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);

          --fcc-course-progress-bg:
            radial-gradient(
              circle,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 86%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 76%, transparent)
            );
          --fcc-course-progress-shadow:
            0 14px 26px color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
          --fcc-course-progress-inset: inset 0 1px 0 rgba(255, 255, 255, 0.76);

          --fcc-course-button-bg: var(--fcc-premium-button);
          --fcc-course-button-text: #ffffff;
          --fcc-course-button-shadow:
            color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent);
          --fcc-course-button-shadow-hover:
            color-mix(in srgb, var(--fcc-premium-accent) 26%, transparent);

          --fcc-courses-empty-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface) 84%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 92%, transparent)
            );
          --fcc-courses-empty-border:
            color-mix(in srgb, var(--fcc-premium-accent) 32%, transparent);

          position: relative;
          min-width: 0;
          overflow: hidden;
          padding: 18px 14px 18px;
        }

        .theme-oscuro .fcc-courses-section {
          --fcc-course-card-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          --fcc-course-progress-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          --fcc-course-button-text: #050505;
        }

        .fcc-courses-section::before {
          content: "";
          position: absolute;
          right: -80px;
          bottom: -80px;
          width: 310px;
          height: 310px;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            var(--fcc-courses-section-glow),
            transparent 65%
          );
          pointer-events: none;
        }

        .fcc-courses-section::after {
          content: "";
          position: absolute;
          right: 20px;
          bottom: 20px;
          width: min(42%, 360px);
          height: 58%;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-courses-grid-a) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-courses-grid-b) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at center, black, transparent 72%);
          opacity: 0.72;
        }

        .fcc-courses-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 18px;
          text-align: center;
        }

        .fcc-courses-header::before,
        .fcc-courses-header::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--fcc-courses-heading-line)
          );
        }

        .fcc-courses-header::after {
          background: linear-gradient(
            90deg,
            var(--fcc-courses-heading-line),
            transparent
          );
        }

        .fcc-courses-title {
          color: var(--fcc-courses-text);
          font-size: clamp(1.2rem, 1.9vw, 1.5rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .fcc-courses-grid {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
          gap: 16px;
          align-items: stretch;
        }

        .fcc-course-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 24px;
          padding: clamp(18px, 2.5vw, 26px);
          min-height: 150px;
          display: flex;
          align-items: center;
          gap: clamp(16px, 2.6vw, 28px);
          background: var(--fcc-course-card-bg);
          border: 1px solid var(--fcc-course-card-border);
          box-shadow:
            var(--fcc-course-card-shadow),
            var(--fcc-course-card-inset);
          color: var(--fcc-courses-text);
        }

        .fcc-course-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              125deg,
              transparent 0 66%,
              var(--fcc-course-diagonal-a) 66.3% 66.9%,
              transparent 67.2%
            ),
            linear-gradient(
              125deg,
              transparent 0 74%,
              var(--fcc-course-diagonal-b) 74.2% 74.7%,
              transparent 75%
            );
          opacity: 0.85;
        }

        .fcc-course-card::after {
          content: "";
          position: absolute;
          right: -20px;
          bottom: -25px;
          width: 220px;
          height: 150px;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-course-card-grid-a) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-course-card-grid-b) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(circle at center, black, transparent 72%);
          opacity: 0.7;
        }

        .fcc-course-progress {
          position: relative;
          z-index: 2;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 104px;
          height: 104px;
          border-radius: 999px;
          background: var(--fcc-course-progress-bg);
          box-shadow:
            var(--fcc-course-progress-shadow),
            var(--fcc-course-progress-inset);
        }

        .fcc-course-progress > * {
          transform: scale(1.02);
        }

        .fcc-course-body {
          position: relative;
          z-index: 2;
          flex: 1;
          min-width: 0;
          padding-right: 28px;
        }

        .fcc-course-name {
          color: var(--fcc-courses-text);
          font-size: clamp(1rem, 1.45vw, 1.18rem);
          font-weight: 950;
          line-height: 1.18;
          letter-spacing: -0.03em;
          text-wrap: balance;
          word-break: break-word;
        }

        .fcc-course-progress-label {
          margin-top: 8px;
          color: var(--fcc-courses-muted);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .fcc-course-progress-label strong {
          color: var(--fcc-courses-accent);
          font-weight: 950;
        }

        .fcc-course-button {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 12px;
          padding: 0 16px;
          color: var(--fcc-course-button-text);
          font-size: 0.92rem;
          font-weight: 850;
          background: var(--fcc-course-button-bg);
          box-shadow:
            0 14px 24px var(--fcc-course-button-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            filter 180ms ease;
        }

        .fcc-course-button:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow:
            0 16px 28px var(--fcc-course-button-shadow-hover),
            inset 0 1px 0 rgba(255, 255, 255, 0.26);
        }

        .fcc-course-button svg {
          transition: transform 180ms ease;
        }

        .fcc-course-button:hover svg {
          transform: translateX(2px);
        }

        .fcc-course-remove {
          position: absolute;
          z-index: 4;
          top: 14px;
          right: 14px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #ef4444;
          background:
            color-mix(in srgb, var(--fcc-premium-surface-strong) 76%, transparent);
          border: 1px solid rgba(239, 68, 68, 0.16);
          box-shadow:
            0 10px 18px color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent);
          transition:
            background 180ms ease,
            color 180ms ease,
            transform 180ms ease,
            border-color 180ms ease;
        }

        .fcc-course-remove:hover {
          color: #dc2626;
          background: rgba(254, 242, 242, 0.95);
          border-color: rgba(239, 68, 68, 0.26);
          transform: translateY(-1px);
        }

        .fcc-course-remove:disabled {
          opacity: 0.62;
          cursor: not-allowed;
          transform: none;
        }

        .fcc-courses-empty {
          position: relative;
          z-index: 2;
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 28px 18px;
          background: var(--fcc-courses-empty-bg);
          border: 1px dashed var(--fcc-courses-empty-border);
        }

        .fcc-courses-empty-title {
          color: var(--fcc-courses-text);
          font-size: 1.05rem;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .fcc-courses-empty-text {
          max-width: 430px;
          margin-top: 6px;
          margin-bottom: 18px;
          color: var(--fcc-courses-muted);
          font-size: 0.92rem;
          line-height: 1.45;
          font-weight: 650;
        }

        .fcc-courses-empty-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 12px;
          padding: 0 16px;
          color: var(--fcc-course-button-text);
          font-size: 0.92rem;
          font-weight: 850;
          background: var(--fcc-course-button-bg);
          box-shadow: 0 14px 24px var(--fcc-course-button-shadow);
        }

        @media (max-width: 640px) {
          .fcc-courses-section {
            padding: 14px 4px 14px;
          }

          .fcc-course-card {
            flex-direction: column;
            text-align: center;
            gap: 14px;
          }

          .fcc-course-body {
            padding-right: 0;
          }

          .fcc-course-progress {
            width: 96px;
            height: 96px;
          }
        }
      `}</style>

      <section className="fcc-courses-section">
        <div className="fcc-courses-header">
          <h3 className="fcc-courses-title">Cursos</h3>
        </div>

        {misCursos.length === 0 ? (
          <div className="fcc-courses-empty">
            <p className="fcc-courses-empty-title">
              Aún no tienes cursos en tu inicio
            </p>

            <p className="fcc-courses-empty-text">
              Explora la sección de cursos para encontrar materias y agregarlas
              aquí.
            </p>

            <Link
              href="/dashboard/estudiante/cursos"
              className="fcc-courses-empty-button"
            >
              <span>Ir a cursos</span>
              <ChevronRight size={17} strokeWidth={2.4} />
            </Link>
          </div>
        ) : (
          <div className="fcc-courses-grid">
            {misCursos.map((curso) => (
              <article key={curso.id} className="fcc-course-card">
                <div className="fcc-course-progress">
                  <CirculoProgreso progress={curso.progress} size={80} />
                </div>

                <div className="fcc-course-body">
                  <p className="fcc-course-name">{curso.name}</p>

                  <p className="fcc-course-progress-label">
                    Progreso: <strong>{curso.progress}%</strong>
                  </p>

                  <Link
                    href={`/curso/${curso.id}`}
                    className="fcc-course-button"
                  >
                    <span>Entrar</span>
                    <ChevronRight size={17} strokeWidth={2.4} />
                  </Link>
                </div>

                <button
                  type="button"
                  disabled={loadingId === curso.progresoId}
                  onClick={() => removeCourse(curso.progresoId)}
                  className="fcc-course-remove"
                  aria-label={`Quitar ${curso.name} de inicio`}
                >
                  {loadingId === curso.progresoId ? (
                    <span className="text-xs font-black">...</span>
                  ) : (
                    <X size={17} strokeWidth={2.4} />
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}