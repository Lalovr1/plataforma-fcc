/**
 * Página de profesor para explorar y buscar todos los cursos públicos.
 */

"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import FiltrosCursos from "@/components/FiltrosCursos";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

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
      ? m.curso_carreras?.some((cc) => Number(cc.semestre) === Number(filters.semestre_id))
      : true;

    const byCarrera = filters.carrera_id
      ? m.curso_carreras?.some((cc) => Number(cc.carrera?.id) === Number(filters.carrera_id))
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
    <Link
      key={c.id}
      href={`/curso/${c.id}`}
      className="block p-4 rounded-xl shadow transition"
      style={{
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      <h2
        className="text-lg font-semibold"
        style={{ color: "var(--color-heading)" }}
      >
        {c.nombre}
      </h2>

      {c.curso_carreras && c.curso_carreras.length > 0 ? (
        c.curso_carreras.map((cc) => (
          <p
            key={cc.id}
            className="text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Carrera: {cc.carrera?.nombre ?? "Desconocida"} — Semestre:{" "}
            {cc.semestre ?? "N/A"}
          </p>
        ))
      ) : (
        <p
          className="text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          Sin carreras ligadas
        </p>
      )}

      <p
        className="text-sm"
        style={{ color: "var(--color-muted)" }}
      >
        Profesor: {c.profesor?.nombre ?? "Aún no hay profesor asignado"}
      </p>
    </Link>
  );

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          Todos los Cursos
        </h1>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar curso por nombre"
            className="flex-1 p-2 rounded"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          />

          <button
            type="submit"
            disabled={buscando}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>

        <FiltrosCursos filters={filters} setFilters={setFilters} materias={cursos} />

        {cargandoInicial ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="rounded-xl p-4 shadow animate-pulse"
                style={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <div
                  className="h-5 rounded w-3/4 mb-3"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-3 rounded w-full mb-2"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-3 rounded w-2/3"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
              </div>
            ))}
          </div>
        ) : filters.groupBy === "none" ? (
          filtered.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>
              No hay cursos para los filtros seleccionados
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...filtered]
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((c) => renderCursoCard(c))}
            </div>
          )
        ) : (
          <div className="space-y-8">
            {Object.keys(grouped)
              .sort()
              .map((k) => (
                <div key={k}>
                  <h2
                    className="text-xl font-bold mb-4"
                    style={{ color: "var(--color-heading)" }}
                  >
                    {k}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped[k]
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((c) => renderCursoCard(c))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}