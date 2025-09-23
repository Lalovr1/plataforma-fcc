/**
 * Filtros para listar/consultar cursos por semestre, área, carrera y criterio de agrupación.
 * Recibe y actualiza el estado externo mediante las props `filters` y `setFilters`.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface Carrera {
  id: number;
  nombre: string;
}

interface Props {
  filters: {
    semestre_id: number | null;
    area: string | null;
    carrera_id: number | null;
    groupBy: string;
  };
  setFilters: (filters: any) => void;
}

export default function FiltrosCursos({ filters, setFilters }: Props) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    const fetchCarreras = async () => {
      const { data, error } = await supabase.from("carreras").select("id, nombre");
      if (!error && data) {
        setCarreras(data);
      }
    };
    fetchCarreras();
  }, []);

  return (
    <div className="bg-gray-900 p-4 rounded-xl flex gap-4 flex-wrap">
      <select
        className="bg-gray-800 p-2 rounded"
        value={filters.semestre_id || ""}
        onChange={(e) =>
          setFilters({
            ...filters,
            semestre_id: e.target.value ? Number(e.target.value) : null,
          })
        }
      >
        <option value="">Todos los semestres</option>
        {[...Array(10)].map((_, i) => (
          <option key={i + 1} value={i + 1}>
            Semestre {i + 1}
          </option>
        ))}
      </select>

      <select
        className="bg-gray-800 p-2 rounded"
        value={filters.area || ""}
        onChange={(e) => setFilters({ ...filters, area: e.target.value || null })}
      >
        <option value="">Todas las áreas</option>
        <option value="Ciencias Básicas">Ciencias Básicas</option>
        <option value="Computación">Computación</option>
      </select>

      <select
        className="bg-gray-800 p-2 rounded"
        value={filters.carrera_id || ""}
        onChange={(e) =>
          setFilters({
            ...filters,
            carrera_id: e.target.value ? Number(e.target.value) : null,
          })
        }
      >
        <option value="">Todas las carreras</option>
        {carreras.map((carrera) => (
          <option key={carrera.id} value={carrera.id}>
            {carrera.nombre}
          </option>
        ))}
      </select>

      <select
        className="bg-gray-800 p-2 rounded"
        value={filters.groupBy}
        onChange={(e) => setFilters({ ...filters, groupBy: e.target.value })}
      >
        <option value="none">Sin agrupación</option>
        <option value="semestre">Agrupar por semestre</option>
        <option value="carrera">Agrupar por carrera</option>
        <option value="area">Agrupar por área</option>
      </select>
    </div>
  );
}
