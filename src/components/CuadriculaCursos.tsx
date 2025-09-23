/**
 * Cuadrícula de cursos que muestra materias agrupadas (o no) 
 * y permite agregarlas al inicio desde un modal de detalle.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";

interface Props {
  materias: any[];
  groupBy: string;
  userId: string;
}

export default function CuadriculaCursos({ materias, groupBy, userId }: Props) {
  const [selected, setSelected] = useState<any | null>(null);

  const addToInicio = async (materia: any) => {
    const { data: exists } = await supabase
      .from("progreso")
      .select("id, visible")
      .eq("usuario_id", userId)
      .eq("materia_id", materia.id)
      .maybeSingle();

    if (!exists) {
      const { error } = await supabase.from("progreso").insert([
        {
          usuario_id: userId,
          materia_id: materia.id,
          progreso: 0,
          visible: true,
        },
      ]);
      if (error) {
        toast.error("Error al agregar curso");
        return;
      }
    } else if (exists.visible === false) {
      await supabase
        .from("progreso")
        .update({ visible: true })
        .eq("id", exists.id);
    }

    setSelected(null);
    toast.success(`${materia.nombre} agregado a inicio`);
  };

  const renderCard = (m: any) => (
    <div
      key={m.id}
      className="bg-gray-900 p-4 rounded-lg shadow hover:bg-gray-800 transition relative cursor-pointer"
      onClick={() => setSelected(m)}
    >
      <h3 className="text-lg font-bold">{m.nombre}</h3>
      <p className="text-sm text-gray-400">
        Carrera: {m.carrera?.nombre ?? "N/A"}
      </p>
      <p className="text-sm text-gray-400">Semestre: {m.semestre_id}</p>
      <p className="text-sm text-gray-400">
        Profesor: {m.profesor?.nombre ?? "Aún no hay profesor asignado"}
      </p>
    </div>
  );

  const grouped: Record<string, any[]> = {};
  if (groupBy !== "none") {
    materias.forEach((m) => {
      let key = "";
      if (groupBy === "semestre") key = `Semestre ${m.semestre_id}`;
      if (groupBy === "carrera") key = m.carrera?.nombre ?? "Carrera desconocida";
      if (groupBy === "area") key = m.area;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
  }

  return (
    <div className="relative">
      {groupBy === "none" ? (
        <div className="grid grid-cols-3 gap-4">
          {[...materias]
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((m) => renderCard(m))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(grouped)
            .sort()
            .map((k) => (
              <div key={k}>
                <h2 className="text-xl font-bold mb-4">📘 {k}</h2>
                <div className="grid grid-cols-3 gap-4">
                  {grouped[k]
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((m) => renderCard(m))}
                </div>
              </div>
            ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl w-96 shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-center">
              {selected.nombre}
            </h3>

            <div className="text-left mb-6">
              <p className="text-sm text-gray-400">
                Carrera: {selected.carrera?.nombre ?? "N/A"}
              </p>
              <p className="text-sm text-gray-400">
                Semestre: {selected.semestre_id}
              </p>
              <p className="text-sm text-gray-400">
                Profesor:{" "}
                {selected.profesor?.nombre ?? "Aún no hay profesor asignado"}
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <button
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
                onClick={() => setSelected(null)}
              >
                Volver
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-500"
                onClick={() => addToInicio(selected)}
              >
                Agregar a inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
