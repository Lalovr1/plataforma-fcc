/**
 * Página de ranking por curso (profesor):
 * - Verifica que el profesor sea dueño del curso.
 * - Muestra el componente <RankingCurso /> con filtros por período y sección
 *   y dos rankings: Progreso general y por Quiz.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import RankingCurso from "@/components/RankingCurso";

type CursoRanking = {
  id: string;
  nombre: string;
};

const CACHE_KEY_BASE = "fcc_academy_ranking_curso_profesor_v1";

function getCacheKey(usuarioId: string, cursoId: string) {
  return `${CACHE_KEY_BASE}_${usuarioId}_${cursoId}`;
}

function guardarCache(usuarioId: string, cursoId: string, curso: CursoRanking) {
  try {
    sessionStorage.setItem(
      getCacheKey(usuarioId, cursoId),
      JSON.stringify({
        timestamp: Date.now(),
        curso,
      })
    );
  } catch {}
}

function leerCache(usuarioId: string, cursoId: string): CursoRanking | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(usuarioId, cursoId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.curso?.id || !parsed?.curso?.nombre) return null;

    return parsed.curso;
  } catch {
    return null;
  }
}

export default function RankingCursoPage() {
  const params = useParams();
  const router = useRouter();

  const id = typeof params?.id === "string" ? params.id : "";

  const [curso, setCurso] = useState<CursoRanking | null>(null);
  const [filtroMatricula, setFiltroMatricula] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useLayoutEffect(() => {
    if (!id) return;

    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerCache(usuarioLocal, id);
    if (!cache) return;

    setCurso(cache);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      try {
        const usuarioLocal = localStorage.getItem("user_id");

        if (usuarioLocal) {
          const cache = leerCache(usuarioLocal, id);

          if (cache) {
            setCurso(cache);
            setCargando(false);
          }
        }

        const [
          {
            data: { user },
          },
          { data: materia, error: materiaError },
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("materias")
            .select("id, nombre, profesor_id")
            .eq("id", id)
            .single(),
        ]);

        if (materiaError || !materia) {
          toast.error("No se pudo cargar el curso");
          router.push("/dashboard/profesor");
          return;
        }

        if (!user || user.id !== materia.profesor_id) {
          toast.error("No tienes permiso para ver este ranking");
          router.push("/dashboard/profesor");
          return;
        }

        const cursoData = {
          id: materia.id,
          nombre: materia.nombre,
        };

        setCurso(cursoData);
        guardarCache(user.id, id, cursoData);
      } catch (e) {
        console.error("Error cargando ranking del curso:", e);
        toast.error("No se pudo cargar el ranking del curso");
        router.push("/dashboard/profesor");
      } finally {
        setCargando(false);
      }
    };

    run();
  }, [id, router]);

  const estilos = (
    <style>{`
      .ranking-curso-page {
        --ranking-accent: var(--fcc-premium-accent);
        --ranking-accent-hover: var(--fcc-premium-accent-hover);
        --ranking-cyan: var(--fcc-premium-cyan);
        --ranking-surface: var(--fcc-premium-surface);
        --ranking-surface-soft: var(--fcc-premium-surface-soft);
        --ranking-surface-strong: var(--fcc-premium-surface-strong);
        --ranking-text: var(--fcc-premium-text);
        --ranking-text-soft: var(--fcc-premium-text-soft);
        --ranking-muted: var(--fcc-premium-muted);
        --ranking-border: var(--fcc-premium-border);
        --ranking-border-strong: var(--fcc-premium-border-strong);
        --ranking-shadow: var(--fcc-premium-shadow);
        --ranking-shadow-soft: var(--fcc-premium-shadow-soft);
        --ranking-button: var(--fcc-premium-button);

        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .ranking-curso-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--ranking-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--ranking-surface) 96%, transparent),
            color-mix(in srgb, var(--ranking-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--ranking-accent) 14%, var(--ranking-border));
        box-shadow:
          var(--ranking-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--ranking-surface-strong) 65%, transparent);
      }

      .ranking-curso-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--ranking-accent) 7%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 24%,
            color-mix(in srgb, var(--ranking-accent) 5%, transparent) 24% 24.35%,
            transparent 24.35% 100%
          );
        opacity: 0.68;
      }

      .ranking-curso-card.no-line::before {
        content: none;
      }

      .ranking-curso-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
      }

      .ranking-curso-header {
        padding: 24px;
      }

      .ranking-curso-header-content {
        position: relative;
        display: grid;
        justify-items: center;
        gap: 8px;
        text-align: center;
        min-width: 0;
      }

      .ranking-curso-back {
        position: absolute;
        left: 0;
        top: 0;
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 999px;
        padding: 0 15px;
        color: var(--ranking-accent);
        background: color-mix(in srgb, var(--ranking-surface-strong) 82%, transparent);
        border: 1px solid color-mix(in srgb, var(--ranking-accent) 24%, var(--ranking-border));
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .ranking-curso-back:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--ranking-accent) 42%, var(--ranking-border));
        background: color-mix(in srgb, var(--ranking-accent) 8%, var(--ranking-surface-strong));
      }

      .ranking-curso-icon {
        position: absolute;
        right: 0;
        top: 50%;
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        border-radius: 20px;
        color: color-mix(in srgb, #f59e0b 54%, var(--ranking-accent));
        background:
          radial-gradient(
            circle,
            color-mix(in srgb, #f59e0b 13%, var(--ranking-surface-strong)),
            color-mix(in srgb, var(--ranking-surface-strong) 84%, transparent)
          );
        border: 1px solid color-mix(in srgb, #f59e0b 28%, var(--ranking-border));
        transform: translateY(-50%);
      }

      .ranking-curso-eyebrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--ranking-accent);
        font-size: 0.74rem;
        font-weight: 950;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .ranking-curso-eyebrow::before,
      .ranking-curso-eyebrow::after {
        content: "";
        width: 36px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--ranking-accent) 62%, transparent)
        );
      }

      .ranking-curso-eyebrow::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--ranking-accent) 62%, transparent),
          transparent
        );
      }

      .ranking-curso-title {
        max-width: 900px;
        color: var(--ranking-text);
        font-size: clamp(1.75rem, 3.4vw, 2.75rem);
        font-weight: 950;
        line-height: 0.98;
        letter-spacing: -0.06em;
        text-wrap: balance;
      }

      .ranking-curso-description {
        max-width: 700px;
        color: var(--ranking-muted);
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.38;
      }

      .ranking-curso-search-card {
        padding: 16px;
      }

      .ranking-curso-search-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 10px;
        align-items: center;
      }

      .ranking-curso-input {
        min-height: 44px;
        width: 100%;
        border-radius: 14px;
        padding: 0 13px;
        color: var(--ranking-text);
        background: color-mix(in srgb, var(--ranking-surface-strong) 74%, transparent);
        border: 1px solid var(--ranking-border);
        outline: none;
        font-size: 0.92rem;
        font-weight: 750;
        transition:
          border-color 170ms ease,
          background 170ms ease;
      }

      .ranking-curso-input:focus {
        border-color: color-mix(in srgb, var(--ranking-accent) 56%, var(--ranking-border));
        background: color-mix(in srgb, var(--ranking-surface-strong) 90%, transparent);
      }

      .ranking-curso-button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        padding: 0 16px;
        color: #ffffff;
        background: var(--ranking-button);
        border: 1px solid transparent;
        font-size: 0.92rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .theme-oscuro .ranking-curso-button {
        color: #050505;
      }

      .ranking-curso-button:hover {
        transform: translateY(-1px);
      }

      .ranking-curso-button.secondary {
        color: var(--ranking-text);
        background: color-mix(in srgb, var(--ranking-surface-strong) 82%, transparent);
        border-color: var(--ranking-border);
      }

      .ranking-curso-content {
        min-width: 0;
      }

      .ranking-curso-empty {
        min-height: 60dvh;
        display: grid;
        place-items: center;
      }

      .ranking-curso-empty-text {
        color: var(--color-danger);
        font-weight: 850;
        text-align: center;
      }

      .ranking-curso-skeleton {
        animation: rankingCursoPulse 1.35s ease-in-out infinite;
      }

      .ranking-curso-skeleton-block {
        border-radius: 16px;
        background: color-mix(in srgb, var(--ranking-border-strong) 28%, transparent);
      }

      @keyframes rankingCursoPulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }

      @media (max-width: 760px) {
        .ranking-curso-header {
          padding: 18px 16px;
        }

        .ranking-curso-header-content {
          padding-top: 0;
          gap: 7px;
        }

        .ranking-curso-back {
          left: 0;
          top: 0;
          min-height: 36px;
          padding: 0 13px;
          font-size: 0.84rem;
        }

        .ranking-curso-icon {
          position: static;
          width: 52px;
          height: 52px;
          transform: none;
        }

        .ranking-curso-search-form {
          grid-template-columns: 1fr;
        }

        .ranking-curso-button {
          width: 100%;
        }
      }
    `}</style>
  );

  if (cargando && !curso) {
    return (
      <LayoutGeneral rol="profesor">
        {estilos}

        <div className="ranking-curso-page">
          <section className="ranking-curso-card ranking-curso-header ranking-curso-skeleton">
            <div className="ranking-curso-card-content ranking-curso-header-content">
              <div
                className="ranking-curso-skeleton-block"
                style={{
                  width: "150px",
                  height: "16px",
                  marginBottom: 8,
                }}
              />

              <div
                className="ranking-curso-skeleton-block"
                style={{
                  width: "min(760px, 82%)",
                  height: "44px",
                }}
              />

              <div
                className="ranking-curso-skeleton-block"
                style={{
                  width: "min(540px, 72%)",
                  height: "18px",
                }}
              />
            </div>
          </section>

          <section className="ranking-curso-card ranking-curso-search-card no-line ranking-curso-skeleton">
            <div className="ranking-curso-card-content ranking-curso-search-form">
              <div
                className="ranking-curso-skeleton-block"
                style={{ height: 44 }}
              />
              <div
                className="ranking-curso-skeleton-block"
                style={{ width: 96, height: 44 }}
              />
            </div>
          </section>

          <section
            className="ranking-curso-card no-line ranking-curso-skeleton"
            style={{ minHeight: 260 }}
          />
        </div>
      </LayoutGeneral>
    );
  }

  if (!curso) {
    return (
      <LayoutGeneral rol="profesor">
        {estilos}

        <div className="ranking-curso-empty">
          <p className="ranking-curso-empty-text">Curso no disponible</p>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      {estilos}

      <div className="ranking-curso-page">
        <section className="ranking-curso-card ranking-curso-header">
          <div className="ranking-curso-card-content ranking-curso-header-content">
            <Link
              href={`/dashboard/profesor/cursos/${id}/editar`}
              className="ranking-curso-back"
            >
              <ArrowLeft size={17} strokeWidth={2.8} aria-hidden="true" />
              <span>Volver al menú</span>
            </Link>

            <div className="ranking-curso-icon" aria-hidden="true">
              <BarChart3 size={34} strokeWidth={2.35} />
            </div>

            <p className="ranking-curso-eyebrow">Ranking del curso</p>

            <h1 className="ranking-curso-title">{curso.nombre}</h1>

            <p className="ranking-curso-description">
              Consulta el desempeño de los estudiantes inscritos en este curso.
            </p>
          </div>
        </section>

        <section className="ranking-curso-card ranking-curso-search-card no-line">
          <div className="ranking-curso-card-content">
            <form
              onSubmit={(e) => {
                e.preventDefault();

                const input = (e.currentTarget as HTMLFormElement).querySelector(
                  "input"
                );

                const matricula = input?.value?.trim() || null;
                setFiltroMatricula(matricula);
              }}
              className="ranking-curso-search-form"
            >
              <input
                type="text"
                placeholder="Buscar alumno por matrícula"
                defaultValue={filtroMatricula || ""}
                className="ranking-curso-input"
              />

              <button type="submit" className="ranking-curso-button">
                Buscar
              </button>

              {filtroMatricula && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroMatricula(null);

                    const input = document.querySelector<HTMLInputElement>(
                      'input[placeholder="Buscar alumno por matrícula"]'
                    );

                    if (input) input.value = "";
                  }}
                  className="ranking-curso-button secondary"
                >
                  Quitar filtro
                </button>
              )}
            </form>
          </div>
        </section>

        <div className="ranking-curso-content">
          <RankingCurso materiaId={curso.id} filtroMatricula={filtroMatricula} />
        </div>
      </div>
    </LayoutGeneral>
  );
}
