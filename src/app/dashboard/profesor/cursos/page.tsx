/**
 * Página de profesor para explorar y buscar todos los cursos públicos.
 */

"use client";

import { useState, useEffect } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import FiltrosCursos from "@/components/FiltrosCursos";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

interface Materia {
  id: string;
  nombre: string;
  area: string;
  semestre_id: number;
  carrera: { id: number; nombre: string } | null;
  profesor: { id: string; nombre: string } | null;
}

export default function ProfesorCursosPage() {
  const [cursos, setCursos] = useState<Materia[]>([]);
  const [filters, setFilters] = useState({
    semestre_id: null as number | null,
    area: null as string | null,
    carrera_id: null as number | null,
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
        area,
        semestre_id,
        carrera:carreras (id, nombre),
        profesor:usuarios (id, nombre)
      `
      )
      .eq("visible", true); // solo cursos públicos

    if (filters.semestre_id)
      query = query.eq("semestre_id", filters.semestre_id);
    if (filters.area) query = query.eq("area", filters.area);
    if (filters.carrera_id) query = query.eq("carrera_id", filters.carrera_id);

    if (nombre) {
      query = query.ilike("nombre", `%${nombre}%`);
    }

    const { data, error } = await query;
    if (!error && data) setCursos(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCursos();
  }, [filters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCursos(searchTerm.trim());
  };

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Todos los Cursos</h1>

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
        ) : cursos && cursos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...cursos]
              .sort((a, b) => a.nombre.localeCompare(b.nombre)) // orden alfabético
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/curso/${c.id}`}
                  className="block bg-gray-900 p-4 rounded-xl shadow text-gray-200 hover:bg-gray-800 transition"
                >
                  <h2 className="text-lg font-semibold">{c.nombre}</h2>
                  <p className="text-sm text-gray-400">
                    Carrera: {c.carrera?.nombre ?? "Desconocida"}
                  </p>
                  <p className="text-sm text-gray-400">
                    Semestre: {c.semestre_id ?? "N/A"}
                  </p>
                  <p className="text-sm text-gray-400">
                    Profesor: {c.profesor?.nombre ?? "Aún no hay profesor asignado"}
                  </p>
                </Link>
              ))}
          </div>
        ) : (
          <p className="text-gray-400">No hay cursos disponibles</p>
        )}
      </div>
    </LayoutGeneral>
  );
}
