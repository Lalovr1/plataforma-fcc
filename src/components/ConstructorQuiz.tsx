/**
 * Constructor de quizzes para un curso específico.
 * Permite crear preguntas y respuestas, asignar puntos de experiencia,
 * tiempo límite e intentos máximos, además de guardar y listar quizzes.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";

type Bloque = { id: string; titulo?: string | null; tipo: string };
type PreguntaLocal = {
  id: string;
  enunciado: string;
  respuestas: { id: string; texto: string; es_correcta: boolean }[];
};

export default function ConstructorQuiz({ materiaId }: { materiaId: string }) {
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [bloqueId, setBloqueId] = useState<string>("");

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [xp, setXp] = useState(100);
  const [tiempo, setTiempo] = useState<number | null>(null);
  const [intentosMax, setIntentosMax] = useState(1);

  const [preguntas, setPreguntas] = useState<PreguntaLocal[]>([]);
  const [saving, setSaving] = useState(false);

  const [quizzesGuardados, setQuizzesGuardados] = useState<any[]>([]);

  useEffect(() => {
    const fetchBloques = async () => {
      const { data, error } = await supabase
        .from("curso_contenido_bloques")
        .select("id,titulo,tipo")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      if (!error && data) setBloques(data as Bloque[]);
    };

    const fetchQuizzes = async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      if (!error && data) setQuizzesGuardados(data);
    };

    fetchBloques();
    fetchQuizzes();
  }, [materiaId]);

  /** Manejo de preguntas y respuestas locales */
  const addPregunta = () => {
    setPreguntas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        enunciado: "Nueva pregunta",
        respuestas: [],
      },
    ]);
  };

  const updatePregunta = (id: string, enunciado: string) => {
    setPreguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enunciado } : p))
    );
  };

  const deletePregunta = (id: string) => {
    setPreguntas((prev) => prev.filter((p) => p.id !== id));
  };

  const addRespuesta = (preguntaId: string) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? {
              ...p,
              respuestas: [
                ...p.respuestas,
                { id: crypto.randomUUID(), texto: "Opción", es_correcta: false },
              ],
            }
          : p
      )
    );
  };

  const updateRespuesta = (
    preguntaId: string,
    respuestaId: string,
    patch: Partial<{ texto: string; es_correcta: boolean }>
  ) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? {
              ...p,
              respuestas: p.respuestas.map((r) =>
                r.id === respuestaId ? { ...r, ...patch } : r
              ),
            }
          : p
      )
    );
  };

  const deleteRespuesta = (preguntaId: string, respuestaId: string) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? {
              ...p,
              respuestas: p.respuestas.filter((r) => r.id !== respuestaId),
            }
          : p
      )
    );
  };

  const markCorrecta = (preguntaId: string, respuestaId: string) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? {
              ...p,
              respuestas: p.respuestas.map((r) => ({
                ...r,
                es_correcta: r.id === respuestaId,
              })),
            }
          : p
      )
    );
  };

  /** Guardar quiz en la base de datos */
  const saveQuiz = async () => {
    if (!bloqueId) {
      toast.error("Selecciona un bloque para ligar el quiz");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Pon un título al quiz");
      return;
    }
    if (preguntas.length === 0) {
      toast.error("Agrega al menos una pregunta");
      return;
    }

    setSaving(true);
    try {
      const orden = quizzesGuardados.length
        ? Math.max(...quizzesGuardados.map((q) => q.orden || 0)) + 1
        : 0;

      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .insert({
          materia_id: materiaId,
          bloque_id: bloqueId,
          titulo,
          descripcion: descripcion || null,
          xp,
          orden,
          tiempo_limite_seg: tiempo,
          intentos_max: intentosMax,
        })
        .select("id")
        .single();

      if (qErr) throw qErr;

      const quizId = quiz.id;

      for (let i = 0; i < preguntas.length; i++) {
        const p = preguntas[i];
        const { data: preg, error: pErr } = await supabase
          .from("preguntas")
          .insert({
            quiz_id: quizId,
            enunciado: p.enunciado,
            orden: i,
          })
          .select("id")
          .single();

        if (pErr) throw pErr;
        const pregId = preg.id;

        for (const r of p.respuestas) {
          await supabase.from("respuestas").insert({
            pregunta_id: pregId,
            texto: r.texto,
            es_correcta: r.es_correcta,
          });
        }
      }

      toast.success("Quiz guardado ✅");

      setTitulo("");
      setDescripcion("");
      setXp(100);
      setTiempo(null);
      setIntentosMax(1);
      setPreguntas([]);

      const { data } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });
      setQuizzesGuardados(data || []);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar el quiz");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("¿Eliminar este quiz y todas sus preguntas/respuestas?")) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Error al eliminar quiz");
      return;
    }
    toast.success("Quiz eliminado 🗑️");
    setQuizzesGuardados((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="bg-gray-900 rounded-xl p-5 shadow space-y-5">
      <h3 className="text-xl font-semibold">Quiz</h3>

      <div>
        <label className="block text-sm mb-1">Ligar a bloque</label>
        <select
          value={bloqueId}
          onChange={(e) => setBloqueId(e.target.value)}
          className="w-full bg-gray-800 rounded-lg px-3 py-2"
        >
          <option value="">— Selecciona un bloque —</option>
          {bloques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.titulo || "(Sin título)"} — {b.tipo.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
            placeholder="Ej. Quiz 1: Estructuras básicas"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">XP</label>
          <input
            type="number"
            value={xp}
            onChange={(e) => setXp(parseInt(e.target.value || "0", 10))}
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Tiempo límite (seg)</label>
          <input
            type="number"
            value={tiempo || ""}
            onChange={(e) =>
              setTiempo(e.target.value ? parseInt(e.target.value) : null)
            }
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Intentos máximos</label>
          <input
            type="number"
            value={intentosMax}
            onChange={(e) => setIntentosMax(parseInt(e.target.value || "1", 10))}
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
            min={1}
          />
        </div>
        <div className="md:col-span-6">
          <label className="block text-sm mb-1">Descripción (opcional)</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
            placeholder="Instrucciones o alcance del quiz"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Preguntas</h4>
          <button
            onClick={addPregunta}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
          >
            + Pregunta
          </button>
        </div>

        {preguntas.length === 0 && (
          <p className="text-sm text-gray-400">Aún no hay preguntas.</p>
        )}

        {preguntas.map((p, idx) => (
          <div key={p.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">
                {idx + 1}.{" "}
                <input
                  className="bg-gray-700 rounded px-2 py-1 w-3/4"
                  value={p.enunciado}
                  onChange={(e) => updatePregunta(p.id, e.target.value)}
                />
              </span>
              <button
                onClick={() => deletePregunta(p.id)}
                className="px-2 py-1 bg-red-600 rounded"
              >
                🗑
              </button>
            </div>

            {p.respuestas.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <input
                  className="flex-1 bg-gray-700 rounded px-2 py-1"
                  value={r.texto}
                  onChange={(e) =>
                    updateRespuesta(p.id, r.id, { texto: e.target.value })
                  }
                />
                <button
                  onClick={() => markCorrecta(p.id, r.id)}
                  className={`px-2 py-1 rounded ${
                    r.es_correcta ? "bg-green-600" : "bg-gray-600"
                  }`}
                >
                  ✓
                </button>
                <button
                  onClick={() => deleteRespuesta(p.id, r.id)}
                  className="px-2 py-1 rounded bg-red-600"
                >
                  🗑
                </button>
              </div>
            ))}

            <button
              onClick={() => addRespuesta(p.id)}
              className="px-2 py-1 bg-gray-700 rounded"
            >
              + Opción
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveQuiz}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar quiz"}
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold mt-4">Quizzes guardados</h4>
        {quizzesGuardados.length === 0 && (
          <p className="text-sm text-gray-400">Aún no hay quizzes en este curso.</p>
        )}
        {quizzesGuardados.map((q) => (
          <div
            key={q.id}
            className="bg-gray-800 rounded-lg px-3 py-2 flex justify-between items-center"
          >
            <span>
              {q.titulo} (XP {q.xp})
            </span>
            <button
              onClick={() => deleteQuiz(q.id)}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
