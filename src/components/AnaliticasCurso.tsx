/**
 * Analíticas por curso para profesor.
 * - Conserva los filtros y ranking existentes.
 * - Cuando se selecciona un quiz, habilita analíticas visuales.
 * - Al seleccionar un estudiante muestra evolución por intentos y detalle por pregunta.
 */

"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  Eye,
  Minus,
  RefreshCw,
  Target,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";

type PeriodoOpt = {
  id: string;
  etiqueta: string;
  carrera_id: number;
};

type SeccionOpt = {
  id: string;
  nombre: string;
  periodo_id: string;
};

type Inscrito = {
  usuario_id: string;
  nombre: string;
  avatar_config: AvatarConfig | null;
  carrera_id: number | null;
  periodo_id: string | null;
  seccion_id: string | null;
  rol: string;
  matricula?: string | null;
};

type Quiz = {
  id: string;
  titulo: string;
  xp: number;
};

type IntentoResumen = {
  puntaje: number;
  puntos: number;
  numero_intento: number;
  created_at: string | null;
};

type IntentoStats = {
  best: number;
  total: number;
  tries: number;
  bestScore: number;
  latestScore: number | null;
  intentos: IntentoResumen[];
};

type RankingCursoCache = {
  timestamp: number;
  periodos: PeriodoOpt[];
  secciones: SeccionOpt[];
  inscritos: Inscrito[];
  quizzes: Quiz[];
  intentosMap: Record<string, Record<string, IntentoStats>>;
};

type ConceptoPrincipal = {
  id: string;
  nombre: string;
} | null;

type RespuestaAnalitica = {
  pregunta_id: string | null;
  orden_pregunta: number;
  pregunta_enunciado: string;
  respuesta_seleccionada_texto: string | null;
  respuesta_correcta_texto: string | null;
  es_correcta: boolean;
  es_version_actual: boolean;
  concepto_principal: ConceptoPrincipal;
};

type GrupoEstudiante = {
  usuario_id: string;
  estado: "sin_iniciar" | "provisional" | "final";
  puntaje: number | null;
  intentos_realizados: number;
  numero_intento: number;
  intentos_max: number;
  respuestas: RespuestaAnalitica[];
};

type GrupoAnaliticas = {
  quiz: {
    id: string;
    titulo: string;
    intentos_max: number;
  };
  estudiantes: GrupoEstudiante[];
  preguntas: {
    id: string;
    orden: number;
    enunciado: string;
  }[];
};

type DetalleIntento = {
  id: string;
  numero_intento: number;
  puntaje: number;
  created_at: string;
  envio_automatico: boolean;
  respuestas: RespuestaAnalitica[];
};

type DetalleEstudiante = {
  quiz: {
    id: string;
    titulo: string;
    intentos_max: number;
  };
  estudiante: {
    usuario_id: string;
    nombre: string;
    matricula: string | null;
  };
  preguntas: {
    id: string;
    orden: number;
    enunciado: string;
  }[];
  intentos: DetalleIntento[];
};

function parseAvatarConfig(value: any): AvatarConfig | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

function textoPlano(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<span[^>]*data-latex=["']([^"']+)["'][^>]*><\/span>/gi, "$1")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatearFecha(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function limitar(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorPuntaje(value: number | null | undefined) {
  const score = limitar(Number(value ?? 0), 0, 100);

  if (score < 60) return "#ef4444";
  if (score < 75) return "#f59e0b";
  if (score < 90) return "#3b82f6";
  return "#10b981";
}

function etiquetaPuntaje(value: number | null | undefined) {
  const score = limitar(Number(value ?? 0), 0, 100);

  if (score < 60) return "Requiere atención";
  if (score < 75) return "En desarrollo";
  if (score < 90) return "Buen desempeño";
  return "Dominio alto";
}

function interpretacionConcepto(
  value: number | null | undefined,
  individual: boolean,
  intentosDisponibles = false
) {
  const score = limitar(Number(value ?? 0), 0, 100);

  if (individual) {
    if (score === 100) return "Concepto comprendido";
    if (score >= 75) {
      return intentosDisponibles
        ? "Buen avance en la comprensión"
        : "Buen entendimiento";
    }
    if (score >= 50) {
      return intentosDisponibles
        ? "Comprensión en proceso"
        : "Comprensión parcial";
    }
    if (score > 0) {
      return intentosDisponibles
        ? "Aún presenta dificultades"
        : "Presenta dificultades";
    }
    return intentosDisponibles
      ? "No se ha comprendido"
      : "No se comprendió";
  }

  if (score >= 90) return "Comprensión sólida en el grupo";
  if (score >= 75) return "Buen entendimiento general";
  if (score >= 60) return "Comprensión parcial";
  if (score > 0) return "El concepto requiere refuerzo";
  return "El concepto no se comprendió";
}

function resumenParticipacion(
  iniciados: number,
  total: number,
  individual: boolean
) {
  if (individual) {
    if (iniciados > 0) {
      return {
        titulo: "Respondido",
        descripcion: "El estudiante ya respondió el quiz",
      };
    }

    return {
      titulo: "Pendiente",
      descripcion: "El estudiante aún no responde el quiz",
    };
  }

  if (total <= 0 || iniciados <= 0) {
    return {
      titulo: "Sin respuestas",
      descripcion: "Aún nadie ha respondido el quiz",
    };
  }

  if (iniciados === total) {
    return {
      titulo: "Completa",
      descripcion: "Todos los estudiantes ya respondieron el quiz",
    };
  }

  if (iniciados / Math.max(total, 1) >= 0.5) {
    return {
      titulo: "Activa",
      descripcion: "Más de la mitad del grupo ya respondió el quiz",
    };
  }

  return {
    titulo: "Baja",
    descripcion: "Pocos estudiantes han respondido el quiz",
  };
}

function gradienteDistribucion(
  bandas: Array<{ count: number }>,
  total: number
) {
  const colores = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

  if (total <= 0) {
    return "conic-gradient(color-mix(in srgb, var(--analytics-border) 45%, transparent) 0 100%)";
  }

  let cursor = 0;
  const partes: string[] = [];

  bandas.forEach((banda, index) => {
    if (banda.count <= 0) return;

    const inicio = cursor;
    cursor += (banda.count / total) * 100;
    partes.push(`${colores[index]} ${inicio}% ${cursor}%`);
  });

  return `conic-gradient(${partes.join(", ")})`;
}

export default function AnaliticasCurso({
  materiaId,
  filtroMatricula,
}: {
  materiaId: string;
  filtroMatricula?: string | null;
}) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [reintentoCarga, setReintentoCarga] = useState(0);

  const [periodos, setPeriodos] = useState<PeriodoOpt[]>([]);
  const [secciones, setSecciones] = useState<SeccionOpt[]>([]);
  const [carreraSel, setCarreraSel] = useState<number | null>(null);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const [seccionSel, setSeccionSel] = useState<string | null>(null);

  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizSel, setQuizSel] = useState<string>("");

  const [intentosMap, setIntentosMap] = useState<
    Record<string, Record<string, IntentoStats>>
  >({});

  const [grupoAnaliticas, setGrupoAnaliticas] =
    useState<GrupoAnaliticas | null>(null);
  const [cargandoGrupo, setCargandoGrupo] = useState(false);
  const [errorGrupo, setErrorGrupo] = useState("");

  const [estudianteAbiertoId, setEstudianteAbiertoId] = useState<
    string | null
  >(null);
  const [detalleEstudiante, setDetalleEstudiante] =
    useState<DetalleEstudiante | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const [intentoSeleccionadoId, setIntentoSeleccionadoId] = useState<
    string | null
  >(null);
  const [comparacionAbierta, setComparacionAbierta] = useState(false);
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<{
    intentoId: string;
    orden: number;
  } | null>(null);

  const aplicarDatos = (data: RankingCursoCache) => {
    setPeriodos(data.periodos);
    setSecciones(data.secciones);
    setInscritos(data.inscritos);
    setQuizzes(data.quizzes);
    setIntentosMap(data.intentosMap);
  };

  const cargarDatosRanking = async (): Promise<RankingCursoCache> => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Tu sesión no está disponible.");
    }

    const [
      { data: cursoCarreras, error: cursoCarrerasError },
      { data: quizzesRows, error: quizzesError },
      inscritosResponse,
    ] = await Promise.all([
      supabase
        .from("curso_carreras")
        .select(
          `
          id,
          carrera_id,
          curso_periodos (
            id,
            nombre,
            anio,
            curso_secciones (
              id,
              nombre
            )
          )
        `
        )
        .eq("curso_id", materiaId),

      supabase
        .from("quizzes")
        .select("id, titulo, xp, created_at")
        .eq("materia_id", materiaId)
        .order("created_at", { ascending: true }),

      fetch(
        `/api/analiticas/quiz?materiaId=${encodeURIComponent(materiaId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      ),
    ]);

    if (cursoCarrerasError || quizzesError) {
      throw cursoCarrerasError ?? quizzesError;
    }

    const inscritosPayload = await inscritosResponse.json();

    if (!inscritosResponse.ok || !inscritosPayload?.ok) {
      throw new Error(
        inscritosPayload?.error ||
          "No se pudieron cargar los estudiantes del curso."
      );
    }

    const periodosData: PeriodoOpt[] = [];
    const seccionesData: SeccionOpt[] = [];

    (cursoCarreras ?? []).forEach((c: any) => {
      (c.curso_periodos ?? []).forEach((p0: any) => {
        const etiqueta = `${p0.nombre} ${p0.anio}`;

        periodosData.push({
          id: p0.id,
          etiqueta,
          carrera_id: c.carrera_id,
        });

        (p0.curso_secciones ?? []).forEach((sec: any) => {
          seccionesData.push({
            id: sec.id,
            nombre: sec.nombre,
            periodo_id: p0.id,
          });
        });
      });
    });

    const quizzesData: Quiz[] = ((quizzesRows as any[]) ?? []).map((q) => ({
      id: q.id,
      titulo: q.titulo || "Quiz",
      xp: Number(q.xp ?? 0),
    }));

    const quizXpMap = new Map<string, number>();
    quizzesData.forEach((q) => quizXpMap.set(q.id, q.xp));

    const inscritosData: Inscrito[] = Array.isArray(
      inscritosPayload?.datos?.estudiantes
    )
      ? inscritosPayload.datos.estudiantes.map((row: any) => ({
          usuario_id: String(row.usuario_id),
          nombre: row.nombre || "Sin nombre",
          avatar_config: parseAvatarConfig(row.avatar_config),
          carrera_id: row.carrera_id ?? null,
          periodo_id: row.periodo_id ?? null,
          seccion_id: row.seccion_id ?? null,
          rol: "estudiante",
          matricula: row.matricula ?? null,
        }))
      : [];

    const quizIds = quizzesData.map((q) => q.id);

    const intentosResponse =
      quizIds.length > 0
        ? await supabase
            .from("intentos_quiz")
            .select(
              "quiz_id, usuario_id, puntaje, numero_intento, created_at"
            )
            .in("quiz_id", quizIds)
        : { data: [] as any[], error: null };

    if (intentosResponse.error) {
      throw intentosResponse.error;
    }

    const intentosRows = intentosResponse.data;

    const intentosData: Record<string, Record<string, IntentoStats>> = {};

    ((intentosRows as any[]) ?? []).forEach((row) => {
      const qid = String(row.quiz_id);
      const uid = String(row.usuario_id);
      const score = Number(row.puntaje ?? 0);
      const xpQuiz = quizXpMap.get(qid) ?? 0;
      const puntos = Math.round((xpQuiz * score) / 100);

      if (!intentosData[qid]) intentosData[qid] = {};

      if (!intentosData[qid][uid]) {
        intentosData[qid][uid] = {
          best: puntos,
          total: puntos,
          tries: 0,
          bestScore: score,
          latestScore: null,
          intentos: [],
        };
      }

      const stats = intentosData[qid][uid];
      stats.tries += 1;
      stats.total += stats.tries === 1 ? 0 : puntos;
      stats.best = Math.max(stats.best, puntos);
      stats.bestScore = Math.max(stats.bestScore, score);
      stats.intentos.push({
        puntaje: score,
        puntos,
        numero_intento: Number(row.numero_intento ?? stats.tries),
        created_at: row.created_at ?? null,
      });
    });

    Object.values(intentosData).forEach((porUsuario) => {
      Object.values(porUsuario).forEach((stats) => {
        stats.intentos.sort((a, b) => {
          if (a.numero_intento !== b.numero_intento) {
            return a.numero_intento - b.numero_intento;
          }

          return String(a.created_at || "").localeCompare(
            String(b.created_at || "")
          );
        });

        stats.latestScore =
          stats.intentos[stats.intentos.length - 1]?.puntaje ?? null;
      });
    });

    return {
      timestamp: Date.now(),
      periodos: periodosData,
      secciones: seccionesData,
      inscritos: inscritosData,
      quizzes: quizzesData,
      intentosMap: intentosData,
    };
  };

  useEffect(() => {
    const run = async () => {
      try {
        setCargando(true);
        setErrorCarga("");
        const data = await cargarDatosRanking();
        aplicarDatos(data);
      } catch (e) {
        console.error("Error cargando analíticas del curso:", e);
        setErrorCarga(
          e instanceof Error
            ? e.message
            : "No fue posible confirmar las analíticas del curso."
        );
      } finally {
        setCargando(false);
      }
    };

    void run();
  }, [materiaId, reintentoCarga]);

  useEffect(() => {
    setGrupoAnaliticas(null);
    setEstudianteAbiertoId(null);
    setDetalleEstudiante(null);
    setIntentoSeleccionadoId(null);
    setComparacionAbierta(false);
    setCeldaSeleccionada(null);
    setErrorGrupo("");
    setErrorDetalle("");

    if (!quizSel) {
      setCargandoGrupo(false);
      return;
    }

    let cancelado = false;

    const cargarAnaliticasGrupo = async () => {
      try {
        setCargandoGrupo(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Tu sesión no está disponible.");
        }

        const response = await fetch(
          `/api/analiticas/quiz?quizId=${encodeURIComponent(quizSel)}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error || "No se pudieron cargar las analíticas."
          );
        }

        if (!cancelado) {
          setGrupoAnaliticas(data.datos as GrupoAnaliticas);
        }
      } catch (error) {
        if (!cancelado) {
          setGrupoAnaliticas(null);
          setErrorGrupo(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las analíticas."
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoGrupo(false);
        }
      }
    };

    void cargarAnaliticasGrupo();

    return () => {
      cancelado = true;
    };
  }, [quizSel]);

  useEffect(() => {
    if (!quizSel) return;

    let cancelado = false;
    let actualizando = false;

    const refrescarSilenciosamente = async () => {
      if (actualizando) return;
      actualizando = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const [rankingData, grupoResponse] = await Promise.all([
          cargarDatosRanking(),
          fetch(
            `/api/analiticas/quiz?quizId=${encodeURIComponent(quizSel)}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          ),
        ]);

        const grupoData = await grupoResponse.json();

        if (cancelado) return;

        aplicarDatos(rankingData);

        if (grupoResponse.ok && grupoData?.ok) {
          setGrupoAnaliticas(grupoData.datos as GrupoAnaliticas);
          setErrorGrupo("");
        }

        if (estudianteAbiertoId) {
          const detalleResponse = await fetch(
            `/api/analiticas/quiz?quizId=${encodeURIComponent(
              quizSel
            )}&usuarioId=${encodeURIComponent(estudianteAbiertoId)}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          );

          const detalleData = await detalleResponse.json();

          if (
            !cancelado &&
            detalleResponse.ok &&
            detalleData?.ok
          ) {
            setDetalleEstudiante(
              detalleData.datos as DetalleEstudiante
            );
            setErrorDetalle("");
          }
        }
      } catch (error) {
        console.warn(
          "No se pudieron refrescar automáticamente las analíticas:",
          error
        );
      } finally {
        actualizando = false;
      }
    };

    const channel = supabase
      .channel(`analiticas-quiz-${materiaId}-${quizSel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intentos_quiz",
          filter: `quiz_id=eq.${quizSel}`,
        },
        () => {
          void refrescarSilenciosamente();
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refrescarSilenciosamente();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      cancelado = true;
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      void supabase.removeChannel(channel);
    };
  }, [materiaId, quizSel, estudianteAbiertoId]);

  const periodosFiltrados = useMemo(() => {
    if (!carreraSel) return [];
    return periodos.filter((p) => p.carrera_id === carreraSel);
  }, [carreraSel, periodos]);

  const seccionesFiltradas = useMemo(() => {
    if (!periodoSel) return [];
    return secciones.filter((s) => s.periodo_id === periodoSel);
  }, [periodoSel, secciones]);

  const inscritosFiltrados = useMemo(() => {
    return inscritos.filter((i) => {
      const passCarrera = !carreraSel || i.carrera_id === carreraSel;
      const passPeriodo = !periodoSel || i.periodo_id === periodoSel;
      const passSeccion = !seccionSel || i.seccion_id === seccionSel;
      return passCarrera && passPeriodo && passSeccion;
    });
  }, [inscritos, carreraSel, periodoSel, seccionSel]);

  const ranking = useMemo(() => {
    if (quizSel === "") {
      const acc: Record<string, number> = {};

      Object.keys(intentosMap).forEach((qid) => {
        Object.entries(intentosMap[qid]).forEach(([uid, st]) => {
          acc[uid] = (acc[uid] || 0) + st.best;
        });
      });

      return inscritosFiltrados
        .map((i) => ({
          ...i,
          total: acc[i.usuario_id] || 0,
        }))
        .sort(
          (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre)
        );
    }

    const rows = inscritosFiltrados.map((i) => {
      const st = intentosMap[quizSel]?.[i.usuario_id] || {
        best: 0,
        total: 0,
        tries: 0,
        bestScore: 0,
        latestScore: null,
        intentos: [],
      };

      return {
        ...i,
        best: st.best,
        tries: st.tries,
        bestScore: st.bestScore,
        latestScore: st.latestScore,
      };
    });

    return rows.sort((a, b) => {
      if (b.best !== a.best) return b.best - a.best;
      if (a.tries !== b.tries) return a.tries - b.tries;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [inscritosFiltrados, intentosMap, quizSel]);

  const rankingFiltrado = useMemo(() => {
    if (!filtroMatricula) return ranking;
    return ranking.filter((r: any) => r.matricula === filtroMatricula);
  }, [ranking, filtroMatricula]);

  const quizSeleccionado = useMemo(() => {
    if (!quizSel) return null;
    return quizzes.find((q) => q.id === quizSel) ?? null;
  }, [quizSel, quizzes]);

  const hayFiltroActivo = Boolean(
    filtroMatricula || carreraSel || periodoSel || seccionSel
  );

  const matriculaSinCoincidencia = Boolean(
    filtroMatricula && !cargando && rankingFiltrado.length === 0
  );

  const descripcionFiltro = useMemo(() => {
    const partes: string[] = [];

    if (filtroMatricula) {
      partes.push(`matrícula ${filtroMatricula}`);
    }

    if (carreraSel) {
      partes.push("carrera");
    }

    if (periodoSel) {
      partes.push("período");
    }

    if (seccionSel) {
      partes.push("sección");
    }

    return partes.join(", ");
  }, [filtroMatricula, carreraSel, periodoSel, seccionSel]);

  const idsVisibles = useMemo(
    () => new Set(rankingFiltrado.map((item: any) => item.usuario_id)),
    [rankingFiltrado]
  );

  const grupoFiltrado = useMemo(() => {
    return (grupoAnaliticas?.estudiantes || []).filter((item) =>
      idsVisibles.has(item.usuario_id)
    );
  }, [grupoAnaliticas, idsVisibles]);

  const resumenGrupo = useMemo(() => {
    const total = grupoFiltrado.length;
    const iniciados = grupoFiltrado.filter(
      (item) => item.estado !== "sin_iniciar"
    );
    const sinIniciar = total - iniciados.length;
    const provisionales = grupoFiltrado.filter(
      (item) => item.estado === "provisional"
    ).length;
    const finales = grupoFiltrado.filter(
      (item) => item.estado === "final"
    ).length;

    const promedio =
      iniciados.length > 0
        ? Math.round(
            iniciados.reduce(
              (sum, item) => sum + Number(item.puntaje ?? 0),
              0
            ) / iniciados.length
          )
        : null;

    const bandas = [
      {
        id: "bajo",
        label: "0–59",
        count: iniciados.filter((i) => Number(i.puntaje ?? 0) < 60).length,
      },
      {
        id: "medio",
        label: "60–74",
        count: iniciados.filter(
          (i) => Number(i.puntaje ?? 0) >= 60 && Number(i.puntaje ?? 0) < 75
        ).length,
      },
      {
        id: "alto",
        label: "75–89",
        count: iniciados.filter(
          (i) => Number(i.puntaje ?? 0) >= 75 && Number(i.puntaje ?? 0) < 90
        ).length,
      },
      {
        id: "excelente",
        label: "90–100",
        count: iniciados.filter((i) => Number(i.puntaje ?? 0) >= 90).length,
      },
    ];

    return {
      total,
      iniciados: iniciados.length,
      sinIniciar,
      provisionales,
      finales,
      promedio,
      bandas,
    };
  }, [grupoFiltrado]);

  const vistaIndividual = resumenGrupo.total === 1;
  const estadoIndividual = grupoFiltrado[0]?.estado ?? "sin_iniciar";

  const estadisticasPreguntas = useMemo(() => {
    if (!grupoAnaliticas) return [];

    return grupoAnaliticas.preguntas
      .map((pregunta) => {
        const respuestas = grupoFiltrado.flatMap((estudiante) =>
          estudiante.respuestas.filter(
            (respuesta) =>
              respuesta.pregunta_id === pregunta.id &&
              respuesta.es_version_actual
          )
        );

        const aciertos = respuestas.filter((r) => r.es_correcta).length;

        return {
          ...pregunta,
          total: respuestas.length,
          aciertos,
          porcentaje:
            respuestas.length > 0
              ? Math.round((aciertos / respuestas.length) * 100)
              : null,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));
  }, [grupoAnaliticas, grupoFiltrado]);

  const estadisticasConceptos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nombre: string;
        aciertos: number;
        total: number;
        estudiantes: Set<string>;
      }
    >();

    grupoFiltrado.forEach((estudiante) => {
      estudiante.respuestas.forEach((respuesta) => {
        if (!respuesta.es_version_actual || !respuesta.concepto_principal) {
          return;
        }

        const concepto = respuesta.concepto_principal;
        const actual = mapa.get(concepto.id) || {
          id: concepto.id,
          nombre: concepto.nombre,
          aciertos: 0,
          total: 0,
          estudiantes: new Set<string>(),
        };

        actual.total += 1;
        if (respuesta.es_correcta) actual.aciertos += 1;
        actual.estudiantes.add(estudiante.usuario_id);
        mapa.set(concepto.id, actual);
      });
    });

    return Array.from(mapa.values())
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        total: item.total,
        aciertos: item.aciertos,
        estudiantes: item.estudiantes.size,
        porcentaje:
          item.total > 0 ? Math.round((item.aciertos / item.total) * 100) : 0,
      }))
      .sort((a, b) => a.porcentaje - b.porcentaje);
  }, [grupoFiltrado]);

  useEffect(() => {
    if (
      estudianteAbiertoId &&
      !rankingFiltrado.some(
        (item: any) => item.usuario_id === estudianteAbiertoId
      )
    ) {
      setEstudianteAbiertoId(null);
      setDetalleEstudiante(null);
    }
  }, [rankingFiltrado, estudianteAbiertoId]);

  const abrirEstudiante = async (usuarioId: string) => {
    if (!quizSel) return;

    if (estudianteAbiertoId === usuarioId) {
      setEstudianteAbiertoId(null);
      setDetalleEstudiante(null);
      setIntentoSeleccionadoId(null);
      setComparacionAbierta(false);
      setCeldaSeleccionada(null);
      return;
    }

    setEstudianteAbiertoId(usuarioId);
    setDetalleEstudiante(null);
    setIntentoSeleccionadoId(null);
    setComparacionAbierta(false);
    setCeldaSeleccionada(null);
    setErrorDetalle("");

    try {
      setCargandoDetalle(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Tu sesión no está disponible.");
      }

      const response = await fetch(
        `/api/analiticas/quiz?quizId=${encodeURIComponent(
          quizSel
        )}&usuarioId=${encodeURIComponent(usuarioId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "No se pudo cargar el historial del estudiante."
        );
      }

      const detalle = data.datos as DetalleEstudiante;
      setDetalleEstudiante(detalle);
      setIntentoSeleccionadoId(null);
    } catch (error) {
      setErrorDetalle(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el historial del estudiante."
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  const intentoSeleccionado = useMemo(() => {
    if (!detalleEstudiante || !intentoSeleccionadoId) {
      return null;
    }

    return (
      detalleEstudiante.intentos.find(
        (intento) => intento.id === intentoSeleccionadoId
      ) || null
    );
  }, [detalleEstudiante, intentoSeleccionadoId]);

  const mejorIntentoId = useMemo(() => {
    const intentos = detalleEstudiante?.intentos || [];

    if (intentos.length === 0) {
      return null;
    }

    let mejor = intentos[0];

    for (const intento of intentos.slice(1)) {
      if (intento.puntaje >= mejor.puntaje) {
        mejor = intento;
      }
    }

    return mejor.id;
  }, [detalleEstudiante]);

  const tendenciaEstudiante = useMemo(() => {
    const intentos = detalleEstudiante?.intentos || [];
    if (intentos.length < 2) return null;

    const primero = intentos[0].puntaje;
    const ultimo = intentos[intentos.length - 1].puntaje;
    return ultimo - primero;
  }, [detalleEstudiante]);

  const filasMatriz = useMemo(() => {
    if (!detalleEstudiante) return [];

    const mapa = new Map<
      number,
      {
        orden: number;
        enunciado: string;
      }
    >();

    detalleEstudiante.preguntas.forEach((pregunta) => {
      mapa.set(Number(pregunta.orden ?? 0), {
        orden: Number(pregunta.orden ?? 0),
        enunciado: pregunta.enunciado || "",
      });
    });

    detalleEstudiante.intentos.forEach((intento) => {
      intento.respuestas.forEach((respuesta) => {
        if (!mapa.has(respuesta.orden_pregunta)) {
          mapa.set(respuesta.orden_pregunta, {
            orden: respuesta.orden_pregunta,
            enunciado: respuesta.pregunta_enunciado,
          });
        }
      });
    });

    return Array.from(mapa.values()).sort((a, b) => a.orden - b.orden);
  }, [detalleEstudiante]);

  const respuestaCeldaSeleccionada = useMemo(() => {
    if (!detalleEstudiante || !celdaSeleccionada) return null;

    const intento = detalleEstudiante.intentos.find(
      (item) => item.id === celdaSeleccionada.intentoId
    );

    const respuesta = intento?.respuestas.find(
      (item) => item.orden_pregunta === celdaSeleccionada.orden
    );

    if (!intento || !respuesta) return null;

    return { intento, respuesta };
  }, [detalleEstudiante, celdaSeleccionada]);

  const renderTimeline = () => {
    const intentos = detalleEstudiante?.intentos || [];

    if (intentos.length === 0) {
      return (
        <div className="analytics-student-empty">
          Este estudiante todavía no tiene intentos en el quiz.
        </div>
      );
    }

    const width = 820;
    const height = 248;
    const axisX = 88;
    const paddingRight = 34;
    const firstPointOffset = 54;
    const lastPointOffset = 20;
    const top = 48;
    const bottom = 48;
    const plotHeight = height - top - bottom;
    const plotStart = axisX + firstPointOffset;
    const plotEnd = width - paddingRight - lastPointOffset;
    const usableWidth = plotEnd - plotStart;

    const points = intentos.map((intento, index) => {
      const x =
        intentos.length === 1
          ? plotStart + usableWidth / 2
          : plotStart + (usableWidth * index) / (intentos.length - 1);

      const y =
        top +
        ((100 - limitar(intento.puntaje, 0, 100)) / 100) *
          plotHeight;

      return {
        intento,
        x,
        y,
        color: colorPuntaje(intento.puntaje),
      };
    });

    return (
      <div className="analytics-timeline-wrap">
        <svg
          className="analytics-timeline"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Evolución del puntaje por intento"
        >
          {[100, 75, 50, 25, 0].map((value) => {
            const y =
              top +
              ((100 - value) / 100) *
                plotHeight;

            return (
              <g key={value}>
                <line
                  x1={axisX}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  className="analytics-timeline-grid"
                />

                <text
                  x={axisX - 22}
                  y={y + 4}
                  textAnchor="end"
                  className="analytics-timeline-axis"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {points.slice(1).map((point, index) => {
            const previous = points[index];

            return (
              <line
                key={`segment-${point.intento.id}`}
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke={point.color}
                className="analytics-timeline-segment"
              />
            );
          })}

          {points.map(({ intento, x, y, color }) => {
            const seleccionado =
              intento.id === intentoSeleccionadoId;
            const esMejor = intento.id === mejorIntentoId;

            return (
              <g
                key={intento.id}
                className="analytics-timeline-point"
                onClick={() =>
                  setIntentoSeleccionadoId(intento.id)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    setIntentoSeleccionadoId(intento.id);
                  }
                }}
              >
                {esMejor && (
                  <circle
                    cx={x}
                    cy={y}
                    r={15}
                    fill="none"
                    stroke="#f59e0b"
                    className="analytics-timeline-best-ring"
                  />
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={seleccionado ? 11 : 9}
                  fill={seleccionado ? color : "var(--analytics-surface)"}
                  stroke={color}
                  className="analytics-timeline-dot"
                />

                {seleccionado && (
                  <circle
                    cx={x}
                    cy={y}
                    r={16}
                    fill="none"
                    stroke={color}
                    className="analytics-timeline-halo"
                  />
                )}

                {esMejor && (
                  <text
                    x={x}
                    y={Math.max(12, y - 35)}
                    textAnchor="middle"
                    className="analytics-timeline-best-label"
                  >
                    MEJOR
                  </text>
                )}

                <text
                  x={x}
                  y={Math.max(24, y - (esMejor ? 20 : 16))}
                  textAnchor="middle"
                  fill={color}
                  className="analytics-timeline-score"
                >
                  {intento.puntaje} pts
                </text>

                <text
                  x={x}
                  y={height - 15}
                  textAnchor="middle"
                  className="analytics-timeline-label"
                >
                  Intento {intento.numero_intento}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  if (cargando) {
    return (
      <CargadorFCC
        mensaje="Construyendo analíticas"
        detalle="Validando estudiantes, quizzes e intentos antes de mostrar resultados…"
      />
    );
  }

  if (errorCarga) {
    return (
      <EstadoErrorCargaFCC
        titulo="No se pudieron confirmar las analíticas"
        detalle={errorCarga}
        onRetry={() => setReintentoCarga((valor) => valor + 1)}
      />
    );
  }

  const estilos = (
    <style>{`
      .ranking-detalle {
        --analytics-accent: var(--fcc-premium-accent);
        --analytics-cyan: var(--fcc-premium-cyan);
        --analytics-surface: var(--fcc-premium-surface);
        --analytics-surface-soft: var(--fcc-premium-surface-soft);
        --analytics-surface-strong: var(--fcc-premium-surface-strong);
        --analytics-text: var(--fcc-premium-text);
        --analytics-text-soft: var(--fcc-premium-text-soft);
        --analytics-muted: var(--fcc-premium-muted);
        --analytics-border: var(--fcc-premium-border);
        --analytics-border-strong: var(--fcc-premium-border-strong);
        --analytics-shadow-soft: var(--fcc-premium-shadow-soft);
        --analytics-button: var(--fcc-premium-button);
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .analytics-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--analytics-text);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--analytics-surface) 96%, transparent),
          color-mix(in srgb, var(--analytics-surface-soft) 98%, transparent));
        border: 1px solid color-mix(in srgb, var(--analytics-accent) 14%, var(--analytics-border));
        box-shadow: var(--analytics-shadow-soft), inset 0 1px 0 color-mix(in srgb, var(--analytics-surface-strong) 65%, transparent);
      }

      .analytics-card-content { position: relative; z-index: 2; min-width: 0; }
      .analytics-filters { padding: 18px; }
      .analytics-filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
      .analytics-field { display: grid; gap: 8px; min-width: 0; }
      .analytics-label { color: var(--analytics-text-soft); font-size: .76rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
      .analytics-select { min-height: 44px; width: 100%; border-radius: 14px; padding: 0 13px; color: var(--analytics-text); background: color-mix(in srgb, var(--analytics-surface-strong) 74%, transparent); border: 1px solid var(--analytics-border); outline: none; font-size: .9rem; font-weight: 750; }
      .analytics-select:focus { border-color: color-mix(in srgb, var(--analytics-accent) 56%, var(--analytics-border)); }
      .analytics-select:disabled { opacity: .58; cursor: not-allowed; }

      .analytics-overview { padding: 18px; display: grid; gap: 15px; }
      .analytics-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      .analytics-eyebrow { display: inline-flex; align-items: center; gap: 9px; color: var(--analytics-accent); font-size: .7rem; font-weight: 950; letter-spacing: .15em; text-transform: uppercase; }
      .analytics-title { margin-top: 5px; color: var(--analytics-text); font-size: clamp(1.12rem, 2vw, 1.45rem); font-weight: 950; letter-spacing: -.035em; }
      .analytics-help { margin-top: 4px; color: var(--analytics-muted); font-size: .8rem; font-weight: 700; line-height: 1.4; }

      .analytics-overview-grid { display: grid; grid-template-columns: 1.05fr 1fr 1.35fr; gap: 11px; }
      .analytics-metric { min-height: 112px; border-radius: 20px; padding: 14px; background: color-mix(in srgb, var(--analytics-surface-strong) 72%, transparent); border: 1px solid var(--analytics-border); }
      .analytics-metric.center { display: flex; align-items: center; gap: 14px; }
      .analytics-ring { --ring-value: 0deg; width: 72px; height: 72px; flex: 0 0 72px; display: grid; place-items: center; border-radius: 999px; background: conic-gradient(var(--analytics-accent) var(--ring-value), color-mix(in srgb, var(--analytics-border) 55%, transparent) 0); position: relative; }
      .analytics-ring::after { content: ""; position: absolute; inset: 8px; border-radius: inherit; background: var(--analytics-surface); }
      .analytics-ring strong { position: relative; z-index: 1; font-size: .92rem; font-weight: 950; }
      .analytics-metric-copy { display: grid; gap: 3px; min-width: 0; }
      .analytics-metric-copy strong { font-size: 1.35rem; line-height: 1; font-weight: 950; color: var(--analytics-text); }
      .analytics-metric-copy span { color: var(--analytics-muted); font-size: .72rem; font-weight: 800; line-height: 1.25; }
      .analytics-state-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; height: 100%; }
      .analytics-state-box { display: grid; align-content: center; justify-items: center; gap: 4px; border-radius: 14px; background: color-mix(in srgb, var(--analytics-surface) 86%, transparent); border: 1px solid var(--analytics-border); text-align: center; }
      .analytics-state-box strong { font-size: 1.2rem; font-weight: 950; }
      .analytics-state-box span { color: var(--analytics-muted); font-size: .65rem; font-weight: 800; }
      .analytics-bands { display: grid; align-content: center; gap: 10px; height: 100%; }
      .analytics-band-track { height: 22px; display: flex; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--analytics-border) 30%, transparent); }
      .analytics-band-segment { min-width: 0; height: 100%; transition: width 220ms ease; }
      .analytics-band-segment:nth-child(1) { background: #ef4444; }
      .analytics-band-segment:nth-child(2) { background: #f59e0b; }
      .analytics-band-segment:nth-child(3) { background: #3b82f6; }
      .analytics-band-segment:nth-child(4) { background: #10b981; }
      .analytics-band-legend { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 5px; }
      .analytics-band-legend span { color: var(--analytics-muted); font-size: .64rem; font-weight: 800; text-align: center; }

      .analytics-insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
      .analytics-insight-panel { border-radius: 20px; padding: 14px; background: color-mix(in srgb, var(--analytics-surface-strong) 68%, transparent); border: 1px solid var(--analytics-border); }
      .analytics-insight-title { color: var(--analytics-text); font-size: .82rem; font-weight: 950; margin-bottom: 10px; }
      .analytics-visual-list { display: grid; gap: 9px; }
      .analytics-visual-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
      .analytics-visual-copy { min-width: 0; }
      .analytics-visual-copy strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--analytics-text-soft); font-size: .74rem; font-weight: 850; }
      .analytics-visual-copy small { color: var(--analytics-muted); font-size: .62rem; font-weight: 700; }
      .analytics-mini-bar { height: 7px; margin-top: 5px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--analytics-border) 45%, transparent); }
      .analytics-mini-bar > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981); }
      .analytics-visual-value { min-width: 44px; text-align: right; font-size: .84rem; font-weight: 950; color: var(--analytics-accent); }
      .analytics-small-sample { display: inline-block; margin-top: 2px; color: #d97706; font-size: .58rem; font-weight: 900; }

      .analytics-list-card { padding: 20px; }
      .analytics-list-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
      .analytics-list-header-tools { display: grid; justify-items: end; gap: 8px; }
      .analytics-score-label { color: var(--analytics-muted); font-size: .7rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
      .analytics-count { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 12px; color: var(--analytics-accent); background: color-mix(in srgb, var(--analytics-accent) 8%, transparent); border: 1px solid color-mix(in srgb, var(--analytics-accent) 20%, var(--analytics-border)); font-size: .82rem; font-weight: 950; white-space: nowrap; }
      .analytics-empty { border-radius: 18px; padding: 16px; color: var(--analytics-muted); background: color-mix(in srgb, var(--analytics-surface-strong) 58%, transparent); border: 1px dashed color-mix(in srgb, var(--analytics-accent) 20%, var(--analytics-border)); font-size: .9rem; font-weight: 750; text-align: center; }
      .analytics-error { color: #dc2626; }
      .analytics-list { display: grid; gap: 10px; }
      .analytics-row-wrap { display: grid; gap: 0; }
      .analytics-row { --row-accent: var(--analytics-accent); width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; min-width: 0; border-radius: 20px; padding: 13px 14px; color: var(--analytics-text); text-align: left; background: linear-gradient(135deg, color-mix(in srgb, var(--analytics-surface-strong) 72%, transparent), color-mix(in srgb, var(--analytics-surface-soft) 88%, transparent)); border: 1px solid var(--analytics-border); transition: transform 170ms ease, border-color 170ms ease, border-radius 170ms ease; }
      .analytics-row.clickable { cursor: pointer; }
      .analytics-row.clickable:hover { transform: translateY(-1px); border-color: var(--analytics-border-strong); }
      .analytics-row.open { border-radius: 20px 20px 8px 8px; border-color: color-mix(in srgb, var(--analytics-accent) 32%, var(--analytics-border)); }
      .analytics-row.top-1 { --row-accent: #f59e0b; background: linear-gradient(135deg, color-mix(in srgb, #f59e0b 14%, var(--analytics-surface-strong)), color-mix(in srgb, var(--analytics-surface-soft) 90%, transparent)); border-color: color-mix(in srgb, #f59e0b 38%, var(--analytics-border)); }
      .analytics-row.top-2 { --row-accent: #94a3b8; }
      .analytics-row.top-3 { --row-accent: #c08457; }
      .analytics-user { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 12px; min-width: 0; }
      .analytics-rank { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; color: var(--row-accent); background: color-mix(in srgb, var(--row-accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--row-accent) 30%, var(--analytics-border)); font-size: .95rem; font-weight: 950; white-space: nowrap; }
      .analytics-avatar-stage { width: 62px; height: 62px; display: grid; place-items: center; border-radius: 999px; background: radial-gradient(circle, color-mix(in srgb, var(--analytics-accent) 15%, transparent), transparent 65%); }
      .analytics-name-block { display: grid; gap: 3px; min-width: 0; }
      .analytics-name { color: var(--analytics-text); font-size: 1rem; font-weight: 950; overflow-wrap: anywhere; }
      .analytics-subtext { color: var(--analytics-muted); font-size: .75rem; font-weight: 750; }
      .analytics-points { display: flex; align-items: center; gap: 12px; color: var(--analytics-accent); font-size: 1rem; font-weight: 950; white-space: nowrap; }
      .analytics-points-meta { display: grid; justify-items: end; gap: 1px; }
      .analytics-points-meta > span:first-child { line-height: 1; }
      .analytics-row-chevron { color: var(--analytics-muted); }

      .analytics-student-panel { margin-top: 4px; border-radius: 8px 8px 24px 24px; padding: 17px; background: color-mix(in srgb, var(--analytics-accent) 3%, var(--analytics-surface)); border: 1px solid color-mix(in srgb, var(--analytics-accent) 22%, var(--analytics-border)); border-top: 0; display: grid; gap: 15px; }
      .analytics-student-loading { min-height: 150px; display: grid; place-items: center; color: var(--analytics-muted); }
      .analytics-student-empty { border-radius: 16px; padding: 20px; color: var(--analytics-muted); background: color-mix(in srgb, var(--analytics-surface-strong) 62%, transparent); border: 1px dashed var(--analytics-border); text-align: center; font-weight: 750; }
      .analytics-student-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .analytics-student-title { display: grid; gap: 3px; }
      .analytics-student-title strong { font-size: .95rem; font-weight: 950; }
      .analytics-student-title span { color: var(--analytics-muted); font-size: .7rem; font-weight: 750; }
      .analytics-trend { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 10px; font-size: .7rem; font-weight: 900; background: color-mix(in srgb, var(--analytics-accent) 8%, transparent); }
      .analytics-trend.up { color: #059669; }
      .analytics-trend.down { color: #dc2626; }
      .analytics-trend.same { color: var(--analytics-muted); }

      .analytics-timeline-wrap { width: 100%; overflow-x: auto; border-radius: 18px; padding: 6px; background: color-mix(in srgb, var(--analytics-surface-strong) 58%, transparent); border: 1px solid var(--analytics-border); }
      .analytics-timeline { display: block; width: 100%; min-width: 560px; height: auto; }
      .analytics-timeline-grid { stroke: color-mix(in srgb, var(--analytics-border) 80%, transparent); stroke-width: 1; stroke-dasharray: 4 7; }
      .analytics-timeline-axis { fill: var(--analytics-muted); font-size: 11px; font-weight: 700; }
      .analytics-timeline-line { fill: none; stroke: var(--analytics-accent); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
      .analytics-timeline-point { cursor: pointer; outline: none; }
      .analytics-timeline-dot { fill: var(--analytics-surface); stroke: var(--analytics-accent); stroke-width: 5; transition: r 160ms ease; }
      .analytics-timeline-dot.selected { fill: var(--analytics-accent); stroke: color-mix(in srgb, var(--analytics-accent) 26%, var(--analytics-surface)); }
      .analytics-timeline-score { fill: var(--analytics-text); font-size: 13px; font-weight: 950; }
      .analytics-timeline-label { fill: var(--analytics-muted); font-size: 11px; font-weight: 850; }

      .analytics-attempt-card { border-radius: 18px; padding: 14px; background: color-mix(in srgb, var(--analytics-surface-strong) 68%, transparent); border: 1px solid var(--analytics-border); display: grid; gap: 12px; }
      .analytics-attempt-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .analytics-attempt-score { display: flex; align-items: baseline; gap: 7px; }
      .analytics-attempt-score strong { font-size: 1.55rem; color: var(--analytics-accent); font-weight: 950; }
      .analytics-attempt-score span { color: var(--analytics-muted); font-size: .72rem; font-weight: 800; }
      .analytics-question-list { display: grid; gap: 8px; }
      .analytics-question { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; border-radius: 14px; padding: 10px; background: var(--analytics-surface); border: 1px solid var(--analytics-border); }
      .analytics-question-status { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 10px; }
      .analytics-question-status.ok { color: #059669; background: color-mix(in srgb, #10b981 11%, transparent); }
      .analytics-question-status.bad { color: #dc2626; background: color-mix(in srgb, #ef4444 10%, transparent); }
      .analytics-question-body { min-width: 0; display: grid; gap: 5px; }
      .analytics-question-body strong { color: var(--analytics-text); font-size: .78rem; font-weight: 900; line-height: 1.35; }
      .analytics-answer-line { color: var(--analytics-text-soft); font-size: .7rem; font-weight: 700; line-height: 1.35; }
      .analytics-answer-line b { color: var(--analytics-text); }
      .analytics-concept-chip { width: max-content; max-width: 100%; border-radius: 999px; padding: 4px 8px; color: #6d4aff; background: color-mix(in srgb, #7c5cff 8%, transparent); font-size: .62rem; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .analytics-version-old { color: #d97706; font-size: .6rem; font-weight: 850; }

      .analytics-action-row { display: flex; justify-content: center; }
      .analytics-button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 13px; padding: 0 14px; color: var(--analytics-text); background: color-mix(in srgb, var(--analytics-surface-strong) 82%, transparent); border: 1px solid var(--analytics-border); font-size: .78rem; font-weight: 900; transition: transform 160ms ease, border-color 160ms ease; }
      .analytics-button:hover { transform: translateY(-1px); border-color: var(--analytics-border-strong); }

      .analytics-matrix-wrap { overflow-x: auto; border-radius: 17px; border: 1px solid var(--analytics-border); }
      .analytics-matrix { width: 100%; min-width: 560px; border-collapse: collapse; background: var(--analytics-surface); }
      .analytics-matrix th, .analytics-matrix td { border-bottom: 1px solid var(--analytics-border); border-right: 1px solid var(--analytics-border); padding: 9px; text-align: center; }
      .analytics-matrix th { color: var(--analytics-muted); background: color-mix(in srgb, var(--analytics-surface-strong) 74%, transparent); font-size: .65rem; font-weight: 900; }
      .analytics-matrix th:first-child, .analytics-matrix td:first-child { position: sticky; left: 0; z-index: 2; width: 210px; text-align: left; background: var(--analytics-surface); }
      .analytics-matrix-question { display: block; max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--analytics-text-soft); font-size: .68rem; font-weight: 750; }
      .analytics-cell { width: 34px; height: 34px; display: inline-grid; place-items: center; border-radius: 10px; border: 0; cursor: pointer; }
      .analytics-cell.ok { color: #059669; background: color-mix(in srgb, #10b981 11%, transparent); }
      .analytics-cell.bad { color: #dc2626; background: color-mix(in srgb, #ef4444 10%, transparent); }
      .analytics-cell.empty { color: var(--analytics-muted); background: color-mix(in srgb, var(--analytics-border) 22%, transparent); cursor: default; }
      .analytics-cell.selected { outline: 2px solid var(--analytics-accent); outline-offset: 2px; }
      .analytics-cell-detail { border-radius: 16px; padding: 12px; background: color-mix(in srgb, var(--analytics-accent) 4%, var(--analytics-surface)); border: 1px solid color-mix(in srgb, var(--analytics-accent) 18%, var(--analytics-border)); display: grid; gap: 7px; }
      .analytics-cell-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .analytics-cell-detail-head strong { font-size: .78rem; font-weight: 950; }


      .analytics-query-card {
        min-height: 132px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        align-items: center;
        border-radius: 22px;
        padding: 20px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--analytics-accent) 6%, var(--analytics-surface)),
            color-mix(in srgb, var(--analytics-surface-strong) 72%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--analytics-accent) 18%, var(--analytics-border));
      }

      .analytics-query-copy {
        display: grid;
        gap: 5px;
        min-width: 0;
      }

      .analytics-query-copy strong {
        color: var(--analytics-text);
        font-size: 1rem;
        font-weight: 950;
      }

      .analytics-query-copy span {
        max-width: 680px;
        color: var(--analytics-muted);
        font-size: .8rem;
        font-weight: 700;
        line-height: 1.45;
      }

      .analytics-query-button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 14px;
        padding: 0 17px;
        color: #fff;
        background: var(--analytics-button);
        border: 1px solid transparent;
        font-size: .84rem;
        font-weight: 950;
        white-space: nowrap;
        transition: transform 160ms ease, opacity 160ms ease;
      }

      .theme-oscuro .analytics-query-button {
        color: #050505;
      }

      .analytics-query-button:hover {
        transform: translateY(-1px);
      }

      .analytics-query-button:disabled {
        opacity: .6;
        cursor: not-allowed;
        transform: none;
      }

      .analytics-filter-notice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        border-radius: 16px;
        padding: 11px 13px;
        color: color-mix(in srgb, #2563eb 78%, var(--analytics-text));
        background: color-mix(in srgb, #3b82f6 7%, var(--analytics-surface));
        border: 1px solid color-mix(in srgb, #3b82f6 22%, var(--analytics-border));
        font-size: .76rem;
        font-weight: 760;
        line-height: 1.45;
      }
      .analytics-filter-notice.not-found {
        color: #dc2626;
        background: color-mix(in srgb, #ef4444 7%, var(--analytics-surface));
        border-color: color-mix(in srgb, #ef4444 22%, var(--analytics-border));
      }

      .analytics-filter-notice strong {
        color: #2563eb;
        font-weight: 950;
      }

      .analytics-overview-grid {
        grid-template-columns: 1fr 1fr 1.15fr;
        align-items: stretch;
      }

      .analytics-average {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 14px;
      }

      .analytics-gauge {
        width: 154px;
        height: 92px;
        overflow: visible;
      }

      .analytics-gauge-track {
        fill: none;
        stroke: color-mix(in srgb, var(--analytics-border) 52%, transparent);
        stroke-width: 13;
        stroke-linecap: round;
      }

      .analytics-gauge-value {
        fill: none;
        stroke-width: 13;
        stroke-linecap: round;
        transition: stroke-dasharray 240ms ease;
      }

      .analytics-gauge-score {
        fill: var(--analytics-text);
        font-size: 22px;
        font-weight: 950;
      }

      .analytics-gauge-caption {
        fill: var(--analytics-muted);
        font-size: 8px;
        font-weight: 800;
      }

      .analytics-average-copy {
        display: grid;
        gap: 5px;
      }

      .analytics-average-copy strong {
        color: var(--analytics-text);
        font-size: .88rem;
        font-weight: 950;
      }

      .analytics-average-status {
        width: max-content;
        max-width: 100%;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: .66rem;
        font-weight: 900;
      }

      .analytics-distribution-panel {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 18px;
        align-items: center;
        border-radius: 20px;
        padding: 14px 16px;
        background: color-mix(in srgb, var(--analytics-surface-strong) 66%, transparent);
        border: 1px solid var(--analytics-border);
      }

      .analytics-donut {
        width: 98px;
        height: 98px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        position: relative;
      }

      .analytics-donut::after {
        content: "";
        position: absolute;
        inset: 15px;
        border-radius: inherit;
        background: var(--analytics-surface);
      }

      .analytics-donut-center {
        position: relative;
        z-index: 1;
        display: grid;
        justify-items: center;
        line-height: 1;
      }

      .analytics-donut-center strong {
        color: var(--analytics-text);
        font-size: 1.15rem;
        font-weight: 950;
      }

      .analytics-donut-center span {
        margin-top: 4px;
        color: var(--analytics-muted);
        font-size: .58rem;
        font-weight: 800;
      }

      .analytics-distribution-copy {
        display: grid;
        gap: 10px;
        min-width: 0;
      }

      .analytics-distribution-copy > strong {
        color: var(--analytics-text);
        font-size: .82rem;
        font-weight: 950;
      }

      .analytics-distribution-legend {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .analytics-distribution-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 7px;
        align-items: center;
        min-width: 0;
        border-radius: 13px;
        padding: 8px 9px;
        background: color-mix(in srgb, var(--analytics-surface) 88%, transparent);
        border: 1px solid var(--analytics-border);
      }

      .analytics-distribution-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
      }

      .analytics-distribution-item strong {
        display: block;
        color: var(--analytics-text-soft);
        font-size: .68rem;
        font-weight: 900;
      }

      .analytics-distribution-item span {
        display: block;
        margin-top: 1px;
        color: var(--analytics-muted);
        font-size: .6rem;
        font-weight: 750;
      }

      .analytics-insights-stack {
        display: grid;
        gap: 10px;
      }

      .analytics-insight-accordion {
        overflow: hidden;
        border-radius: 19px;
        background: color-mix(in srgb, var(--analytics-surface-strong) 64%, transparent);
        border: 1px solid var(--analytics-border);
      }

      .analytics-insight-summary {
        min-height: 62px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px 14px;
        cursor: pointer;
        list-style: none;
      }

      .analytics-insight-summary::-webkit-details-marker {
        display: none;
      }

      .analytics-insight-summary-copy {
        display: grid;
        gap: 2px;
      }

      .analytics-insight-summary-copy strong {
        color: var(--analytics-text);
        font-size: .86rem;
        font-weight: 950;
      }

      .analytics-insight-summary-copy span {
        color: var(--analytics-muted);
        font-size: .65rem;
        font-weight: 750;
      }

      .analytics-insight-chevron {
        color: var(--analytics-muted);
        transition: transform 160ms ease;
      }

      .analytics-insight-accordion[open] .analytics-insight-chevron {
        transform: rotate(180deg);
      }

      .analytics-insight-content {
        padding: 14px;
        border-top: 1px solid var(--analytics-border);
      }

      .analytics-concept-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .analytics-concept-card {
        min-height: 126px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 11px;
        align-items: center;
        border-radius: 16px;
        padding: 11px;
        background: var(--analytics-surface);
        border: 1px solid var(--analytics-border);
      }

      .analytics-concept-ring {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        position: relative;
      }

      .analytics-concept-ring::after {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: inherit;
        background: var(--analytics-surface);
      }

      .analytics-concept-ring strong {
        position: relative;
        z-index: 1;
        color: var(--analytics-text);
        font-size: .78rem;
        font-weight: 950;
      }

      .analytics-concept-copy {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .analytics-concept-copy strong {
        color: var(--analytics-text-soft);
        font-size: .72rem;
        font-weight: 900;
        line-height: 1.3;
      }

      .analytics-concept-copy span {
        color: var(--analytics-muted);
        font-size: .61rem;
        font-weight: 750;
      }

      .analytics-question-chart {
        min-height: 220px;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 10px;
        align-items: stretch;
      }

      .analytics-question-axis {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 4px 0 31px;
        color: var(--analytics-muted);
        font-size: .58rem;
        font-weight: 800;
        text-align: right;
      }

      .analytics-question-bars {
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(5, minmax(60px, 1fr));
        gap: 12px;
        align-items: end;
        padding: 8px 8px 0;
        border-left: 1px solid var(--analytics-border);
        border-bottom: 1px solid var(--analytics-border);
        background:
          repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent calc(25% - 1px),
            color-mix(in srgb, var(--analytics-border) 45%, transparent) calc(25% - 1px),
            color-mix(in srgb, var(--analytics-border) 45%, transparent) 25%
          );
      }

      .analytics-question-column {
        height: 180px;
        display: grid;
        grid-template-rows: 1fr auto auto;
        gap: 5px;
        align-items: end;
        justify-items: center;
        min-width: 0;
      }

      .analytics-question-bar-space {
        width: min(46px, 72%);
        height: 100%;
        display: flex;
        align-items: flex-end;
      }

      .analytics-question-bar {
        width: 100%;
        min-height: 4px;
        border-radius: 10px 10px 4px 4px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.2);
      }

      .analytics-question-column strong {
        color: var(--analytics-text);
        font-size: .67rem;
        font-weight: 950;
      }

      .analytics-question-column span {
        color: var(--analytics-muted);
        font-size: .58rem;
        font-weight: 750;
      }

      .analytics-row {
        min-height: 94px;
        padding: 17px 18px;
      }

      .analytics-user {
        gap: 15px;
      }

      .analytics-rank {
        width: 50px;
        height: 50px;
        border-radius: 16px;
        font-size: 1.02rem;
      }

      .analytics-avatar-stage {
        width: 108px;
        height: 108px;
      }

      .analytics-name-block {
        gap: 5px;
      }

      .analytics-name {
        font-size: 1.12rem;
      }

      .analytics-subtext {
        font-size: .82rem;
      }

      .analytics-student-meta-line {
        display: block;
        color: var(--analytics-muted);
        font-size: .72rem;
        font-weight: 750;
      }

      .analytics-points {
        font-size: 1.14rem;
      }

      .analytics-points-meta small {
        font-size: .67rem;
      }

      .analytics-count.filtered {
        color: #2563eb;
        background: color-mix(in srgb, #3b82f6 8%, transparent);
        border-color: color-mix(in srgb, #3b82f6 22%, var(--analytics-border));
      }

      .analytics-timeline-wrap {
        max-width: 980px;
        margin: 0 auto;
        padding: 8px 12px 2px;
      }

      .analytics-timeline {
        min-width: 610px;
        max-height: 260px;
      }

      .analytics-timeline-segment {
        stroke-width: 3.5;
        stroke-linecap: round;
      }

      .analytics-timeline-dot {
        stroke-width: 4;
      }

      .analytics-timeline-halo {
        stroke-width: 3;
        opacity: .2;
      }

      .analytics-timeline-score {
        font-size: 10.5px;
        font-weight: 950;
      }

      .analytics-timeline-label {
        font-size: 9.5px;
        font-weight: 850;
      }

      .analytics-timeline-axis {
        font-size: 9.5px;
      }


      .analytics-list-card.hidden-during-quiz-load {
        display: none;
      }

      .analytics-quiz-loading {
        min-height: 170px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-radius: 20px;
        color: var(--analytics-text-soft);
        background: color-mix(
          in srgb,
          var(--analytics-surface-strong) 64%,
          transparent
        );
        border: 1px solid var(--analytics-border);
      }

      .analytics-quiz-loading strong {
        font-size: .92rem;
        font-weight: 950;
      }

      .analytics-summary-layout-v4 {
        display: grid;
        grid-template-columns:
          minmax(0, 1.35fr)
          minmax(250px, 1fr)
          minmax(300px, .95fr);
        grid-template-rows: repeat(2, minmax(126px, auto));
        gap: 12px;
        align-items: stretch;
      }

      .analytics-summary-average-v4,
      .analytics-summary-participation-v4,
      .analytics-summary-states-v4,
      .analytics-summary-distribution-v4 {
        border-radius: 20px;
        padding: 16px;
        background: color-mix(
          in srgb,
          var(--analytics-surface-strong) 68%,
          transparent
        );
        border: 1px solid var(--analytics-border);
      }

      .analytics-summary-card-title {
        display: block;
        color: var(--analytics-text);
        font-size: .88rem;
        font-weight: 950;
      }

      .analytics-summary-average-v4 {
        grid-column: 1;
        grid-row: 1 / span 2;
        min-height: 286px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 6px;
        text-align: center;
        background:
          radial-gradient(
            circle at 50% 45%,
            color-mix(in srgb, var(--analytics-accent) 6%, transparent),
            transparent 62%
          ),
          color-mix(
            in srgb,
            var(--analytics-surface-strong) 68%,
            transparent
          );
      }

      .analytics-summary-average-v4 .analytics-summary-card-title {
        font-size: 1.08rem;
      }

      .analytics-gauge-v4 {
        width: min(300px, 96%);
        height: 172px;
        overflow: visible;
      }

      .analytics-gauge-track-v4,
      .analytics-gauge-value-v4 {
        stroke-width: 16;
      }

      .analytics-gauge-score-v4 {
        fill: var(--analytics-text);
        font-size: 31px;
        font-weight: 950;
      }

      .analytics-average-status-v4 {
        font-size: .72rem;
        padding: 6px 11px;
      }

      .analytics-summary-participation-v4 {
        grid-column: 2;
        grid-row: 1;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 10px;
        text-align: center;
      }

      .analytics-summary-participation-v4 .analytics-summary-card-title,
      .analytics-summary-states-v4 .analytics-summary-card-title,
      .analytics-summary-distribution-v4 .analytics-summary-card-title {
        text-align: center;
      }

      .analytics-participation-main-v4 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
      }

      .analytics-ring-v4 {
        width: 78px;
        height: 78px;
        flex: 0 0 78px;
      }

      .analytics-ring-v4 strong {
        font-size: .9rem;
      }

      .analytics-participation-copy-v4 {
        display: grid;
        gap: 3px;
        max-width: 190px;
        text-align: left;
      }

      .analytics-participation-copy-v4 strong {
        color: var(--analytics-text);
        font-size: 1.02rem;
        font-weight: 950;
        line-height: 1;
      }

      .analytics-participation-copy-v4 span {
        color: var(--analytics-muted);
        font-size: .72rem;
        font-weight: 800;
        line-height: 1.25;
      }

      .analytics-summary-states-v4 {
        grid-column: 2;
        grid-row: 2;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 10px;
      }

      .analytics-state-grid-v4 {
        width: 100%;
        min-height: 76px;
        gap: 10px;
      }

      .analytics-state-grid-v4 .analytics-state-box {
        min-width: 0;
        padding: 10px 12px;
      }

      .analytics-individual-state-v6 {
        width: min(100%, 280px);
        min-height: 82px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 5px;
        padding: 12px 16px;
        border-radius: 16px;
        text-align: center;
        border: 1px solid var(--analytics-border);
        background: color-mix(in srgb, var(--analytics-surface) 88%, transparent);
      }

      .analytics-individual-state-v6 strong {
        font-size: 1rem;
        font-weight: 950;
      }

      .analytics-individual-state-v6 span {
        color: var(--analytics-muted);
        font-size: .68rem;
        font-weight: 750;
      }

      .analytics-individual-state-v6.final strong { color: #10b981; }
      .analytics-individual-state-v6.provisional strong { color: #f59e0b; }
      .analytics-individual-state-v6.sin_iniciar strong { color: var(--analytics-muted); }

      .analytics-summary-distribution-v4 {
        grid-column: 3;
        grid-row: 1 / span 2;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 12px;
      }

      .analytics-distribution-compact-v4 {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr;
        gap: 13px;
        align-items: center;
        justify-items: center;
      }

      .analytics-pie-v6 {
        width: 112px;
        height: 112px;
        flex: 0 0 112px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--analytics-border) 70%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--analytics-surface) 60%, transparent);
      }

      .analytics-distribution-grid-v4 {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .analytics-distribution-item-v4 {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 7px;
        align-items: center;
        min-width: 0;
        border-radius: 12px;
        padding: 7px 8px;
        background: color-mix(
          in srgb,
          var(--analytics-surface) 88%,
          transparent
        );
        border: 1px solid var(--analytics-border);
      }

      .analytics-distribution-item-v4 strong {
        display: block;
        color: var(--analytics-text-soft);
        font-size: .67rem;
        font-weight: 950;
      }

      .analytics-distribution-item-v4 span {
        display: block;
        color: var(--analytics-muted);
        font-size: .59rem;
        font-weight: 750;
      }

      .analytics-insight-summary {
        min-height: 58px;
      }

      .analytics-insight-summary-copy strong {
        font-size: .9rem;
      }

      .analytics-concept-grid-v4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .analytics-concept-card-v4 {
        min-height: 118px;
        padding: 13px 14px;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 13px;
      }

      .analytics-concept-ring-v4 {
        width: 72px;
        height: 72px;
      }

      .analytics-concept-ring-v4::after {
        inset: 9px;
      }

      .analytics-concept-ring-v4 strong {
        font-size: .85rem;
      }

      .analytics-concept-copy-v4 {
        gap: 6px;
      }

      .analytics-concept-reading-v6 {
        font-size: .7rem !important;
        font-weight: 900 !important;
        line-height: 1.3;
      }

      .analytics-concept-copy-v4 strong {
        font-size: .82rem;
        line-height: 1.3;
      }

      .analytics-concept-copy-v4 span {
        font-size: .68rem;
      }

      .analytics-question-chart-v4 {
        min-height: 198px;
        grid-template-columns: 48px minmax(0, 1fr);
      }

      .analytics-question-bars-v4 {
        gap: 14px;
        padding: 9px 10px 0;
      }

      .analytics-question-column-v4 {
        height: 170px;
        grid-template-rows: auto 1fr auto auto;
        gap: 6px;
      }

      .analytics-question-bar-space-v4 {
        width: min(52px, 44%);
        min-width: 34px;
        border-radius: 10px 10px 4px 4px;
        background: color-mix(
          in srgb,
          var(--analytics-border) 20%,
          transparent
        );
      }

      .analytics-question-value-v4 {
        font-size: .72rem;
        font-weight: 950;
      }

      .analytics-question-column-v4 strong {
        font-size: .75rem;
      }

      .analytics-question-column-v4 > span:last-child {
        font-size: .62rem;
      }

      .analytics-row {
        min-height: 128px;
        padding: 18px 22px;
      }

      .analytics-user {
        gap: 17px;
      }

      .analytics-rank {
        width: 54px;
        height: 54px;
        border-radius: 17px;
        font-size: 1.08rem;
      }

      .analytics-avatar-stage {
        width: 88px;
        height: 88px;
      }

      .analytics-name-block {
        gap: 6px;
      }

      .analytics-name {
        font-size: 1.24rem;
      }

      .analytics-subtext {
        font-size: .9rem;
      }

      .analytics-student-meta-line {
        font-size: .78rem;
      }

      .analytics-points {
        font-size: 1.28rem;
      }

      .analytics-points-meta small {
        font-size: .7rem;
      }

      .analytics-student-panel {
        padding: 22px;
        gap: 18px;
      }

      .analytics-student-title strong {
        font-size: 1.08rem;
      }

      .analytics-student-title span {
        font-size: .8rem;
      }

      .analytics-trend {
        font-size: .76rem;
        padding: 7px 11px;
      }

      .analytics-timeline-wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 13px 16px 5px;
      }

      .analytics-timeline {
        min-width: 700px;
        max-height: 320px;
      }

      .analytics-timeline-segment {
        stroke-width: 4;
      }

      .analytics-timeline-dot {
        stroke-width: 4.5;
      }

      .analytics-timeline-halo {
        stroke-width: 3;
        opacity: .18;
      }

      .analytics-timeline-best-ring {
        stroke-width: 3;
        opacity: .8;
      }

      .analytics-timeline-best-label {
        fill: #d97706;
        font-size: 8px;
        font-weight: 950;
        letter-spacing: .08em;
      }

      .analytics-timeline-score {
        font-size: 12px;
        font-weight: 950;
      }

      .analytics-timeline-label {
        font-size: 10.5px;
        font-weight: 900;
      }

      .analytics-timeline-axis {
        font-size: 10.5px;
        font-weight: 800;
      }

      .analytics-timeline-hint {
        width: max-content;
        max-width: 100%;
        margin: -6px auto 0;
        border-radius: 999px;
        padding: 7px 11px;
        color: var(--analytics-muted);
        background: color-mix(
          in srgb,
          var(--analytics-surface-strong) 74%,
          transparent
        );
        border: 1px solid var(--analytics-border);
        font-size: .72rem;
        font-weight: 800;
      }

      .analytics-attempt-card {
        padding: 18px;
        gap: 14px;
      }

      .analytics-attempt-score strong {
        font-size: 1.75rem;
      }

      .analytics-question {
        padding: 13px;
        gap: 12px;
      }

      .analytics-question-status {
        width: 34px;
        height: 34px;
      }

      .analytics-question-body strong {
        font-size: .86rem;
      }

      .analytics-answer-line {
        font-size: .76rem;
      }

      .analytics-concept-chip {
        font-size: .67rem;
        padding: 5px 9px;
      }

      .analytics-matrix {
        min-width: 640px;
      }

      .analytics-matrix th,
      .analytics-matrix td {
        padding: 13px;
      }

      .analytics-matrix th {
        font-size: .72rem;
      }

      .analytics-matrix th:first-child,
      .analytics-matrix td:first-child {
        width: 140px;
      }

      .analytics-matrix-question {
        max-width: none;
        overflow: visible;
        text-overflow: clip;
        white-space: nowrap;
        font-size: .8rem;
        font-weight: 900;
      }

      .analytics-cell {
        width: 40px;
        height: 40px;
        border-radius: 11px;
      }

      .analytics-loader { animation: analyticsSpin 900ms linear infinite; }
      @keyframes analyticsSpin { to { transform: rotate(360deg); } }
      .analytics-skeleton { animation: analyticsPulse 1.25s ease-in-out infinite; }
      @keyframes analyticsPulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }

      @media (max-width: 1100px) {
        .analytics-concept-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .analytics-distribution-legend {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 980px) {
        .analytics-filter-grid {
          grid-template-columns: repeat(2, minmax(0,1fr));
        }

        .analytics-overview-grid {
          grid-template-columns: 1fr 1fr;
        }

        .analytics-overview-grid > :last-child {
          grid-column: 1 / -1;
        }

        .analytics-query-card,
        .analytics-distribution-panel {
          grid-template-columns: 1fr;
        }

        .analytics-donut {
          margin: 0 auto;
        }
      }

      @media (max-width: 700px) {
        .analytics-filters,
        .analytics-overview,
        .analytics-list-card {
          padding: 15px;
          border-radius: 24px;
        }

        .analytics-filter-grid,
        .analytics-overview-grid {
          grid-template-columns: 1fr;
        }

        .analytics-overview-grid > :last-child {
          grid-column: auto;
        }

        .analytics-list-header,
        .analytics-section-head {
          flex-direction: column;
        }

        .analytics-query-button {
          width: 100%;
        }

        .analytics-concept-grid,
        .analytics-distribution-legend {
          grid-template-columns: 1fr;
        }

        .analytics-question-chart {
          overflow-x: auto;
        }

        .analytics-question-bars {
          min-width: 480px;
        }

        .analytics-row {
          grid-template-columns: 1fr;
        }

        .analytics-user {
          grid-template-columns: auto auto minmax(0,1fr);
        }

        .analytics-avatar-stage {
          width: 92px;
          height: 92px;
        }

        .analytics-points {
          justify-content: flex-end;
        }

        .analytics-student-panel {
          padding: 12px;
        }
      }

      @media (max-width: 1180px) {
        .analytics-summary-layout-v4 {
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr);
          grid-template-rows: repeat(2, minmax(126px, auto)) auto;
        }

        .analytics-summary-average-v4 {
          grid-column: 1;
          grid-row: 1 / span 2;
        }

        .analytics-summary-participation-v4 {
          grid-column: 2;
          grid-row: 1;
        }

        .analytics-summary-states-v4 {
          grid-column: 2;
          grid-row: 2;
        }

        .analytics-summary-distribution-v4 {
          grid-column: 1 / -1;
          grid-row: 3;
        }

        .analytics-distribution-compact-v4 {
          grid-template-columns: auto minmax(0, 1fr);
        }
      }

      @media (max-width: 760px) {
        .analytics-summary-layout-v4 {
          grid-template-columns: 1fr;
          grid-template-rows: auto;
        }

        .analytics-summary-average-v4,
        .analytics-summary-participation-v4,
        .analytics-summary-states-v4,
        .analytics-summary-distribution-v4 {
          grid-column: 1;
          grid-row: auto;
        }

        .analytics-summary-average-v4 {
          min-height: 238px;
        }

        .analytics-distribution-compact-v4 {
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .analytics-distribution-grid-v4 {
          width: 100%;
        }

        .analytics-concept-grid-v4 {
          grid-template-columns: 1fr;
        }

        .analytics-avatar-stage {
          width: 96px;
          height: 96px;
        }

        .analytics-name {
          font-size: 1.08rem;
        }

        .analytics-subtext {
          font-size: .82rem;
        }
      }

    `}</style>
  );

  return (
    <div className="ranking-detalle">
      {estilos}

      <section className="analytics-card analytics-filters">
        <div className="analytics-card-content analytics-filter-grid">
          <div className="analytics-field">
            <label className="analytics-label">Carrera</label>
            <select
              value={carreraSel || ""}
              onChange={(e) => {
                setCarreraSel(e.target.value ? Number(e.target.value) : null);
                setPeriodoSel(null);
                setSeccionSel(null);
              }}
              className="analytics-select"
            >
              <option value="">Todas</option>
              <option value={1}>Licenciatura en Ciencias de la Computación</option>
              <option value={2}>Ingeniería en Ciencias de la Computación</option>
              <option value={3}>Ingeniería en Ciencia de Datos</option>
              <option value={4}>Ingeniería en Ciberseguridad</option>
              <option value={5}>Ingeniería en Tecnologías de la Información</option>
            </select>
          </div>

          <div className="analytics-field">
            <label className="analytics-label">Período</label>
            <select
              value={periodoSel || ""}
              onChange={(e) => {
                setPeriodoSel(e.target.value || null);
                setSeccionSel(null);
              }}
              disabled={!carreraSel}
              className="analytics-select"
            >
              <option value="">Todos</option>
              {periodosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="analytics-field">
            <label className="analytics-label">Sección</label>
            <select
              value={seccionSel || ""}
              onChange={(e) => setSeccionSel(e.target.value || null)}
              disabled={!periodoSel}
              className="analytics-select"
            >
              <option value="">Todas</option>
              {seccionesFiltradas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="analytics-field">
            <label className="analytics-label">Quiz</label>
            <select
              value={quizSel}
              onChange={(e) => setQuizSel(e.target.value)}
              className="analytics-select"
            >
              <option value="">Todos</option>
              {quizzes.length === 0 ? (
                <option disabled>Sin quizzes</option>
              ) : (
                quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.titulo}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {hayFiltroActivo && !cargando && (
        <div
          className={`analytics-filter-notice ${
            matriculaSinCoincidencia ? "not-found" : ""
          }`}
        >
          {matriculaSinCoincidencia ? <X size={17} /> : <Eye size={17} />}

          <span>
            {matriculaSinCoincidencia ? (
              <>
                <strong>Alumno no encontrado.</strong>{" "}
                No se encontró ningún alumno con la matrícula {filtroMatricula}.
              </>
            ) : (
              <>
                <strong>Vista filtrada.</strong>{" "}
                Estás viendo {rankingFiltrado.length} de {inscritos.length}{" "}
                {inscritos.length === 1 ? "estudiante" : "estudiantes"} del curso
                {descripcionFiltro ? ` · ${descripcionFiltro}` : ""}.
              </>
            )}
          </span>
        </div>
      )}

      {quizSel && (
        <section className="analytics-card">
          <div className="analytics-card-content analytics-overview">
            <div className="analytics-section-head">
              <div>
                <span className="analytics-eyebrow">
                  <BarChart3 size={15} /> Analíticas del quiz
                </span>

                <h2 className="analytics-title">
                  {quizSeleccionado?.titulo || "Quiz seleccionado"}
                </h2>

                <p className="analytics-help">
                  {vistaIndividual
                    ? "Resultados del estudiante seleccionado."
                    : "Resultados basados en la mejor calificación de cada estudiante."}
                </p>
              </div>
            </div>

            {matriculaSinCoincidencia ? (
              <div className="analytics-empty analytics-error">
                No se encontró ningún alumno con la matrícula {filtroMatricula}.
              </div>
            ) : cargandoGrupo ? (
              <div className="analytics-quiz-loading">
                <RefreshCw className="analytics-loader" size={24} />
                <strong>Cargando analíticas del quiz</strong>
              </div>
            ) : errorGrupo ? (
              <div className="analytics-empty analytics-error">
                {errorGrupo}
              </div>
            ) : grupoAnaliticas ? (
              <>
                <div className="analytics-summary-layout-v4">
                  <div className="analytics-summary-average-v4">
                    <span className="analytics-summary-card-title">
                      {vistaIndividual ? "Puntaje del estudiante" : "Promedio del grupo"}
                    </span>

                    <svg
                      className="analytics-gauge-v4"
                      viewBox="0 0 220 128"
                      aria-label={
                        vistaIndividual
                          ? "Puntaje del estudiante"
                          : "Promedio del grupo"
                      }
                    >
                      <path
                        d="M 20 108 A 90 90 0 0 1 200 108"
                        pathLength="100"
                        className="analytics-gauge-track analytics-gauge-track-v4"
                      />

                      <path
                        d="M 20 108 A 90 90 0 0 1 200 108"
                        pathLength="100"
                        stroke={colorPuntaje(resumenGrupo.promedio)}
                        strokeDasharray={`${resumenGrupo.promedio ?? 0} 100`}
                        className="analytics-gauge-value analytics-gauge-value-v4"
                      />

                      <text
                        x="110"
                        y="88"
                        textAnchor="middle"
                        className="analytics-gauge-score-v4"
                      >
                        {resumenGrupo.promedio === null
                          ? "—"
                          : `${resumenGrupo.promedio} pts`}
                      </text>
                    </svg>

                    {resumenGrupo.promedio !== null && (
                      <span
                        className="analytics-average-status analytics-average-status-v4"
                        style={{
                          color: colorPuntaje(resumenGrupo.promedio),
                          backgroundColor: `${colorPuntaje(
                            resumenGrupo.promedio
                          )}12`,
                        }}
                      >
                        {etiquetaPuntaje(resumenGrupo.promedio)}
                      </span>
                    )}

                  </div>

                  <div className="analytics-summary-participation-v4">
                    <span className="analytics-summary-card-title">
                      Participación
                    </span>

                    <div className="analytics-participation-main-v4">
                      <div
                        className="analytics-ring analytics-ring-v4"
                        style={{
                          ["--ring-value" as any]: `${
                            resumenGrupo.total > 0
                              ? Math.round(
                                  (resumenGrupo.iniciados /
                                    resumenGrupo.total) *
                                    360
                                )
                              : 0
                          }deg`,
                        }}
                      >
                        <strong>
                          {resumenGrupo.iniciados}/{resumenGrupo.total}
                        </strong>
                      </div>

                      {(() => {
                        const participacion = resumenParticipacion(
                          resumenGrupo.iniciados,
                          resumenGrupo.total,
                          vistaIndividual
                        );

                        return (
                          <div className="analytics-participation-copy-v4">
                            <strong>{participacion.titulo}</strong>
                            <span>{participacion.descripcion}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="analytics-summary-states-v4">
                    <span className="analytics-summary-card-title">
                      {vistaIndividual ? "Estatus" : "Estatus del grupo"}
                    </span>

                    {vistaIndividual ? (
                      <div
                        className={`analytics-individual-state-v6 ${estadoIndividual}`}
                      >
                        <strong>
                          {estadoIndividual === "final"
                            ? "Finalizado"
                            : estadoIndividual === "provisional"
                              ? "En progreso"
                              : "Sin iniciar"}
                        </strong>
                        <span>
                          {estadoIndividual === "final"
                            ? "Ya no tiene intentos pendientes"
                            : estadoIndividual === "provisional"
                              ? "Aún tiene intentos disponibles"
                              : "Aún no ha respondido este quiz"}
                        </span>
                      </div>
                    ) : (
                      <div className="analytics-state-grid analytics-state-grid-v4">
                        <div className="analytics-state-box">
                          <strong>{resumenGrupo.sinIniciar}</strong>
                          <span>Sin iniciar</span>
                        </div>

                        <div className="analytics-state-box">
                          <strong>{resumenGrupo.provisionales}</strong>
                          <span>En progreso</span>
                        </div>

                        <div className="analytics-state-box">
                          <strong>{resumenGrupo.finales}</strong>
                          <span>Final</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="analytics-summary-distribution-v4">
                    <span className="analytics-summary-card-title">
                      {vistaIndividual
                        ? "Rango de calificación"
                        : "Distribución de calificaciones"}
                    </span>

                    <div className="analytics-distribution-compact-v4">
                      <div
                        className="analytics-pie-v6"
                        role="img"
                        aria-label={
                          vistaIndividual
                            ? "Rango de la calificación del estudiante"
                            : "Distribución de calificaciones del grupo"
                        }
                        style={{
                          background: gradienteDistribucion(
                            resumenGrupo.bandas,
                            resumenGrupo.iniciados
                          ),
                        }}
                      />

                      <div className="analytics-distribution-grid-v4">
                        {resumenGrupo.bandas.map((banda, index) => {
                          const colores = [
                            "#ef4444",
                            "#f59e0b",
                            "#3b82f6",
                            "#10b981",
                          ];

                          return (
                            <div
                              key={banda.id}
                              className="analytics-distribution-item-v4"
                            >
                              <span
                                className="analytics-distribution-dot"
                                style={{ backgroundColor: colores[index] }}
                              />

                              <div>
                                <strong>{`${banda.label} pts`}</strong>
                                <span>
                                  {banda.count}{" "}
                                  {banda.count === 1
                                    ? "estudiante"
                                    : "estudiantes"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {(estadisticasConceptos.length > 0 ||
                  estadisticasPreguntas.length > 0) && (
                  <div className="analytics-insights-stack">
                    {estadisticasConceptos.length > 0 && (
                      <details className="analytics-insight-accordion">
                        <summary className="analytics-insight-summary">
                          <span className="analytics-insight-summary-copy">
                            <strong>Entendimiento de conceptos según la IA</strong>
                          </span>

                          <ChevronDown
                            size={18}
                            className="analytics-insight-chevron"
                          />
                        </summary>

                        <div className="analytics-insight-content">
                          <div className="analytics-concept-grid analytics-concept-grid-v4">
                            {estadisticasConceptos.slice(0, 8).map((item) => {
                              const color = colorPuntaje(item.porcentaje);

                              return (
                                <div
                                  key={item.id}
                                  className="analytics-concept-card analytics-concept-card-v4"
                                >
                                  <div
                                    className="analytics-concept-ring analytics-concept-ring-v4"
                                    style={{
                                      background: `conic-gradient(${color} ${
                                        item.porcentaje
                                      }%, color-mix(in srgb, var(--analytics-border) 42%, transparent) 0)`,
                                    }}
                                  >
                                    <strong>
                                      {item.aciertos}/{item.total}
                                    </strong>
                                  </div>

                                  <div className="analytics-concept-copy analytics-concept-copy-v4">
                                    <strong>{item.nombre}</strong>
                                    <span
                                      className="analytics-concept-reading-v6"
                                      style={{ color }}
                                    >
                                      {interpretacionConcepto(
                                        item.porcentaje,
                                        vistaIndividual,
                                        vistaIndividual &&
                                          estadoIndividual !== "final"
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    )}

                    {estadisticasPreguntas.length > 0 && (
                      <details className="analytics-insight-accordion">
                        <summary className="analytics-insight-summary">
                          <span className="analytics-insight-summary-copy">
                            <strong>Desempeño por pregunta</strong>
                          </span>

                          <ChevronDown
                            size={18}
                            className="analytics-insight-chevron"
                          />
                        </summary>

                        <div className="analytics-insight-content">
                          <div className="analytics-question-chart analytics-question-chart-v4">
                            <div className="analytics-question-axis">
                              <span>100%</span>
                              <span>75%</span>
                              <span>50%</span>
                              <span>25%</span>
                              <span>0%</span>
                            </div>

                            <div
                              className="analytics-question-bars analytics-question-bars-v4"
                              style={{
                                gridTemplateColumns: `repeat(${Math.max(
                                  1,
                                  estadisticasPreguntas.length
                                )}, minmax(120px, 1fr))`,
                              }}
                            >
                              {estadisticasPreguntas.map((item) => {
                                const porcentaje = Number(
                                  item.porcentaje ?? 0
                                );

                                return (
                                  <div
                                    key={item.id}
                                    className="analytics-question-column analytics-question-column-v4"
                                  >
                                    <span
                                      className="analytics-question-value-v4"
                                      style={{
                                        color: colorPuntaje(porcentaje),
                                      }}
                                    >
                                      {porcentaje}%
                                    </span>

                                    <div className="analytics-question-bar-space analytics-question-bar-space-v4">
                                      <span
                                        className="analytics-question-bar"
                                        style={{
                                          height: `${Math.max(
                                            4,
                                            porcentaje
                                          )}%`,
                                          backgroundColor:
                                            colorPuntaje(porcentaje),
                                        }}
                                      />
                                    </div>

                                    <strong>Pregunta {item.orden + 1}</strong>
                                    <span>
                                      {item.aciertos} de {item.total} correctas
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>
      )}

      <section
        className={`analytics-card analytics-list-card ${
          quizSel && (cargandoGrupo || !grupoAnaliticas || errorGrupo)
            ? "hidden-during-quiz-load"
            : ""
        }`}
      >
        <div className="analytics-card-content">
          <div className="analytics-list-header">
            <div>
              <p className="analytics-eyebrow">
                {quizSel === "" ? "General" : "Estudiantes"}
              </p>
              <h2 className="analytics-title">
                {quizSel === ""
                  ? "Puntos acumulados"
                  : "Seguimiento individual"}
              </h2>
              {quizSel && (
                <p className="analytics-help">
                  Selecciona un estudiante para abrir su evolución completa por intentos.
                </p>
              )}
            </div>

            <div className="analytics-list-header-tools">
              <span className="analytics-score-label">
                {quizSel === "" ? "Total acumulado" : "Mejor puntaje"}
              </span>

              <span
                className={`analytics-count ${
                  hayFiltroActivo ? "filtered" : ""
                }`}
              >
                {hayFiltroActivo
                  ? `${rankingFiltrado.length} de ${inscritos.length} estudiantes`
                  : `${rankingFiltrado.length} estudiantes`}
              </span>
            </div>
          </div>

          {cargando ? (
            <div className="analytics-list analytics-skeleton">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="analytics-empty" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <p className="analytics-empty">No hay datos para estos filtros.</p>
          ) : rankingFiltrado.length === 0 && filtroMatricula ? (
            <p className="analytics-empty">
              No se encontró ningún alumno con la matrícula <b>{filtroMatricula}</b>.
            </p>
          ) : (
            <div className="analytics-list">
              {rankingFiltrado.map((user: any, index: number) => {
                const posicion = index + 1;
                const puntos = quizSel === "" ? user.total : user.best;
                const abierto = estudianteAbiertoId === user.usuario_id;

                return (
                  <div key={user.usuario_id} className="analytics-row-wrap">
                    <button
                      type="button"
                      className={`analytics-row ${
                        quizSel ? "clickable" : ""
                      } ${abierto ? "open" : ""} ${
                        index === 0
                          ? "top-1"
                          : index === 1
                            ? "top-2"
                            : index === 2
                              ? "top-3"
                              : ""
                      }`}
                      onClick={() =>
                        quizSel ? void abrirEstudiante(user.usuario_id) : undefined
                      }
                      disabled={!quizSel}
                    >
                      <div className="analytics-user">
                        <span className="analytics-rank">{posicion}°</span>
                        <div className="analytics-avatar-stage">
                          <RenderizadorAvatar
                            config={user.avatar_config}
                            size={102}
                          />
                        </div>

                        <div className="analytics-name-block">
                          <span className="analytics-name">{user.nombre}</span>

                          <span className="analytics-subtext">
                            {user.matricula || "Estudiante"}
                          </span>

                          {quizSel && (
                            <span className="analytics-student-meta-line">
                              {user.tries === 0
                                ? "Sin intentos"
                                : `${user.tries} ${
                                    user.tries === 1 ? "intento" : "intentos"
                                  }`}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="analytics-points">
                        <span className="analytics-points-meta">
                          <span>{puntos} pts</span>
                        </span>
                        {quizSel && (
                          <span className="analytics-row-chevron">
                            {abierto ? (
                              <ChevronUp size={20} />
                            ) : (
                              <ChevronDown size={20} />
                            )}
                          </span>
                        )}
                      </span>
                    </button>

                    {abierto && quizSel && (
                      <div className="analytics-student-panel">
                        {cargandoDetalle ? (
                          <div className="analytics-student-loading">
                            <RefreshCw className="analytics-loader" size={23} />
                          </div>
                        ) : errorDetalle ? (
                          <div className="analytics-empty analytics-error">
                            {errorDetalle}
                          </div>
                        ) : detalleEstudiante ? (
                          <>
                            <div className="analytics-student-head">
                              <div className="analytics-student-title">
                                <strong>Evolución de {detalleEstudiante.estudiante.nombre}</strong>
                                <span>
                                  {detalleEstudiante.estudiante.matricula
                                    ? `Matrícula ${detalleEstudiante.estudiante.matricula} · `
                                    : ""}
                                  {detalleEstudiante.intentos.length} de {detalleEstudiante.quiz.intentos_max} intentos utilizados
                                </span>
                              </div>

                              {tendenciaEstudiante === null ? (
                                <span className="analytics-trend same">
                                  <Minus size={14} /> Sin tendencia todavía
                                </span>
                              ) : tendenciaEstudiante > 0 ? (
                                <span className="analytics-trend up">
                                  <ArrowUpRight size={14} /> +{tendenciaEstudiante} puntos desde el primer intento
                                </span>
                              ) : tendenciaEstudiante < 0 ? (
                                <span className="analytics-trend down">
                                  <ArrowDownRight size={14} /> {tendenciaEstudiante} puntos desde el primer intento
                                </span>
                              ) : (
                                <span className="analytics-trend same">
                                  <Minus size={14} /> Mismo puntaje que al inicio
                                </span>
                              )}
                            </div>

                            {renderTimeline()}

                            {!intentoSeleccionado &&
                              detalleEstudiante.intentos.length > 0 && (
                                <div className="analytics-timeline-hint">
                                  Selecciona un intento para ver sus respuestas.
                                </div>
                              )}

                            {intentoSeleccionado && (
                              <div className="analytics-attempt-card">
                                <div className="analytics-attempt-head">
                                  <div>
                                    <span className="analytics-eyebrow">
                                      <Target size={14} /> Intento {intentoSeleccionado.numero_intento}
                                    </span>
                                    <div className="analytics-attempt-score">
                                      <strong>{intentoSeleccionado.puntaje} pts</strong>
                                      <span>
                                        {formatearFecha(intentoSeleccionado.created_at)}
                                        {intentoSeleccionado.envio_automatico
                                          ? " · enviado por tiempo"
                                          : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="analytics-question-list">
                                  {intentoSeleccionado.respuestas.map(
                                    (respuesta) => (
                                      <div
                                        key={`${intentoSeleccionado.id}-${respuesta.orden_pregunta}`}
                                        className="analytics-question"
                                      >
                                        <span
                                          className={`analytics-question-status ${
                                            respuesta.es_correcta ? "ok" : "bad"
                                          }`}
                                        >
                                          {respuesta.es_correcta ? (
                                            <Check size={17} />
                                          ) : (
                                            <X size={16} />
                                          )}
                                        </span>
                                        <div className="analytics-question-body">
                                          <strong>
                                            Pregunta {respuesta.orden_pregunta + 1} · {textoPlano(respuesta.pregunta_enunciado)}
                                          </strong>
                                          <span className="analytics-answer-line">
                                            <b>Respondió:</b>{" "}
                                            {textoPlano(
                                              respuesta.respuesta_seleccionada_texto ||
                                                "Sin respuesta"
                                            )}
                                          </span>
                                          {!respuesta.es_correcta && (
                                            <span className="analytics-answer-line">
                                              <b>Correcta:</b>{" "}
                                              {textoPlano(
                                                respuesta.respuesta_correcta_texto ||
                                                  "Sin información"
                                              )}
                                            </span>
                                          )}
                                          {respuesta.concepto_principal && (
                                            <span className="analytics-concept-chip">
                                              {respuesta.concepto_principal.nombre}
                                            </span>
                                          )}
                                          {!respuesta.es_version_actual && (
                                            <span className="analytics-version-old">
                                              Esta respuesta pertenece a una versión anterior de la pregunta.
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {detalleEstudiante.intentos.length > 1 && (
                              <div className="analytics-action-row">
                                <button
                                  type="button"
                                  className="analytics-button"
                                  onClick={() =>
                                    setComparacionAbierta((prev) => !prev)
                                  }
                                >
                                  <Eye size={16} />
                                  {comparacionAbierta
                                    ? "Ocultar comparación completa"
                                    : "Comparar todos los intentos"}
                                </button>
                              </div>
                            )}

                            {comparacionAbierta && (
                              <>
                                <div className="analytics-matrix-wrap">
                                  <table className="analytics-matrix">
                                    <thead>
                                      <tr>
                                        <th>Pregunta</th>
                                        {detalleEstudiante.intentos.map(
                                          (intento) => (
                                            <th key={intento.id}>
                                              Intento {intento.numero_intento}<br />
                                              {intento.puntaje} pts
                                            </th>
                                          )
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filasMatriz.map((fila) => (
                                        <tr key={fila.orden}>
                                          <td>
                                            <span
                                              className="analytics-matrix-question"
                                              title={textoPlano(fila.enunciado)}
                                            >
                                              Pregunta {fila.orden + 1}
                                            </span>
                                          </td>
                                          {detalleEstudiante.intentos.map(
                                            (intento) => {
                                              const respuesta = intento.respuestas.find(
                                                (item) =>
                                                  item.orden_pregunta === fila.orden
                                              );

                                              if (!respuesta) {
                                                return (
                                                  <td key={intento.id}>
                                                    <span className="analytics-cell empty">
                                                      <Circle size={11} />
                                                    </span>
                                                  </td>
                                                );
                                              }

                                              const selected =
                                                celdaSeleccionada?.intentoId ===
                                                  intento.id &&
                                                celdaSeleccionada?.orden === fila.orden;

                                              return (
                                                <td key={intento.id}>
                                                  <button
                                                    type="button"
                                                    className={`analytics-cell ${
                                                      respuesta.es_correcta
                                                        ? "ok"
                                                        : "bad"
                                                    } ${selected ? "selected" : ""}`}
                                                    onClick={() =>
                                                      setCeldaSeleccionada({
                                                        intentoId: intento.id,
                                                        orden: fila.orden,
                                                      })
                                                    }
                                                    title={`Intento ${intento.numero_intento} · Pregunta ${fila.orden + 1}`}
                                                  >
                                                    {respuesta.es_correcta ? (
                                                      <Check size={16} />
                                                    ) : (
                                                      <X size={15} />
                                                    )}
                                                  </button>
                                                </td>
                                              );
                                            }
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {respuestaCeldaSeleccionada && (
                                  <div className="analytics-cell-detail">
                                    <div className="analytics-cell-detail-head">
                                      <strong>
                                        Intento {respuestaCeldaSeleccionada.intento.numero_intento} · Pregunta {respuestaCeldaSeleccionada.respuesta.orden_pregunta + 1}
                                      </strong>
                                      <span
                                        className={`analytics-question-status ${
                                          respuestaCeldaSeleccionada.respuesta.es_correcta
                                            ? "ok"
                                            : "bad"
                                        }`}
                                      >
                                        {respuestaCeldaSeleccionada.respuesta.es_correcta ? (
                                          <Check size={16} />
                                        ) : (
                                          <X size={15} />
                                        )}
                                      </span>
                                    </div>
                                    <span className="analytics-answer-line">
                                      <b>Respondió:</b>{" "}
                                      {textoPlano(
                                        respuestaCeldaSeleccionada.respuesta
                                          .respuesta_seleccionada_texto ||
                                          "Sin respuesta"
                                      )}
                                    </span>
                                    <span className="analytics-answer-line">
                                      <b>Respuesta correcta:</b>{" "}
                                      {textoPlano(
                                        respuestaCeldaSeleccionada.respuesta
                                          .respuesta_correcta_texto ||
                                          "Sin información"
                                      )}
                                    </span>
                                    {respuestaCeldaSeleccionada.respuesta
                                      .concepto_principal && (
                                      <span className="analytics-concept-chip">
                                        {
                                          respuestaCeldaSeleccionada.respuesta
                                            .concepto_principal.nombre
                                        }
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
