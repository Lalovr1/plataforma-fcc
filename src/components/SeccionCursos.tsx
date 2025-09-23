/**
 * Sección de cursos en el dashboard del usuario.
 * Muestra los cursos con su progreso, acceso directo y opción para quitarlos de inicio.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import Link from "next/link";
import CirculoProgreso from "@/components/CirculoProgreso";

interface Curso {
  id: string;
  name: string;
  progress: number;
  progresoId: string;
}

interface Props {
  initialCourses: Curso[];
}

export default function SeccionCursos({ initialCourses }: Props) {
  const [misCursos, setMisCursos] = useState<Curso[]>(initialCourses);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const removeCourse = async (progresoId: string) => {
    setLoadingId(progresoId);
    const { error } = await supabase
      .from("progreso")
      .update({ visible: false })
      .eq("id", progresoId);

    if (error) {
      toast.error("Error al quitar curso de inicio");
    } else {
      toast.success("Curso eliminado de inicio");
      setMisCursos((prev) => prev.filter((c) => c.progresoId !== progresoId));
    }
    setLoadingId(null);
  };

  return (
    <div className="mt-6">
      <h3 className="text-2xl font-bold mb-4 text-white">Cursos</h3>

      {misCursos.length === 0 ? (
        <p className="text-gray-400">Aún no tienes cursos asignados</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {misCursos.map((curso) => (
            <div
              key={curso.id}
              className="bg-[#B8C3CA] rounded-xl p-6 shadow flex items-center gap-6 relative"
            >
              <CirculoProgreso progress={curso.progress} size={80} />

              <div className="flex-1">
                <p className="text-lg font-semibold text-black">{curso.name}</p>
                <p className="text-sm text-gray-800 mt-1">
                  Progreso: {curso.progress}%
                </p>

                <Link href={`/curso/${curso.id}`}>
                  <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm">
                    Entrar
                  </button>
                </Link>
              </div>

              <button
                disabled={loadingId === curso.progresoId}
                onClick={() => removeCourse(curso.progresoId)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-sm"
              >
                {loadingId === curso.progresoId ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
