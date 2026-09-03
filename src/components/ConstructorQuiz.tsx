/**
 * Constructor de quizzes para un curso específico.
 * - Crea y edita quizzes ligados a un bloque.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import {
  reconciliarStorageCurso,
  subirArchivoCursoDeduplicado,
} from "@/lib/cursoStorageCliente";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import EditorQuizCampo, {
  convertirContenidoQuizATiptapHtml,
  normalizarEntradaLatex,
} from "@/components/EditorQuizCampo";
import ExplicacionesQuiz from "@/components/ExplicacionesQuiz";
import GeneradorQuizIA, {
  type BorradorQuizIA,
} from "@/components/GeneradorQuizIA";
import ConfirmarSalidaEdicion from "@/components/ConfirmarSalidaEdicion";
import CargadorFCC, {
  DURACION_MINIMA_CARGADOR_FCC_MS,
} from "@/components/CargadorFCC";
import CargadorIAFCC, {
  AvisoIAFCC,
} from "@/components/CargadorIAFCC";
import {
  ErrorIAVisible,
  mensajeErrorIA,
} from "@/lib/ai/errorPublicoCliente";
import { contenidoQuizATextoIA } from "@/lib/ai/quizMedia";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, MessageCircle, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";

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

const LIMITE_ESPERA_ANALISIS_IA_MS = 180_000;

type PreguntaLocal = {
  id: string;
  enunciado: string;
  respuestas: { id: string; texto: string; es_correcta: boolean }[];
};

export type ConstructorQuizNavigationGuard = {
  dirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

async function esperarMinimoCargadorFCC(inicio: number) {
  const transcurrido = performance.now() - inicio;
  const restante = Math.max(
    0,
    DURACION_MINIMA_CARGADOR_FCC_MS - transcurrido
  );

  if (restante <= 0) return;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, restante);
  });
}

type ResumenExplicacionesQuiz = {
  total: number;
  completas: number;
  pendientes: number;
};

async function cargarIntentosIAUsadosQuiz(quizId: string) {
  const { count, error } = await supabase
    .from("ia_analisis_quiz")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("quiz_id", quizId);

  if (error) throw error;

  return Math.min(Number(count ?? 0), 3);
}

async function cargarResumenExplicacionesQuizInicial(
  quizId: string
): Promise<ResumenExplicacionesQuiz> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No hay una sesión disponible para cargar las explicaciones.");
  }

  const response = await fetch(
    `/api/ia/explicaciones-quiz?quizId=${encodeURIComponent(quizId)}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error || "No se pudo cargar el resumen de explicaciones."
    );
  }

  return {
    total: Number(data?.resumen?.total ?? 0),
    completas: Number(data?.resumen?.completas ?? 0),
    pendientes: Number(data?.resumen?.pendientes ?? 0),
  };
}

type ConstructorQuizProps = {
  materiaId: string;
  onNavigationGuardChange?: (guard: ConstructorQuizNavigationGuard) => void;
};

export default function ConstructorQuiz({
  materiaId,
  onNavigationGuardChange,
}: ConstructorQuizProps) {
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadId, setUnidadId] = useState<string>("");
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
  const [bloquesContextoGeneracionIA, setBloquesContextoGeneracionIA] =
    useState<string[]>([]);
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

  const [vistaIA, setVistaIA] = useState<
    | "editor"
    | "confirmar"
    | "preparar"
    | "cargando"
    | "resultado_listo"
    | "tiempo_agotado"
    | "resultado"
    | "confirmar_aplicados"
  >("editor");

  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState<any | null>(null);
  const [analisisIdIA, setAnalisisIdIA] = useState<string | null>(null);
  const [finalizandoRevisionIA, setFinalizandoRevisionIA] = useState(false);
  const [mostrarExplicacionesQuiz, setMostrarExplicacionesQuiz] = useState(false);
  const [resumenExplicacionesQuiz, setResumenExplicacionesQuiz] = useState({
    total: 0,
    completas: 0,
    pendientes: 0,
  });
  const [bloquesContextoIA, setBloquesContextoIA] = useState<string[]>([]);
  const [firmaGuardadaIA, setFirmaGuardadaIA] = useState("");
  const [confirmarSalidaQuiz, setConfirmarSalidaQuiz] = useState(false);
  const [guardandoSalidaQuiz, setGuardandoSalidaQuiz] = useState(false);

  const [intentosIAUsados, setIntentosIAUsados] = useState(0);
  const [cargandoIntentosIA, setCargandoIntentosIA] = useState(false);

  const [recursosIA, setRecursosIA] = useState<any[]>([]);
  const [imagenesQuizIA, setImagenesQuizIA] = useState<any[]>([]);
  const [formulasQuizIA, setFormulasQuizIA] = useState<any[]>([]);
  const [recursosSeleccionadosIA, setRecursosSeleccionadosIA] = useState<string[]>([]);
  const [maxRecursosIA, setMaxRecursosIA] = useState(0);
  const [cargandoRecursosIA, setCargandoRecursosIA] = useState(false);
  const [errorRecursosIA, setErrorRecursosIA] = useState("");
  const [contextoAdicionalIA, setContextoAdicionalIA] = useState("");

  const [
    accionesAplicadasIA,
    setAccionesAplicadasIA,
  ] = useState<string[]>([]);

  const [
    accionesIgnoradasIA,
    setAccionesIgnoradasIA,
  ] = useState<string[]>([]);

  useEffect(() => {
    setPortalReady(true);
  }, []);


  /* FCC_STORAGE_RECONCILIACION_QUIZ */
  useEffect(() => {
    // Una sola pasada al entrar a Quizzes.
    // Crear, editar, borrar o descartar ya solicita
    // su propia reconciliacion.
    void reconciliarStorageCurso(materiaId);
  }, [materiaId]);
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

    setVistaIA("editor");
    setAnalisisIA(null);
    setAnalisisIdIA(null);
    setMostrarExplicacionesQuiz(false);
    setResumenExplicacionesQuiz(
      editQuiz._resumenExplicacionesPrecargado ?? {
        total: 0,
        completas: 0,
        pendientes: 0,
      }
    );
    setFirmaGuardadaIA("");
    setAccionesAplicadasIA([]);
    setAccionesIgnoradasIA([]);
    setRecursosIA([]);
    setImagenesQuizIA([]);
    setFormulasQuizIA([]);
    setRecursosSeleccionadosIA([]);
    setMaxRecursosIA(0);
    setErrorRecursosIA("");
    setContextoAdicionalIA("");

    setBloquesContextoIA(
      editQuiz.bloque_id ? [editQuiz.bloque_id] : []
    );
  }, [editQuiz?.id]);

  useEffect(() => {
    if (
      !editQuiz?.id ||
      !editQuiz?.preguntasCargadas ||
      firmaGuardadaIA
    ) {
      return;
    }

    setFirmaGuardadaIA(
      crearFirmaQuizEdicionIA(editQuiz)
    );
  }, [
    editQuiz?.id,
    editQuiz?.preguntasCargadas,
    firmaGuardadaIA,
  ]);

  useEffect(() => {
    if (!editQuiz?.id) {
      setIntentosIAUsados(0);
      setCargandoIntentosIA(false);
      return;
    }

    if (
      typeof editQuiz._intentosIAUsadosPrecargados === "number"
    ) {
      setIntentosIAUsados(
        editQuiz._intentosIAUsadosPrecargados
      );
      setCargandoIntentosIA(false);
      return;
    }

    let cancelado = false;

    const cargarUsoIA = async () => {
      setCargandoIntentosIA(true);

      try {
        const intentosUsados =
          await cargarIntentosIAUsadosQuiz(editQuiz.id);

        if (!cancelado) {
          setIntentosIAUsados(intentosUsados);
        }
      } catch (error) {
        console.error(
          "Error consultando uso de IA:",
          error
        );
      } finally {
        if (!cancelado) {
          setCargandoIntentosIA(false);
        }
      }
    };

    void cargarUsoIA();

    return () => {
      cancelado = true;
    };
  }, [editQuiz?.id]);

  useEffect(() => {
    if (!editQuiz?.id) {
      setResumenExplicacionesQuiz({
        total: 0,
        completas: 0,
        pendientes: 0,
      });
      return;
    }

    if (editQuiz._resumenExplicacionesPrecargado) {
      setResumenExplicacionesQuiz(
        editQuiz._resumenExplicacionesPrecargado
      );
      return;
    }

    let cancelado = false;

    const cargarResumenExplicaciones = async () => {
      try {
        const resumen =
          await cargarResumenExplicacionesQuizInicial(
            editQuiz.id
          );

        if (!cancelado) {
          setResumenExplicacionesQuiz(resumen);
        }
      } catch {
        // El editor puede seguir usándose aunque el resumen no esté disponible.
      }
    };

    void cargarResumenExplicaciones();

    return () => {
      cancelado = true;
    };
  }, [editQuiz?.id]);

  useEffect(() => {
    if (
      vistaIA !== "preparar" ||
      !editQuiz?.id
    ) {
      return;
    }

    let cancelado = false;

    const cargarRecursosIA = async () => {
      const inicioCarga = performance.now();
      setCargandoRecursosIA(true);
      setErrorRecursosIA("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Tu sesión no está disponible."
          );
        }

        const response =
          await fetch(
            "/api/ia/recursos-quiz",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  quizId:
                    editQuiz.id,

                  bloqueIds:
                    bloquesContextoIA,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.ok
        ) {
          throw new Error(
            data?.error ||
              "No se pudieron cargar los recursos."
          );
        }

        if (cancelado) return;

        const recursos =
          Array.isArray(
            data.recursos
          )
            ? data.recursos
            : [];

        setRecursosIA(
          recursos
        );

        setImagenesQuizIA(
          Array.isArray(
            data.imagenes_quiz
          )
            ? data.imagenes_quiz
            : []
        );

        setFormulasQuizIA(
          Array.isArray(
            data.formulas_quiz
          )
            ? data.formulas_quiz
            : []
        );

        setMaxRecursosIA(
          Number(
            data.max_recursos_adicionales ??
            0
          )
        );

        const idsValidos =
          new Set(
            recursos.map(
              (recurso: any) =>
                recurso.id
            )
          );

        setRecursosSeleccionadosIA(
          (prev) =>
            prev.filter(
              (id) =>
                idsValidos.has(id)
            )
        );
      } catch (error) {
        if (cancelado) return;

        setErrorRecursosIA(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los recursos."
        );
      } finally {
        await esperarMinimoCargadorFCC(inicioCarga);

        if (!cancelado) {
          setCargandoRecursosIA(false);
        }
      }
    };

    void cargarRecursosIA();

    return () => {
      cancelado = true;
    };
  }, [
    vistaIA,
    editQuiz?.id,
    bloquesContextoIA,
  ]);
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
    const {
      url,
      originalName,
    } = await subirArchivoCursoDeduplicado(
      materiaId,
      file,
      "imagenes"
    );

    return {
      url,
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

  const unidadesSeleccionables = useMemo(() => {
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

  const bloquesUnidadSeleccionada = useMemo(
    () => (unidadId ? bloquesPorUnidad[unidadId] || [] : []),
    [unidadId, bloquesPorUnidad]
  );

  const unidadesListado = useMemo(
    () =>
      unidadesSeleccionables.filter((unidad) =>
        (bloquesPorUnidad[unidad.id] || []).some(
          (bloque) => (quizzesPorBloque[bloque.id]?.length || 0) > 0
        )
      ),
    [unidadesSeleccionables, bloquesPorUnidad, quizzesPorBloque]
  );

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
    if (quizCargando) return;

    const inicioCarga = performance.now();
    setQuizCargando(quiz);

    let quizPreparado: any | null = null;

    try {
      const [
        preguntasCargadas,
        intentosIAUsadosPrecargados,
        resumenExplicacionesPrecargado,
      ] = await Promise.all([
        cargarPreguntasDeQuiz(quiz.id),
        cargarIntentosIAUsadosQuiz(quiz.id),
        cargarResumenExplicacionesQuizInicial(quiz.id),
      ]);

      quizPreparado = {
        ...quiz,
        preguntas: preguntasCargadas,
        preguntasCargadas: true,
        _intentosIAUsadosPrecargados:
          intentosIAUsadosPrecargados,
        _resumenExplicacionesPrecargado:
          resumenExplicacionesPrecargado,
      };
    } catch (error) {
      console.error("Error preparando quiz:", error);
      toast.error(
        "No se pudo cargar toda la información del quiz"
      );
    } finally {
      await esperarMinimoCargadorFCC(inicioCarga);

      if (quizPreparado) {
        setDeletedPreguntas([]);
        setDeletedRespuestas([]);
        setIntentosIAUsados(
          quizPreparado._intentosIAUsadosPrecargados
        );
        setCargandoIntentosIA(false);
        setResumenExplicacionesQuiz(
          quizPreparado._resumenExplicacionesPrecargado
        );
        setEditQuiz(quizPreparado);
      }

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

  const bloquesContextoDisponiblesIA = useMemo(() => {
    if (!editQuiz?.bloque_id) return [];

    const bloquePrincipal = bloques.find(
      (bloque) => bloque.id === editQuiz.bloque_id
    );

    if (!bloquePrincipal) return [];

    if (!bloquePrincipal.unidad_id) {
      return [bloquePrincipal];
    }

    return bloques
      .filter(
        (bloque) =>
          bloque.unidad_id === bloquePrincipal.unidad_id &&
          Number(bloque.orden ?? 0) <= Number(bloquePrincipal.orden ?? 0)
      )
      .sort(
        (a, b) =>
          Number(a.orden ?? 0) - Number(b.orden ?? 0)
      );
  }, [editQuiz?.bloque_id, bloques]);

  const toggleBloqueContextoIA = (id: string) => {
    if (id === editQuiz?.bloque_id) return;

    setBloquesContextoIA((prev) =>
      prev.includes(id)
        ? prev.filter((bloqueId) => bloqueId !== id)
        : [...prev, id]
    );

    setAnalisisIA(null);
  };

  const crearFirmaQuizEdicionIA = (quiz: any) => {
    if (!quiz) return "";

    return JSON.stringify({
      titulo: quiz.titulo?.trim() || "",
      tiempo_limite_min: quiz.tiempo_limite_min ?? null,
      intentos_max: Number(quiz.intentos_max ?? 1),

      preguntas: (quiz.preguntas || []).map(
        (pregunta: any, preguntaIndex: number) => ({
          id: String(pregunta.id),
          enunciado: pregunta.enunciado || "",
          orden: preguntaIndex,

          respuestas: (pregunta.respuestas || []).map(
            (respuesta: any, respuestaIndex: number) => ({
              id: String(respuesta.id),
              texto: respuesta.texto || "",
              es_correcta: Boolean(respuesta.es_correcta),
              orden: respuestaIndex,
            })
          ),
        })
      ),
    });
  };

  const hayCambiosSinGuardarIA = () => {
    if (!editQuiz) return false;

    if (
      deletedPreguntas.length > 0 ||
      deletedRespuestas.length > 0
    ) {
      return true;
    }

    if (!firmaGuardadaIA) {
      return false;
    }

    return (
      crearFirmaQuizEdicionIA(editQuiz) !==
      firmaGuardadaIA
    );
  };

  const abrirPreparacionAsistenteIA = () => {
    // La preparación aparece de inmediato. Los recursos opcionales terminan de
    // cargarse dentro del mismo modal, sin superponer otra pantalla.
    setCargandoRecursosIA(true);
    setVistaIA("preparar");
  };

  const abrirAsistenteIA = () => {
    if (intentosIAUsados >= 3) {
      toast.error(
        "Este quiz ya utilizó sus 3 análisis con IA."
      );
      return;
    }

    setAnalisisIA(null);

    if (hayCambiosSinGuardarIA()) {
      setVistaIA("confirmar");
      return;
    }

    abrirPreparacionAsistenteIA();
  };

  const guardarYContinuarIA = async () => {
    const guardado =
      await handleSaveEditQuiz(true);

    if (!guardado) return;

    abrirPreparacionAsistenteIA();
  };

  const normalizarTextoAnalisisIA = (
    value: unknown
  ) => {
    if (typeof value !== "string") {
      return "";
    }

    let resultado = value;

    (editQuiz?.preguntas || []).forEach(
      (pregunta: any, index: number) => {
        const etiqueta = `Pregunta ${index + 1}`;

        resultado =
          resultado
            .split(String(pregunta.id))
            .join(etiqueta);

        (pregunta.respuestas || []).forEach(
          (respuesta: any) => {
            resultado =
              resultado
                .split(String(respuesta.id))
                .join(
                  `una opción de ${etiqueta}`
                );
          }
        );
      }
    );

    resultado = resultado
      .replace(
        /la pregunta con (?:el )?id pregunta (\d+)/gi,
        "la Pregunta $1"
      )
      .replace(
        /pregunta con (?:el )?id pregunta (\d+)/gi,
        "Pregunta $1"
      )
      .replace(
        /la pregunta con (?:el )?identificador pregunta (\d+)/gi,
        "la Pregunta $1"
      )
      .replace(
        /pregunta con (?:el )?identificador pregunta (\d+)/gi,
        "Pregunta $1"
      )
      .replace(
        /\bID\s+Pregunta\s+(\d+)/gi,
        "Pregunta $1"
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

    return resultado;
  };

  const prepararContenidoMatematicoIA = (
    value: unknown
  ) => {
    let resultado = normalizarTextoAnalisisIA(
      contenidoQuizATextoIA(value)
    );

    if (
      resultado &&
      !/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(resultado) &&
      /\\(?:text|frac|dfrac|tfrac|sqrt|sum|prod|int|lim|begin|left|right|cdot|times|pm|leq|geq|neq)\b|[_^]\{/.test(
        resultado
      )
    ) {
      resultado = `$${normalizarEntradaLatex(resultado)}$`;
    }

    return resultado;
  };

  const renderContenidoMatematicoIA = (
    value: unknown,
    fallback = ""
  ) => {
    const contenido =
      prepararContenidoMatematicoIA(value) || fallback;

    if (!contenido) return null;

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {contenido}
      </ReactMarkdown>
    );
  };

  const renderFormulaIA = (value: unknown) => {
    const latex = normalizarEntradaLatex(
      String(value ?? "")
    );

    return renderContenidoMatematicoIA(
      latex ? `$${latex}$` : "",
      "Fórmula no disponible"
    );
  };

  const convertirPropuestaIAAContenidoQuiz = (
    value: unknown
  ) => {
    const original = String(value ?? "").trim();
    if (!original) return "";

    let contenido = original;
    const visible = contenidoQuizATextoIA(original);

    if (
      !/<\/?[a-z][\s\S]*>/i.test(original) &&
      !/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(original) &&
      /\\(?:text|frac|dfrac|tfrac|sqrt|sum|prod|int|lim|begin|left|right|cdot|times|pm|leq|geq|neq)\b|[_^]\{/.test(
        visible
      )
    ) {
      contenido = `$${normalizarEntradaLatex(visible)}$`;
    }

    return convertirContenidoQuizATiptapHtml(contenido);
  };

  const obtenerContenidoActualAccionIA = (
    preguntaId: string,
    accion: any
  ) => {
    const pregunta = (editQuiz?.preguntas || []).find(
      (item: any) => item.id === preguntaId
    );

    if (!pregunta) return accion?.texto_actual || "";

    if (accion?.tipo === "reescribir_pregunta") {
      return pregunta.enunciado || "";
    }

    if (accion?.tipo === "reescribir_respuesta") {
      return (
        (pregunta.respuestas || []).find(
          (respuesta: any) =>
            respuesta.id === accion.respuesta_objetivo_id
        )?.texto || accion?.texto_actual || ""
      );
    }

    if (accion?.tipo === "cambiar_respuesta_correcta") {
      return (
        (pregunta.respuestas || []).find(
          (respuesta: any) => Boolean(respuesta.es_correcta)
        )?.texto || accion?.texto_actual || ""
      );
    }

    return accion?.texto_actual || "";
  };

  const advertenciasGeneralesVisiblesIA = () => {
    return (
      analisisIA?.advertencias_generales || []
    )
      .map(
        (advertencia: string) =>
          normalizarTextoAnalisisIA(
            advertencia
          )
      )
      .filter(
        (advertencia: string) =>
          advertencia &&
          !/pregunta\s+\d+/i.test(
            advertencia
          )
      );
  };
  const claveAccionIA = (
    preguntaId: string,
    accionIndex: number
  ) => {
    return `${preguntaId}:${accionIndex}`;
  };

  const ignorarAccionIA = (
    preguntaIA: any,
    accionIndex: number
  ) => {
    const clave =
      claveAccionIA(
        preguntaIA.pregunta_id,
        accionIndex
      );

    setAccionesIgnoradasIA(
      (prev) =>
        prev.includes(clave)
          ? prev
          : [...prev, clave]
    );
  };

  const aplicarAccionIA = (
    preguntaIA: any,
    accion: any,
    accionIndex: number
  ) => {
    const preguntaId =
      preguntaIA.pregunta_id;

    const clave =
      claveAccionIA(
        preguntaId,
        accionIndex
      );

    setEditQuiz(
      (prev: any) => {
        if (!prev) return prev;

        return {
          ...prev,

          preguntas:
            (prev.preguntas || []).map(
              (pregunta: any) => {
                if (
                  pregunta.id !==
                  preguntaId
                ) {
                  return pregunta;
                }

                if (
                  accion.tipo ===
                  "cambiar_respuesta_correcta"
                ) {
                  return {
                    ...pregunta,

                    respuestas:
                      (
                        pregunta.respuestas ||
                        []
                      ).map(
                        (respuesta: any) => ({
                          ...respuesta,

                          es_correcta:
                            respuesta.id ===
                            accion.respuesta_objetivo_id,
                        })
                      ),
                  };
                }

                if (
                  accion.tipo ===
                  "reescribir_pregunta"
                ) {
                  return {
                    ...pregunta,

                    enunciado:
                      convertirPropuestaIAAContenidoQuiz(
                        accion.texto_propuesto
                      ),
                  };
                }

                if (
                  accion.tipo ===
                  "reescribir_respuesta"
                ) {
                  return {
                    ...pregunta,

                    respuestas:
                      (
                        pregunta.respuestas ||
                        []
                      ).map(
                        (respuesta: any) =>
                          respuesta.id ===
                          accion.respuesta_objetivo_id
                            ? {
                                ...respuesta,

                                texto:
                                  convertirPropuestaIAAContenidoQuiz(
                                    accion.texto_propuesto
                                  ),
                              }
                            : respuesta
                      ),
                  };
                }

                return pregunta;
              }
            ),
        };
      }
    );

    setAccionesAplicadasIA(
      (prev) =>
        prev.includes(clave)
          ? prev
          : [...prev, clave]
    );

    setAccionesIgnoradasIA(
      (prev) =>
        prev.filter(
          (item) => item !== clave
        )
    );

    toast.success(
      "Cambio seleccionado"
    );
  };
  const obtenerCambiosAprobadosIA = () => {
    if (!analisisIA?.preguntas) return [];

    return analisisIA.preguntas.flatMap(
      (preguntaIA: any, preguntaIndex: number) =>
        (preguntaIA.acciones || [])
          .map(
            (accion: any, accionIndex: number) => ({
              preguntaIA,
              preguntaIndex,
              accion,
              accionIndex,

              clave: claveAccionIA(
                preguntaIA.pregunta_id,
                accionIndex
              ),
            })
          )
          .filter((item: any) =>
            accionesAplicadasIA.includes(
              item.clave
            )
          )
    );
  };

  const volverDesdeResultadoIA = () => {
    if (
      obtenerCambiosAprobadosIA().length > 0
    ) {
      setVistaIA("confirmar_aplicados");
      return;
    }

    setVistaIA("editor");
  };

  const confirmarYGuardarCambiosIA = async () => {
    const guardado =
      await handleSaveEditQuiz(true);

    if (!guardado) return;

    setAnalisisIA(null);
    setAccionesAplicadasIA([]);
    setAccionesIgnoradasIA([]);
    setVistaIA("editor");

    toast.success(
      "Cambios de la revisión guardados"
    );
  };
  const toggleRecursoIA = (
    recursoId: string
  ) => {
    setRecursosSeleccionadosIA(
      (prev) => {
        if (
          prev.includes(
            recursoId
          )
        ) {
          return prev.filter(
            (id) =>
              id !==
              recursoId
          );
        }

        if (
          prev.length >=
          maxRecursosIA
        ) {
          toast.error(
            `Puedes seleccionar como máximo ${maxRecursosIA} recursos adicionales.`
          );

          return prev;
        }

        return [
          ...prev,
          recursoId,
        ];
      }
    );
  };
  const obtenerDecisionesIA = () => {
    if (
      !Array.isArray(
        analisisIA?.preguntas
      )
    ) {
      return [];
    }

    const decisiones: {
      pregunta_id: string;
      accion_index: number;
      decision:
        | "aplicar"
        | "ignorar";
    }[] = [];

    for (
      const preguntaIA
      of analisisIA.preguntas
    ) {
      const acciones =
        preguntaIA.acciones ||
        [];

      for (
        let accionIndex = 0;
        accionIndex <
          acciones.length;
        accionIndex++
      ) {
        const clave =
          claveAccionIA(
            preguntaIA.pregunta_id,
            accionIndex
          );

        if (
          accionesAplicadasIA.includes(
            clave
          )
        ) {
          decisiones.push({
            pregunta_id:
              preguntaIA.pregunta_id,

            accion_index:
              accionIndex,

            decision:
              "aplicar",
          });

          continue;
        }

        if (
          accionesIgnoradasIA.includes(
            clave
          )
        ) {
          decisiones.push({
            pregunta_id:
              preguntaIA.pregunta_id,

            accion_index:
              accionIndex,

            decision:
              "ignorar",
          });
        }
      }
    }

    return decisiones;
  };

  const cantidadAccionesIA = () => {
    return (
      analisisIA?.preguntas ||
      []
    ).reduce(
      (
        total: number,
        pregunta: any
      ) =>
        total +
        (
          pregunta.acciones ||
          []
        ).length,
      0
    );
  };

  const severidadPreguntaIA = (
    pregunta: any
  ): "academico" | "editorial" | "correcto" => {
    const acciones = Array.isArray(pregunta?.acciones)
      ? pregunta.acciones
      : [];

    if (
      pregunta?.estado_respuesta_correcta === "revisar" ||
      acciones.some((accion: any) => accion?.impacto === "academico")
    ) {
      return "academico";
    }

    if (
      acciones.length > 0 ||
      pregunta?.contexto_suficiente === false ||
      (Array.isArray(pregunta?.advertencias) &&
        pregunta.advertencias.length > 0)
    ) {
      return "editorial";
    }

    return "correcto";
  };

  const resumenResultadoIA = () => {
    const preguntasAnalizadas = Array.isArray(analisisIA?.preguntas)
      ? analisisIA.preguntas
      : [];
    let academicas = 0;
    let editoriales = 0;
    let correctas = 0;
    let accionesAcademicas = 0;
    let accionesEditoriales = 0;

    preguntasAnalizadas.forEach((pregunta: any) => {
      const severidad = severidadPreguntaIA(pregunta);

      if (severidad === "academico") academicas += 1;
      else if (severidad === "editorial") editoriales += 1;
      else correctas += 1;

      (pregunta.acciones || []).forEach((accion: any) => {
        if (accion?.impacto === "academico") accionesAcademicas += 1;
        else accionesEditoriales += 1;
      });
    });

    return {
      total: preguntasAnalizadas.length,
      academicas,
      editoriales,
      correctas,
      accionesAcademicas,
      accionesEditoriales,
    };
  };

  const revisionResueltaIA = () => {
    return (
      Boolean(analisisIdIA) &&
      obtenerDecisionesIA().length ===
        cantidadAccionesIA()
    );
  };

  const cantidadIgnoradasIA = () => {
    return obtenerDecisionesIA()
      .filter(
        (item) =>
          item.decision ===
          "ignorar"
      )
      .length;
  };

  const cantidadIgnoradasAcademicasIA = () => {
    if (!Array.isArray(analisisIA?.preguntas)) {
      return 0;
    }

    let total = 0;

    for (const preguntaIA of analisisIA.preguntas) {
      const acciones = preguntaIA.acciones || [];

      acciones.forEach(
        (accion: any, accionIndex: number) => {
          const clave = claveAccionIA(
            preguntaIA.pregunta_id,
            accionIndex
          );

          if (
            accion?.impacto === "academico" &&
            accionesIgnoradasIA.includes(clave)
          ) {
            total++;
          }
        }
      );
    }

    return total;
  };

  const finalizarRevisionIA = async () => {
    if (!analisisIdIA) {
      toast.error(
        "No se encontró el análisis."
      );
      return;
    }

    if (!revisionResueltaIA()) {
      toast.error(
        "Aplica o ignora todas las sugerencias antes de finalizar."
      );
      return;
    }

    try {
      setFinalizandoRevisionIA(true);

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Tu sesión no está disponible."
        );
      }

      const response =
        await fetch(
          "/api/ia/finalizar-revision",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                analisisId:
                  analisisIdIA,

                decisiones:
                  obtenerDecisionesIA(),
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          data?.error ||
            "No se pudo finalizar la revisión."
        );
      }

      const resultado =
        data?.resultado || {};

      const preguntasActualizadas =
        await cargarPreguntasDeQuiz(
          editQuiz.id
        );

      const quizActualizado = {
        ...editQuiz,

        preguntas:
          preguntasActualizadas,

        preguntasCargadas:
          true,
      };

      setEditQuiz(
        quizActualizado
      );

      setFirmaGuardadaIA(
        crearFirmaQuizEdicionIA(
          quizActualizado
        )
      );

      setAnalisisIA(null);
      setAnalisisIdIA(null);

      setAccionesAplicadasIA([]);
      setAccionesIgnoradasIA([]);

      setVistaIA("editor");
      setMostrarExplicacionesQuiz(true);

      const manuales =
        Number(
          resultado
            ?.feedback_manual_pendiente ??
          0
        );

      setResumenExplicacionesQuiz((prev) => ({
        ...prev,
        pendientes: manuales,
      }));

      toast.success(
        "Revisión finalizada. Revisa las explicaciones para estudiantes."
      );
    } catch (error) {
      console.warn(
        "No se pudo finalizar la revisión IA:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo finalizar la revisión."
      );
    } finally {
      setFinalizandoRevisionIA(false);
    }
  };
  const crearSnapshotQuizIA = () => {
    return (editQuiz?.preguntas || []).map(
      (pregunta: any, preguntaIndex: number) => ({
        id: String(pregunta.id),
        enunciado: pregunta.enunciado || "",
        orden: preguntaIndex,

        respuestas: (pregunta.respuestas || []).map(
          (respuesta: any, respuestaIndex: number) => ({
            id: String(respuesta.id),
            texto: respuesta.texto || "",
            es_correcta: Boolean(respuesta.es_correcta),
            orden: respuestaIndex,
          })
        ),
      })
    );
  };

  const analizarQuizConIA = async () => {
    if (!editQuiz?.id) return;

    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      () => controlador.abort(),
      LIMITE_ESPERA_ANALISIS_IA_MS
    );

    try {
      setAnalizandoIA(true);
      setAnalisisIA(null);
      setAccionesAplicadasIA([]);
      setAccionesIgnoradasIA([]);
      setVistaIA("cargando");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new ErrorIAVisible(
          "Tu sesión no está disponible. Vuelve a iniciar sesión."
        );
      }

      const response = await fetch(
        "/api/ia/analizar-quiz",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            quizId: editQuiz.id,

            bloqueIds:
              bloquesContextoIA,

            snapshot:
              crearSnapshotQuizIA(),

            recursosSeleccionados:
              recursosSeleccionadosIA,

            contextoAdicional:
              contextoAdicionalIA.trim(),
          }),

          signal: controlador.signal,
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (data?.code === "AI_TIMEOUT") {
        setVistaIA("tiempo_agotado");
        return;
      }

      if (!response.ok || !data?.ok) {
        throw new ErrorIAVisible(
          mensajeErrorIA(
            data,
            "analizar"
          )
        );
      }

      setAnalisisIA(
        data.analisis
      );

      setAnalisisIdIA(
        typeof data?.analisis_id ===
        "string"
          ? data.analisis_id
          : null
      );

      if (data?.uso?.usados != null) {
        setIntentosIAUsados(
          Number(data.uso.usados)
        );
      } else {
        setIntentosIAUsados(
          (prev) => Math.min(prev + 1, 3)
        );
      }

      setVistaIA("resultado_listo");
    } catch (error) {
      console.warn(
        "No se pudo completar el análisis con IA:",
        error
      );

      const tiempoAgotado =
        controlador.signal.aborted ||
        (error instanceof Error && error.name === "AbortError");

      if (tiempoAgotado) {
        setVistaIA("tiempo_agotado");
        return;
      }

      abrirPreparacionAsistenteIA();

      toast.error(
        error instanceof ErrorIAVisible
          ? error.message
          : "No se pudo analizar el quiz con IA en este momento. No se descontó ningún intento."
      );
    } finally {
      window.clearTimeout(temporizador);
      setAnalizandoIA(false);
    }
  };
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

  const aplicarBorradorGeneradoIA = (
    borrador: BorradorQuizIA,
    bloqueIds: string[]
  ) => {
    setTitulo(borrador.titulo || "");
    setDescripcion(borrador.descripcion || "");
    setPreguntas(
      (borrador.preguntas || []).map((pregunta) => ({
        id: crypto.randomUUID(),
        enunciado: convertirContenidoQuizATiptapHtml(pregunta.enunciado),
        respuestas: (pregunta.respuestas || []).map((respuesta) => ({
          id: crypto.randomUUID(),
          texto: convertirContenidoQuizATiptapHtml(respuesta.texto),
          es_correcta: Boolean(respuesta.es_correcta),
        })),
      }))
    );
    setBloquesContextoGeneracionIA(
      Array.from(new Set([bloqueId, ...bloqueIds].filter(Boolean)))
    );
  };

  const registrarContextoGeneracionQuiz = async (quizId: string) => {
    if (bloquesContextoGeneracionIA.length <= 1) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Tu sesión no está disponible para registrar el contexto del quiz.");
    }

    const response = await fetch("/api/ia/contexto-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        materiaId,
        quizId,
        origen: "generacion",
        bloqueIds: bloquesContextoGeneracionIA,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error || "No se pudo registrar el contenido utilizado por el quiz."
      );
    }
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

      await registrarContextoGeneracionQuiz(quizId);

      toast.success("Quiz guardado");

      setTitulo("");
      setDescripcion("");
      setTiempoMin(null);
      setIntentosMax(1);
      setPreguntas([]);
      setBloquesContextoGeneracionIA([]);

      const { data } = await supabase
        .from("quizzes")
        .select("id,titulo,xp,bloque_id,intentos_max,tiempo_limite_min,orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });
      setQuizzesGuardados(data || []);
      await reconciliarStorageCurso(materiaId);
      return true;
    } catch (err) {
      console.error(err);
      void reconciliarStorageCurso(materiaId);
      toast.error("No se pudo guardar el quiz");
      return false;
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

    await reconciliarStorageCurso(materiaId);

    toast.success("Quiz eliminado");
    setQuizzesGuardados((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSaveEditQuiz = async (mantenerAbierto = false) => {
    if (!editQuiz) return false;

    if (!editQuiz.titulo?.trim()) {
      toast.error("Pon un título al quiz");
      return false;
    }

    if (!validateQuizPreguntas(editQuiz.preguntas || [])) {
      return false;
    }

    try {
      const preguntasEditadas = editQuiz.preguntas || [];
      const preguntasExistentesIds = preguntasEditadas
        .filter((pregunta: any) => !String(pregunta.id).startsWith("_new_"))
        .map((pregunta: any) => String(pregunta.id));

      const preguntasActualesMap = new Map<string, any>();
      const respuestasActualesMap = new Map<string, any>();
      const respuestasPorPregunta = new Map<string, any[]>();

      if (preguntasExistentesIds.length > 0) {
        const {
          data: preguntasActuales,
          error: preguntasActualesError,
        } = await supabase
          .from("preguntas")
          .select("id,enunciado,orden")
          .in("id", preguntasExistentesIds);

        if (preguntasActualesError) {
          throw preguntasActualesError;
        }

        (preguntasActuales || []).forEach((pregunta: any) => {
          preguntasActualesMap.set(String(pregunta.id), pregunta);
        });

        const {
          data: respuestasActuales,
          error: respuestasActualesError,
        } = await supabase
          .from("respuestas")
          .select("id,pregunta_id,texto,es_correcta,orden")
          .in("pregunta_id", preguntasExistentesIds);

        if (respuestasActualesError) {
          throw respuestasActualesError;
        }

        (respuestasActuales || []).forEach((respuesta: any) => {
          respuestasActualesMap.set(String(respuesta.id), respuesta);

          const preguntaId = String(respuesta.pregunta_id);
          const lista = respuestasPorPregunta.get(preguntaId) || [];
          lista.push(respuesta);
          respuestasPorPregunta.set(preguntaId, lista);
        });
      }

      const { error: quizUpdateError } = await supabase
        .from("quizzes")
        .update({
          titulo: editQuiz.titulo.trim(),
          xp: editQuiz.xp,
          tiempo_limite_min: editQuiz.tiempo_limite_min,
          intentos_max: editQuiz.intentos_max,
        })
        .eq("id", editQuiz.id);

      if (quizUpdateError) {
        throw quizUpdateError;
      }

      if (deletedRespuestas.length > 0) {
        const { error } = await supabase
          .from("respuestas")
          .delete()
          .in("id", deletedRespuestas);

        if (error) throw error;
      }

      if (deletedPreguntas.length > 0) {
        const { error } = await supabase
          .from("preguntas")
          .delete()
          .in("id", deletedPreguntas);

        if (error) throw error;
      }

      for (let i = 0; i < preguntasEditadas.length; i++) {
        const p = preguntasEditadas[i];
        const preguntaEsNueva = String(p.id).startsWith("_new_");
        let preguntaId = String(p.id);

        if (preguntaEsNueva) {
          const {
            data: nuevaPregunta,
            error: preguntaInsertError,
          } = await supabase
            .from("preguntas")
            .insert({
              quiz_id: editQuiz.id,
              enunciado: p.enunciado.trim(),
              orden: i,
            })
            .select("id")
            .single();

          if (preguntaInsertError) {
            throw preguntaInsertError;
          }

          preguntaId = String(nuevaPregunta.id);
        } else {
          const actual = preguntasActualesMap.get(preguntaId);

          if (!actual) {
            throw new Error(
              "Una de las preguntas ya no existe. Recarga el quiz e inténtalo nuevamente."
            );
          }

          const patchPregunta: Record<string, unknown> = {};
          const enunciadoNuevo = p.enunciado.trim();

          if (String(actual.enunciado ?? "") !== enunciadoNuevo) {
            patchPregunta.enunciado = enunciadoNuevo;
          }

          if (Number(actual.orden ?? 0) !== i) {
            patchPregunta.orden = i;
          }

          if (Object.keys(patchPregunta).length > 0) {
            const { error } = await supabase
              .from("preguntas")
              .update(patchPregunta)
              .eq("id", preguntaId);

            if (error) throw error;
          }
        }

        const respuestasPreguntaActuales = preguntaEsNueva
          ? []
          : respuestasPorPregunta.get(preguntaId) || [];

        const correctaActual = respuestasPreguntaActuales.find(
          (respuesta: any) => Boolean(respuesta.es_correcta)
        );

        let respuestaCorrectaId: string | null = null;

        for (let j = 0; j < (p.respuestas || []).length; j++) {
          const r = p.respuestas[j];
          const respuestaEsNueva = String(r.id).startsWith("_new_");
          let respuestaId = String(r.id);

          if (respuestaEsNueva) {
            const {
              data: nuevaRespuesta,
              error: respuestaInsertError,
            } = await supabase
              .from("respuestas")
              .insert({
                pregunta_id: preguntaId,
                texto: r.texto.trim(),
                es_correcta: false,
                orden: j,
              })
              .select("id")
              .single();

            if (respuestaInsertError) {
              throw respuestaInsertError;
            }

            respuestaId = String(nuevaRespuesta.id);
          } else {
            const actual = respuestasActualesMap.get(respuestaId);

            if (!actual) {
              throw new Error(
                "Una de las respuestas ya no existe. Recarga el quiz e inténtalo nuevamente."
              );
            }

            const patchRespuesta: Record<string, unknown> = {};
            const textoNuevo = r.texto.trim();

            if (String(actual.texto ?? "") !== textoNuevo) {
              patchRespuesta.texto = textoNuevo;
            }

            if (Number(actual.orden ?? 0) !== j) {
              patchRespuesta.orden = j;
            }

            if (Object.keys(patchRespuesta).length > 0) {
              const { error } = await supabase
                .from("respuestas")
                .update(patchRespuesta)
                .eq("id", respuestaId);

              if (error) throw error;
            }
          }

          if (r.es_correcta) {
            respuestaCorrectaId = respuestaId;
          }
        }

        if (!respuestaCorrectaId) {
          throw new Error(
            "La pregunta debe tener una respuesta correcta."
          );
        }

        const correctaActualId = correctaActual
          ? String(correctaActual.id)
          : null;

        if (correctaActualId !== respuestaCorrectaId) {
          if (correctaActualId) {
            const { error: desmarcarError } = await supabase
              .from("respuestas")
              .update({ es_correcta: false })
              .eq("id", correctaActualId);

            if (desmarcarError) {
              throw desmarcarError;
            }
          }

          const { error: marcarCorrectaError } = await supabase
            .from("respuestas")
            .update({ es_correcta: true })
            .eq("id", respuestaCorrectaId);

          if (marcarCorrectaError) {
            throw marcarCorrectaError;
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

      if (mantenerAbierto) {
        const preguntasActualizadas = await cargarPreguntasDeQuiz(editQuiz.id);

        const quizActualizado = {
          ...editQuiz,
          preguntas: preguntasActualizadas,
          preguntasCargadas: true,
        };

        setEditQuiz(quizActualizado);

        setFirmaGuardadaIA(
          crearFirmaQuizEdicionIA(quizActualizado)
        );
      } else {
        setEditQuiz(null);
      }

      setDeletedPreguntas([]);
      setDeletedRespuestas([]);

      await reconciliarStorageCurso(materiaId);
      return true;
    } catch (err: any) {
      console.error("Error real al actualizar quiz:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        error: err,
      });

      toast.error(
        err?.message ||
          err?.details ||
          "Error al actualizar quiz"
      );
      return false;
    }
  };

  const limpiarEdicionQuiz = () => {
    setConfirmarSalidaQuiz(false);
    setEditQuiz(null);
    setDeletedPreguntas([]);
    setDeletedRespuestas([]);

    void reconciliarStorageCurso(materiaId);
  };

  const solicitarSalidaQuiz = () => {
    if (!editQuiz) return;

    if (hayCambiosSinGuardarIA()) {
      setConfirmarSalidaQuiz(true);
      return;
    }

    limpiarEdicionQuiz();
  };

  const guardarYSalirQuiz = async () => {
    if (guardandoSalidaQuiz) return;

    setGuardandoSalidaQuiz(true);

    try {
      const guardado = await handleSaveEditQuiz(false);

      if (guardado) {
        setConfirmarSalidaQuiz(false);
      }
    } finally {
      setGuardandoSalidaQuiz(false);
    }
  };

  const hayCambiosCreacionQuiz = () =>
    Boolean(
      titulo.trim() ||
      descripcion.trim() ||
      tiempoMin !== null ||
      intentosMax !== 1 ||
      preguntas.length > 0 ||
      bloquesContextoGeneracionIA.length > 0
    );

  const hayCambiosNavegacionQuiz = () =>
    hayCambiosCreacionQuiz() ||
    (Boolean(editQuiz) && hayCambiosSinGuardarIA());

  const guardarCambiosNavegacionQuiz = async () => {
    if (editQuiz && hayCambiosSinGuardarIA()) {
      const guardado = await handleSaveEditQuiz(false);
      if (!guardado) return false;
    }

    if (hayCambiosCreacionQuiz()) {
      const guardado = await saveQuiz();
      if (!guardado) return false;
    }

    return true;
  };

  const descartarCambiosNavegacionQuiz = () => {
    limpiarEdicionQuiz();
    setTitulo("");
    setDescripcion("");
    setTiempoMin(null);
    setIntentosMax(1);
    setPreguntas([]);
    setBloquesContextoGeneracionIA([]);
  };

  useEffect(() => {
    const dirty = hayCambiosNavegacionQuiz();

    onNavigationGuardChange?.({
      dirty,
      save: guardarCambiosNavegacionQuiz,
      discard: descartarCambiosNavegacionQuiz,
    });

    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    titulo,
    descripcion,
    tiempoMin,
    intentosMax,
    preguntas,
    bloquesContextoGeneracionIA,
    editQuiz,
    deletedPreguntas,
    deletedRespuestas,
    firmaGuardadaIA,
    onNavigationGuardChange,
  ]);

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

      .constructor-quiz-ai {
        margin-top: 18px;
        border-radius: 20px;
        padding: 15px;
        color: var(--quiz-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #8b5cf6 8%, var(--quiz-surface)),
            color-mix(in srgb, var(--quiz-surface-strong) 82%, transparent)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #8b5cf6 26%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }

      .constructor-quiz-ai-kicker {
        display: inline-flex;
        align-items: center;
        justify-self: center;
        gap: 7px;
        color: color-mix(
          in srgb,
          #8b5cf6 70%,
          var(--quiz-accent)
        );
        font-size: 0.78rem;
        font-weight: 950;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .constructor-quiz-ai-description {
        margin-top: 5px;
        max-width: 680px;
        color: var(--quiz-muted);
        font-size: 0.84rem;
        font-weight: 700;
        line-height: 1.45;
      }

      .constructor-quiz-ai-body {
        display: grid;
        gap: 15px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid
          color-mix(
            in srgb,
            #8b5cf6 18%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-context {
        display: grid;
        gap: 9px;
      }

      .constructor-quiz-ai-context-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .constructor-quiz-ai-context-item {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 36px;
        border-radius: 12px;
        padding: 7px 10px;
        color: var(--quiz-text);
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 78%,
            transparent
          );
        border: 1px solid var(--quiz-border);
        font-size: 0.8rem;
        font-weight: 800;
        cursor: pointer;
      }

      .constructor-quiz-ai-context-item.main {
        border-color:
          color-mix(
            in srgb,
            #8b5cf6 40%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-result {
        display: grid;
        gap: 13px;
        margin-top: 3px;
      }

      .constructor-quiz-ai-summary,
      .constructor-quiz-ai-question {
        border-radius: 16px;
        padding: 13px;
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 72%,
            transparent
          );
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-summary {
        color: var(--quiz-text-soft);
        font-size: 0.88rem;
        font-weight: 700;
        line-height: 1.5;
      }

      .constructor-quiz-ai-concepts {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .constructor-quiz-ai-chip {
        border-radius: 999px;
        padding: 5px 9px;
        color:
          color-mix(
            in srgb,
            #8b5cf6 72%,
            var(--quiz-text)
          );
        background:
          color-mix(
            in srgb,
            #8b5cf6 9%,
            transparent
          );
        border: 1px solid
          color-mix(
            in srgb,
            #8b5cf6 22%,
            var(--quiz-border)
          );
        font-size: 0.75rem;
        font-weight: 900;
      }

      .constructor-quiz-ai-question {
        display: grid;
        gap: 10px;
      }

      .constructor-quiz-ai-question-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .constructor-quiz-ai-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 0.72rem;
        font-weight: 900;
      }

      .constructor-quiz-ai-status.ok {
        color: #10b981;
        background:
          color-mix(
            in srgb,
            #10b981 9%,
            transparent
          );
      }

      .constructor-quiz-ai-status.warn {
        color: #f59e0b;
        background:
          color-mix(
            in srgb,
            #f59e0b 10%,
            transparent
          );
      }

      .constructor-quiz-ai-status.danger {
        color: #dc2626;
        background:
          color-mix(
            in srgb,
            #ef4444 9%,
            transparent
          );
      }

      .constructor-quiz-ai-feedback-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .constructor-quiz-ai-feedback {
        border-radius: 12px;
        padding: 10px;
        color: var(--quiz-text-soft);
        background:
          color-mix(
            in srgb,
            var(--quiz-surface) 88%,
            transparent
          );
        border: 1px solid var(--quiz-border);
        font-size: 0.81rem;
        font-weight: 700;
        line-height: 1.45;
      }

      .constructor-quiz-ai-feedback strong {
        display: block;
        margin-bottom: 4px;
        color: var(--quiz-text);
      }

      .constructor-quiz-ai-warning {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        border-radius: 12px;
        padding: 9px 10px;
        color:
          color-mix(
            in srgb,
            #f59e0b 80%,
            var(--quiz-text)
          );
        background:
          color-mix(
            in srgb,
            #f59e0b 7%,
            transparent
          );
        border: 1px solid
          color-mix(
            in srgb,
            #f59e0b 20%,
            var(--quiz-border)
          );
        font-size: 0.8rem;
        font-weight: 750;
        line-height: 1.4;
      }

      @media (max-width: 640px) {
        .constructor-quiz-ai-feedback-grid {
          grid-template-columns: 1fr;
        }
      }
      .constructor-quiz-ai-screen {
        display: grid;
        gap: 20px;
        width: 100%;
        max-width: 860px;
        margin: 0 auto;
        padding: 10px 2px 24px;
      }

      .constructor-quiz-ai-screen.center {
        min-height: 420px;
        place-content: center;
        justify-items: center;
        text-align: center;
      }

      .constructor-quiz-ai-screen-title {
        margin: 0;
        color: var(--quiz-text);
        font-size: clamp(1.45rem, 3vw, 2rem);
        font-weight: 950;
        letter-spacing: -0.045em;
      }

      .constructor-quiz-ai-screen-description {
        max-width: 680px;
        margin: 0 auto;
        color: var(--quiz-muted);
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.55;
        text-align: center;
      }

      .constructor-quiz-ai-notice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        border-radius: 16px;
        padding: 13px 14px;
        color: var(--quiz-text-soft);
        background:
          color-mix(
            in srgb,
            #8b5cf6 7%,
            var(--quiz-surface-strong)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #8b5cf6 22%,
            var(--quiz-border)
          );
        font-size: 0.84rem;
        font-weight: 750;
        line-height: 1.5;
      }

      .constructor-quiz-ai-loader {
        width: 62px;
        height: 62px;
        display: grid;
        place-items: center;
        border-radius: 22px;
        color: #8b5cf6;
        background:
          color-mix(
            in srgb,
            #8b5cf6 10%,
            var(--quiz-surface)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #8b5cf6 25%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-result-header {
        display: grid;
        gap: 8px;
        text-align: center;
      }

      .constructor-quiz-ai-result-summary {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .constructor-quiz-ai-stat {
        display: grid;
        gap: 4px;
        border-radius: 16px;
        padding: 13px;
        text-align: center;
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 80%,
            transparent
          );
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-stat strong {
        color: var(--quiz-text);
        font-size: 1.15rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-stat span {
        color: var(--quiz-muted);
        font-size: 0.74rem;
        font-weight: 850;
      }

      @media (max-width: 640px) {
        .constructor-quiz-ai-result-summary {
          grid-template-columns: 1fr;
        }
      }
      .constructor-quiz-ai-stat {
        position: relative;
        overflow: hidden;
      }

      .constructor-quiz-ai-stat.info {
        color: #2563eb;
        background:
          color-mix(
            in srgb,
            #3b82f6 8%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #3b82f6 24%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-stat.warn {
        color: #d97706;
        background:
          color-mix(
            in srgb,
            #f59e0b 9%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #f59e0b 28%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-stat.danger {
        color: #dc2626;
        background:
          color-mix(
            in srgb,
            #ef4444 7%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #ef4444 23%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-stat.ok {
        color: #059669;
        background:
          color-mix(
            in srgb,
            #10b981 8%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #10b981 25%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-stat-icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        margin: 0 auto 4px;
        border-radius: 11px;
        background:
          color-mix(
            in srgb,
            currentColor 10%,
            transparent
          );
      }

      .constructor-quiz-ai-stat strong {
        color: currentColor;
      }

      .constructor-quiz-ai-general-note {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        border-radius: 15px;
        padding: 12px 13px;
        color:
          color-mix(
            in srgb,
            #6366f1 78%,
            var(--quiz-text)
          );
        background:
          color-mix(
            in srgb,
            #6366f1 7%,
            var(--quiz-surface)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #6366f1 22%,
            var(--quiz-border)
          );
        font-size: 0.82rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .constructor-quiz-ai-question.is-ok {
        border-color:
          color-mix(
            in srgb,
            #10b981 20%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-question.is-review {
        border-color:
          color-mix(
            in srgb,
            #f59e0b 30%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-question.is-danger {
        background:
          color-mix(
            in srgb,
            #ef4444 3.5%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #ef4444 25%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-clean {
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 13px;
        padding: 10px 11px;
        color: #059669;
        background:
          color-mix(
            in srgb,
            #10b981 7%,
            transparent
          );
        border: 1px solid
          color-mix(
            in srgb,
            #10b981 19%,
            var(--quiz-border)
          );
        font-size: 0.82rem;
        font-weight: 850;
      }

      .constructor-quiz-button.ai-launch {
        color: #6d4aff;
        background:
          color-mix(
            in srgb,
            #7c5cff 9%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #7c5cff 28%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-button.ai-back {
        color: #2563eb;
        background:
          color-mix(
            in srgb,
            #3b82f6 8%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #3b82f6 24%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-button.ai-regenerate {
        color: #6d4aff;
        background:
          color-mix(
            in srgb,
            #7c5cff 9%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #7c5cff 28%,
            var(--quiz-border)
          );
      }
      .constructor-quiz-ai-result-summary {
        gap: 9px;
      }

      .constructor-quiz-ai-stat {
        min-height: 76px;
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        grid-template-rows: auto auto;
        column-gap: 11px;
        row-gap: 1px;
        align-items: center;
        justify-items: start;
        padding: 11px 14px;
        text-align: left;
      }

      .constructor-quiz-ai-stat-icon {
        grid-column: 1;
        grid-row: 1 / span 2;
        width: 36px;
        height: 36px;
        margin: 0;
        border-radius: 12px;
        color: currentColor;
      }

      .constructor-quiz-ai-stat strong {
        grid-column: 2;
        grid-row: 1;
        align-self: end;
        font-size: 1.25rem;
        line-height: 1;
        color: currentColor;
      }

      .constructor-quiz-ai-stat > span:last-child {
        grid-column: 2;
        grid-row: 2;
        align-self: start;
        color: var(--quiz-text-soft);
        font-size: 0.75rem;
        line-height: 1.2;
      }

      .constructor-quiz-ai-general-note {
        display: none;
      }

      .constructor-quiz-ai-actions-list {
        display: grid;
        gap: 10px;
      }

      .constructor-quiz-ai-action-card {
        display: grid;
        gap: 10px;
        border-radius: 16px;
        padding: 13px;
        background:
          color-mix(
            in srgb,
            #f59e0b 6%,
            var(--quiz-surface)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #f59e0b 24%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-action-card.academic {
        background:
          color-mix(
            in srgb,
            #ef4444 5%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #ef4444 23%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-action-card.editorial {
        background:
          color-mix(
            in srgb,
            #f59e0b 6%,
            var(--quiz-surface)
          );
      }

      .constructor-quiz-ai-action-card.applied {
        background:
          color-mix(
            in srgb,
            #10b981 7%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #10b981 26%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-action-card.ignored {
        opacity: 0.55;
      }

      .constructor-quiz-ai-action-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--quiz-text);
        font-size: 0.85rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-action-reason {
        margin: 0;
        color: var(--quiz-text-soft);
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.45;
      }

      .constructor-quiz-ai-change {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .constructor-quiz-ai-change-box {
        border-radius: 13px;
        padding: 10px 11px;
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 76%,
            transparent
          );
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-change-box.proposed {
        background:
          color-mix(
            in srgb,
            #10b981 6%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #10b981 20%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-change-label {
        display: block;
        margin-bottom: 5px;
        color: var(--quiz-muted);
        font-size: 0.68rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .constructor-quiz-ai-change-text {
        margin: 0;
        min-width: 0;
        overflow-x: auto;
        color: var(--quiz-text);
        font-size: 0.81rem;
        font-weight: 750;
        line-height: 1.4;
      }

      .constructor-quiz-ai-change-text .katex-display,
      .constructor-quiz-ai-confirm-formula .katex-display {
        margin: 2px 0;
        text-align: left;
      }

      .constructor-quiz-ai-action-buttons {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .constructor-quiz-ai-result-breakdown {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: -4px;
        border-radius: 14px;
        padding: 9px 12px;
        color: var(--quiz-text-soft);
        background: color-mix(in srgb, #6366f1 5%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, #6366f1 17%, var(--quiz-border));
        font-size: 0.8rem;
        font-weight: 750;
        text-align: center;
      }

      .constructor-quiz-ai-result-breakdown strong {
        color: var(--quiz-text);
      }

      .constructor-quiz-ai-manual-note {
        display: grid;
        gap: 7px;
        border-radius: 14px;
        padding: 11px 12px;
        color: var(--quiz-text-soft);
        font-size: 0.82rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .constructor-quiz-ai-manual-note.editorial {
        background: color-mix(in srgb, #f59e0b 6%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, #f59e0b 22%, var(--quiz-border));
      }

      .constructor-quiz-ai-manual-note.academic {
        background: color-mix(in srgb, #ef4444 5%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, #ef4444 22%, var(--quiz-border));
      }

      .constructor-quiz-ai-manual-note p {
        margin: 0;
      }

      .constructor-quiz-ai-manual-note ul {
        display: grid;
        gap: 4px;
        margin: 0;
        padding-left: 18px;
      }

      .constructor-quiz-ai-apply {
        color: #ffffff !important;
        background:
          linear-gradient(
            135deg,
            #10b981,
            #14b8a6
          ) !important;
        border-color: transparent !important;
      }

      .constructor-quiz-button.ai-back {
        color: #1d4ed8 !important;
        background:
          color-mix(
            in srgb,
            #3b82f6 13%,
            var(--quiz-surface)
          ) !important;
        border-color:
          color-mix(
            in srgb,
            #3b82f6 38%,
            var(--quiz-border)
          ) !important;
      }

      .constructor-quiz-button.ai-regenerate {
        color: #6d4aff !important;
        background:
          color-mix(
            in srgb,
            #7c5cff 13%,
            var(--quiz-surface)
          ) !important;
        border-color:
          color-mix(
            in srgb,
            #7c5cff 38%,
            var(--quiz-border)
          ) !important;
      }

      @media (max-width: 640px) {
        .constructor-quiz-ai-change {
          grid-template-columns: 1fr;
        }

        .constructor-quiz-ai-stat {
          min-height: 68px;
        }
      }

      @media (max-width: 900px) and (min-width: 641px) {
        .constructor-quiz-ai-result-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .constructor-quiz-ai-confirm-list {
        display: grid;
        gap: 10px;
      }

      .constructor-quiz-ai-confirm-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        border-radius: 16px;
        padding: 13px 14px;
        background:
          color-mix(
            in srgb,
            #10b981 6%,
            var(--quiz-surface)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #10b981 22%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-confirm-icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        color: #059669;
        background:
          color-mix(
            in srgb,
            #10b981 12%,
            transparent
          );
      }

      .constructor-quiz-ai-confirm-item strong {
        color: var(--quiz-text);
        font-size: 0.88rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-confirm-item p {
        margin: 2px 0 5px;
        color: #059669;
        font-size: 0.77rem;
        font-weight: 900;
      }

      .constructor-quiz-ai-confirm-formula {
        min-width: 0;
        overflow-x: auto;
        color: var(--quiz-text-soft);
        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1.4;
      }
      .constructor-quiz-ai-prep-stats {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 9px;
      }

      .constructor-quiz-ai-prep-stat {
        min-height: 58px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 15px;
        padding: 10px 12px;
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-prep-stat.attempts {
        color: #6d4aff;
        background:
          color-mix(
            in srgb,
            #7c5cff 7%,
            var(--quiz-surface)
          );
        border-color:
          color-mix(
            in srgb,
            #7c5cff 22%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-prep-stat.questions {
        color: #2563eb;
        background:
          color-mix(
            in srgb,
            #3b82f6 6%,
            var(--quiz-surface)
          );
      }

      .constructor-quiz-ai-prep-stat.media {
        color: #059669;
        background:
          color-mix(
            in srgb,
            #10b981 6%,
            var(--quiz-surface)
          );
      }

      .constructor-quiz-ai-prep-stat span {
        display: grid;
        gap: 1px;
        color: var(--quiz-text-soft);
        font-size: 0.72rem;
        font-weight: 750;
      }

      .constructor-quiz-ai-prep-stat strong {
        color: currentColor;
        font-size: 0.92rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-prep-section {
        display: grid;
        gap: 11px;
        border-radius: 18px;
        padding: 14px;
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 68%,
            transparent
          );
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-prep-section.quiz-media {
        border-color:
          color-mix(
            in srgb,
            #10b981 21%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-prep-section.optional-media {
        border-color:
          color-mix(
            in srgb,
            #f59e0b 19%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-prep-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .constructor-quiz-ai-prep-section-head > div {
        display: grid;
        gap: 2px;
      }

      .constructor-quiz-ai-prep-section-head strong {
        color: var(--quiz-text);
        font-size: 0.88rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-prep-section-head span {
        color: var(--quiz-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .constructor-quiz-ai-resource-count {
        min-width: 48px;
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 9px;
        color: #d97706 !important;
        background:
          color-mix(
            in srgb,
            #f59e0b 9%,
            transparent
          );
        font-size: 0.72rem !important;
        font-weight: 950 !important;
      }

      .constructor-quiz-ai-resource-count.auto {
        color: #059669 !important;
        background:
          color-mix(
            in srgb,
            #10b981 9%,
            transparent
          );
      }

      .constructor-quiz-ai-quiz-images {
        display: flex;
        gap: 9px;
        overflow-x: auto;
        padding-bottom: 3px;
      }

      .constructor-quiz-ai-quiz-image {
        flex: 0 0 112px;
        display: grid;
        gap: 5px;
      }

      .constructor-quiz-ai-quiz-image img {
        width: 112px;
        height: 72px;
        object-fit: contain;
        border-radius: 11px;
        background: var(--quiz-surface);
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-quiz-image span {
        color: var(--quiz-muted);
        font-size: 0.66rem;
        font-weight: 800;
        text-align: center;
      }

      .constructor-quiz-ai-resource-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .constructor-quiz-ai-resource-card {
        position: relative;
        display: grid;
        grid-template-columns: 78px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        min-height: 86px;
        border-radius: 14px;
        padding: 8px 38px 8px 8px;
        text-align: left;
        color: var(--quiz-text);
        background: var(--quiz-surface);
        border: 1px solid var(--quiz-border);
        cursor: pointer;
        transition:
          border-color 150ms ease,
          background 150ms ease,
          transform 150ms ease;
      }

      .constructor-quiz-ai-resource-card:hover {
        transform: translateY(-1px);
        border-color:
          color-mix(
            in srgb,
            #7c5cff 30%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-resource-card.selected {
        background:
          color-mix(
            in srgb,
            #7c5cff 7%,
            var(--quiz-surface)
          );
        border-color: #8b5cf6;
      }

      .constructor-quiz-ai-resource-card > img {
        width: 78px;
        height: 64px;
        border-radius: 10px;
        object-fit: contain;
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 80%,
            transparent
          );
      }

      .constructor-quiz-ai-formula-preview {
        width: 78px;
        height: 64px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 10px;
        padding: 5px;
        color: #6d4aff;
        background:
          color-mix(
            in srgb,
            #7c5cff 8%,
            transparent
          );
      }

      .constructor-quiz-ai-formula-preview span {
        font-weight: 950;
      }

      .constructor-quiz-ai-formula-preview code {
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.58rem;
      }

      .constructor-quiz-ai-resource-info {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .constructor-quiz-ai-resource-info strong {
        color: var(--quiz-text);
        font-size: 0.77rem;
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .constructor-quiz-ai-resource-info span {
        color: var(--quiz-muted);
        font-size: 0.66rem;
        font-weight: 700;
      }

      .constructor-quiz-ai-resource-check {
        position: absolute;
        right: 11px;
        top: 50%;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        transform: translateY(-50%);
        border-radius: 999px;
        color: #6d4aff;
        background:
          color-mix(
            in srgb,
            #7c5cff 10%,
            transparent
          );
        font-size: 0.82rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-resource-empty {
        min-height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 12px;
        padding: 12px;
        color: var(--quiz-muted);
        background: var(--quiz-surface);
        font-size: 0.75rem;
        font-weight: 750;
        text-align: center;
      }

      .constructor-quiz-ai-resource-empty.error {
        color: #d97706;
      }

      .constructor-quiz-ai-extra-context {
        border-radius: 15px;
        padding: 11px 13px;
        background:
          color-mix(
            in srgb,
            #3b82f6 4%,
            var(--quiz-surface)
          );
        border: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-extra-context summary {
        cursor: pointer;
        color: #2563eb;
        font-size: 0.8rem;
        font-weight: 900;
      }

      .constructor-quiz-ai-extra-context p {
        margin: 8px 0;
        color: var(--quiz-muted);
        font-size: 0.7rem;
        font-weight: 700;
      }

      .constructor-quiz-ai-extra-context > span {
        display: block;
        margin-top: 4px;
        color: var(--quiz-muted);
        font-size: 0.65rem;
        text-align: right;
      }

      .constructor-quiz-ai-prep-footnote {
        margin: -4px 0 0;
        color: var(--quiz-muted);
        font-size: 0.68rem;
        font-weight: 700;
        text-align: center;
      }

      @media (max-width: 640px) {
        .constructor-quiz-ai-prep-stats,
        .constructor-quiz-ai-resource-grid {
          grid-template-columns: 1fr;
        }
      }
      .constructor-quiz-ai-auto-group {
        display: grid;
        gap: 7px;
      }

      .constructor-quiz-ai-auto-group +
      .constructor-quiz-ai-auto-group {
        padding-top: 9px;
        border-top: 1px solid var(--quiz-border);
      }

      .constructor-quiz-ai-auto-label {
        color: #059669;
        font-size: 0.7rem;
        font-weight: 950;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .constructor-quiz-ai-formulas-included {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 2px;
      }

      .constructor-quiz-ai-formula-included {
        flex: 0 0 min(210px, 75vw);
        display: grid;
        gap: 5px;
        border-radius: 12px;
        padding: 9px 10px;
        background:
          color-mix(
            in srgb,
            #10b981 5%,
            var(--quiz-surface)
          );
        border: 1px solid
          color-mix(
            in srgb,
            #10b981 18%,
            var(--quiz-border)
          );
      }

      .constructor-quiz-ai-formula-included > div {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .constructor-quiz-ai-formula-included > div {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 34px;
      }

      .constructor-quiz-ai-formula-included > div > span:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        height: 30px;
      }

      .constructor-quiz-ai-formula-included > div > span:last-child {
        display: inline-flex;
        align-items: center;
        margin: 0;
        line-height: 1.2;
        min-height: 30px;
      }
      .constructor-quiz-ai-formula-included > div > span {
        width: 27px;
        height: 27px;
        flex: 0 0 27px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        color: #059669;
        background:
          color-mix(
            in srgb,
            #10b981 10%,
            transparent
          );
        font-size: 0.72rem;
        font-weight: 950;
      }

      .constructor-quiz-ai-formula-included code {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--quiz-text);
        font-size: 0.72rem;
      }

      .constructor-quiz-ai-rendered-formula {
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        color: var(--quiz-text);
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .constructor-quiz-ai-rendered-formula .katex-display {
        margin: 0;
        text-align: left;
      }

      .constructor-quiz-ai-rendered-formula .katex {
        font-size: 1em;
      }

      .constructor-quiz-ai-formula-included small {
        color: var(--quiz-muted);
        font-size: 0.62rem;
        font-weight: 750;
      }
      /* Fórmulas ya incluidas en el quiz */
      .constructor-quiz-ai-formulas-included {
        display: grid;
        grid-template-columns:
          repeat(auto-fit, minmax(260px, 1fr));
        gap: 8px;
        overflow: visible;
        padding-bottom: 2px;
      }

      .constructor-quiz-ai-formula-included {
        width: 100%;
        min-width: 0;
        display: grid;
        gap: 6px;
      }

      .constructor-quiz-ai-formula-included > div {
        min-width: 0;
        align-items: flex-start;
      }

      .constructor-quiz-ai-formula-included code {
        display: block;
        width: 100%;
        min-width: 0;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        color: var(--quiz-text);
        font-size: 0.72rem;
        line-height: 1.45;
      }


      /* Fórmulas opcionales de los bloques */
      .constructor-quiz-ai-resource-card.formula {
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
        min-height: 0;
        padding:
          10px
          38px
          10px
          10px;
      }

      .constructor-quiz-ai-resource-card.formula
      .constructor-quiz-ai-formula-preview {
        width: 100%;
        height: auto;
        min-height: 56px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 9px;
        align-items: center;
        justify-items: start;
        padding: 9px 10px;
      }

      .constructor-quiz-ai-resource-card.formula
      .constructor-quiz-ai-formula-preview code {
        display: block;
        width: 100%;
        max-width: none;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        color: var(--quiz-text);
        font-size: 0.7rem;
        line-height: 1.4;
      }

      .constructor-quiz-ai-resource-card.formula
      .constructor-quiz-ai-resource-info {
        padding: 0 2px;
      }
      /* Recursos que ya forman parte del quiz:
         mismo tratamiento visual, sin significado de correcto/incorrecto */
      .constructor-quiz-ai-quiz-image img,
      .constructor-quiz-ai-formula-included {
        background:
          color-mix(
            in srgb,
            var(--quiz-surface-strong) 72%,
            var(--quiz-surface)
          );
        border-color: var(--quiz-border);
      }

      .constructor-quiz-ai-formula-included > div {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 34px;
      }

      .constructor-quiz-ai-formula-included > div > span:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        height: 30px;
      }

      .constructor-quiz-ai-formula-included > div > span:last-child {
        display: inline-flex;
        align-items: center;
        margin: 0;
        line-height: 1.2;
        min-height: 30px;
      }
      .constructor-quiz-ai-formula-included > div > span {
        color: var(--quiz-text-soft);
        background:
          color-mix(
            in srgb,
            var(--quiz-border) 35%,
            transparent
          );
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

      .constructor-quiz-question-editor,
      .constructor-quiz-answer-editor {
        width: 100%;
        min-width: 0;
      }

      .constructor-quiz-question-editor {
        border-radius: 18px;
        background: color-mix(in srgb, var(--quiz-accent) 4%, transparent);
      }

      .constructor-quiz-answer-editor {
        border-radius: 16px;
        background: color-mix(in srgb, #10b981 3%, transparent);
      }

      .constructor-quiz-question-editor :is(textarea, input, [contenteditable="true"], .ProseMirror) {
        font-size: 1.02rem;
        font-weight: 900;
        line-height: 1.32;
      }

      .constructor-quiz-answer-editor :is(textarea, input, [contenteditable="true"], .ProseMirror) {
        font-size: 0.92rem;
        font-weight: 760;
        line-height: 1.36;
      }

      .constructor-quiz-answers {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .constructor-quiz-answer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
        min-width: 0;
      }

      .constructor-quiz-answer-actions {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .constructor-quiz-inline-actions,
      .constructor-quiz-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      .constructor-quiz-actions {
        margin-top: 16px;
        justify-content: center;
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

      .constructor-quiz-button.exit-action {
        color: #ffffff;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        border-color: color-mix(in srgb, #ef4444 70%, white);
      }

      .constructor-quiz-button.info-action,
      .constructor-quiz-button.add-action {
        color: #ffffff;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        border-color: color-mix(in srgb, #3b82f6 62%, white);
      }

      .constructor-quiz-button.ai-launch {
        color: #ffffff;
        background: linear-gradient(135deg, #8b5cf6, #6d4aff);
        border-color: color-mix(in srgb, #8b5cf6 62%, white);
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

      .constructor-quiz-subview-overlay {
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
        background: var(--quiz-surface, var(--fcc-premium-surface));
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

      .constructor-quiz-edit-modal .constructor-quiz-modal-close {
        display: grid;
        color: #ffffff;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        border-color: color-mix(in srgb, #ef4444 70%, white);
        box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
      }

      .constructor-quiz-edit-modal .constructor-quiz-modal-close:hover {
        color: #ffffff;
        border-color: color-mix(in srgb, #ef4444 82%, white);
        filter: brightness(1.05);
      }

      .constructor-quiz-edit-modal {
        isolation: isolate;
      }

      .constructor-quiz-edit-modal .constructor-quiz-modal-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding-bottom: 18px;
      }

      .constructor-quiz-edit-actions {
        position: relative;
        z-index: 20;
        flex: 0 0 auto;
        margin: 0;
        padding: 14px 26px 22px;
        gap: 10px;
        background: var(--quiz-surface);
        border-top: 1px solid color-mix(in srgb, var(--quiz-accent) 12%, var(--quiz-border));
        box-shadow:
          0 -14px 34px rgba(15, 23, 42, 0.1),
          inset 0 1px 0 color-mix(in srgb, var(--quiz-surface-strong) 80%, transparent);
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

        .constructor-quiz-edit-modal .constructor-quiz-modal-scroll {
          padding-bottom: 14px;
        }

        .constructor-quiz-edit-actions {
          padding: 12px 16px 16px;
          background: var(--quiz-surface);
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
          min-width: 0;
        }

        .constructor-quiz-question-main,
        .constructor-quiz-answer {
          justify-items: center;
        }

        .constructor-quiz-inline-actions,
        .constructor-quiz-actions {
          justify-content: stretch;
        }

        .constructor-quiz-button {
          width: 100%;
        }

        .constructor-quiz-icon-button {
          width: 42px;
          height: 42px;
        }

        .constructor-quiz-question-main > .constructor-quiz-icon-button {
          justify-self: center;
        }

        .constructor-quiz-answer-actions {
          width: 100%;
          justify-content: center;
        }

        .constructor-quiz-unit-body {
          min-width: 0;
          padding: 10px;
        }

        .constructor-quiz-block-body {
          min-width: 0;
          margin-left: 0;
          padding: 8px 0 2px 8px;
        }

        .constructor-quiz-block-button,
        .constructor-quiz-saved-row {
          min-width: 0;
        }

        .constructor-quiz-unit-title,
        .constructor-quiz-block-title,
        .constructor-quiz-saved-title {
          white-space: normal;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .constructor-quiz-saved-row {
          justify-items: center;
          text-align: center;
        }

        .constructor-quiz-saved-row .constructor-quiz-icon-button {
          justify-self: center;
        }

        .constructor-quiz-edit-actions {
          margin: 0;
          padding: 12px 16px calc(18px + env(safe-area-inset-bottom));
          gap: 10px;
          background: var(--quiz-surface);
          border-top: 1px solid color-mix(in srgb, var(--quiz-accent) 12%, var(--quiz-border));
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
              <label className="constructor-quiz-label">Unidad</label>
              <select
                value={unidadId}
                onChange={(e) => {
                  setUnidadId(e.target.value);
                  setBloqueId("");
                  setBloquesContextoGeneracionIA([]);
                }}
                className="constructor-quiz-select"
              >
                <option value="">— Selecciona una unidad —</option>
                {unidadesSeleccionables.map((unidad) => (
                  <option key={unidad.id} value={unidad.id}>
                    {unidad.synthetic
                      ? "Sin unidad"
                      : `Unidad ${unidad.numero}${
                          unidad.nombre?.trim()
                            ? ` — ${unidad.nombre.trim()}`
                            : ""
                        }`}
                  </option>
                ))}
              </select>
            </div>

            <div className="constructor-quiz-field constructor-quiz-full">
              <label className="constructor-quiz-label">Ligar a bloque</label>
              <select
                value={bloqueId}
                onChange={(e) => {
                  setBloqueId(e.target.value);
                  setBloquesContextoGeneracionIA([]);
                }}
                className="constructor-quiz-select"
                disabled={!unidadId || bloquesUnidadSeleccionada.length === 0}
              >
                <option value="">
                  {!unidadId
                    ? "— Selecciona primero una unidad —"
                    : bloquesUnidadSeleccionada.length === 0
                      ? "— Esta unidad no tiene bloques —"
                      : "— Selecciona un bloque —"}
                </option>
                {bloquesUnidadSeleccionada.map((b) => (
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
                  <div className="constructor-quiz-question-editor">
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
                      <div className="constructor-quiz-answer-editor">
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

                      <div className="constructor-quiz-answer-actions">
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
                    </div>
                  ))}

                  <div className="constructor-quiz-inline-actions">
                    <button
                      type="button"
                      onClick={() => addRespuesta(p.id)}
                      className="constructor-quiz-button add-action"
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
            <GeneradorQuizIA
              materiaId={materiaId}
              bloquePrincipalId={bloqueId}
              bloques={bloques}
              unidades={unidades}
              hayBorrador={preguntas.length > 0}
              onAplicar={aplicarBorradorGeneradoIA}
            />

            <button
              type="button"
              onClick={addPregunta}
              className="constructor-quiz-button add-action"
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
              {saving ? "Finalizando..." : "Guardar quiz"}
            </button>
          </div>
          </div>
        </section>

        <section className="constructor-quiz-card constructor-quiz-saved no-line">
          <div className="constructor-quiz-card-content">
          <h4 className="constructor-quiz-section-title">Quizzes guardados</h4>

          {unidadesListado.length === 0 ? (
            <p className="constructor-quiz-empty">
              Aún no hay quizzes en este curso.
            </p>
          ) : (
            <div className="constructor-quiz-saved-list">
              {unidadesListado.map((unidadItem) => {
                const unidadId = unidadItem.id;
                const abierta = unidadQuizzesAbiertaId === unidadId;
                const bloquesUnidad = (bloquesPorUnidad[unidadId] || []).filter(
                  (bloque) => (quizzesPorBloque[bloque.id]?.length || 0) > 0
                );
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

      {quizCargando && (
        <CargadorFCC
          flotante
          mensaje="Cargando el quiz"
          detalle=""
        />
      )}

      {editQuiz &&
        vistaIA === "editor" &&
        !mostrarExplicacionesQuiz &&
        renderPortal(
          <div className="constructor-quiz-overlay fcc-modal-backdrop-enter-standard">
            <div className="constructor-quiz-modal constructor-quiz-edit-modal fcc-modal-enter-standard">
              <button
                type="button"
                onClick={solicitarSalidaQuiz}
                className="constructor-quiz-modal-close"
                aria-label="Salir de la edición"
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
                          <div className="constructor-quiz-question-editor">
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
                          </div>

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
                              <div className="constructor-quiz-answer-editor">
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
                              </div>

                              <div className="constructor-quiz-answer-actions">
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
                              className="constructor-quiz-button add-action"
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
                      className="constructor-quiz-button add-action"
                    >
                      <Plus size={17} strokeWidth={2.7} />
                      Pregunta
                    </button>
                  </div>
                </div>

              </div>

              <div className="constructor-quiz-modal-actions constructor-quiz-edit-actions">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarExplicacionesQuiz(true)
                  }
                  className="constructor-quiz-button info-action"
                >
                  <MessageCircle
                    size={17}
                    strokeWidth={2.5}
                  />

                  Explicaciones

                  {resumenExplicacionesQuiz.pendientes > 0 && (
                    <span>
                      ({resumenExplicacionesQuiz.pendientes} pendientes)
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={abrirAsistenteIA}
                  disabled={
                    cargandoIntentosIA ||
                    intentosIAUsados >= 3
                  }
                  className="constructor-quiz-button ai-launch"
                >
                  <Sparkles size={17} strokeWidth={2.6} />

                  Asistente IA
                  {!cargandoIntentosIA && (
                    <span>
                      ({Math.max(0, 3 - intentosIAUsados)}/3)
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleSaveEditQuiz(false)
                  }
                  className="constructor-quiz-button success"
                >
                  <Save size={17} strokeWidth={2.6} />
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <ConfirmarSalidaEdicion
        open={confirmarSalidaQuiz}
        titulo="¿Salir de la edición del quiz?"
        descripcion="Hay cambios sin guardar. Puedes seguir editando, descartarlos o guardar el quiz antes de salir."
        guardando={guardandoSalidaQuiz}
        onContinuar={() => setConfirmarSalidaQuiz(false)}
        onDescartar={limpiarEdicionQuiz}
        onGuardar={guardarYSalirQuiz}
      />

      {editQuiz &&
        vistaIA !== "editor" &&
        vistaIA !== "cargando" &&
        vistaIA !== "resultado_listo" &&
        vistaIA !== "tiempo_agotado" &&
        renderPortal(
          <div className="constructor-quiz-overlay constructor-quiz-subview-overlay fcc-modal-backdrop-enter-standard">
            <div className="constructor-quiz-modal constructor-quiz-edit-modal fcc-modal-enter-standard">
              <div className="constructor-quiz-modal-scroll">
                {vistaIA === "confirmar" && (
                  <div className="constructor-quiz-ai-screen center">
                    <div className="constructor-quiz-ai-loader">
                      <Save size={28} strokeWidth={2.3} />
                    </div>

                    <h3 className="constructor-quiz-ai-screen-title">
                      Guarda tus cambios para continuar
                    </h3>

                    <p className="constructor-quiz-ai-screen-description">
                      El asistente analizará la versión guardada del quiz.
                      Guarda los cambios que acabas de realizar antes de continuar.
                    </p>
                  </div>
                )}

                {vistaIA === "preparar" && (
                  <div className="constructor-quiz-ai-screen">
                    <div className="constructor-quiz-ai-result-header">
                      <span className="constructor-quiz-ai-kicker">
                        <Sparkles
                          size={16}
                          strokeWidth={2.5}
                        />
                        Asistente IA
                      </span>

                      <h3 className="constructor-quiz-ai-screen-title">
                        Preparar análisis
                      </h3>

                      <p className="constructor-quiz-ai-screen-description">
                        Elige el contenido que realmente necesita la IA.
                      </p>
                    </div>

                    <div className="constructor-quiz-ai-prep-stats">
                      <div className="constructor-quiz-ai-prep-stat attempts">
                        <Sparkles
                          size={18}
                          strokeWidth={2.5}
                        />

                        <span>
                          <strong>
                            {Math.max(
                              0,
                              3 - intentosIAUsados
                            )} de 3
                          </strong>
                          análisis disponibles
                        </span>
                      </div>

                      <div className="constructor-quiz-ai-prep-stat questions">
                        <Check
                          size={18}
                          strokeWidth={2.6}
                        />

                        <span>
                          <strong>
                            {editQuiz.preguntas?.length || 0}
                          </strong>
                          preguntas
                        </span>
                      </div>

                      <div className="constructor-quiz-ai-prep-stat media">
                        <Sparkles
                          size={18}
                          strokeWidth={2.5}
                        />

                        <span>
                          <strong>
                            {imagenesQuizIA.length + formulasQuizIA.length}
                          </strong>
                          recursos del quiz
                        </span>
                      </div>
                    </div>

                    <section className="constructor-quiz-ai-prep-section">
                      <div className="constructor-quiz-ai-prep-section-head">
                        <div>
                          <strong>
                            Contexto académico
                          </strong>

                          <span>
                            Sólo se enviará el texto.
                          </span>
                        </div>
                      </div>

                      <div className="constructor-quiz-ai-context-list">
                        {bloquesContextoDisponiblesIA.map(
                          (bloque) => {
                            const esPrincipal =
                              bloque.id ===
                              editQuiz.bloque_id;

                            const seleccionado =
                              esPrincipal ||
                              bloquesContextoIA.includes(
                                bloque.id
                              );

                            return (
                              <label
                                key={bloque.id}
                                className={`constructor-quiz-ai-context-item ${
                                  esPrincipal
                                    ? "main"
                                    : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    seleccionado
                                  }
                                  disabled={
                                    esPrincipal
                                  }
                                  onChange={() =>
                                    toggleBloqueContextoIA(
                                      bloque.id
                                    )
                                  }
                                />

                                <span>
                                  {bloque.titulo?.trim() ||
                                    "Bloque sin título"}

                                  {esPrincipal
                                    ? " · principal"
                                    : ""}
                                </span>
                              </label>
                            );
                          }
                        )}
                      </div>
                    </section>

                    {(imagenesQuizIA.length > 0 ||
                      formulasQuizIA.length > 0) && (
                      <section className="constructor-quiz-ai-prep-section quiz-media">
                        <div className="constructor-quiz-ai-prep-section-head">
                          <div>
                            <strong>
                              Incluidos automáticamente
                            </strong>

                            <span>
                              Ya forman parte del quiz. No necesitas seleccionarlos otra vez.
                            </span>
                          </div>

                          <span className="constructor-quiz-ai-resource-count auto">
                            {imagenesQuizIA.length + formulasQuizIA.length}
                          </span>
                        </div>

                        {imagenesQuizIA.length > 0 && (
                          <div className="constructor-quiz-ai-auto-group">
                            <span className="constructor-quiz-ai-auto-label">
                              Imágenes · {imagenesQuizIA.length}
                            </span>

                            <div className="constructor-quiz-ai-quiz-images">
                              {imagenesQuizIA.map(
                                (imagen: any) => (
                                  <div
                                    key={imagen.id}
                                    className="constructor-quiz-ai-quiz-image"
                                  >
                                    <img
                                      src={imagen.url}
                                      alt={
                                        imagen.ubicacion
                                      }
                                    />

                                    <span>
                                      {imagen.ubicacion}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {formulasQuizIA.length > 0 && (
                          <div className="constructor-quiz-ai-auto-group">
                            <span className="constructor-quiz-ai-auto-label">
                              Fórmulas · {formulasQuizIA.length}
                            </span>

                            <div className="constructor-quiz-ai-formulas-included">
                              {formulasQuizIA.map(
                                (
                                  formula: any,
                                  index: number
                                ) => (
                                  <div
                                    key={`${formula.ubicacion}-${index}`}
                                    className="constructor-quiz-ai-formula-included"
                                  >
                                    <div>
                                      <span>
                                        ƒx
                                      </span>

                                      <div className="constructor-quiz-ai-rendered-formula">
                                        {renderFormulaIA(
                                          formula.formula
                                        )}
                                      </div>
                                    </div>

                                    <small>
                                      {formula.ubicacion}
                                    </small>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    <section className="constructor-quiz-ai-prep-section optional-media">
                      <div className="constructor-quiz-ai-prep-section-head">
                        <div>
                          <strong>
                            Recursos opcionales
                          </strong>

                          <span>
                            Imágenes o fórmulas de los bloques.
                          </span>
                        </div>

                        <span className="constructor-quiz-ai-resource-count">
                          {recursosSeleccionadosIA.length}
                          {" / "}
                          {maxRecursosIA}
                        </span>
                      </div>

                      {cargandoRecursosIA ? (
                        <div className="constructor-quiz-ai-resource-empty">
                          <RefreshCw
                            size={18}
                            className="animate-spin"
                          />
                          Buscando recursos...
                        </div>
                      ) : errorRecursosIA ? (
                        <div className="constructor-quiz-ai-resource-empty error">
                          <AlertTriangle
                            size={18}
                          />
                          {errorRecursosIA}
                        </div>
                      ) : recursosIA.length === 0 ? (
                        <div className="constructor-quiz-ai-resource-empty">
                          No hay imágenes o fórmulas adicionales en los bloques seleccionados.
                        </div>
                      ) : (
                        <div className="constructor-quiz-ai-resource-grid">
                          {recursosIA.map(
                            (recurso: any) => {
                              const seleccionado =
                                recursosSeleccionadosIA.includes(
                                  recurso.id
                                );

                              return (
                                <button
                                  key={recurso.id}
                                  type="button"
                                  onClick={() =>
                                    toggleRecursoIA(
                                      recurso.id
                                    )
                                  }
                                  className={`constructor-quiz-ai-resource-card ${
                                    seleccionado
                                      ? "selected"
                                      : ""
                                  } ${
                                    recurso.tipo === "formula"
                                      ? "formula"
                                      : ""
                                  }`}
                                >
                                  {recurso.tipo ===
                                  "imagen" ? (
                                    <img
                                      src={recurso.url}
                                      alt={
                                        recurso.titulo
                                      }
                                    />
                                  ) : (
                                    <div className="constructor-quiz-ai-formula-preview">
                                      <span>ƒx</span>

                                      <div className="constructor-quiz-ai-rendered-formula">
                                        {renderFormulaIA(
                                          recurso.texto
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="constructor-quiz-ai-resource-info">
                                    <strong>
                                      {recurso.titulo}
                                    </strong>

                                    <span>
                                      {recurso.bloque_titulo}
                                    </span>
                                  </div>

                                  <span className="constructor-quiz-ai-resource-check">
                                    {seleccionado
                                      ? "✓"
                                      : "+"}
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      )}
                    </section>

                    <details className="constructor-quiz-ai-extra-context">
                      <summary>
                        Añadir contexto manual
                      </summary>

                      <p>
                        Úsalo sólo si un video u otro material contiene información indispensable.
                      </p>

                      <textarea
                        value={
                          contextoAdicionalIA
                        }
                        onChange={(e) =>
                          setContextoAdicionalIA(
                            e.target.value.slice(
                              0,
                              1500
                            )
                          )
                        }
                        maxLength={1500}
                        className="constructor-quiz-textarea"
                        placeholder="Ejemplo: En el video se explica que..."
                      />

                      <span>
                        {contextoAdicionalIA.length}
                        /1500
                      </span>
                    </details>

                    <p className="constructor-quiz-ai-prep-footnote">
                      Videos, PDFs, documentos y enlaces externos no se enviarán a la IA.
                    </p>
                  </div>
                )}
                {vistaIA === "confirmar_aplicados" && (
                  <div className="constructor-quiz-ai-screen">
                    <div className="constructor-quiz-ai-result-header">
                      <span className="constructor-quiz-ai-kicker">
                        <CheckCircle2
                          size={16}
                          strokeWidth={2.6}
                        />
                        Confirmación final
                      </span>

                      <h3 className="constructor-quiz-ai-screen-title">
                        Finalizar revisión
                      </h3>

                      <p className="constructor-quiz-ai-screen-description">
                        Se guardarán los cambios que aprobaste. FCC Academy también
                        preparará explicaciones automáticas para ayudar a los estudiantes
                        a entender sus aciertos y errores cuando terminen el quiz.
                      </p>
                    </div>

                    {cantidadIgnoradasAcademicasIA() > 0 && (
                      <div className="constructor-quiz-ai-notice">
                        <AlertTriangle
                          size={18}
                          strokeWidth={2.4}
                        />

                        <span>
                          <strong>
                            {cantidadIgnoradasAcademicasIA() === 1
                              ? "Hay 1 pregunta que necesita tu revisión."
                              : `Hay ${cantidadIgnoradasAcademicasIA()} preguntas que necesitan tu revisión.`}
                          </strong>{" "}
                          Decidiste conservar una respuesta o contenido que el asistente
                          recomendó cambiar por razones académicas. Por seguridad, esas
                          preguntas no tendrán una explicación automática hasta que tú
                          escribas una manualmente.
                        </span>
                      </div>
                    )}
                    <div className="constructor-quiz-ai-confirm-list">
                      {obtenerCambiosAprobadosIA().map(
                        (item: any) => (
                          <div
                            key={item.clave}
                            className="constructor-quiz-ai-confirm-item"
                          >
                            <span className="constructor-quiz-ai-confirm-icon">
                              <Check
                                size={17}
                                strokeWidth={2.8}
                              />
                            </span>

                            <div>
                              <strong>
                                Pregunta {item.preguntaIndex + 1}
                              </strong>

                              <p>
                                {item.accion.tipo ===
                                "cambiar_respuesta_correcta"
                                  ? "Cambiar la respuesta correcta"
                                  : item.accion.tipo ===
                                      "reescribir_pregunta"
                                    ? "Corregir el enunciado"
                                    : "Corregir una respuesta"}
                              </p>

                              <div className="constructor-quiz-ai-confirm-formula">
                                {renderContenidoMatematicoIA(
                                  item.accion.texto_propuesto
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
                {vistaIA === "resultado" &&
                  analisisIA && (
                    <div className="constructor-quiz-ai-screen">
                      <div className="constructor-quiz-ai-result-header">
                        <span className="constructor-quiz-ai-kicker">
                          <CheckCircle2
                            size={16}
                            strokeWidth={2.5}
                          />
                          Análisis terminado
                        </span>

                        <h3 className="constructor-quiz-ai-screen-title">
                          Revisión del quiz
                        </h3>

                        <p className="constructor-quiz-ai-screen-description">
                          {normalizarTextoAnalisisIA(
                            analisisIA.resumen
                          )}
                        </p>
                      </div>

                      <div className="constructor-quiz-ai-result-summary">
                        <div className="constructor-quiz-ai-stat info">
                          <span className="constructor-quiz-ai-stat-icon">
                            <Check
                              size={18}
                              strokeWidth={2.7}
                            />
                          </span>

                          <strong>
                            {resumenResultadoIA().total}
                          </strong>

                          <span>
                            Preguntas revisadas
                          </span>
                        </div>

                        <div className="constructor-quiz-ai-stat danger">
                          <span className="constructor-quiz-ai-stat-icon">
                            <AlertTriangle
                              size={18}
                              strokeWidth={2.5}
                            />
                          </span>

                          <strong>
                            {resumenResultadoIA().academicas}
                          </strong>

                          <span>
                            Problemas académicos
                          </span>
                        </div>

                        <div className="constructor-quiz-ai-stat warn">
                          <span className="constructor-quiz-ai-stat-icon">
                            <Sparkles
                              size={18}
                              strokeWidth={2.5}
                            />
                          </span>

                          <strong>
                            {resumenResultadoIA().editoriales}
                          </strong>

                          <span>
                            Ajustes editoriales
                          </span>
                        </div>

                        <div className="constructor-quiz-ai-stat ok">
                          <span className="constructor-quiz-ai-stat-icon">
                            <CheckCircle2
                              size={18}
                              strokeWidth={2.6}
                            />
                          </span>

                          <strong>
                            {resumenResultadoIA().correctas}
                          </strong>

                          <span>
                            Sin observaciones
                          </span>
                        </div>
                      </div>

                      {(resumenResultadoIA().accionesAcademicas > 0 ||
                        resumenResultadoIA().accionesEditoriales > 0) && (
                        <div className="constructor-quiz-ai-result-breakdown">
                          <strong>Propuestas detectadas:</strong>
                          <span>
                            {resumenResultadoIA().accionesAcademicas} académicas · {" "}
                            {resumenResultadoIA().accionesEditoriales} editoriales
                          </span>
                        </div>
                      )}

                      {advertenciasGeneralesVisiblesIA().map(
                        (
                          advertencia: string,
                          index: number
                        ) => (
                          <div
                            key={index}
                            className="constructor-quiz-ai-general-note"
                          >
                            <Sparkles
                              size={16}
                              strokeWidth={2.4}
                            />

                            <span>
                              {advertencia}
                            </span>
                          </div>
                        )
                      )}

                      <div className="constructor-quiz-ai-result">
                        {(analisisIA.preguntas || []).map(
                          (
                            preguntaIA: any,
                            index: number
                          ) => {
                            const preguntaOriginal =
                              editQuiz.preguntas?.[index];
                            const accionesPregunta = Array.isArray(
                              preguntaIA.acciones
                            )
                              ? preguntaIA.acciones
                              : [];
                            const severidad =
                              severidadPreguntaIA(preguntaIA);

                            return (
                              <article
                                key={
                                  preguntaIA.pregunta_id ||
                                  index
                                }
                                className={`constructor-quiz-ai-question ${
                                  severidad === "academico"
                                    ? "is-danger"
                                    : severidad === "editorial"
                                      ? "is-review"
                                      : "is-ok"
                                }`}
                              >
                                <div className="constructor-quiz-ai-question-head">
                                  <div>
                                    <strong>
                                      Pregunta {index + 1}
                                    </strong>

                                    {preguntaOriginal && (
                                      <p
                                        className="constructor-quiz-ai-description"
                                        style={{
                                          marginTop: 4,
                                          maxWidth: 620,
                                        }}
                                      >
                                        {renderContenidoMatematicoIA(
                                          preguntaOriginal.enunciado
                                        )}
                                      </p>
                                    )}
                                  </div>

                                  {severidad === "correcto" ? (
                                    <span className="constructor-quiz-ai-status ok">
                                      <CheckCircle2
                                        size={14}
                                        strokeWidth={2.6}
                                      />
                                      Coherente
                                    </span>
                                  ) : severidad === "academico" ? (
                                    <span className="constructor-quiz-ai-status danger">
                                      <AlertTriangle
                                        size={14}
                                        strokeWidth={2.6}
                                      />
                                      Problema importante
                                    </span>
                                  ) : (
                                    <span className="constructor-quiz-ai-status warn">
                                      <Sparkles
                                        size={14}
                                        strokeWidth={2.6}
                                      />
                                      Mejorar redacción
                                    </span>
                                  )}
                                </div>

                                {severidad === "correcto" ? (
                                  <div className="constructor-quiz-ai-clean">
                                    <CheckCircle2
                                      size={17}
                                      strokeWidth={2.6}
                                    />

                                    <span>
                                      Sin observaciones.
                                    </span>
                                  </div>
                                ) : accionesPregunta.length > 0 ? (
                                  <div className="constructor-quiz-ai-actions-list">
                                    {accionesPregunta.map(
                                      (
                                        accion: any,
                                        accionIndex: number
                                      ) => {
                                        const clave =
                                          claveAccionIA(
                                            preguntaIA.pregunta_id,
                                            accionIndex
                                          );

                                        const aplicada =
                                          accionesAplicadasIA.includes(
                                            clave
                                          );

                                        const ignorada =
                                          accionesIgnoradasIA.includes(
                                            clave
                                          );

                                        const esAcademica =
                                          accion.impacto === "academico";

                                        const tituloAccion =
                                          accion.tipo ===
                                          "cambiar_respuesta_correcta"
                                            ? "Corregir respuesta correcta"
                                            : accion.tipo ===
                                                "reescribir_pregunta"
                                              ? esAcademica
                                                ? "Revisar contenido de la pregunta"
                                                : "Mejorar redacción de la pregunta"
                                              : esAcademica
                                                ? "Revisar contenido de la respuesta"
                                                : "Mejorar redacción de la respuesta";

                                        return (
                                          <div
                                            key={clave}
                                            className={`constructor-quiz-ai-action-card ${
                                              esAcademica
                                                ? "academic"
                                                : "editorial"
                                            } ${
                                              aplicada
                                                ? "applied"
                                                : ignorada
                                                  ? "ignored"
                                                  : ""
                                            }`}
                                          >
                                            <div className="constructor-quiz-ai-action-title">
                                              {aplicada ? (
                                                <CheckCircle2
                                                  size={17}
                                                  strokeWidth={2.6}
                                                />
                                              ) : (
                                                <Sparkles
                                                  size={17}
                                                  strokeWidth={2.5}
                                                />
                                              )}

                                              <span>
                                                {aplicada
                                                  ? "Cambio seleccionado"
                                                  : tituloAccion}
                                              </span>
                                            </div>

                                            <div className="constructor-quiz-ai-action-reason">
                                              {renderContenidoMatematicoIA(
                                                accion.motivo
                                              )}
                                            </div>

                                            {!aplicada &&
                                              !ignorada && (
                                                <div className="constructor-quiz-ai-change">
                                                  <div className="constructor-quiz-ai-change-box">
                                                    <span className="constructor-quiz-ai-change-label">
                                                      Actual
                                                    </span>

                                                    <div className="constructor-quiz-ai-change-text">
                                                      {renderContenidoMatematicoIA(
                                                        obtenerContenidoActualAccionIA(
                                                          preguntaIA.pregunta_id,
                                                          accion
                                                        ),
                                                        "Sin contenido"
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="constructor-quiz-ai-change-box proposed">
                                                    <span className="constructor-quiz-ai-change-label">
                                                      Propuesta
                                                    </span>

                                                    <div className="constructor-quiz-ai-change-text">
                                                      {renderContenidoMatematicoIA(
                                                        accion.texto_propuesto,
                                                        "Sin propuesta"
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                            {!aplicada &&
                                              !ignorada && (
                                                <div className="constructor-quiz-ai-action-buttons">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      ignorarAccionIA(
                                                        preguntaIA,
                                                        accionIndex
                                                      )
                                                    }
                                                    className="constructor-quiz-button secondary"
                                                  >
                                                    Ignorar
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      aplicarAccionIA(
                                                        preguntaIA,
                                                        accion,
                                                        accionIndex
                                                      )
                                                    }
                                                    className="constructor-quiz-button constructor-quiz-ai-apply"
                                                  >
                                                    <Check
                                                      size={16}
                                                      strokeWidth={2.7}
                                                    />
                                                    Aplicar cambio
                                                  </button>
                                                </div>
                                              )}

                                            {ignorada && (
                                              <span className="constructor-quiz-ai-description">
                                                Sugerencia ignorada.
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className={`constructor-quiz-ai-manual-note ${
                                      severidad === "academico"
                                        ? "academic"
                                        : "editorial"
                                    }`}
                                  >
                                    <p>
                                      {normalizarTextoAnalisisIA(
                                        preguntaIA.motivo_revision
                                      ) ||
                                        (severidad === "academico"
                                          ? "La respuesta o el contenido necesita una revisión manual."
                                          : "La pregunta necesita una revisión de claridad o contexto.")}
                                    </p>

                                    {(preguntaIA.advertencias || []).length > 0 && (
                                      <ul>
                                        {(preguntaIA.advertencias || []).map(
                                          (advertencia: string, advertenciaIndex: number) => (
                                            <li key={advertenciaIndex}>
                                              {normalizarTextoAnalisisIA(advertencia)}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </article>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
              </div>

              {vistaIA !== "cargando" && (
                <div className="constructor-quiz-modal-actions constructor-quiz-edit-actions">
                  {vistaIA === "confirmar" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVistaIA("editor")
                        }
                        className="constructor-quiz-button secondary"
                      >
                        Volver
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void guardarYContinuarIA()
                        }
                        className="constructor-quiz-button success"
                      >
                        <Save
                          size={17}
                          strokeWidth={2.6}
                        />

                        Guardar y continuar
                      </button>
                    </>
                  )}

                  {vistaIA === "confirmar_aplicados" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVistaIA("resultado")
                        }
                        className="constructor-quiz-button secondary ai-back"
                      >
                        Volver a la revisión
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void finalizarRevisionIA()
                        }
                        disabled={
                          finalizandoRevisionIA
                        }
                        className="constructor-quiz-button success"
                      >
                        {finalizandoRevisionIA ? (
                          <RefreshCw
                            size={17}
                            strokeWidth={2.5}
                            className="animate-spin"
                          />
                        ) : (
                          <Save
                            size={17}
                            strokeWidth={2.6}
                          />
                        )}

                        {finalizandoRevisionIA
                          ? "Finalizando..."
                          : "Guardar y finalizar"}
                      </button>
                    </>
                  )}
                  {vistaIA === "preparar" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVistaIA("editor")
                        }
                        className="constructor-quiz-button secondary ai-back"
                      >
                        Volver al quiz
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void analizarQuizConIA()
                        }
                        disabled={cargandoRecursosIA}
                        className="constructor-quiz-button success"
                      >
                        <Sparkles
                          size={17}
                          strokeWidth={2.6}
                        />
                        {cargandoRecursosIA
                          ? "Preparando…"
                          : "Generar análisis"}
                      </button>
                    </>
                  )}

                  {vistaIA === "resultado" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVistaIA("editor")
                        }
                        className="constructor-quiz-button secondary ai-back"
                      >
                        Volver al quiz
                      </button>

                      {revisionResueltaIA() && (
                        <button
                          type="button"
                          onClick={() =>
                            setVistaIA(
                              "confirmar_aplicados"
                            )
                          }
                          className="constructor-quiz-button success"
                        >
                          <CheckCircle2
                            size={17}
                            strokeWidth={2.6}
                          />

                          Finalizar revisión
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      {editQuiz &&
        vistaIA === "resultado_listo" &&
        renderPortal(
          <AvisoIAFCC
            etiqueta="Análisis terminado"
            titulo="La revisión está lista"
            descripcion="La IA puede cometer errores. Revisa cada observación y decide qué propuestas deseas aplicar antes de finalizar."
            nota="Ningún cambio se aplicará sin tu autorización."
            textoPrincipal="Entendido"
            onPrincipal={() => setVistaIA("resultado")}
          />,
          document.body
        )}
      {editQuiz &&
        vistaIA === "tiempo_agotado" &&
        renderPortal(
          <AvisoIAFCC
            tipo="tiempo"
            etiqueta="Tiempo de espera agotado"
            titulo="El análisis tardó más de lo esperado"
            descripcion="El servicio está tardando más de lo esperado. Revisa tu conexión o vuelve a intentarlo más tarde."
            nota="No se descontó ningún intento."
            textoSecundario="Volver al quiz"
            onSecundario={() => setVistaIA("editor")}
            textoPrincipal="Preparar otro intento"
            onPrincipal={abrirPreparacionAsistenteIA}
          />,
          document.body
        )}
      {editQuiz &&
        vistaIA === "cargando" &&
        renderPortal(
          <CargadorIAFCC
            mensaje="Analizando tu quiz"
            frases={[
              "Revisando cada pregunta…",
              "Comprobando las respuestas…",
              "Mejorando la redacción…",
              "Preparando recomendaciones…",
            ]}
          />,
          document.body
        )}
      {editQuiz &&
        mostrarExplicacionesQuiz && (
          <ExplicacionesQuiz
            quizId={editQuiz.id}
            quizTitulo={editQuiz.titulo}
            onClose={() =>
              setMostrarExplicacionesQuiz(false)
            }
            onResumenChange={(resumen) =>
              setResumenExplicacionesQuiz(resumen)
            }
          />
        )}

      {quizAEliminar &&
        renderPortal(
          <div
            className="constructor-quiz-overlay fcc-modal-backdrop-enter-standard"
            onClick={() => setQuizAEliminar(null)}
          >
            <div
              className="constructor-quiz-modal small fcc-modal-enter-standard"
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
          <div className="constructor-quiz-overlay fcc-modal-backdrop-enter-standard">
            <div className="constructor-quiz-modal small fcc-modal-enter-standard">
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
