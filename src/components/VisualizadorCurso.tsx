/**
 * Visualizador de curso para estudiantes.
 * Muestra datos de la materia, progreso, bloques de contenido,
 * quizzes disponibles y un formulario de fórmulas asociadas.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import CirculoProgreso from "@/components/CirculoProgreso";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

export default function VisualizadorCurso({
  materiaId,
  userId,
}: {
  materiaId: string;
  userId: string;
}) {
  const [materia, setMateria] = useState<any>(null);
  const [progreso, setProgreso] = useState<number>(0);
  const [bloques, setBloques] = useState<any[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: mat } = await supabase
        .from("materias")
        .select(
          `
          id,
          nombre,
          area,
          semestre_id,
          carrera:carreras (id, nombre),
          profesor:usuarios (id, nombre)
        `
        )
        .eq("id", materiaId)
        .single();
      setMateria(mat);

      const { data: prog } = await supabase.rpc("get_progreso_curso", {
        user_id: userId,
        materia_id: materiaId,
      });
      setProgreso(prog ?? 0);

      const { data: bl } = await supabase
        .from("curso_contenido_bloques")
        .select("*")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      let bloquesConQuizzes: any[] = [];
      if (bl) {
        bloquesConQuizzes = await Promise.all(
          bl.map(async (b: any) => {
            const { data: quizzes } = await supabase
              .from("quizzes")
              .select("id, titulo, descripcion, xp, orden")
              .eq("bloque_id", b.id)
              .order("orden", { ascending: true });
            return { ...b, quizzes: quizzes || [] };
          })
        );
      }
      setBloques(bloquesConQuizzes);

      const { data: fm } = await supabase
        .from("curso_formulas")
        .select("id, titulo, ecuacion, bloque_id")
        .in(
          "bloque_id",
          (bl || []).map((b: any) => b.id)
        )
        .order("created_at", { ascending: true });
      setFormulas(fm || []);

      setLoading(false);
    };

    fetchData();
  }, [materiaId, userId]);

  if (loading) return <p className="text-gray-400">Cargando curso...</p>;
  if (!materia) return <p className="text-red-400">Curso no encontrado</p>;

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-900 p-6 rounded-xl shadow gap-6 items-center">
        <div className="flex items-center">
          <CirculoProgreso progress={progreso} size={140} />
        </div>

        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold text-white">{materia.nombre}</h1>
          <p className="text-gray-400">Área: {materia.area}</p>
          <p className="text-gray-400">Carrera: {materia.carrera?.nombre}</p>
          <p className="text-gray-400">Semestre: {materia.semestre_id}</p>

          <div className="mt-6">
            <h2 className="text-xl font-bold text-white">Profesor</h2>
            <p className="text-gray-400">
              {materia.profesor
                ? materia.profesor.nombre
                : "Aún no hay profesor asignado"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow space-y-4">
        <h2 className="text-xl font-bold text-white">Contenido del curso</h2>
        {bloques.length === 0 && (
          <p className="text-gray-400">Aún no hay contenido.</p>
        )}
        {bloques.map((b, i) => (
          <div key={b.id} className="bg-gray-800 p-6 rounded-lg space-y-4">
            {b.tipo === "texto" && (
              <div className="prose prose-invert max-w-none">
                {b.titulo && (
                  <h2 className="text-2xl font-bold text-center mb-6">
                    {b.titulo}
                  </h2>
                )}
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                >
                  {b.contenido}
                </ReactMarkdown>
              </div>
            )}
            {b.tipo === "imagen" && (
              <img
                src={b.contenido}
                alt={`imagen-${i}`}
                className="rounded-xl shadow max-h-[360px] mx-auto"
              />
            )}
            {b.tipo === "video" && (
              <video
                src={b.contenido}
                controls
                className="rounded-xl shadow w-full max-h-[420px]"
              />
            )}

            {b.quizzes && b.quizzes.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Quizzes</h3>
                {b.quizzes.map((q: any) => (
                  <div
                    key={q.id}
                    className="bg-gray-700 rounded-lg px-3 py-2 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{q.titulo}</p>
                      {q.descripcion && (
                        <p className="text-xs text-gray-300">{q.descripcion}</p>
                      )}
                    </div>
                    <a
                      href={`/curso/${materiaId}/quiz/${q.id}`}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Resolver
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow space-y-4">
        <h2 className="text-xl font-bold text-white">Formulario</h2>
        {formulas.length === 0 && (
          <p className="text-gray-400">Aún no hay fórmulas.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formulas.map((f) => (
            <div
              key={f.id}
              className="bg-gray-800 p-6 rounded-lg shadow text-center flex flex-col items-center justify-center"
            >
              {f.titulo && (
                <h3 className="font-semibold text-white mb-3">{f.titulo}</h3>
              )}
              <div className="prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {`$$${f.ecuacion}$$`}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
