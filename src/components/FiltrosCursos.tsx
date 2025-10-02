/**
 * Filtros para listar/consultar cursos por semestre, área, carrera, periodo y agrupación.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface Carrera {
  id: number;
  nombre: string;
}

interface Periodo {
  id: string;
  nombre: string;
  anio: number;
}

interface Props {
  filters: {
    semestre_id: number | null;
    area: string | null;
    carrera_id: number | null;
    periodo: string | null;
    groupBy: string;
  };
  setFilters: (filters: any) => void;
}

export default function FiltrosCursos({ filters, setFilters }: Props) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: cData } = await supabase.from("carreras").select("id, nombre");
      if (cData) setCarreras(cData);

      const { data: pData } = await supabase
        .from("curso_periodos")
        .select("id, nombre, anio");
      if (pData) setPeriodos(pData);
    };
    fetchData();
  }, []);

  const selectStyle: React.CSSProperties = {
    backgroundColor: "var(--color-card)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div
      className="p-4 rounded-xl flex gap-4 flex-wrap"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
      }}
    >
      <select
        className="p-2 rounded"
        style={selectStyle}
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
        className="p-2 rounded"
        style={selectStyle}
        value={filters.area || ""}
        onChange={(e) => setFilters({ ...filters, area: e.target.value || null })}
      >
        <option value="">Todas las áreas</option>
        <option value="Ciencias Básicas">Ciencias Básicas</option>
        <option value="Computación">Computación</option>
      </select>

      <select
        className="p-2 rounded"
        style={selectStyle}
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
        className="p-2 rounded"
        style={selectStyle}
        value={filters.periodo || ""}
        onChange={(e) =>
          setFilters({
            ...filters,
            periodo: e.target.value || null,
          })
        }
      >
        <option value="">Todos los periodos</option>
        {periodos.map((p) => (
          <option key={p.id} value={`${p.nombre} ${p.anio}`}>
            {p.nombre} {p.anio}
          </option>
        ))}
      </select>

      <select
        className="p-2 rounded"
        style={selectStyle}
        value={filters.groupBy}
        onChange={(e) => setFilters({ ...filters, groupBy: e.target.value })}
      >
        <option value="none">Sin agrupación</option>
        <option value="semestre">📘 Agrupar por semestre</option>
        <option value="carrera">🎓 Agrupar por carrera</option>
        <option value="area">📂 Agrupar por área</option>
        <option value="periodo">🗓️ Agrupar por periodo</option>
      </select>
    </div>
  );
}
