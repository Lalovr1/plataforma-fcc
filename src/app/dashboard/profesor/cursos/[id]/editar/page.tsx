/**
 * Página para que un profesor edite la información de un curso,
 * gestione su contenido y cree quizzes.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import EditorContenidoCurso from "@/components/EditorContenidoCurso";
import ConstructorQuiz from "@/components/ConstructorQuiz";

export default function EditarCursoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("Ciencias Básicas");
  const [semestre, setSemestre] = useState<number | null>(null);
  const [carrera, setCarrera] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurso = async () => {
      const { data, error } = await supabase
        .from("materias")
        .select("id, nombre, area, semestre_id, carrera_id, profesor_id, visible")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("No se pudo cargar el curso");
        router.push("/dashboard/profesor");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || data.profesor_id !== user.id) {
        toast.error("No tienes permiso para editar este curso");
        router.push("/dashboard/profesor");
        return;
      }

      setNombre(data.nombre);
      setArea(data.area);
      setSemestre(data.semestre_id);
      setCarrera(data.carrera_id);
      setVisible(data.visible ?? false);
      setLoading(false);
    };

    fetchCurso();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("materias")
      .update({
        nombre,
        area,
        semestre_id: semestre,
        carrera_id: carrera,
        visible,
      })
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error.message);
      toast.error("Error al actualizar curso");
    } else {
      toast.success("Curso actualizado ✅");
      router.push("/dashboard/profesor");
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este curso? Esta acción no se puede deshacer.")) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("materias").delete().eq("id", id);

    if (error) {
      console.error("Supabase error:", error.message);
      toast.error("Error al eliminar curso");
    } else {
      toast.success("Curso eliminado 🗑️");
      router.push("/dashboard/profesor");
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-center text-gray-400">Cargando curso...</p>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="bg-gray-900 p-6 rounded-xl shadow w-full">
          <h2 className="text-xl font-bold mb-4">📘 Contenido del curso</h2>
          <EditorContenidoCurso materiaId={id} />
        </div>

        <div className="flex flex-col gap-6 w-full">
          <form
            onSubmit={handleSubmit}
            className="bg-gray-900 p-6 rounded-xl shadow-lg w-full space-y-4"
          >
            <h2 className="text-xl font-bold mb-4">✏️ Editar información del curso</h2>

            <div>
              <label className="block text-sm mb-1">Nombre del curso</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full p-2 rounded bg-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Área</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full p-2 rounded bg-gray-800"
              >
                <option value="Ciencias Básicas">Ciencias Básicas</option>
                <option value="Computación">Computación</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Semestre</label>
              <select
                value={semestre ?? ""}
                onChange={(e) =>
                  setSemestre(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full p-2 rounded bg-gray-800"
              >
                <option value="">Sin semestre</option>
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Semestre {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Carrera</label>
              <select
                value={carrera ?? ""}
                onChange={(e) =>
                  setCarrera(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full p-2 rounded bg-gray-800"
              >
                <option value="">Todas</option>
                <option value="1">Lic. en Ciencias de la Computación</option>
                <option value="2">Ing. en Ciencias de la Computación</option>
                <option value="3">Ing. en Ciencia de Datos</option>
                <option value="4">Ing. en Ciberseguridad</option>
                <option value="5">Ing. en Tecnologías de la Información</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="w-4 h-4"
                />
                Hacer público (visible para todos)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Actualizar curso"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                Eliminar curso
              </button>
            </div>
          </form>

          <div className="bg-gray-900 p-6 rounded-xl shadow w-full">
            <ConstructorQuiz materiaId={id} />
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
