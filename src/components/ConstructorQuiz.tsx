/**
 * Constructor de quizzes para un curso específico.
 * - Crea y edita quizzes ligados a un bloque.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import EditorQuizCampo from "@/components/EditorQuizCampo";
import { Check, ChevronDown, ChevronUp, Plus, Save, Trash2, X } from "lucide-react";

type Bloque = {
  id: string;
  titulo?: string | null;
  tipo: string;
  unidad_id?: string | null;
  orden?: number | null;
};

type Unidad = {
  id: string;
  numero: number;
  nombre?: string | null;
  orden?: number | null;
};
type PreguntaLocal = {
  id: string;
  enunciado: string;
  respuestas: { id: string; texto: string; es_correcta: boolean }[];
};

export default function ConstructorQuiz({ materiaId }: { materiaId: string }) {
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [bloqueId, setBloqueId] = useState<string>("");
  const [unidadQuizzesAbiertaId, setUnidadQuizzesAbiertaId] =
    useState<string | null>(null);
  const [bloqueQuizzesAbiertoId, setBloqueQuizzesAbiertoId] =
    useState<string | null>(null);

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
  const [quizCargando, setQuizCargando] = useState<any | null>(null);
  const [quizAEliminar, setQuizAEliminar] = useState<any | null>(null);
  const [deletedPreguntas, setDeletedPreguntas] = useState<string[]>([]);
  const [deletedRespuestas, setDeletedRespuestas] = useState<string[]>([]);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!editQuiz && !showFormulaModal && !quizAEliminar && !quizCargando) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editQuiz, showFormulaModal, quizAEliminar, quizCargando]);

  useEffect(() => {
    if (!editQuiz?.id) return;
    setDeletedPreguntas([]);
    setDeletedRespuestas([]);
  }, [editQuiz?.id]);

  const modalActivo = Boolean(editQuiz) || showFormulaModal || Boolean(quizCargando);

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

  const bloquesPorUnidad = useMemo(() => {
    const agrupados: Record<string, Bloque[]> = {};

    bloques.forEach((bloque) => {
      const unidadKey = bloque.unidad_id || "__sin_unidad__";

      if (!agrupados[unidadKey]) {
        agrupados[unidadKey] = [];
      }

      agrupados[unidadKey].push(bloque);
    });

    return agrupados;
  }, [bloques]);

  const quizzesPorBloque = useMemo(() => {
    const agrupados: Record<string, any[]> = {};

    quizzesGuardados.forEach((quiz) => {
      const bloqueKey = quiz.bloque_id || "__sin_bloque__";

      if (!agrupados[bloqueKey]) {
        agrupados[bloqueKey] = [];
      }

      agrupados[bloqueKey].push(quiz);
    });

    return agrupados;
  }, [quizzesGuardados]);

  const unidadesListado = useMemo(() => {
    const salida: Array<Unidad & { synthetic?: boolean }> = [...unidades];

    if ((bloquesPorUnidad["__sin_unidad__"] || []).length > 0) {
      salida.push({
        id: "__sin_unidad__",
        numero: 0,
        nombre: "Sin unidad",
        synthetic: true,
      });
    }

    return salida;
  }, [unidades, bloquesPorUnidad]);

  const contarQuizzesDeUnidad = (unidadId: string) => {
    const bloquesUnidad = bloquesPorUnidad[unidadId] || [];

    return bloquesUnidad.reduce(
      (total, bloque) => total + (quizzesPorBloque[bloque.id]?.length || 0),
      0
    );
  };

  useEffect(() => {
    const fetchBloques = async () => {
      const { data, error } = await supabase
        .from("curso_contenido_bloques")
        .select("id,titulo,tipo,unidad_id,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });
      if (!error && data) setBloques(data as Bloque[]);
    };

    const fetchUnidades = async () => {
      const { data, error } = await supabase
        .from("curso_unidades")
        .select("id,numero,nombre,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      if (!error && data) setUnidades(data as Unidad[]);
    };

    const fetchQuizzes = async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id,intentos_max,tiempo_limite_min,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      if (!error && data) setQuizzesGuardados(data);
    };

    fetchUnidades();
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

  const cargarPreguntasDeQuiz = async (quizId: string) => {
    const { data: preguntasData, error: preguntasError } = await supabase
      .from("preguntas")
      .select("id, enunciado, orden")
      .eq("quiz_id", quizId)
      .order("orden", { ascending: true });

    if (preguntasError) {
      console.error(preguntasError);
      throw preguntasError;
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

    return preguntasConRespuestas;
  };

  const abrirQuizGuardado = async (quiz: any) => {
    setQuizCargando(quiz);

    try {
      const preguntasCargadas = await cargarPreguntasDeQuiz(quiz.id);

      setDeletedPreguntas([]);
      setDeletedRespuestas([]);
      setEditQuiz({
        ...quiz,
        preguntas: preguntasCargadas,
        preguntasCargadas: true,
      });
    } catch (error) {
      console.error("Error cargando quiz:", error);
      toast.error("No se pudo cargar el quiz");
    } finally {
      setQuizCargando(null);
    }
  };

  useEffect(() => {
    if (!editQuiz?.id || editQuiz.preguntasCargadas) return;

    const fetchPreguntas = async () => {
      try {
        const preguntasConRespuestas = await cargarPreguntasDeQuiz(editQuiz.id);

        setEditQuiz((prev: any) =>
          prev
            ? {
                ...prev,
                preguntas: preguntasConRespuestas,
                preguntasCargadas: true,
              }
            : prev
        );
      } catch (error) {
        console.error(error);
      }
    };

    fetchPreguntas();
  }, [editQuiz?.id, editQuiz?.preguntasCargadas]);

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

      toast.success("Quiz guardado");

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
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Error al eliminar quiz");
      return;
    }
    toast.success("Quiz eliminado");
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

      toast.success("Quiz actualizado");

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

  const estilos = (
    <style>{`
      .constructor-quiz,
      .constructor-quiz-overlay {
        --quiz-accent: var(--fcc-premium-accent);
        --quiz-cyan: var(--fcc-premium-cyan);
        --quiz-surface: var(--fcc-premium-surface);
        --quiz-surface-soft: var(--fcc-premium-surface-soft);
        --quiz-surface-strong: var(--fcc-premium-surface-strong);
        --quiz-text: var(--fcc-premium-text);
        --quiz-text-soft: var(--fcc-premium-text-soft);
        --quiz-muted: var(--fcc-premium-muted);
        --quiz-border: var(--fcc-premium-border);
        --quiz-border-strong: var(--fcc-premium-border-strong);
        --quiz-shadow: var(--fcc-premium-shadow);
        --quiz-shadow-soft: var(--fcc-premium-shadow-soft);
        --quiz-button: var(--fcc-premium-button);
      }

      .constructor-quiz {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .constructor-quiz-main-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(430px, 0.92fr);
        gap: 16px;
        align-items: start;
        min-width: 0;
      }

      .constructor-quiz-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--quiz-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface) 96%, transparent),
            color-mix(in srgb, var(--quiz-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 14%, var(--quiz-border));
        box-shadow:
          var(--quiz-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--quiz-surface-strong) 65%, transparent);
      }

      .constructor-quiz-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--quiz-accent) 6%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 24%,
            color-mix(in srgb, var(--quiz-accent) 4%, transparent) 24% 24.35%,
            transparent 24.35% 100%
          );
        opacity: 0.62;
      }

      .constructor-quiz-card.no-line::before,
      .constructor-quiz-question::before,
      .constructor-quiz-answer::before {
        content: none;
      }

      .constructor-quiz-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
      }

      .constructor-quiz-form {
        padding: clamp(16px, 2.8vw, 26px);
      }

      .constructor-quiz-grid {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(120px, 0.7fr) minmax(120px, 0.7fr);
        gap: 14px;
        align-items: end;
      }

      .constructor-quiz-full {
        grid-column: 1 / -1;
      }

      .constructor-quiz-field {
        display: grid;
        gap: 8px;
        min-width: 0;
      }

      .constructor-quiz-label {
        color: var(--quiz-text-soft);
        font-size: 0.78rem;
        font-weight: 950;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .constructor-quiz-input,
      .constructor-quiz-select,
      .constructor-quiz-textarea {
        min-height: 44px;
        width: 100%;
        border-radius: 14px;
        padding: 0 13px;
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 74%, transparent);
        border: 1px solid var(--quiz-border);
        outline: none;
        font-size: 0.92rem;
        font-weight: 750;
        transition:
          border-color 170ms ease,
          background 170ms ease;
      }

      .constructor-quiz-textarea {
        min-height: 76px;
        padding: 12px 13px;
        resize: vertical;
      }

      .constructor-quiz-input:focus,
      .constructor-quiz-select:focus,
      .constructor-quiz-textarea:focus {
        border-color: color-mix(in srgb, var(--quiz-accent) 56%, var(--quiz-border));
        background: color-mix(in srgb, var(--quiz-surface-strong) 90%, transparent);
      }

      .constructor-quiz-section-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 22px 0 14px;
        color: var(--quiz-text);
        font-size: 1.04rem;
        font-weight: 950;
        letter-spacing: -0.02em;
        text-align: center;
      }

      .constructor-quiz-section-title::before,
      .constructor-quiz-section-title::after {
        content: "";
        width: 42px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--quiz-accent) 55%, transparent)
        );
      }

      .constructor-quiz-section-title::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--quiz-accent) 55%, transparent),
          transparent
        );
      }

      .constructor-quiz-empty {
        border-radius: 18px;
        padding: 16px;
        color: var(--quiz-muted);
        background: color-mix(in srgb, var(--quiz-surface-strong) 58%, transparent);
        border: 1px dashed color-mix(in srgb, var(--quiz-accent) 20%, var(--quiz-border));
        font-size: 0.92rem;
        font-weight: 750;
        text-align: center;
      }

      .constructor-quiz-list {
        display: grid;
        gap: 12px;
      }

      .constructor-quiz-question {
        position: relative;
        overflow: visible;
        border-radius: 22px;
        padding: 54px 16px 18px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface) 98%, transparent),
            color-mix(in srgb, var(--quiz-surface-strong) 58%, transparent)
          );
        border: 1px solid color-mix(in srgb, #10b981 10%, var(--quiz-border));
        box-shadow: inset 3px 0 0 color-mix(in srgb, #10b981 34%, var(--quiz-accent));
      }

      .constructor-quiz-number {
        position: absolute;
        left: 14px;
        top: 14px;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 13px;
        color: var(--quiz-accent);
        background: color-mix(in srgb, var(--quiz-accent) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 12%, transparent);
        font-size: 0.9rem;
        font-weight: 950;
      }

      .constructor-quiz-question-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
        min-width: 0;
      }

      .constructor-quiz-answers {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .constructor-quiz-answer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 8px;
        align-items: start;
        min-width: 0;
      }

      .constructor-quiz-inline-actions,
      .constructor-quiz-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 10px;
      }

      .constructor-quiz-actions {
        margin-top: 16px;
      }

      .constructor-quiz-button {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 14px;
        padding: 0 15px;
        color: #ffffff;
        background: var(--quiz-button);
        border: 1px solid transparent;
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .theme-oscuro .constructor-quiz-button {
        color: #050505;
      }

      .constructor-quiz-button:hover {
        transform: translateY(-1px);
      }

      .constructor-quiz-button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
        transform: none;
      }

      .constructor-quiz-button.secondary {
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 82%, transparent);
        border-color: var(--quiz-border);
      }

      .constructor-quiz-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .constructor-quiz-button.success {
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            #10b981,
            color-mix(in srgb, #10b981 70%, var(--quiz-accent))
          );
      }

      .constructor-quiz-icon-button {
        width: 38px;
        height: 38px;
        display: inline-grid;
        place-items: center;
        border-radius: 13px;
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 82%, transparent);
        border: 1px solid var(--quiz-border);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease,
          color 170ms ease;
      }

      .constructor-quiz-icon-button:hover {
        transform: translateY(-1px);
        border-color: var(--quiz-border-strong);
      }

      .constructor-quiz-icon-button.correct {
        color: #10b981;
        background: color-mix(in srgb, #10b981 10%, transparent);
        border-color: color-mix(in srgb, #10b981 32%, var(--quiz-border));
      }

      .constructor-quiz-icon-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .constructor-quiz-saved {
        padding: clamp(16px, 2.8vw, 22px);
      }

      .constructor-quiz-saved .constructor-quiz-section-title {
        margin-top: 2px;
      }

      .constructor-quiz-saved-list {
        display: grid;
        gap: 10px;
      }

      .constructor-quiz-unit-card {
        overflow: hidden;
        border-radius: 22px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-accent) 5%, var(--quiz-surface-strong)),
            color-mix(in srgb, var(--quiz-surface-soft) 92%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 12%, var(--quiz-border));
      }

      .constructor-quiz-unit-button,
      .constructor-quiz-block-button {
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        color: var(--quiz-text);
        text-align: center;
      }

      .constructor-quiz-unit-button {
        min-height: 64px;
        padding: 13px 14px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-accent) 6%, transparent),
            color-mix(in srgb, var(--quiz-surface-strong) 72%, transparent)
          );
      }

      .constructor-quiz-block-button {
        min-height: 54px;
        border-radius: 17px;
        padding: 10px 12px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #8b5cf6 5%, var(--quiz-surface)),
            color-mix(in srgb, var(--quiz-surface-strong) 78%, transparent)
          );
        border: 1px solid color-mix(in srgb, #8b5cf6 14%, var(--quiz-border));
        box-shadow: inset 4px 0 0 color-mix(in srgb, #8b5cf6 28%, var(--quiz-accent));
      }

      .constructor-quiz-unit-title,
      .constructor-quiz-block-title {
        display: block;
        color: var(--quiz-text);
        font-weight: 950;
        line-height: 1.18;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .constructor-quiz-unit-title {
        font-size: 0.98rem;
      }

      .constructor-quiz-block-title {
        font-size: 0.86rem;
      }

      .constructor-quiz-unit-meta,
      .constructor-quiz-block-meta {
        display: block;
        margin-top: 3px;
        color: var(--quiz-muted);
        font-size: 0.74rem;
        font-weight: 800;
      }

      .constructor-quiz-kind-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: max-content;
        margin: 0 auto 5px;
        border-radius: 999px;
        padding: 3px 9px;
        color: color-mix(in srgb, #8b5cf6 62%, var(--quiz-accent));
        background: color-mix(in srgb, #8b5cf6 4%, transparent);
        border: 1px solid color-mix(in srgb, #8b5cf6 12%, var(--quiz-border));
        font-size: 0.62rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .constructor-quiz-unit-body {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-top: 1px solid color-mix(in srgb, var(--quiz-accent) 14%, var(--quiz-border));
      }

      .constructor-quiz-block-body {
        display: grid;
        gap: 8px;
        margin-left: 12px;
        padding: 10px 0 2px 12px;
        border-left: 2px solid color-mix(in srgb, #8b5cf6 14%, var(--quiz-border));
      }

      .constructor-quiz-saved-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        border-radius: 18px;
        padding: 12px 13px;
        color: var(--quiz-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface) 98%, transparent),
            color-mix(in srgb, var(--quiz-surface-strong) 58%, transparent)
          );
        border: 1px solid color-mix(in srgb, #10b981 10%, var(--quiz-border));
        box-shadow: inset 3px 0 0 color-mix(in srgb, #10b981 34%, var(--quiz-accent));
        cursor: pointer;
        transition:
          transform 170ms ease,
          border-color 170ms ease;
      }

      .constructor-quiz-saved-row:hover {
        transform: translateY(-1px);
        border-color: var(--quiz-border-strong);
      }

      .constructor-quiz-saved-title {
        color: var(--quiz-text);
        font-size: 0.96rem;
        font-weight: 950;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .constructor-quiz-saved-meta {
        margin-top: 3px;
        color: var(--quiz-muted);
        font-size: 0.78rem;
        font-weight: 750;
      }

      .constructor-quiz-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(2, 8, 23, 0.58);
        backdrop-filter: blur(8px);
      }

      .constructor-quiz-modal {
        position: relative;
        width: min(100%, 980px);
        max-height: 92dvh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 28px;
        color: var(--quiz-text, var(--fcc-premium-text));
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface, var(--fcc-premium-surface)) 98%, transparent),
            color-mix(in srgb, var(--quiz-surface-soft, var(--fcc-premium-surface-soft)) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--quiz-accent, var(--fcc-premium-accent)) 16%, var(--quiz-border, var(--fcc-premium-border)));
        box-shadow: var(--quiz-shadow, var(--fcc-premium-shadow));
      }

      .constructor-quiz-modal.small {
        width: min(94vw, 560px);
      }

      .constructor-quiz-modal-scroll {
        overflow-y: auto;
        padding: 26px;
      }

      .constructor-quiz-modal-title {
        color: var(--quiz-text);
        font-size: clamp(1.45rem, 3vw, 2rem);
        font-weight: 950;
        letter-spacing: -0.055em;
        line-height: 1;
        text-align: center;
      }

      .constructor-quiz-modal-description {
        max-width: 640px;
        margin: 8px auto 20px;
        color: var(--quiz-muted);
        text-align: center;
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.42;
      }

      .constructor-quiz-modal-close {
        position: absolute;
        right: 16px;
        top: 16px;
        z-index: 3;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 82%, transparent);
        border: 1px solid var(--quiz-border);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          color 170ms ease;
      }

      .constructor-quiz-modal-close:hover {
        transform: translateY(-1px);
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 34%, var(--quiz-border));
      }

      .constructor-quiz-modal-actions {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        padding-top: 16px;
      }

      .constructor-quiz-warning {
        border-radius: 18px;
        padding: 14px 16px;
        color: var(--quiz-text);
        background: color-mix(in srgb, #ef4444 8%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, #ef4444 28%, var(--quiz-border));
        text-align: center;
        font-size: 0.94rem;
        font-weight: 850;
        line-height: 1.45;
      }

      .constructor-quiz-loading-box {
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: 18px;
        background: color-mix(in srgb, var(--quiz-surface-strong) 58%, transparent);
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 16%, var(--quiz-border));
      }

      .constructor-quiz-loading-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--quiz-accent);
        animation: constructorQuizLoading 950ms ease-in-out infinite;
      }

      .constructor-quiz-loading-dot:nth-child(2) {
        animation-delay: 120ms;
      }

      .constructor-quiz-loading-dot:nth-child(3) {
        animation-delay: 240ms;
      }

      @keyframes constructorQuizLoading {
        0%, 100% {
          opacity: 0.35;
          transform: translateY(0);
        }
        50% {
          opacity: 1;
          transform: translateY(-4px);
        }
      }

      .constructor-quiz-tabs {
        display: flex;
        justify-content: center;
        gap: 8px;
      }

      .constructor-quiz-preview-box {
        border-radius: 18px;
        padding: 14px;
        text-align: center;
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 66%, transparent);
        border: 1px solid var(--quiz-border);
        overflow-x: auto;
      }

      @media (max-width: 760px) {
        .constructor-quiz-form,
        .constructor-quiz-saved,
        .constructor-quiz-modal-scroll {
          padding: 16px;
        }

        .constructor-quiz-main-layout {
          grid-template-columns: 1fr;
        }

        .constructor-quiz-grid {
          grid-template-columns: 1fr;
        }

        .constructor-quiz-full {
          grid-column: auto;
        }

        .constructor-quiz-question-main,
        .constructor-quiz-answer,
        .constructor-quiz-saved-row,
        .constructor-quiz-unit-button,
        .constructor-quiz-block-button {
          grid-template-columns: 1fr;
        }

        .constructor-quiz-inline-actions,
        .constructor-quiz-actions {
          justify-content: stretch;
        }

        .constructor-quiz-button {
          width: 100%;
        }

        .constructor-quiz-icon-button {
          width: 100%;
        }
      }
    `}</style>
  );

  return (
    <div className="constructor-quiz">
      {estilos}

      <div className="constructor-quiz-main-layout">
        <section className="constructor-quiz-card constructor-quiz-form no-line">
          <div className="constructor-quiz-card-content">
          <div className="constructor-quiz-grid">
            <div className="constructor-quiz-field">
              <label className="constructor-quiz-label">Título del quiz</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="constructor-quiz-input"
                placeholder="Ej. Quiz 1: Estructuras básicas"
              />
            </div>

            <div className="constructor-quiz-field">
              <label className="constructor-quiz-label">Tiempo</label>
              <input
                type="number"
                value={tiempoMin ?? ""}
                onChange={(e) =>
                  setTiempoMin(
                    e.target.value === "" ? null : parseInt(e.target.value)
                  )
                }
                className="constructor-quiz-input"
                min={0}
                placeholder="Min"
              />
            </div>

            <div className="constructor-quiz-field">
              <label className="constructor-quiz-label">Intentos</label>
              <input
                type="number"
                value={intentosMax}
                onChange={(e) =>
                  setIntentosMax(parseInt(e.target.value || "1", 10))
                }
                className="constructor-quiz-input"
                min={1}
              />
            </div>

            <div className="constructor-quiz-field constructor-quiz-full">
              <label className="constructor-quiz-label">
                Descripción (opcional)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="constructor-quiz-textarea"
                placeholder="Descripción del quiz"
              />
            </div>

            <div className="constructor-quiz-field constructor-quiz-full">
              <label className="constructor-quiz-label">Ligar a bloque</label>
              <select
                value={bloqueId}
                onChange={(e) => setBloqueId(e.target.value)}
                className="constructor-quiz-select"
              >
                <option value="">— Selecciona un bloque —</option>
                {bloques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.titulo || "(Sin título)"} — {b.tipo.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 className="constructor-quiz-section-title">Preguntas</h4>

          <div className="constructor-quiz-list">
            {preguntas.length === 0 && (
              <p className="constructor-quiz-empty">Aún no hay preguntas.</p>
            )}

            {preguntas.map((p, idx) => (
              <article key={p.id} className="constructor-quiz-question">
                <span className="constructor-quiz-number">{idx + 1}</span>

                <div className="constructor-quiz-question-main">
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

                  <button
                    type="button"
                    onClick={() => deletePregunta(p.id)}
                    className="constructor-quiz-icon-button danger"
                    aria-label="Eliminar pregunta"
                  >
                    <Trash2 size={17} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="constructor-quiz-answers">
                  {p.respuestas.map((r) => (
                    <div key={r.id} className="constructor-quiz-answer">
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

                      <button
                        type="button"
                        onClick={() => markCorrecta(p.id, r.id)}
                        className={`constructor-quiz-icon-button ${
                          r.es_correcta ? "correct" : ""
                        }`}
                        aria-label="Marcar como correcta"
                      >
                        <Check size={18} strokeWidth={2.7} />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteRespuesta(p.id, r.id)}
                        className="constructor-quiz-icon-button danger"
                        aria-label="Eliminar respuesta"
                      >
                        <Trash2 size={17} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}

                  <div className="constructor-quiz-inline-actions">
                    <button
                      type="button"
                      onClick={() => addRespuesta(p.id)}
                      className="constructor-quiz-button secondary"
                    >
                      <Plus size={16} strokeWidth={2.7} />
                      Opción
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="constructor-quiz-actions">
            <button
              type="button"
              onClick={addPregunta}
              className="constructor-quiz-button secondary"
            >
              <Plus size={17} strokeWidth={2.7} />
              Pregunta
            </button>

            <button
              type="button"
              onClick={saveQuiz}
              disabled={saving}
              className="constructor-quiz-button success"
            >
              <Save size={17} strokeWidth={2.6} />
              {saving ? "Guardando..." : "Guardar quiz"}
            </button>
          </div>
          </div>
        </section>

        <section className="constructor-quiz-card constructor-quiz-saved no-line">
          <div className="constructor-quiz-card-content">
          <h4 className="constructor-quiz-section-title">Quizzes guardados</h4>

          {quizzesGuardados.length === 0 ? (
            <p className="constructor-quiz-empty">
              Aún no hay quizzes en este curso.
            </p>
          ) : (
            <div className="constructor-quiz-saved-list">
              {unidadesListado.map((unidadItem) => {
                const unidadId = unidadItem.id;
                const abierta = unidadQuizzesAbiertaId === unidadId;
                const bloquesUnidad = bloquesPorUnidad[unidadId] || [];
                const quizzesUnidad = contarQuizzesDeUnidad(unidadId);

                return (
                  <article key={unidadId} className="constructor-quiz-unit-card">
                    <button
                      type="button"
                      className="constructor-quiz-unit-button"
                      onClick={() =>
                        setUnidadQuizzesAbiertaId((prev) =>
                          prev === unidadId ? null : unidadId
                        )
                      }
                    >
                      <span className="min-w-0">
                        <span
                          className="constructor-quiz-unit-title"
                          title={
                            unidadItem.synthetic
                              ? "Sin unidad"
                              : `Unidad ${unidadItem.numero}${
                                  unidadItem.nombre?.trim()
                                    ? ` - ${unidadItem.nombre.trim()}`
                                    : ""
                                }`
                          }
                        >
                          {unidadItem.synthetic
                            ? "Sin unidad"
                            : `Unidad ${unidadItem.numero}`}
                        </span>
                        <span className="constructor-quiz-unit-meta">
                          {quizzesUnidad} quiz
                          {quizzesUnidad === 1 ? "" : "zes"}
                        </span>
                      </span>

                      {abierta ? (
                        <ChevronUp size={19} strokeWidth={2.7} />
                      ) : (
                        <ChevronDown size={19} strokeWidth={2.7} />
                      )}
                    </button>

                    {abierta && (
                      <div className="constructor-quiz-unit-body">
                        {bloquesUnidad.length === 0 ? (
                          <p className="constructor-quiz-empty">
                            Esta unidad aún no tiene bloques.
                          </p>
                        ) : (
                          bloquesUnidad.map((bloque) => {
                            const quizzesBloque = quizzesPorBloque[bloque.id] || [];
                            const bloqueAbierto =
                              bloqueQuizzesAbiertoId === bloque.id;

                            return (
                              <div key={bloque.id}>
                                <button
                                  type="button"
                                  className="constructor-quiz-block-button"
                                  onClick={() =>
                                    setBloqueQuizzesAbiertoId((prev) =>
                                      prev === bloque.id ? null : bloque.id
                                    )
                                  }
                                >
                                  <span className="min-w-0">
                                    <span className="constructor-quiz-kind-label">
                                      Tema
                                    </span>
                                    <span
                                      className="constructor-quiz-block-title"
                                      title={bloque.titulo || "(Sin título)"}
                                    >
                                      {bloque.titulo || "(Sin título)"}
                                    </span>
                                    <span className="constructor-quiz-block-meta">
                                      {quizzesBloque.length} quiz
                                      {quizzesBloque.length === 1 ? "" : "zes"}
                                    </span>
                                  </span>

                                  {bloqueAbierto ? (
                                    <ChevronUp size={18} strokeWidth={2.7} />
                                  ) : (
                                    <ChevronDown size={18} strokeWidth={2.7} />
                                  )}
                                </button>

                                {bloqueAbierto && (
                                  <div className="constructor-quiz-block-body">
                                    {quizzesBloque.length === 0 ? (
                                      <p className="constructor-quiz-empty">
                                        Este bloque aún no tiene quizzes.
                                      </p>
                                    ) : (
                                      quizzesBloque.map((q) => (
                                        <article
                                          key={q.id}
                                          className="constructor-quiz-saved-row"
                                          onClick={() => void abrirQuizGuardado(q)}
                                        >
                                          <div>
                                            <p
                                              className="constructor-quiz-saved-title"
                                              title={q.titulo}
                                            >
                                              {q.titulo}
                                            </p>
                                            <p className="constructor-quiz-saved-meta">
                                              {typeof q.tiempo_limite_min ===
                                                "number" &&
                                              q.tiempo_limite_min > 0
                                                ? `${q.tiempo_limite_min} min`
                                                : "Sin límite de tiempo"}
                                              {" · "}
                                              {q.intentos_max || 1}{" "}
                                              {(q.intentos_max || 1) === 1
                                                ? "intento"
                                                : "intentos"}
                                            </p>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setQuizAEliminar(q);
                                            }}
                                            className="constructor-quiz-icon-button danger"
                                            aria-label="Eliminar quiz"
                                          >
                                            <Trash2 size={17} strokeWidth={2.5} />
                                          </button>
                                        </article>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </section>
      </div>

      {quizCargando &&
        renderPortal(
          <div className="constructor-quiz-overlay">
            <div className="constructor-quiz-modal small">
              <div className="constructor-quiz-modal-scroll">
                <h3 className="constructor-quiz-modal-title">
                  Cargando quiz
                </h3>

                <p className="constructor-quiz-modal-description">
                  Estamos preparando las preguntas y respuestas.
                </p>

                <div className="constructor-quiz-loading-box">
                  <span className="constructor-quiz-loading-dot" />
                  <span className="constructor-quiz-loading-dot" />
                  <span className="constructor-quiz-loading-dot" />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {editQuiz &&
        renderPortal(
          <div className="constructor-quiz-overlay">
            <div className="constructor-quiz-modal">
              <button
                type="button"
                onClick={() => {
                  setEditQuiz(null);
                  setDeletedPreguntas([]);
                  setDeletedRespuestas([]);
                }}
                className="constructor-quiz-modal-close"
                aria-label="Cerrar edición"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="constructor-quiz-modal-scroll">
                <h3 className="constructor-quiz-modal-title">
                  Editar quiz
                </h3>

                <p className="constructor-quiz-modal-description">
                  Actualiza los datos, preguntas y respuestas de este quiz.
                </p>

                <div className="constructor-quiz-grid">
                  <div className="constructor-quiz-field">
                    <label className="constructor-quiz-label">Título</label>
                    <input
                      value={editQuiz.titulo}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          titulo: e.target.value,
                        }))
                      }
                      className="constructor-quiz-input"
                      placeholder="Título"
                    />
                  </div>

                  <div className="constructor-quiz-field">
                    <label className="constructor-quiz-label">Tiempo</label>
                    <input
                      type="number"
                      value={editQuiz.tiempo_limite_min ?? ""}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          tiempo_limite_min:
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value, 10),
                        }))
                      }
                      className="constructor-quiz-input"
                      placeholder="Min"
                    />
                  </div>

                  <div className="constructor-quiz-field">
                    <label className="constructor-quiz-label">Intentos</label>
                    <input
                      type="number"
                      value={editQuiz.intentos_max || 1}
                      onChange={(e) =>
                        setEditQuiz((prev: any) => ({
                          ...prev,
                          intentos_max: parseInt(e.target.value || "1", 10),
                        }))
                      }
                      className="constructor-quiz-input"
                      placeholder="Intentos"
                    />
                  </div>
                </div>

                <h4 className="constructor-quiz-section-title">
                  Preguntas
                </h4>

                <div className="constructor-quiz-list">
                  {Array.isArray(editQuiz.preguntas) &&
                  editQuiz.preguntas.length > 0 ? (
                    editQuiz.preguntas.map((p: any, idx: number) => (
                      <article key={p.id} className="constructor-quiz-question">
                        <span className="constructor-quiz-number">{idx + 1}</span>

                        <div className="constructor-quiz-question-main">
                          <EditorQuizCampo
                            value={p.enunciado}
                            onChange={(value) =>
                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.map((q: any) =>
                                  q.id === p.id
                                    ? { ...q, enunciado: value }
                                    : q
                                ),
                              }))
                            }
                            placeholder="Nueva pregunta"
                            onUploadImage={async (file) => {
                              const { url, originalName } =
                                await uploadQuizImage(file);

                              return {
                                url,
                                name: originalName,
                              };
                            }}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              if (!String(p.id).startsWith("_new_")) {
                                setDeletedPreguntas((prev) =>
                                  prev.includes(p.id) ? prev : [...prev, p.id]
                                );

                                const respuestasExistentes = (p.respuestas || [])
                                  .filter(
                                    (r: any) => !String(r.id).startsWith("_new_")
                                  )
                                  .map((r: any) => r.id);

                                setDeletedRespuestas((prev) =>
                                  Array.from(
                                    new Set([...prev, ...respuestasExistentes])
                                  )
                                );
                              }

                              setEditQuiz((prev: any) => ({
                                ...prev,
                                preguntas: prev.preguntas.filter(
                                  (q: any) => q.id !== p.id
                                ),
                              }));
                            }}
                            className="constructor-quiz-icon-button danger"
                            aria-label="Eliminar pregunta"
                          >
                            <Trash2 size={17} strokeWidth={2.5} />
                          </button>
                        </div>

                        <div className="constructor-quiz-answers">
                          {p.respuestas.map((r: any) => (
                            <div key={r.id} className="constructor-quiz-answer">
                              <EditorQuizCampo
                                value={r.texto}
                                onChange={(value) =>
                                  setEditQuiz((prev: any) => ({
                                    ...prev,
                                    preguntas: prev.preguntas.map((q: any) =>
                                      q.id === p.id
                                        ? {
                                            ...q,
                                            respuestas: q.respuestas.map(
                                              (x: any) =>
                                                x.id === r.id
                                                  ? { ...x, texto: value }
                                                  : x
                                            ),
                                          }
                                        : q
                                    ),
                                  }))
                                }
                                placeholder="Opción de respuesta"
                                compact
                                onUploadImage={async (file) => {
                                  const { url, originalName } =
                                    await uploadQuizImage(file);

                                  return {
                                    url,
                                    name: originalName,
                                  };
                                }}
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  setEditQuiz((prev: any) => ({
                                    ...prev,
                                    preguntas: prev.preguntas.map((q: any) =>
                                      q.id === p.id
                                        ? {
                                            ...q,
                                            respuestas: q.respuestas.map(
                                              (x: any) => ({
                                                ...x,
                                                es_correcta: x.id === r.id,
                                              })
                                            ),
                                          }
                                        : q
                                    ),
                                  }))
                                }
                                className={`constructor-quiz-icon-button ${
                                  r.es_correcta ? "correct" : ""
                                }`}
                                aria-label="Marcar como correcta"
                              >
                                <Check size={18} strokeWidth={2.7} />
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
                                            respuestas: q.respuestas.filter(
                                              (x: any) => x.id !== r.id
                                            ),
                                          }
                                        : q
                                    ),
                                  }));
                                }}
                                className="constructor-quiz-icon-button danger"
                                aria-label="Eliminar respuesta"
                              >
                                <Trash2 size={17} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}

                          <div className="constructor-quiz-inline-actions">
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
                              className="constructor-quiz-button secondary"
                            >
                              <Plus size={16} strokeWidth={2.7} />
                              Opción
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="constructor-quiz-empty">
                      Aún no hay preguntas.
                    </p>
                  )}

                  <div className="constructor-quiz-actions">
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
                      className="constructor-quiz-button secondary"
                    >
                      <Plus size={17} strokeWidth={2.7} />
                      Pregunta
                    </button>
                  </div>
                </div>

                <div className="constructor-quiz-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditQuiz(null);
                      setDeletedPreguntas([]);
                      setDeletedRespuestas([]);
                    }}
                    className="constructor-quiz-button secondary"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEditQuiz}
                    className="constructor-quiz-button success"
                  >
                    <Save size={17} strokeWidth={2.6} />
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {quizAEliminar &&
        renderPortal(
          <div
            className="constructor-quiz-overlay"
            onClick={() => setQuizAEliminar(null)}
          >
            <div
              className="constructor-quiz-modal small"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setQuizAEliminar(null)}
                className="constructor-quiz-modal-close"
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="constructor-quiz-modal-scroll">
                <h3 className="constructor-quiz-modal-title">
                  Eliminar quiz
                </h3>

                <p className="constructor-quiz-modal-description">
                  Esta acción eliminará el quiz seleccionado.
                </p>

                <div className="constructor-quiz-warning">
                  Si ya existen intentos de estudiantes, esta acción puede afectar
                  sus datos relacionados.
                </div>

                <div className="constructor-quiz-modal-actions">
                  <button
                    type="button"
                    onClick={() => setQuizAEliminar(null)}
                    className="constructor-quiz-button secondary"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await deleteQuiz(quizAEliminar.id);
                      setQuizAEliminar(null);
                    }}
                    className="constructor-quiz-button danger"
                  >
                    <Trash2 size={17} strokeWidth={2.5} />
                    Confirmar eliminación
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showFormulaModal &&
        renderPortal(
          <div className="constructor-quiz-overlay">
            <div className="constructor-quiz-modal small">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="constructor-quiz-modal-close"
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="constructor-quiz-modal-scroll">
                <h3 className="constructor-quiz-modal-title">
                  Insertar fórmula
                </h3>

                <div className="constructor-quiz-tabs">
                  <button
                    type="button"
                    onClick={() => setFormulaMode("latex")}
                    className={`constructor-quiz-button ${
                      formulaMode === "latex" ? "" : "secondary"
                    }`}
                  >
                    LaTeX
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormulaMode("image")}
                    className={`constructor-quiz-button ${
                      formulaMode === "image" ? "" : "secondary"
                    }`}
                  >
                    Imagen
                  </button>
                </div>

                {formulaMode === "latex" ? (
                  <div className="constructor-quiz-list">
                    <textarea
                      value={formulaLatex}
                      onChange={(e) => setFormulaLatex(e.target.value)}
                      rows={3}
                      className="constructor-quiz-textarea"
                      placeholder="Ecuación en LaTeX, ej. \\int_0^1 x^2 dx"
                    />

                    <div className="constructor-quiz-preview-box">
                      <p
                        style={{
                          color: "var(--quiz-muted)",
                          fontSize: "0.78rem",
                          fontWeight: 850,
                          marginBottom: 8,
                        }}
                      >
                        Vista previa
                      </p>

                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {`$$${formulaLatex}$$`}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="constructor-quiz-list">
                    <input type="file" accept="image/*" />
                    <p style={{ color: "var(--quiz-muted)", fontSize: "0.82rem" }}>
                      Funcionalidad no disponible por el momento.
                    </p>
                  </div>
                )}

                <div className="constructor-quiz-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowFormulaModal(false)}
                    className="constructor-quiz-button secondary"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={onInsertFormula}
                    className="constructor-quiz-button success"
                  >
                    Insertar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
