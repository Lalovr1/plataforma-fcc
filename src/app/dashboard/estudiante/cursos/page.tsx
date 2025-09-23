/**
 * Página de cursos: muestra listado de materias disponibles,
 * con buscador, filtros y vista en cuadrícula.
 */

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import FiltrosCursos from "@/components/FiltrosCursos";
import CuadriculaCursos from "@/components/CuadriculaCursos";
import LayoutGeneral from "@/components/LayoutGeneral";

export default function CursosPage() {
  const [materias, setMaterias] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    semestre_id: null,
    area: null,
    carrera_id: null,
    groupBy: "none",
  });
  const [userId, setUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMaterias = async (nombre?: string) => {
    setLoading(true);
    let query = supabase
      .from("materias")
      .select(`
        id,
        nombre,
        semestre_id,
        carrera:carreras (id, nombre),
        profesor:usuarios (id, nombre)
      `)
      .eq("visible", true);

    if (nombre) {
      query = query.ilike("nombre", `%${nombre}%`);
    }

    const { data, error } = await query;
    if (!error && data) setMaterias(data);
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
  }, []);

  const filtered = materias.filter((m) => {
    const bySemestre = filters.semestre_id
      ? m.semestre_id === filters.semestre_id
      : true;
    const byArea = filters.area ? m.area === filters.area : true;
    const byCarrera = filters.carrera_id
      ? m.carrera?.id === filters.carrera_id
      : true;
    return bySemestre && byArea && byCarrera;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMaterias(searchTerm.trim());
  };

  return (
    <LayoutGeneral>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Explorar Cursos</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar curso por nombre"
            className="flex-1 p-2 rounded bg-gray-800 text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Buscar
          </button>
        </form>

        <FiltrosCursos filters={filters} setFilters={setFilters} />

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : userId ? (
          <CuadriculaCursos
            materias={filtered}
            groupBy={filters.groupBy}
            userId={userId}
          />
        ) : (
          <p className="text-gray-400">Cargando usuario...</p>
        )}
      </div>
    </LayoutGeneral>
  );
}
