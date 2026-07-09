/**
 * Página de profesor para explorar y buscar todos los cursos públicos.
 */

"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import FiltrosCursos from "@/components/FiltrosCursos";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";
import { ChevronRight, GraduationCap, UserRound } from "lucide-react";

interface CursoPeriodo {
  id: string;
  nombre: string;
  anio: number;
}

interface CursoCarrera {
  id: string;
  semestre: number;
  area: string | null;
  carrera: { id: number; nombre: string } | null;
  curso_periodos: CursoPeriodo[];
}

interface Materia {
  id: string;
  nombre: string;
  visible: boolean;
  profesor: { id: string; nombre: string } | null;
  curso_carreras: CursoCarrera[];
}

const CACHE_KEY = "fcc_academy_cursos_profesor_v1";

export default function ProfesorCursosPage() {
  const [cursos, setCursos] = useState<Materia[]>([]);
  const [filters, setFilters] = useState({
    semestre_id: null as number | null,
    area: null as string | null,
    carrera_id: null as number | null,
    periodo: null as string | null,
    groupBy: "none",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [cacheCargado, setCacheCargado] = useState(false);

  const guardarCache = (cursosData: Materia[]) => {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          cursos: cursosData,
        })
      );
    } catch {}
  };

  const leerCache = (): Materia[] | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.cursos)) return null;

      return parsed.cursos;
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    const cursosCache = leerCache();

    if (!cursosCache) return;

    setCursos(cursosCache);
    setCacheCargado(true);
    setCargandoInicial(false);
  }, []);

  const fetchCursos = async (nombre?: string) => {
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

    const { data, error } = await query;

    if (error) {
      console.error("Error cargando cursos de profesor:", error);
      return;
    }

    const cursosData = ((data as Materia[]) ?? []).map((curso) => ({
      ...curso,
      curso_carreras: curso.curso_carreras ?? [],
    }));

    setCursos(cursosData);

    if (!nombre) {
      guardarCache(cursosData);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const cursosCache = leerCache();

        if (cursosCache && !cacheCargado) {
          setCursos(cursosCache);
          setCargandoInicial(false);
        }

        await fetchCursos();
      } catch (e) {
        console.error("Error inicializando cursos de profesor:", e);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setBuscando(true);

    try {
      await fetchCursos(searchTerm.trim());
    } finally {
      setBuscando(false);
    }
  };

  const filtered = cursos.filter((m) => {
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

  const grouped: Record<string, Materia[]> = {};

  if (filters.groupBy !== "none") {
    filtered.forEach((c) => {
      if (filters.groupBy === "semestre") {
        c.curso_carreras.forEach((cc) => {
          const key = `📘 Semestre ${cc.semestre ?? "N/A"}`;
          if (!grouped[key]) grouped[key] = [];
          if (!grouped[key].some((x) => x.id === c.id)) grouped[key].push(c);
        });
      }

      if (filters.groupBy === "carrera") {
        c.curso_carreras.forEach((cc) => {
          const key = `🎓 ${cc.carrera?.nombre ?? "Carrera desconocida"}`;
          if (!grouped[key]) grouped[key] = [];
          if (!grouped[key].some((x) => x.id === c.id)) grouped[key].push(c);
        });
      }

      if (filters.groupBy === "area") {
        c.curso_carreras.forEach((cc) => {
          const key = `📂 ${cc.area ?? "Área desconocida"}`;
          if (!grouped[key]) grouped[key] = [];
          if (!grouped[key].some((x) => x.id === c.id)) grouped[key].push(c);
        });
      }

      if (filters.groupBy === "periodo") {
        c.curso_carreras.forEach((cc) => {
          cc.curso_periodos?.forEach((p) => {
            const key = `🗓️ ${p.nombre} ${p.anio}`;
            if (!grouped[key]) grouped[key] = [];
            if (!grouped[key].some((x) => x.id === c.id)) grouped[key].push(c);
          });
        });
      }
    });
  }

  const renderCursoCard = (c: Materia) => (
    <Link key={c.id} href={`/curso/${c.id}`} className="profesor-curso-card">
      <div className="profesor-curso-card-content">
        <h2 className="profesor-curso-title">{c.nombre}</h2>

        <div className="profesor-curso-meta">
          {c.curso_carreras && c.curso_carreras.length > 0 ? (
            c.curso_carreras.map((cc) => (
              <div key={cc.id} className="profesor-curso-career">
                <GraduationCap size={15} strokeWidth={2.3} />
                <span>{cc.carrera?.nombre ?? "Desconocida"}</span>
                <small>Semestre {cc.semestre ?? "N/A"}</small>
              </div>
            ))
          ) : (
            <p className="profesor-curso-muted">Sin carreras ligadas</p>
          )}

          <div className="profesor-curso-profesor">
            <UserRound size={15} strokeWidth={2.3} />
            <span>
              {c.profesor?.nombre ?? "Aún no hay profesor asignado"}
            </span>
          </div>
        </div>

        <div className="profesor-curso-action">
          <span>Ver curso</span>
          <ChevronRight size={16} strokeWidth={2.6} />
        </div>
      </div>
    </Link>
  );

  return (
    <LayoutGeneral rol="profesor">
      <style>{`
        .profesor-cursos-page {
          --profesor-cursos-text: var(--fcc-premium-text, var(--color-text));
          --profesor-cursos-heading: var(--fcc-premium-heading, var(--color-heading));
          --profesor-cursos-muted: var(--fcc-premium-muted, var(--color-muted));
          --profesor-cursos-accent: var(--fcc-premium-accent);
          --profesor-cursos-border: var(--fcc-premium-border, var(--color-border));

          color: var(--profesor-cursos-text);
        }

        .profesor-cursos-shell {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .profesor-cursos-hero,
        .profesor-cursos-search-panel,
        .profesor-cursos-filters-panel,
        .profesor-cursos-content-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesor-cursos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .profesor-cursos-hero {
          border-radius: 22px;
          padding: 16px 22px;
        }

        .profesor-cursos-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .profesor-cursos-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--profesor-cursos-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .profesor-cursos-kicker::before,
        .profesor-cursos-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--profesor-cursos-accent);
        }

        .profesor-cursos-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--profesor-cursos-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .profesor-cursos-search-panel,
        .profesor-cursos-filters-panel,
        .profesor-cursos-content-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .profesor-cursos-search-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .profesor-cursos-input {
          min-height: 46px;
          width: 100%;
          border-radius: 16px;
          padding: 0 16px;
          color: var(--profesor-cursos-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--profesor-cursos-accent) 18%,
            var(--profesor-cursos-border)
          );
          outline: none;
          font-size: 0.94rem;
          font-weight: 750;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .profesor-cursos-input::placeholder {
          color: var(--profesor-cursos-muted);
          opacity: 0.78;
        }

        .profesor-cursos-input:focus {
          border-color: color-mix(
            in srgb,
            var(--profesor-cursos-accent) 58%,
            var(--profesor-cursos-border)
          );
          box-shadow: 0 0 0 4px
            color-mix(in srgb, var(--profesor-cursos-accent) 13%, transparent);
        }

        .profesor-cursos-search-button {
          min-height: 46px;
          border-radius: 16px;
          padding: 0 20px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--profesor-cursos-accent),
            color-mix(in srgb, var(--profesor-cursos-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--profesor-cursos-accent) 24%, transparent);
          font-size: 0.94rem;
          font-weight: 900;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .theme-oscuro .profesor-cursos-search-button {
          color: #050505;
        }

        .profesor-cursos-search-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow: 0 16px 30px
            color-mix(in srgb, var(--profesor-cursos-accent) 30%, transparent);
        }

        .profesor-cursos-search-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .profesor-cursos-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: stretch;
        }

        @media (min-width: 900px) {
          .profesor-cursos-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .profesor-curso-card {
          position: relative;
          min-width: 0;
          min-height: 172px;
          overflow: hidden;
          border-radius: 24px;
          padding: 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesor-cursos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--profesor-cursos-text);
          transition:
            transform 170ms ease,
            box-shadow 170ms ease,
            border-color 170ms ease;
        }

        .profesor-curso-card:hover {
          transform: translateY(-2px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .profesor-curso-card:focus-visible {
          outline: none;
          box-shadow:
            var(--fcc-premium-shadow-hover),
            0 0 0 4px color-mix(
              in srgb,
              var(--profesor-cursos-accent) 18%,
              transparent
            );
        }

        .profesor-curso-card-content {
          position: relative;
          z-index: 2;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 11px;
          text-align: center;
        }

        .profesor-curso-title {
          width: 100%;
          margin: 0 auto;
          color: var(--profesor-cursos-heading);
          font-size: clamp(1.02rem, 1.25vw, 1.2rem);
          font-weight: 950;
          line-height: 1.15;
          letter-spacing: -0.035em;
          text-align: center;
          text-wrap: balance;
          word-break: break-word;
        }

        .profesor-curso-meta {
          width: 100%;
          display: grid;
          gap: 7px;
        }

        .profesor-curso-career,
        .profesor-curso-profesor {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex-wrap: wrap;
          color: var(--profesor-cursos-muted);
          font-size: 0.84rem;
          font-weight: 750;
          line-height: 1.25;
        }

        .profesor-curso-career svg,
        .profesor-curso-profesor svg {
          flex: 0 0 auto;
          color: var(--profesor-cursos-accent);
          opacity: 0.9;
        }

        .profesor-curso-career small {
          color: color-mix(
            in srgb,
            var(--profesor-cursos-muted) 82%,
            transparent
          );
          font-size: 0.78rem;
          font-weight: 800;
        }

        .profesor-curso-muted {
          color: var(--profesor-cursos-muted);
          font-size: 0.86rem;
          font-weight: 750;
        }

        .profesor-curso-action {
          align-self: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 34px;
          border-radius: 13px;
          padding: 0 13px;
          color: var(--profesor-cursos-accent);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 78%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--profesor-cursos-accent) 20%,
            var(--profesor-cursos-border)
          );
          font-size: 0.82rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            background 170ms ease;
        }

        .profesor-curso-card:hover .profesor-curso-action {
          transform: translateY(-1px);
          background: color-mix(
            in srgb,
            var(--profesor-cursos-accent) 10%,
            var(--fcc-premium-surface-strong)
          );
        }

        .profesor-curso-card:hover .profesor-curso-action svg {
          transform: translateX(2px);
        }

        .profesor-curso-action svg {
          transition: transform 170ms ease;
        }

        .profesor-cursos-skeleton-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 900px) {
          .profesor-cursos-skeleton-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .profesor-cursos-skeleton-card {
          min-height: 172px;
          border-radius: 24px;
          padding: 20px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesor-cursos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .profesor-cursos-skeleton-line {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--profesor-cursos-accent) 16%,
            var(--fcc-premium-surface-strong)
          );
        }

        .profesor-cursos-empty {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 28px 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px dashed color-mix(
            in srgb,
            var(--profesor-cursos-accent) 34%,
            transparent
          );
        }

        .profesor-cursos-empty-text {
          max-width: 470px;
          color: var(--profesor-cursos-muted);
          font-size: 0.96rem;
          line-height: 1.5;
          font-weight: 750;
        }

        .profesor-cursos-group-stack {
          display: grid;
          gap: 28px;
        }

        .profesor-cursos-group-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 14px;
          color: var(--profesor-cursos-heading);
          text-align: center;
          font-size: clamp(1.05rem, 1.7vw, 1.35rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .profesor-cursos-group-title::before,
        .profesor-cursos-group-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--profesor-cursos-accent) 55%, transparent)
          );
        }

        .profesor-cursos-group-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--profesor-cursos-accent) 55%, transparent),
            transparent
          );
        }

        @media (min-width: 640px) {
          .profesor-cursos-search-form {
            flex-direction: row;
          }

          .profesor-cursos-search-button {
            min-width: 132px;
          }
        }

        @media (max-width: 640px) {
          .profesor-cursos-hero {
            padding: 14px 16px;
          }

          .profesor-cursos-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .profesor-cursos-description {
            font-size: 0.86rem;
          }

          .profesor-curso-card {
            min-height: 170px;
            padding: 16px;
          }
        }
      `}</style>

      <div className="profesor-cursos-page profesor-cursos-shell">
        <section className="profesor-cursos-hero">
          <div className="profesor-cursos-hero-inner">
            <p className="profesor-cursos-kicker">Cursos disponibles</p>

            <p className="profesor-cursos-description">
              Busca materias públicas y consulta sus datos principales.
            </p>
          </div>
        </section>

        <section className="profesor-cursos-search-panel">
          <form onSubmit={handleSearch} className="profesor-cursos-search-form">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar curso por nombre"
              className="profesor-cursos-input"
            />

            <button
              type="submit"
              disabled={buscando}
              className="profesor-cursos-search-button"
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </form>
        </section>

        <section className="profesor-cursos-filters-panel">
          <FiltrosCursos
            filters={filters}
            setFilters={setFilters}
            materias={cursos}
          />
        </section>

        <section className="profesor-cursos-content-panel">
          {cargandoInicial ? (
            <div className="profesor-cursos-skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="profesor-cursos-skeleton-card animate-pulse"
                >
                  <div className="profesor-cursos-skeleton-line h-5 w-3/4 mb-4" />
                  <div className="profesor-cursos-skeleton-line h-3 w-full mb-3" />
                  <div className="profesor-cursos-skeleton-line h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="profesor-cursos-empty">
              <p className="profesor-cursos-empty-text">
                No hay cursos para los filtros seleccionados. Prueba limpiando
                algún filtro o buscando con otro nombre.
              </p>
            </div>
          ) : filters.groupBy === "none" ? (
            <div className="profesor-cursos-grid">
              {[...filtered]
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((c) => renderCursoCard(c))}
            </div>
          ) : (
            <div className="profesor-cursos-group-stack">
              {Object.keys(grouped)
                .sort()
                .map((k) => (
                  <section key={k}>
                    <h2 className="profesor-cursos-group-title">{k}</h2>

                    <div className="profesor-cursos-grid">
                      {grouped[k]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map((c) => renderCursoCard(c))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </section>
      </div>
    </LayoutGeneral>
  );
}