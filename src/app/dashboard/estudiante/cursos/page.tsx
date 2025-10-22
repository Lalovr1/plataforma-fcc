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

interface Materia {
  id: string;
  nombre: string;
  visible: boolean;
  profesor: { id: string; nombre: string } | null;
  curso_carreras: CursoCarrera[];
  yaInscrito?: boolean;
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
  const [loading, setLoading] = useState(false);

  const fetchMaterias = async (nombre?: string) => {
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

    let inscritosIds = new Set<string>();
    if (userId) {
      const { data: progresoRows } = await supabase
        .from("progreso")
        .select("materia_id")
        .eq("usuario_id", userId);

      inscritosIds = new Set(progresoRows?.map((r) => r.materia_id));
    }

    if (!error && data) {
      const conFlag = (data as Materia[]).map((m) => ({
        ...m,
        yaInscrito: inscritosIds.has(m.id),
      }));
      setMaterias(conFlag);
    }

    setLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };

    fetchUser();
    fetchMaterias();
  }, [userId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMaterias(searchTerm.trim());
  };

  const filtered = materias.filter((m) => {
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

  return (
    <LayoutGeneral>
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-heading)" }}
        >
          Explorar Cursos
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

        <FiltrosCursos filters={filters} setFilters={setFilters} materias={materias} />

        {loading ? (
          <p style={{ color: "var(--color-muted)" }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>No hay cursos para los filtros seleccionados</p>
        ) : (
          <CuadriculaCursos
            materias={filtered}
            groupBy={filters.groupBy}
            userId={userId ?? ""}
            onCambioInscripcion={fetchMaterias} 
        />
        )}
      </div>
    </LayoutGeneral>
  );
}
