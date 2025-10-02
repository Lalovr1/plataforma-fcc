/**
 * Página de profesor para explorar y buscar todos los cursos públicos.
 */

"use client";

import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(false);

  const fetchCursos = async (nombre?: string) => {
    setLoading(true);
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
    if (!error && data) setCursos(data as Materia[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCursos();
  }, [filters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCursos(searchTerm.trim());
  };

  const filtered = cursos.filter((m) => {
    const bySemestre = filters.semestre_id
      ? m.curso_carreras?.some((cc) => cc.semestre === filters.semestre_id)
      : true;

    const byCarrera = filters.carrera_id
      ? m.curso_carreras?.some((cc) => cc.carrera?.id === filters.carrera_id)
      : true;

    const byPeriodo = filters.periodo
      ? m.curso_carreras?.some((cc) =>
          cc.curso_periodos?.some(
            (p) => `${p.nombre} ${p.anio}` === filters.periodo
          )
        )
      : true;

    return bySemestre && byCarrera && byPeriodo;
  });

  const grouped: Record<string, Materia[]> = {};
  if (filters.groupBy !== "none") {
    filtered.forEach((c) => {
      if (filters.groupBy === "semestre") {
        c.curso_carreras.forEach((cc) => {
          const key = `📘 Semestre ${cc.semestre}`;
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

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-heading)" }}
        >
          Todos los Cursos
        </h1>

        <form onSubmit={handleSearch} className="flex gap-2">
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
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
          >
            Buscar
          </button>
        </form>

        <FiltrosCursos filters={filters} setFilters={setFilters} />

        {loading ? (
          <p style={{ color: "var(--color-muted)" }}>Cargando...</p>
        ) : filters.groupBy === "none" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...filtered]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((c) => (
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
              ))}
          </div>
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
                      .map((c) => (
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
                            Profesor:{" "}
                            {c.profesor?.nombre ?? "Aún no hay profesor asignado"}
                          </p>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}
