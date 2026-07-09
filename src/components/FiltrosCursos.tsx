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
  materias?: any[];
}

export default function FiltrosCursos({ filters, setFilters, materias }: Props) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (materias && materias.length > 0) {
        const carrerasLocal: Carrera[] = Array.from(
          new Map(
            materias
              .flatMap(
                (m) =>
                  m.curso_carreras
                    ?.map((cc: any) => cc.carrera)
                    .filter(Boolean) || []
              )
              .map((c: any) => [c.id, c])
          ).values()
        );

        setCarreras(carrerasLocal);

        const periodosLocal: Periodo[] = Array.from(
          new Map(
            materias
              .flatMap(
                (m) =>
                  m.curso_carreras?.flatMap(
                    (cc: any) => cc.curso_periodos || []
                  ) || []
              )
              .map((p: any) => [`${p.nombre}-${p.anio}`, p])
          ).values()
        );

        setPeriodos(periodosLocal);

        const areasLocal: string[] = Array.from(
          new Set(
            materias.flatMap(
              (m) =>
                m.curso_carreras
                  ?.map((cc: any) => cc.area)
                  .filter(Boolean) || []
            )
          )
        );

        setAreas(areasLocal);
      } else {
        const { data: cData } = await supabase
          .from("carreras")
          .select("id, nombre");

        if (cData) setCarreras(cData);

        const { data: pData } = await supabase
          .from("curso_periodos")
          .select("id, nombre, anio");

        if (pData) {
          const unique = Array.from(
            new Map(pData.map((p) => [`${p.nombre}-${p.anio}`, p])).values()
          );

          setPeriodos(unique);
        }

        const { data: aData } = await supabase
          .from("curso_carreras")
          .select("area");

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

  return (
    <>
      <style>{`
        .fcc-filtros-cursos {
          --fcc-filtros-text: var(--fcc-premium-text, var(--color-text));
          --fcc-filtros-muted: var(--fcc-premium-muted, var(--color-muted));
          --fcc-filtros-accent: var(--fcc-premium-accent);
          --fcc-filtros-border: var(--fcc-premium-border, var(--color-border));

          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          width: 100%;
          min-width: 0;
        }

        .fcc-filtro-campo {
          position: relative;
          min-width: 0;
        }

        .fcc-filtro-select {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          appearance: none;
          border-radius: 16px;
          padding: 0 42px 0 15px;
          color: var(--fcc-filtros-text);
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong, var(--color-card)) 78%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft, var(--color-card)) 92%,
                transparent
              )
            );
          border: 1px solid color-mix(
            in srgb,
            var(--fcc-filtros-accent) 18%,
            var(--fcc-filtros-border)
          );
          outline: none;
          font-size: 0.92rem;
          font-weight: 750;
          line-height: 1;
          box-shadow:
            0 10px 22px color-mix(
              in srgb,
              var(--fcc-premium-shadow-color, #0f172a) 6%,
              transparent
            ),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong, #ffffff) 64%,
              transparent
            );
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease,
            background 160ms ease;
        }

        .fcc-filtro-select:hover {
          border-color: color-mix(
            in srgb,
            var(--fcc-filtros-accent) 34%,
            var(--fcc-filtros-border)
          );
        }

        .fcc-filtro-select:focus {
          border-color: color-mix(
            in srgb,
            var(--fcc-filtros-accent) 58%,
            var(--fcc-filtros-border)
          );
          box-shadow:
            0 12px 24px color-mix(
              in srgb,
              var(--fcc-premium-shadow-color, #0f172a) 8%,
              transparent
            ),
            0 0 0 4px color-mix(
              in srgb,
              var(--fcc-filtros-accent) 13%,
              transparent
            );
        }

        .fcc-filtro-campo::after {
          content: "";
          position: absolute;
          right: 16px;
          top: 50%;
          width: 9px;
          height: 9px;
          border-right: 2px solid var(--fcc-filtros-accent);
          border-bottom: 2px solid var(--fcc-filtros-accent);
          transform: translateY(-65%) rotate(45deg);
          pointer-events: none;
          opacity: 0.9;
        }

        .fcc-filtro-select option {
          color: var(--color-text);
          background: var(--color-card);
        }

        @media (min-width: 640px) {
          .fcc-filtros-cursos {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .fcc-filtros-cursos {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1280px) {
          .fcc-filtros-cursos {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="fcc-filtros-cursos">
        <div className="fcc-filtro-campo">
          <select
            className="fcc-filtro-select"
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
        </div>

        <div className="fcc-filtro-campo">
          <select
            className="fcc-filtro-select"
            value={filters.area || ""}
            onChange={(e) =>
              setFilters({ ...filters, area: e.target.value || null })
            }
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="fcc-filtro-campo">
          <select
            className="fcc-filtro-select"
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
        </div>

        <div className="fcc-filtro-campo">
          <select
            className="fcc-filtro-select"
            value={filters.periodo || ""}
            onChange={(e) =>
              setFilters({ ...filters, periodo: e.target.value || null })
            }
          >
            <option value="">Todos los periodos</option>
            {periodos.map((p, i) => (
              <option key={i} value={`${p.nombre} ${p.anio}`}>
                {p.nombre} {p.anio}
              </option>
            ))}
          </select>
        </div>

        <div className="fcc-filtro-campo">
          <select
            className="fcc-filtro-select"
            value={filters.groupBy}
            onChange={(e) =>
              setFilters({ ...filters, groupBy: e.target.value })
            }
          >
            <option value="none">Sin agrupación</option>
            <option value="semestre">📘 Agrupar por semestre</option>
            <option value="carrera">🎓 Agrupar por carrera</option>
            <option value="area">📂 Agrupar por área</option>
            <option value="periodo">🗓️ Agrupar por periodo</option>
          </select>
        </div>
      </div>
    </>
  );
}