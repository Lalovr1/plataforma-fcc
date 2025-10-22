/**
 * Página de ranking por curso (profesor):
 * - Verifica que el profesor sea dueño del curso.
 * - Muestra el componente <RankingCurso /> con filtros por período y sección
 *   y dos rankings: Progreso general y por Quiz.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import RankingCurso from "@/components/RankingCurso";

export default function RankingCursoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [curso, setCurso] = useState<{ id: string; nombre: string } | null>(null);
  const [filtroMatricula, setFiltroMatricula] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data: materia, error } = await supabase
        .from("materias")
        .select("id, nombre, profesor_id")
        .eq("id", id)
        .single();

      if (error || !materia) {
        toast.error("No se pudo cargar el curso");
        router.push("/dashboard/profesor");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.id !== materia.profesor_id) {
        toast.error("No tienes permiso para ver este ranking");
        router.push("/dashboard/profesor");
        return;
      }

      setCurso({ id: materia.id, nombre: materia.nombre });
      setCargando(false);
    };

    run();
  }, [id, router]);

  if (cargando) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-center text-gray-400">Cargando ranking...</p>
      </LayoutGeneral>
    );
  }

  if (!curso) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-center text-red-400">Curso no disponible</p>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">📊 Ranking del curso: {curso.nombre}</h1>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).querySelector("input");
              const matricula = input?.value?.trim() || null;
              setFiltroMatricula(matricula);
            }}
            className="flex gap-2 items-center"
          >
            <input
              type="text"
              placeholder="Buscar alumno por matrícula"
              defaultValue={filtroMatricula || ""}
              className="flex-1 p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
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
                className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded font-semibold"
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
