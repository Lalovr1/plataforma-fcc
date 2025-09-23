/**
 * Página para que un profesor agregue un nuevo curso.
 * Los cursos creados comienzan como privados (visible = false).
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AgregarCursoPage() {
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("Ciencias Básicas");
  const [semestre, setSemestre] = useState<number | null>(null);
  const [carrera, setCarrera] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("No se pudo obtener el usuario");
        setLoading(false);
        return;
      }

      const payload: any = {
        nombre,
        area,
        profesor_id: user.id,
        visible: false,
      };

      if (semestre !== null) payload.semestre_id = semestre;
      if (carrera !== null) payload.carrera_id = carrera;

      const { error } = await supabase.from("materias").insert(payload);

      if (error) {
        console.error("Supabase error:", error.message, error.details);
        toast.error("Error al crear el curso");
      } else {
        toast.success("Curso creado con éxito 🎉");
        setNombre("");
        setSemestre(null);
        setCarrera(null);
        router.push("/dashboard/profesor");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-6 rounded-xl shadow-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          ➕ Agregar Curso
        </h2>

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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          {loading ? "Agregando..." : "Agregar curso"}
        </button>
      </form>
    </div>
  );
}
