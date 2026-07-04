/**
 * Página de cursos: muestra listado de materias disponibles,
 * con buscador, filtros y vista en cuadrícula.
 */

"use client";

import { useState, useEffect, useLayoutEffect } from "react";
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

interface ProgresoEstado {
  exists: boolean;
  visible: boolean;
}

interface Materia {
  id: string;
  nombre: string;
  visible: boolean;
  profesor: { id: string; nombre: string } | null;
  curso_carreras: CursoCarrera[];
  yaInscrito?: boolean;
  progresoEstado?: ProgresoEstado;
}

const CACHE_KEY_BASE = "fcc_academy_cursos_estudiante_v2";

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
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [cacheCargado, setCacheCargado] = useState(false);

  const getCacheKey = (usuarioId: string) => `${CACHE_KEY_BASE}_${usuarioId}`;

  const guardarCache = (usuarioId: string, cursos: Materia[]) => {
    try {
      sessionStorage.setItem(
        getCacheKey(usuarioId),
        JSON.stringify({
          timestamp: Date.now(),
          materias: cursos,
        })
      );
    } catch {}
  };

  const leerCache = (usuarioId: string): Materia[] | null => {
    try {
      const raw = sessionStorage.getItem(getCacheKey(usuarioId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.materias)) return null;

      return parsed.materias;
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    try {
      const usuarioLocal = localStorage.getItem("user_id");
      if (!usuarioLocal) return;

      const cursosCache = leerCache(usuarioLocal);
      if (!cursosCache) return;

      setUserId(usuarioLocal);
      setMaterias(cursosCache);
      setCacheCargado(true);
      setCargandoInicial(false);
    } catch {}
  }, []);

  const cargarMaterias = async (usuarioId: string, nombre?: string) => {
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

    const [{ data: materiasData, error: materiasError }, { data: progresoRows }] =
      await Promise.all([
        query,
        supabase
          .from("progreso")
          .select("materia_id, visible")
          .eq("usuario_id", usuarioId),
      ]);

    if (materiasError) {
      console.error("Error cargando cursos:", materiasError);
      return;
    }

    const progresoPorMateria = new Map<string, { visible: boolean }>();

    progresoRows?.forEach((row: any) => {
      progresoPorMateria.set(row.materia_id, {
        visible: Boolean(row.visible),
      });
    });

    const conEstado = ((materiasData as Materia[]) ?? []).map((m) => {
      const progreso = progresoPorMateria.get(m.id);

      return {
        ...m,
        yaInscrito: Boolean(progreso),
        progresoEstado: progreso
          ? { exists: true, visible: progreso.visible }
          : { exists: false, visible: false },
      };
    });

    setMaterias(conEstado);

    if (!nombre) {
      guardarCache(usuarioId, conEstado);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setMaterias([]);
          setCargandoInicial(false);
          return;
        }

        setUserId(user.id);

        const cursosCache = leerCache(user.id);

        if (cursosCache && !cacheCargado) {
          setMaterias(cursosCache);
          setCargandoInicial(false);
        }

        await cargarMaterias(user.id);
      } catch (e) {
        console.error("Error inicializando cursos:", e);
        setMaterias([]);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) return;

    setBuscando(true);

    try {
      await cargarMaterias(userId, searchTerm.trim());
    } finally {
      setBuscando(false);
    }
  };

  const filtered = materias.filter((m) => {
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

  return (
    <LayoutGeneral>
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          Explorar Cursos
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
            disabled={buscando || !userId}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>

        <FiltrosCursos filters={filters} setFilters={setFilters} materias={materias} />

        {cargandoInicial ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="rounded-lg p-4 shadow animate-pulse"
                style={{
                  backgroundColor: "var(--color-card)",
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
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>
            No hay cursos para los filtros seleccionados
          </p>
        ) : (
          <CuadriculaCursos
            materias={filtered}
            groupBy={filters.groupBy}
            userId={userId ?? ""}
          />
        )}
      </div>
    </LayoutGeneral>
  );
}