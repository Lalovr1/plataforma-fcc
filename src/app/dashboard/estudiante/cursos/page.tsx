/**
 * Página de cursos: muestra listado de materias disponibles,
 * con buscador, filtros y vista en cuadrícula.
 */

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import FiltrosCursos from "@/components/FiltrosCursos";
import LayoutGeneral from "@/components/LayoutGeneral";
import CuadriculaCursos from "@/components/CuadriculaCursos";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";

interface CursoPeriodo {
  id: string;
  nombre: string;
  anio: number;
}

interface CursoCarrera {
  id: string;
  semestre: number;
  area: string;
  carrera: { id: number; nombre: string } | null;
  curso_periodos: CursoPeriodo[];
}

interface ProgresoEstado {
  exists: boolean;
  visible: boolean;
}

interface Materia {
  id: string;
  nombre: string;
  visible: boolean;
  profesor: { id: string; nombre: string } | null;
  curso_carreras: CursoCarrera[];
  yaInscrito?: boolean;
  progresoEstado?: ProgresoEstado;
}

export default function CursosPage() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [filters, setFilters] = useState({
    semestre_id: null as number | null,
    area: null as string | null,
    carrera_id: null as number | null,
    periodo: null as string | null,
    groupBy: "none",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);

  const cargarMaterias = async (usuarioId: string, nombre?: string) => {
    let query = supabase
      .from("materias")
      .select(
        `
        id,
        nombre,
        visible,
        profesor:usuarios (id, nombre),
        curso_carreras (
          id,
          semestre,
          area,
          carrera:carreras (id, nombre),
          curso_periodos (
            id,
            nombre,
            anio
          )
        )
      `
      )
      .eq("visible", true);

    if (nombre) {
      query = query.ilike("nombre", `%${nombre}%`);
    }

    const [
      { data: materiasData, error: materiasError },
      { data: progresoRows, error: progresoError },
    ] = await Promise.all([
        query,
        supabase
          .from("progreso")
          .select("materia_id, visible")
          .eq("usuario_id", usuarioId),
      ]);

    if (materiasError || progresoError) {
      throw materiasError ?? progresoError;
    }

    const progresoPorMateria = new Map<string, { visible: boolean }>();

    progresoRows?.forEach((row: any) => {
      progresoPorMateria.set(row.materia_id, {
        visible: Boolean(row.visible),
      });
    });

    const conEstado = ((materiasData as Materia[]) ?? []).map((m) => {
      const progreso = progresoPorMateria.get(m.id);

      return {
        ...m,
        yaInscrito: Boolean(progreso),
        progresoEstado: progreso
          ? { exists: true, visible: progreso.visible }
          : { exists: false, visible: false },
      };
    });

    setMaterias(conEstado);

  };

  useEffect(() => {
    const init = async () => {
      setCargandoInicial(true);
      setErrorCarga(false);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) throw authError ?? new Error("Sesión no disponible");

        setUserId(user.id);

        await cargarMaterias(user.id);
      } catch (e) {
        console.error("Error inicializando cursos:", e);
        setMaterias([]);
        setErrorCarga(true);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
  }, [reintento]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) return;

    setBuscando(true);
    setCargandoInicial(true);
    setErrorCarga(false);

    try {
      await cargarMaterias(userId, searchTerm.trim());
    } catch (error) {
      console.error("Error buscando cursos:", error);
      setErrorCarga(true);
    } finally {
      setBuscando(false);
      setCargandoInicial(false);
    }
  };

  const filtered = materias.filter((m) => {
    const bySemestre = filters.semestre_id
      ? m.curso_carreras?.some(
          (cc) => Number(cc.semestre) === Number(filters.semestre_id)
        )
      : true;

    const byCarrera = filters.carrera_id
      ? m.curso_carreras?.some(
          (cc) => Number(cc.carrera?.id) === Number(filters.carrera_id)
        )
      : true;

    const byPeriodo = filters.periodo
      ? m.curso_carreras?.some((cc) =>
          cc.curso_periodos?.some(
            (p) => `${p.nombre} ${p.anio}` === String(filters.periodo)
          )
        )
      : true;

    const byArea = filters.area
      ? m.curso_carreras?.some((cc) => String(cc.area) === String(filters.area))
      : true;

    return bySemestre && byCarrera && byPeriodo && byArea;
  });

  if (cargandoInicial) {
    return (
      <LayoutGeneral rol="estudiante">
        <CargadorFCC
          mensaje="Actualizando cursos"
          detalle="Confirmando catálogo, filtros e inscripciones vigentes…"
        />
      </LayoutGeneral>
    );
  }

  if (errorCarga) {
    return (
      <LayoutGeneral rol="estudiante">
        <EstadoErrorCargaFCC
          titulo="No se pudieron confirmar los cursos"
          detalle="El catálogo anterior no se mostró como si estuviera vigente."
          onRetry={() => setReintento((valor) => valor + 1)}
        />
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .cursos-estudiante-page {
          --fcc-cursos-page-bg:
            radial-gradient(
              circle at 88% 10%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );

          --fcc-cursos-page-card-bg:
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

          --fcc-cursos-page-border: var(--fcc-premium-border);
          --fcc-cursos-page-heading:
            var(--fcc-premium-heading, var(--color-heading));
          --fcc-cursos-page-text:
            var(--fcc-premium-text, var(--color-text));
          --fcc-cursos-page-muted:
            var(--fcc-premium-text-muted, var(--color-muted));
          --fcc-cursos-page-accent: var(--fcc-premium-accent);

          color: var(--fcc-cursos-page-text);
        }

        .cursos-estudiante-hero {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 16px 20px;
          background: var(--fcc-cursos-page-bg);
          border: 1px solid var(--fcc-cursos-page-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .cursos-estudiante-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              125deg,
              transparent 0 78%,
              color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent) 78.3% 78.9%,
              transparent 79.2%
            ),
            linear-gradient(
              125deg,
              transparent 0 87%,
              color-mix(in srgb, var(--fcc-premium-cyan) 7%, transparent) 87.2% 87.8%,
              transparent 88.1%
            );
          opacity: 0.75;
        }

        .cursos-estudiante-hero::after {
          content: "";
          position: absolute;
          right: -18px;
          bottom: -30px;
          width: 220px;
          height: 130px;
          pointer-events: none;
          background:
            linear-gradient(
              color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent) 1px,
              transparent 1px
            );
          background-size: 24px 24px;
          mask-image: radial-gradient(circle at center, black, transparent 72%);
          opacity: 0.6;
        }

        .cursos-estudiante-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .cursos-estudiante-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--fcc-cursos-page-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .cursos-estudiante-kicker::before,
        .cursos-estudiante-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--fcc-cursos-page-accent);
        }

        .cursos-estudiante-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--fcc-cursos-page-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .cursos-estudiante-hero {
            padding: 14px 16px;
          }

          .cursos-estudiante-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .cursos-estudiante-description {
            font-size: 0.86rem;
          }
        }

        .cursos-estudiante-search-panel,
        .cursos-estudiante-filters-panel,
        .cursos-estudiante-content-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background: var(--fcc-cursos-page-bg);
          border: 1px solid var(--fcc-cursos-page-border);
          box-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .cursos-estudiante-search-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .cursos-estudiante-search-form {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cursos-estudiante-input {
          min-height: 46px;
          width: 100%;
          border-radius: 16px;
          padding: 0 16px;
          color: var(--fcc-cursos-page-text);
          background:
            color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 76%,
              transparent
            );
          border: 1px solid color-mix(
            in srgb,
            var(--fcc-premium-accent) 18%,
            var(--fcc-cursos-page-border)
          );
          outline: none;
          font-size: 0.94rem;
          font-weight: 750;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .cursos-estudiante-input::placeholder {
          color: var(--fcc-cursos-page-muted);
          opacity: 0.78;
        }

        .cursos-estudiante-input:focus {
          border-color: color-mix(
            in srgb,
            var(--fcc-premium-accent) 58%,
            var(--fcc-cursos-page-border)
          );
          box-shadow: 0 0 0 4px
            color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
        }

        .cursos-estudiante-search-button {
          min-height: 46px;
          border-radius: 16px;
          padding: 0 20px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--fcc-premium-accent),
            color-mix(in srgb, var(--fcc-premium-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
          font-size: 0.94rem;
          font-weight: 900;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .theme-oscuro .cursos-estudiante-search-button {
          color: #050505;
        }

        .cursos-estudiante-search-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow: 0 16px 30px
            color-mix(in srgb, var(--fcc-premium-accent) 30%, transparent);
        }

        .cursos-estudiante-search-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .cursos-estudiante-filters-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .cursos-estudiante-content-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .cursos-estudiante-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
          gap: 16px;
        }

        .cursos-estudiante-skeleton-card {
          border-radius: 24px;
          padding: 20px;
          min-height: 150px;
          background: var(--fcc-cursos-page-card-bg);
          border: 1px solid var(--fcc-cursos-page-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .cursos-estudiante-skeleton-line {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-accent) 16%,
            var(--fcc-premium-surface-strong)
          );
        }

        .cursos-estudiante-empty {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 28px 18px;
          background: var(--fcc-cursos-page-card-bg);
          border: 1px dashed color-mix(
            in srgb,
            var(--fcc-premium-accent) 34%,
            transparent
          );
        }

        .cursos-estudiante-empty-text {
          max-width: 470px;
          color: var(--fcc-cursos-page-muted);
          font-size: 0.96rem;
          line-height: 1.5;
          font-weight: 750;
        }

        @media (min-width: 640px) {
          .cursos-estudiante-search-form {
            flex-direction: row;
          }

          .cursos-estudiante-search-button {
            min-width: 132px;
          }
        }
      `}</style>

      <div className="cursos-estudiante-page space-y-4 md:space-y-6 min-w-0">
        <section className="cursos-estudiante-hero">
          <div className="cursos-estudiante-hero-inner">
            <p className="cursos-estudiante-kicker">Cursos disponibles</p>

            <p className="cursos-estudiante-description">
              Busca materias, filtra resultados y agrega a tu inicio las que quieras seguir.
            </p>
          </div>
        </section>

        <section className="cursos-estudiante-search-panel">
          <form
            onSubmit={handleSearch}
            className="cursos-estudiante-search-form"
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar curso por nombre"
              className="cursos-estudiante-input"
            />

            <button
              type="submit"
              disabled={buscando || !userId}
              className="cursos-estudiante-search-button"
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </form>
        </section>

        <section className="cursos-estudiante-filters-panel">
          <FiltrosCursos
            filters={filters}
            setFilters={setFilters}
            materias={materias}
          />
        </section>

        <section className="cursos-estudiante-content-panel">
          {cargandoInicial ? (
            <div className="cursos-estudiante-skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="cursos-estudiante-skeleton-card animate-pulse"
                >
                  <div className="cursos-estudiante-skeleton-line h-5 w-3/4 mb-4" />
                  <div className="cursos-estudiante-skeleton-line h-3 w-full mb-3" />
                  <div className="cursos-estudiante-skeleton-line h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="cursos-estudiante-empty">
              <p className="cursos-estudiante-empty-text">
                No hay cursos para los filtros seleccionados. Prueba limpiando
                algún filtro o buscando con otro nombre.
              </p>
            </div>
          ) : (
            <CuadriculaCursos
              materias={filtered}
              groupBy={filters.groupBy}
              userId={userId ?? ""}
            />
          )}
        </section>
      </div>
    </LayoutGeneral>
  );
}
