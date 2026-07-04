/**
 * Página de ranking por curso (profesor):
 * - Verifica que el profesor sea dueño del curso.
 * - Muestra el componente <RankingCurso /> con filtros por período y sección
 *   y dos rankings: Progreso general y por Quiz.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import RankingCurso from "@/components/RankingCurso";

type CursoRanking = {
  id: string;
  nombre: string;
};

const CACHE_KEY_BASE = "fcc_academy_ranking_curso_profesor_v1";

function getCacheKey(usuarioId: string, cursoId: string) {
  return `${CACHE_KEY_BASE}_${usuarioId}_${cursoId}`;
}

function guardarCache(usuarioId: string, cursoId: string, curso: CursoRanking) {
  try {
    sessionStorage.setItem(
      getCacheKey(usuarioId, cursoId),
      JSON.stringify({
        timestamp: Date.now(),
        curso,
      })
    );
  } catch {}
}

function leerCache(usuarioId: string, cursoId: string): CursoRanking | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(usuarioId, cursoId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.curso?.id || !parsed?.curso?.nombre) return null;

    return parsed.curso;
  } catch {
    return null;
  }
}

export default function RankingCursoPage() {
  const params = useParams();
  const router = useRouter();

  const id = typeof params?.id === "string" ? params.id : "";

  const [curso, setCurso] = useState<CursoRanking | null>(null);
  const [filtroMatricula, setFiltroMatricula] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useLayoutEffect(() => {
    if (!id) return;

    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerCache(usuarioLocal, id);
    if (!cache) return;

    setCurso(cache);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      try {
        const usuarioLocal = localStorage.getItem("user_id");

        if (usuarioLocal) {
          const cache = leerCache(usuarioLocal, id);

          if (cache) {
            setCurso(cache);
            setCargando(false);
          }
        }

        const [
          {
            data: { user },
          },
          { data: materia, error: materiaError },
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("materias")
            .select("id, nombre, profesor_id")
            .eq("id", id)
            .single(),
        ]);

        if (materiaError || !materia) {
          toast.error("No se pudo cargar el curso");
          router.push("/dashboard/profesor");
          return;
        }

        if (!user || user.id !== materia.profesor_id) {
          toast.error("No tienes permiso para ver este ranking");
          router.push("/dashboard/profesor");
          return;
        }

        const cursoData = {
          id: materia.id,
          nombre: materia.nombre,
        };

        setCurso(cursoData);
        guardarCache(user.id, id, cursoData);
      } catch (e) {
        console.error("Error cargando ranking del curso:", e);
        toast.error("No se pudo cargar el ranking del curso");
        router.push("/dashboard/profesor");
      } finally {
        setCargando(false);
      }
    };

    run();
  }, [id, router]);

  if (cargando && !curso) {
    return (
      <LayoutGeneral rol="profesor">
        <div className="space-y-6">
          <div
            className="h-11 rounded max-w-xl mx-auto animate-pulse"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <div
            className="p-4 rounded-lg shadow animate-pulse"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div
                className="h-10 rounded flex-1"
                style={{ backgroundColor: "var(--color-border)" }}
              />

              <div
                className="h-10 rounded w-full sm:w-24"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            </div>
          </div>

          <div
            className="min-h-[260px] rounded-xl shadow animate-pulse"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
          />
        </div>
      </LayoutGeneral>
    );
  }

  if (!curso) {
    return (
      <LayoutGeneral rol="profesor">
        <div className="min-h-[60dvh] flex items-center justify-center">
          <p className="text-center text-red-400">Curso no disponible</p>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold text-center pl-14 lg:pl-0 min-h-11 flex items-center justify-center"
          style={{ color: "var(--color-heading)" }}
        >
          📊 Ranking del curso: {curso.nombre}
        </h1>

        <div
          className="p-4 rounded-lg shadow mb-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const input = (e.currentTarget as HTMLFormElement).querySelector(
                "input"
              );

              const matricula = input?.value?.trim() || null;
              setFiltroMatricula(matricula);
            }}
            className="flex flex-col sm:flex-row gap-2 sm:items-center"
          >
            <input
              type="text"
              placeholder="Buscar alumno por matrícula"
              defaultValue={filtroMatricula || ""}
              className="flex-1 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />

            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
            >
              Buscar
            </button>

            {filtroMatricula && (
              <button
                type="button"
                onClick={() => {
                  setFiltroMatricula(null);

                  const input = document.querySelector<HTMLInputElement>(
                    'input[placeholder="Buscar alumno por matrícula"]'
                  );

                  if (input) input.value = "";
                }}
                className="w-full sm:w-auto px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-semibold"
              >
                Quitar filtro
              </button>
            )}
          </form>
        </div>

        <RankingCurso materiaId={curso.id} filtroMatricula={filtroMatricula} />
      </div>
    </LayoutGeneral>
  );
}