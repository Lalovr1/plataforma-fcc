/**
 * Constructor de quizzes para un curso específico.
 * - Crea y edita quizzes ligados a un bloque.
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import EditorQuizCampo from "@/components/EditorQuizCampo";

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
  const [deletedPreguntas, setDeletedPreguntas] = useState<string[]>([]);
  const [deletedRespuestas, setDeletedRespuestas] = useState<string[]>([]);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!editQuiz?.id) return;
    setDeletedPreguntas([]);
    setDeletedRespuestas([]);
  }, [editQuiz?.id]);

  const modalActivo = Boolean(editQuiz) || showFormulaModal;

  useEffect(() => {
    if (!modalActivo) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalActivo]);

    const renderPortal = (content: React.ReactNode) => {
      if (!portalReady || typeof document === "undefined") return null;
      return createPortal(content, document.body);
    };

    const hasPreviewContent = (text: string) => {
      return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|!\[[^\]]*\]\([^)]+\)/.test(text);
    };

  const decodeQuizEntities = (text: string) => {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ");
  };

  const getQuizContentKey = (text: string) => {
    const raw = decodeQuizEntities(text || "").trim();

    if (!raw) return "";

    const formulas = Array.from(raw.matchAll(/data-latex=["']([^"']+)["']/g))
      .map((match) => match[1]?.trim())
      .filter(Boolean);

    const imagenes = Array.from(raw.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/g))
      .map((match) => `imagen:${match[1]?.trim()}`)
      .filter(Boolean);

    const markdownFormulas = Array.from(raw.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g))
      .map((match) => (match[1] || match[2] || "").trim())
      .filter(Boolean);

    const textoVisible = raw
      .replace(/<span[^>]*data-type=["']inline-math["'][^>]*><\/span>/g, " ")
      .replace(/<span[^>]*data-latex=["'][^"']+["'][^>]*><\/span>/g, " ")
      .replace(/<img[^>]*>/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return [...formulas, ...markdownFormulas, ...imagenes, textoVisible]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();
  };

  const uploadQuizImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const originalName = file.name;

    const key = `${materiaId}/quizzes/imagenes/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("curso-contenido")
      .upload(key, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("curso-contenido")
      .getPublicUrl(key);

    return {
      url: data.publicUrl,
      originalName,
    };
  };

  const validateQuizPreguntas = (preguntasList: any[]) => {
    if (!Array.isArray(preguntasList) || preguntasList.length === 0) {
      toast.error("Agrega al menos una pregunta");
      return false;
    }

    for (let i = 0; i < preguntasList.length; i++) {
      const pregunta = preguntasList[i];
      const numeroPregunta = i + 1;

      if (!getQuizContentKey(pregunta.enunciado || "")) {
        toast.error(`La pregunta ${numeroPregunta} está vacía`);
        return false;
      }

      if (!Array.isArray(pregunta.respuestas) || pregunta.respuestas.length < 2) {
        toast.error(`La pregunta ${numeroPregunta} debe tener al menos 2 opciones`);
        return false;
      }

      const respuestasLimpias = pregunta.respuestas.map((r: any) =>
        getQuizContentKey(r.texto || "")
      );

      if (respuestasLimpias.some((texto: string) => !texto)) {
        toast.error(`La pregunta ${numeroPregunta} tiene opciones vacías`);
        return false;
      }

      const respuestasUnicas = new Set(respuestasLimpias);

      if (respuestasUnicas.size !== respuestasLimpias.length) {
        toast.error(`La pregunta ${numeroPregunta} tiene opciones repetidas`);
        return false;
      }

      if (!pregunta.respuestas.some((r: any) => r.es_correcta)) {
        toast.error(`La pregunta ${numeroPregunta} debe tener una respuesta correcta`);
        return false;
      }
    }

    return true;
  };

    const renderQuizPreview = (text: string) => {
      if (!text.trim() || !hasPreviewContent(text)) return null;

      return (
        <div
          className="mt-1 rounded px-2 py-2 text-sm overflow-x-auto"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px dashed var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              img: ({ ...props }) => (
                <img
                  {...props}
                  className="max-w-full max-h-40 rounded-lg my-2 cursor-pointer"
                  alt={props.alt || "Imagen del quiz"}
                />
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      );
    };

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
      const { data: preguntasData, error: preguntasError } = await supabase
        .from("preguntas")
        .select("id, enunciado, orden")
        .eq("quiz_id", editQuiz.id)
        .order("orden", { ascending: true });

      if (preguntasError) {
        console.error(preguntasError);
        return;
      }

      const preguntasConRespuestas: any[] = [];

      for (const pregunta of preguntasData || []) {
        const { data: respuestasData, error: respuestasError } = await supabase
          .from("respuestas")
          .select("id, texto, es_correcta, orden")
          .eq("pregunta_id", pregunta.id)
          .order("orden", { ascending: true });

        if (respuestasError) {
          console.error(respuestasError);
        }

        preguntasConRespuestas.push({
          ...pregunta,
          respuestas: respuestasData || [],
        });
      }

      setEditQuiz((prev: any) =>
        prev ? { ...prev, preguntas: preguntasConRespuestas } : prev
      );
    };

    fetchPreguntas();
  }, [editQuiz?.id]);

  const addPregunta = () => {
    setPreguntas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        enunciado: "",
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
                { id: crypto.randomUUID(), texto: "", es_correcta: false },
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
    if (!validateQuizPreguntas(preguntas)) {
      return;
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
            enunciado: p.enunciado.trim(),
            orden: i,
          })
          .select("id")
          .single();

        if (pErr) throw pErr;
        const pregId = preg.id;

        for (let j = 0; j < p.respuestas.length; j++) {
          const r = p.respuestas[j];

          await supabase.from("respuestas").insert({
            pregunta_id: pregId,
            texto: r.texto.trim(),
            es_correcta: r.es_correcta,
            orden: j,
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

    if (!editQuiz.titulo?.trim()) {
      toast.error("Pon un título al quiz");
      return;
    }

    if (!validateQuizPreguntas(editQuiz.preguntas || [])) {
      return;
    }

    try {
      await supabase
        .from("quizzes")
        .update({
          titulo: editQuiz.titulo.trim(),
          xp: editQuiz.xp,
          tiempo_limite_min: editQuiz.tiempo_limite_min,
          intentos_max: editQuiz.intentos_max,
        })
        .eq("id", editQuiz.id);

      if (deletedRespuestas.length > 0) {
        await supabase
          .from("respuestas")
          .delete()
          .in("id", deletedRespuestas);
      }

      if (deletedPreguntas.length > 0) {
        await supabase
          .from("preguntas")
          .delete()
          .in("id", deletedPreguntas);
      }

      for (let i = 0; i < (editQuiz.preguntas || []).length; i++) {
        const p = editQuiz.preguntas[i];

        let preguntaId = p.id;

        if (String(p.id).startsWith("_new_")) {
          const { data: nuevaPregunta, error: preguntaInsertError } = await supabase
            .from("preguntas")
            .insert({
              quiz_id: editQuiz.id,
              enunciado: p.enunciado.trim(),
              orden: i,
            })
            .select("id")
            .single();

          if (preguntaInsertError) throw preguntaInsertError;
          preguntaId = nuevaPregunta.id;
        } else {
          const { error: preguntaUpdateError } = await supabase
            .from("preguntas")
            .update({
              enunciado: p.enunciado.trim(),
              orden: i,
            })
            .eq("id", p.id);

          if (preguntaUpdateError) throw preguntaUpdateError;
        }

        for (let j = 0; j < p.respuestas.length; j++) {
          const r = p.respuestas[j];

          if (String(r.id).startsWith("_new_")) {
            const { error: respuestaInsertError } = await supabase
              .from("respuestas")
              .insert({
                pregunta_id: preguntaId,
                texto: r.texto.trim(),
                es_correcta: r.es_correcta,
                orden: j,
              });

            if (respuestaInsertError) throw respuestaInsertError;
          } else {
            const { error: respuestaUpdateError } = await supabase
              .from("respuestas")
              .update({
                texto: r.texto.trim(),
                es_correcta: r.es_correcta,
                orden: j,
              })
              .eq("id", r.id);

            if (respuestaUpdateError) throw respuestaUpdateError;
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
      setDeletedPreguntas([]);
      setDeletedRespuestas([]);
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
      className="rounded-xl p-4 sm:p-5 shadow space-y-5 min-w-0 overflow-hidden"
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
        <div>
          <h4 className="font-semibold">Preguntas</h4>
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 w-full min-w-0">
                {idx + 1}.
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0">
                    <EditorQuizCampo
                      value={p.enunciado}
                      onChange={(value) => updatePregunta(p.id, value)}
                      placeholder="Nueva pregunta"
                      onUploadImage={async (file) => {
                        const { url, originalName } = await uploadQuizImage(file);

                        return {
                          url,
                          name: originalName,
                        };
                      }}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => deletePregunta(p.id)}
                className="h-[34px] px-3 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white shrink-0 self-start"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-white"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>

            {p.respuestas.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                <div className="flex flex-col gap-1 flex-1 min-w-0 w-full">
                  <EditorQuizCampo
                    value={r.texto}
                    onChange={(value) =>
                      updateRespuesta(p.id, r.id, { texto: value })
                    }
                    placeholder="Opción de respuesta"
                    compact
                    onUploadImage={async (file) => {
                      const { url, originalName } = await uploadQuizImage(file);

                      return {
                        url,
                        name: originalName,
                      };
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => markCorrecta(p.id, r.id)}
                  className={`h-[34px] px-3 flex items-center justify-center rounded text-white shrink-0 self-start ${
                    r.es_correcta ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"
                  }`}
                >
                  <span className="text-white leading-none">✓</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteRespuesta(p.id, r.id)}
                  className="h-[34px] px-3 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white shrink-0 self-start"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 text-white"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}

            <button
              type="button"
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
        <div className="flex justify-end">
          <button
            type="button"
            onClick={addPregunta}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            + Pregunta
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveQuiz}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white w-full sm:w-auto"
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
            className="rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer min-w-0"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onClick={() => setEditQuiz({ ...q, preguntas: [] })}
          >
            <span className="break-words min-w-0">
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
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500  text-white"
            >
              Eliminar
            </button>
          </div>
        ))}

        {/* Modal de edición */}
        {editQuiz && renderPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-3 sm:p-4">
            <div
              className="p-4 sm:p-6 rounded-lg w-full max-w-5xl h-[92dvh] max-h-[92dvh] flex flex-col min-w-0"
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
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2 min-w-0">
                            <span className="font-semibold pt-1">#{idx + 1}</span>

                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <EditorQuizCampo
                                value={p.enunciado}
                                onChange={(value) =>
                                  setEditQuiz((prev: any) => ({
                                    ...prev,
                                    preguntas: prev.preguntas.map((q: any) =>
                                      q.id === p.id ? { ...q, enunciado: value } : q
                                    ),
                                  }))
                                }
                                placeholder="Nueva pregunta"
                                onUploadImage={async (file) => {
                                  const { url, originalName } = await uploadQuizImage(file);

                                  return {
                                    url,
                                    name: originalName,
                                  };
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!String(p.id).startsWith("_new_")) {
                                  setDeletedPreguntas((prev) =>
                                    prev.includes(p.id) ? prev : [...prev, p.id]
                                  );

                                  const respuestasExistentes = (p.respuestas || [])
                                    .filter((r: any) => !String(r.id).startsWith("_new_"))
                                    .map((r: any) => r.id);

                                  setDeletedRespuestas((prev) =>
                                    Array.from(new Set([...prev, ...respuestasExistentes]))
                                  );
                                }

                                setEditQuiz((prev: any) => ({
                                  ...prev,
                                  preguntas: prev.preguntas.filter((q: any) => q.id !== p.id),
                                }));
                              }}
                              className="h-[34px] px-3 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white shrink-0 self-start"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-white"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {p.respuestas.map((r: any) => (
                            <div key={r.id} className="flex flex-col sm:flex-row sm:items-start gap-2 min-w-0">
                              <div className="flex flex-col gap-1 flex-1 min-w-0 w-full">
                                <EditorQuizCampo
                                  value={r.texto}
                                  onChange={(value) =>
                                    setEditQuiz((prev: any) => ({
                                      ...prev,
                                      preguntas: prev.preguntas.map((q: any) =>
                                        q.id === p.id
                                          ? {
                                              ...q,
                                              respuestas: q.respuestas.map((x: any) =>
                                                x.id === r.id ? { ...x, texto: value } : x
                                              ),
                                            }
                                          : q
                                      ),
                                    }))
                                  }
                                  placeholder="Opción de respuesta"
                                  compact
                                  onUploadImage={async (file) => {
                                    const { url, originalName } = await uploadQuizImage(file);

                                    return {
                                      url,
                                      name: originalName,
                                    };
                                  }}
                                />
                              </div>
                              <button
                                type="button"
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
                                className={`h-[34px] px-3 flex items-center justify-center rounded text-white shrink-0 self-start ${
                                  r.es_correcta
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-gray-600 hover:bg-gray-700"
                                }`}
                              >
                                <span className="text-white leading-none">✓</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!String(r.id).startsWith("_new_")) {
                                    setDeletedRespuestas((prev) =>
                                      prev.includes(r.id) ? prev : [...prev, r.id]
                                    );
                                  }

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
                                  }));
                                }}
                                className="h-[34px] px-3 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white shrink-0 self-start"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="w-4 h-4 text-white"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.map((q: any) =>
                                  q.id === p.id
                                    ? {
                                        ...q,
                                        respuestas: [
                                          ...(q.respuestas || []),
                                          {
                                            id: `_new_${crypto.randomUUID()}`,
                                            texto: "",
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          preguntas: [
                            ...(prev.preguntas || []),
                            {
                              id: `_new_${crypto.randomUUID()}`,
                              enunciado: "",
                              respuestas: [],
                            },
                          ],
                        }))
                      }
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
                    >
                      + Pregunta
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditQuiz(null);
                    setDeletedPreguntas([]);
                    setDeletedRespuestas([]);
                  }}
                  className="px-3 py-2 bg-gray-600 rounded text-white w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditQuiz}
                  className="px-3 py-2 bg-green-600 rounded text-white w-full sm:w-auto"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de fórmulas */}
        {showFormulaModal && renderPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
            <div
              className="p-4 sm:p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <h3 className="text-lg font-bold">Insertar fórmula</h3>

              <div className="flex gap-2">
                <button
                  type="button"
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
                  type="button"
                  onClick={() => setFormulaMode("image")}
                  className={`px-3 py-1 rounded ${
                    formulaMode === "image" ? "bg-blue-600 text-white" : ""
                  }`}
                  style={ formulaMode !== "image" ? {
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
                    Funcionalidad NO disponible por el momento
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
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
