"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface Carrera {
  id: number;
  nombre: string;
}
interface Periodo {
  id?: string;
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
  materias?: any[]; // opcional → estudiantes lo pasan, profesores no
}

export default function FiltrosCursos({ filters, setFilters, materias }: Props) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Si recibimos materias → sacar todo de ahí (modo estudiante)
      if (materias && materias.length > 0) {
        const carrerasLocal: Carrera[] = Array.from(
          new Map(
            materias
              .flatMap((m) => m.curso_carreras?.map((cc: any) => cc.carrera).filter(Boolean) || [])
              .map((c: any) => [c.id, c])
          ).values()
        );
        setCarreras(carrerasLocal);

        const periodosLocal: Periodo[] = Array.from(
          new Map(
            materias
              .flatMap((m) => m.curso_carreras?.flatMap((cc: any) => cc.curso_periodos || []) || [])
              .map((p: any) => [`${p.nombre}-${p.anio}`, p])
          ).values()
        );
        setPeriodos(periodosLocal);

        const areasLocal: string[] = Array.from(
          new Set(
            materias.flatMap(
              (m) => m.curso_carreras?.map((cc: any) => cc.area).filter(Boolean) || []
            )
          )
        );
        setAreas(areasLocal);
      } else {
        // Si no recibimos materias → pedir a Supabase (modo profesor)
        const { data: cData } = await supabase.from("carreras").select("id, nombre");
        if (cData) setCarreras(cData);

        const { data: pData } = await supabase.from("curso_periodos").select("id, nombre, anio");
        if (pData) {
          const unique = Array.from(
            new Map(pData.map((p) => [`${p.nombre}-${p.anio}`, p])).values()
          );
          setPeriodos(unique);
        }

        const { data: aData } = await supabase.from("curso_carreras").select("area");
        if (aData) {
          const uniqueAreas = Array.from(
            new Set(aData.map((a) => a.area).filter(Boolean))
          );
          setAreas(uniqueAreas);
        }
      }
    };

    fetchData();
  }, [materias]);

  const selectStyle: React.CSSProperties = {
    backgroundColor: "var(--color-card)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div
      className="p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
      style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
    >
      {/* Semestres */}
      <select
        className="w-full min-w-0 p-2 rounded"
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

      {/* Áreas */}
      <select
        className="w-full min-w-0 p-2 rounded"
        style={selectStyle}
        value={filters.area || ""}
        onChange={(e) => setFilters({ ...filters, area: e.target.value || null })}
      >
        <option value="">Todas las áreas</option>
        {areas.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Carreras */}
      <select
        className="w-full min-w-0 p-2 rounded"
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
        {carreras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      {/* Periodos */}
      <select
        className="w-full min-w-0 p-2 rounded"
        style={selectStyle}
        value={filters.periodo || ""}
        onChange={(e) => setFilters({ ...filters, periodo: e.target.value || null })}
      >
        <option value="">Todos los periodos</option>
        {periodos.map((p, i) => (
          <option key={i} value={`${p.nombre} ${p.anio}`}>
            {p.nombre} {p.anio}
          </option>
        ))}
      </select>

      {/* Agrupación */}
      <select
        className="w-full min-w-0 p-2 rounded"
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
