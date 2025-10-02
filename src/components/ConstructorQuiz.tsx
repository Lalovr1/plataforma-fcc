/**
 * Constructor de quizzes para un curso específico.
 * - Crea y edita quizzes ligados a un bloque.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

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
  const xp = 100;
  const [tiempoMin, setTiempoMin] = useState<number | null>(null);
  const [intentosMax, setIntentosMax] = useState(1);

  const [preguntas, setPreguntas] = useState<PreguntaLocal[]>([]);
  const [saving, setSaving] = useState(false);

  const [quizzesGuardados, setQuizzesGuardados] = useState<any[]>([]);

  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaLatex, setFormulaLatex] = useState("");
  const [formulaMode, setFormulaMode] = useState<"latex" | "image">("latex");
  const [targetTextarea, setTargetTextarea] =
    useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const [editQuiz, setEditQuiz] = useState<any | null>(null);

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
        .select("id,titulo,xp,bloque_id,intentos_max,tiempo_limite_min,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      if (!error && data) setQuizzesGuardados(data);
    };

    fetchBloques();
    fetchQuizzes();

    const channel = supabase
      .channel("bloques-changes")
      .on(
        "postgres_changes",
        {
          event: "*", 
          schema: "public",
          table: "curso_contenido_bloques",
          filter: `materia_id=eq.${materiaId}`,
        },
        () => {
          fetchBloques(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [materiaId]);

  useEffect(() => {
    if (!editQuiz?.id) return;

    const fetchPreguntas = async () => {
      const { data: preguntas, error } = await supabase
        .from("preguntas")
        .select("id, enunciado, orden, respuestas(id, texto, es_correcta)")
        .eq("quiz_id", editQuiz.id)
        .order("orden", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setEditQuiz((prev: any) =>
        prev ? { ...prev, preguntas: preguntas || [] } : prev
      );
    };

    fetchPreguntas();
  }, [editQuiz?.id]);

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
    for (const p of preguntas) {
      if (!p.respuestas.some((r) => r.es_correcta)) {
        toast.error("Cada pregunta debe tener al menos una respuesta correcta");
        return;
      }
    }
    setSaving(true);
    try {
      const orden = quizzesGuardados.length;

      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .insert({
          materia_id: materiaId,
          bloque_id: bloqueId,
          titulo,
          descripcion: descripcion || null,
          xp,
          orden,
          tiempo_limite_min: tiempoMin,
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
      setTiempoMin(null);
      setIntentosMax(1);
      setPreguntas([]);

      const { data } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id,intentos_max,tiempo_limite_min,orden")
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

  const handleSaveEditQuiz = async () => {
    if (!editQuiz) return;

    try {
      await supabase
        .from("quizzes")
        .update({
          titulo: editQuiz.titulo,
          xp: editQuiz.xp,
          tiempo_limite_min: editQuiz.tiempo_limite_min,
          intentos_max: editQuiz.intentos_max,
        })
        .eq("id", editQuiz.id);

      for (let i = 0; i < (editQuiz.preguntas || []).length; i++) {
        const p = editQuiz.preguntas[i];

        if (!p.id || p.id.length !== 36) continue;

        await supabase
          .from("preguntas")
          .update({
            enunciado: p.enunciado,
            orden: i,
          })
          .eq("id", p.id);

        for (const r of p.respuestas) {
          if (!r.id || r.id.length !== 36) {
            await supabase.from("respuestas").insert({
              pregunta_id: p.id,
              texto: r.texto,
              es_correcta: r.es_correcta,
            });
          } else {
            await supabase
              .from("respuestas")
              .update({
                texto: r.texto,
                es_correcta: r.es_correcta,
              })
              .eq("id", r.id);
          }
        }
      }

      toast.success("Quiz actualizado ✅");

      const { data } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id,intentos_max,tiempo_limite_min,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      setQuizzesGuardados(data || []);
      setEditQuiz(null);
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar quiz");
    }
  };

  const onInsertFormula = () => {
    if (!targetTextarea) return;

    const start = targetTextarea.selectionStart || 0;
    const end = targetTextarea.selectionEnd || 0;
    const before = targetTextarea.value.substring(0, start);
    const after = targetTextarea.value.substring(end);

    const insertion = formulaMode === "latex" ? `$$${formulaLatex}$$` : "[[Fórmula de imagen]]";
    const newValue = before + insertion + after;

    (targetTextarea as any).value = newValue;
    targetTextarea.dispatchEvent(new Event("input", { bubbles: true }));

    const pidEdit = targetTextarea.getAttribute("data-pid");
    const ridEdit = targetTextarea.getAttribute("data-rid");

    const idCrear = targetTextarea.getAttribute("data-id");
    const pidCrear = targetTextarea.getAttribute("data-pid");
    const ridCrear = targetTextarea.getAttribute("data-rid");

    if (editQuiz && (pidEdit || ridEdit)) {
      if (pidEdit && ridEdit) {
        setEditQuiz((prev: any) => ({
          ...prev,
          preguntas: prev.preguntas.map((p: any) =>
            p.id === pidEdit
              ? {
                  ...p,
                  respuestas: p.respuestas.map((r: any) =>
                    r.id === ridEdit ? { ...r, texto: newValue } : r
                  ),
                }
              : p
          ),
        }));
      } else if (pidEdit) {
        setEditQuiz((prev: any) => ({
          ...prev,
          preguntas: prev.preguntas.map((p: any) =>
            p.id === pidEdit ? { ...p, enunciado: newValue } : p
          ),
        }));
      }
    } else {
      if (idCrear && !ridCrear) {
        setPreguntas((prev) =>
          prev.map((p) => (p.id === idCrear ? { ...p, enunciado: newValue } : p))
        );
      } else if (pidCrear && ridCrear) {
        setPreguntas((prev) =>
          prev.map((p) =>
            p.id === pidCrear
              ? {
                  ...p,
                  respuestas: p.respuestas.map((r) =>
                    r.id === ridCrear ? { ...r, texto: newValue } : r
                  ),
                }
              : p
          )
        );
      }
    }

    setFormulaLatex("");
    setShowFormulaModal(false);
  };

  return (
    <div
      className="rounded-xl p-5 shadow space-y-5"
      style={{
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      <h3 className="text-xl font-semibold" style={{ color: "var(--color-heading)" }}>
        Quiz
      </h3>

      <div>
        <label className="block text-sm mb-1">Ligar a bloque</label>
        <select
          value={bloqueId}
          onChange={(e) => setBloqueId(e.target.value)}
          className="w-full rounded-lg px-3 py-2"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
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
            className="w-full rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder="Ej. Quiz 1: Estructuras básicas"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Tiempo límite (min)</label>
          <input
            type="number"
            value={tiempoMin ?? ""}
            onChange={(e) =>
              setTiempoMin(e.target.value === "" ? null : parseInt(e.target.value))
            }
            className="w-full rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            min={0}
            placeholder="Ej. 15"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Intentos máximos</label>
          <input
            type="number"
            value={intentosMax}
            onChange={(e) => setIntentosMax(parseInt(e.target.value || "1", 10))}
            className="w-full rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            min={1}
          />
        </div>
        <div className="md:col-span-6">
          <label className="block text-sm mb-1">Descripción (opcional)</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder="Instrucciones o alcance del quiz"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Preguntas</h4>
          <button
            onClick={addPregunta}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            + Pregunta
          </button>
        </div>

        {preguntas.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aún no hay preguntas.
          </p>
        )}

        {preguntas.map((p, idx) => (
          <div
            key={p.id}
            className="rounded-lg p-3 space-y-2"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 w-full">
                {idx + 1}.
                <div className="flex gap-2 flex-1">
                  <textarea
                    data-id={p.id}
                    className="font-semibold rounded px-2 py-1 w-full resize-y min-h-[28px] leading-snug"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                    value={p.enunciado}
                    onChange={(e) => updatePregunta(p.id, e.target.value)}
                    placeholder="Escribe la pregunta (Markdown + LaTeX)"
                    rows={1}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.currentTarget.previousSibling as HTMLTextAreaElement);
                      setTargetTextarea(input);
                      setShowFormulaModal(true);
                    }}
                    className="bg-blue-600 text-white text-xs px-3 py-1 rounded h-full"
                  >
                    ➕Fórmula
                  </button>
                </div>
              </span>
              <button
                onClick={() => deletePregunta(p.id)}
                className="px-2 py-1 bg-red-600 rounded ml-2"
              >
                🗑
              </button>
            </div>

            {p.respuestas.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <div className="flex gap-2 flex-1">
                <input
                  data-pid={p.id}
                  data-rid={r.id}
                  className="w-full rounded px-2 py-1"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  value={r.texto}
                  onChange={(e) =>
                    updateRespuesta(p.id, r.id, { texto: e.target.value })
                  }
                  placeholder="Opción de respuesta (Markdown + LaTeX)"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    setTargetTextarea(input);
                    setShowFormulaModal(true);
                  }}
                  className="bg-blue-600 text-white text-xs px-3 py-1 rounded h-full"
                >
                  ➕Fórmula
                </button>
              </div>
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
              className="px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
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
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aún no hay quizzes en este curso.
          </p>
        )}
        {quizzesGuardados.map((q) => (
          <div
            key={q.id}
            className="rounded-lg px-3 py-2 flex justify-between items-center cursor-pointer"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onClick={() => setEditQuiz({ ...q, preguntas: [] })}
          >
            <span>
              {q.titulo} (XP {q.xp})
              {typeof q.tiempo_limite_min === "number" && q.tiempo_limite_min > 0
                ? ` — ${q.tiempo_limite_min} min`
                : " — sin límite"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteQuiz(q.id);
              }}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500"
            >
              Eliminar
            </button>
          </div>
        ))}

        {/* Modal de edición */}
        {editQuiz && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              className="p-6 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <h3 className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>
                  Editando quiz: {editQuiz.titulo}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">Título</label>
                    <input
                      value={editQuiz.titulo}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({ ...prev, titulo: e.target.value }))
                      }
                      className="w-full rounded px-3 py-2"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                      placeholder="Título"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Tiempo límite (min)</label>
                    <input
                      type="number"
                      value={editQuiz.tiempo_limite_min ?? ""}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          tiempo_limite_min:
                            e.target.value === "" ? null : parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full rounded px-3 py-2"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                      placeholder="Tiempo (min)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Intentos máximos</label>
                    <input
                      type="number"
                      value={editQuiz.intentos_max || 1}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          intentos_max: parseInt(e.target.value || "1", 10),
                        }))
                      }
                      className="w-full rounded px-3 py-2"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                      placeholder="Intentos máx"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Preguntas</h4>
                  {Array.isArray(editQuiz.preguntas) && editQuiz.preguntas.length > 0 ? (
                    editQuiz.preguntas.map((p: any, idx: number) => (
                      <div
                        key={p.id}
                        className="p-3 rounded space-y-2"
                        style={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">#{idx + 1}</span>
                          <textarea
                            data-pid={p.id}
                            value={p.enunciado}
                            onChange={(e) =>
                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.map((q: any) =>
                                  q.id === p.id ? { ...q, enunciado: e.target.value } : q
                                ),
                              }))
                            }
                            className="rounded px-2 py-1 w-full resize-y min-h-[28px] leading-snug"
                            style={{
                              backgroundColor: "var(--color-bg)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text)",
                            }}
                            rows={1}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              setTargetTextarea(e.currentTarget.previousSibling as HTMLTextAreaElement);
                              setShowFormulaModal(true);
                            }}
                            className="bg-blue-600 text-white text-xs px-3 py-1 rounded h-full"
                          >
                            ➕Fórmula
                          </button>
                          <button
                            onClick={() =>
                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.filter((q: any) => q.id !== p.id),
                              }))
                            }
                            className="px-2 py-1 bg-red-600 rounded"
                          >
                            🗑
                          </button>
                        </div>

                        <div className="space-y-2">
                          {p.respuestas.map((r: any) => (
                            <div key={r.id} className="flex items-center gap-2">
                              <div className="flex gap-2 flex-1">
                                <input
                                  data-pid={p.id}
                                  data-rid={r.id}
                                  value={r.texto}
                                  onChange={(e) =>
                                    setEditQuiz((prev: any) => ({
                                      ...prev,
                                      preguntas: prev.preguntas.map((q: any) =>
                                        q.id === p.id
                                          ? {
                                              ...q,
                                              respuestas: q.respuestas.map((x: any) =>
                                                x.id === r.id ? { ...x, texto: e.target.value } : x
                                              ),
                                            }
                                          : q
                                      ),
                                    }))
                                  }
                                  className="w-full rounded px-3 py-1"
                                  style={{
                                    backgroundColor: "var(--color-bg)",
                                    border: "1px solid var(--color-border)",
                                    color: "var(--color-text)",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    setTargetTextarea(
                                      e.currentTarget.previousSibling as HTMLInputElement
                                    );
                                    setShowFormulaModal(true);
                                  }}
                                  className="bg-blue-600 text-white text-xs px-3 py-1 rounded h-full"
                                >
                                  ➕Fórmula
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  setEditQuiz((prev: any) => ({
                                    ...prev,
                                    preguntas: prev.preguntas.map((q: any) =>
                                      q.id === p.id
                                        ? {
                                            ...q,
                                            respuestas: q.respuestas.map((x: any) => ({
                                              ...x,
                                              es_correcta: x.id === r.id,
                                            })),
                                          }
                                        : q
                                    ),
                                  }))
                                }
                                className={`px-2 py-1 rounded ${
                                  r.es_correcta ? "bg-green-600" : "bg-gray-600"
                                }`}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() =>
                                  setEditQuiz((prev: any) => ({
                                    ...prev,
                                    preguntas: prev.preguntas.map((q: any) =>
                                      q.id === p.id
                                        ? {
                                            ...q,
                                            respuestas: q.respuestas.filter((x: any) => x.id !== r.id),
                                          }
                                        : q
                                    ),
                                  }))
                                }
                                className="px-2 py-1 bg-red-600 rounded"
                              >
                                🗑
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.map((q: any) =>
                                  q.id === p.id
                                    ? {
                                        ...q,
                                        respuestas: [
                                          ...q.respuestas,
                                          {
                                            id: crypto.randomUUID(),
                                            texto: "Opción",
                                            es_correcta: false,
                                          },
                                        ],
                                      }
                                    : q
                                ),
                              }))
                            }
                            className="px-2 py-1 rounded"
                            style={{
                              backgroundColor: "var(--color-bg)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text)",
                            }}
                          >
                            + Opción
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">Aún no hay preguntas.</p>
                  )}
                  <button
                    onClick={() =>
                      setEditQuiz((prev: any) => ({
                        ...prev,
                        preguntas: [
                          ...prev.preguntas,
                          {
                            id: crypto.randomUUID(),
                            enunciado: "Nueva pregunta",
                            respuestas: [],
                          },
                        ],
                      }))
                    }
                    className="px-3 py-1 bg-blue-600 rounded text-white"
                  >
                    + Pregunta
                  </button>
                </div>
              </div>
              <div
                className="flex justify-end gap-2 pt-3 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  onClick={() => setEditQuiz(null)}
                  className="px-3 py-1 bg-gray-600 rounded text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditQuiz}
                  className="px-3 py-1 bg-green-600 rounded text-white"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de fórmulas */}
        {showFormulaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              className="p-6 rounded-lg w-full max-w-lg space-y-4"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <h3 className="text-lg font-bold">Insertar fórmula</h3>

              <div className="flex gap-2">
                <button
                  onClick={() => setFormulaMode("latex")}
                  className={`px-3 py-1 rounded ${
                    formulaMode === "latex" ? "bg-blue-600 text-white" : ""
                  }`}
                  style={ formulaMode !== "latex" ? {
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  } : {} }
                >
                  LaTeX
                </button>
                <button
                  onClick={() => setFormulaMode("image")}
                  className={`px-3 py-1 rounded ${
                    formulaMode === "latex" ? "bg-blue-600 text-white" : ""
                  }`}
                  style={ formulaMode !== "latex" ? {
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  } : {} }
                >
                  Imagen
                </button>
              </div>

              {formulaMode === "latex" ? (
                <>
                  <textarea
                    value={formulaLatex}
                    onChange={(e) => setFormulaLatex(e.target.value)}
                    rows={3}
                    className="w-full rounded px-3 py-2"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                    placeholder="Ecuación en LaTeX, ej. \int_0^1 x^2 dx"
                  />
                  <div
                    className="rounded p-3 text-center"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                      Vista previa:
                    </p>
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {`$$${formulaLatex}$$`}
                    </ReactMarkdown>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <input type="file" accept="image/*" className="w-full text-sm" />
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Aquí conectarías tu OCR (imagen → LaTeX) más adelante.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="px-3 py-1 bg-gray-600 rounded text-white"
                >
                  Cancelar
                </button>
                <button onClick={onInsertFormula} className="px-3 py-1 bg-green-600 rounded text-white">
                  Insertar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
