/**
 * Página para resolver o previsualizar un quiz:
 * - Estudiante: responde, guarda intentos, cronómetro y XP proporcional.
 * - Profesor: previsualiza (no guarda ni otorga XP).
 * - Auto-envía al agotar tiempo (usa minutos desde la BD).
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import "katex/dist/katex.min.css";

type Pregunta = { id: string; enunciado: string };
type Respuesta = { id: string; texto: string; es_correcta: boolean };

type QuizInfo = {
  id: string;
  titulo: string;
  descripcion: string | null;
  xp: number | null;
  intentos_max: number | null;
  tiempo_limite_min: number | null;
};

type EstadoQuiz = "intro" | "en_curso" | "finalizado";

type QuizStaticCache = {
  timestamp: number;
  quizInfo: QuizInfo | null;
  preguntas: Pregunta[];
  respuestas: Record<string, Respuesta[]>;
};

type QuizUserCache = {
  timestamp: number;
  rol: string;
  intentosRealizados: number;
  mejorPuntaje: number;
  esPreview: boolean;
};

const STATIC_CACHE_KEY_BASE = "fcc_academy_quiz_static_v1";
const USER_CACHE_KEY_BASE = "fcc_academy_quiz_user_v1";

function getStaticCacheKey(quizId: string) {
  return `${STATIC_CACHE_KEY_BASE}_${quizId}`;
}

function getUserCacheKey(userId: string, quizId: string) {
  return `${USER_CACHE_KEY_BASE}_${userId}_${quizId}`;
}

function guardarStaticCache(quizId: string, cache: Omit<QuizStaticCache, "timestamp">) {
  try {
    sessionStorage.setItem(
      getStaticCacheKey(quizId),
      JSON.stringify({
        timestamp: Date.now(),
        ...cache,
      })
    );
  } catch {}
}

function leerStaticCache(quizId: string): QuizStaticCache | null {
  try {
    const raw = sessionStorage.getItem(getStaticCacheKey(quizId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed?.preguntas)) return null;
    if (!parsed?.respuestas || typeof parsed.respuestas !== "object") return null;

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      quizInfo: parsed.quizInfo ?? null,
      preguntas: parsed.preguntas,
      respuestas: parsed.respuestas,
    };
  } catch {
    return null;
  }
}

function guardarUserCache(
  userId: string,
  quizId: string,
  cache: Omit<QuizUserCache, "timestamp">
) {
  try {
    sessionStorage.setItem(
      getUserCacheKey(userId, quizId),
      JSON.stringify({
        timestamp: Date.now(),
        ...cache,
      })
    );
  } catch {}
}

function leerUserCache(userId: string, quizId: string): QuizUserCache | null {
  try {
    const raw = sessionStorage.getItem(getUserCacheKey(userId, quizId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      rol: parsed.rol ?? "estudiante",
      intentosRealizados: Number(parsed.intentosRealizados) || 0,
      mejorPuntaje: Number(parsed.mejorPuntaje) || 0,
      esPreview: Boolean(parsed.esPreview),
    };
  } catch {
    return null;
  }
}

function limpiarCachesDerivados() {
  try {
    const prefixes = [
      "fcc_academy_visualizador_curso_",
      "fcc_academy_cursos_estudiante_",
      "fcc_academy_ranking_estudiante_",
      "fcc_academy_ranking_profesor_",
      "fcc_academy_widget_ranking_top5_",
      "fcc_academy_perfil_estudiante_",
      "fcc_academy_amigos_estudiante_",
    ];

    Object.keys(sessionStorage).forEach((key) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {}
}

export default function ResolverQuizPage() {
  const params = useParams();
  const router = useRouter();
  const materiaId = params?.id as string;
  const quizId = params?.quizId as string;

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta[]>>({});
  const [seleccionadas, setSeleccionadas] = useState<Record<string, string>>({});
  const seleccionadasRef = useRef<Record<string, string>>({});
  const [resultado, setResultado] = useState<{ correctas: number; total: number } | null>(null);
  const [envioAutomaticoPorTiempo, setEnvioAutomaticoPorTiempo] = useState(false);
  const [mostrarAvisoTiempo, setMostrarAvisoTiempo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verificandoIntentos, setVerificandoIntentos] = useState(true);
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rol, setRol] = useState<string>("estudiante");
  const [intentosRealizados, setIntentosRealizados] = useState<number>(0);
  const [esPreview, setEsPreview] = useState<boolean>(false);

  const [xpGanado, setXpGanado] = useState<number>(0);

  const [estado, setEstado] = useState<EstadoQuiz>("intro");
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const enviadoRef = useRef<boolean>(false);

  const [mejorPuntaje, setMejorPuntaje] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!quizId) return;

    const staticCache = leerStaticCache(quizId);

    if (staticCache) {
      setQuizInfo(staticCache.quizInfo);
      setPreguntas(staticCache.preguntas);
      setRespuestas(staticCache.respuestas);
      setLoading(false);
    }

    const usuarioLocal = localStorage.getItem("user_id");

    if (usuarioLocal) {
      setUserId(usuarioLocal);

      const userCache = leerUserCache(usuarioLocal, quizId);

      if (userCache) {
        setRol(userCache.rol);
        setIntentosRealizados(userCache.intentosRealizados);
        setMejorPuntaje(userCache.mejorPuntaje);
        setEsPreview(userCache.esPreview);
      }
    }
  }, [quizId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!quizId) return;

        const staticCache = leerStaticCache(quizId);

        if (staticCache) {
          setQuizInfo(staticCache.quizInfo);
          setPreguntas(staticCache.preguntas);
          setRespuestas(staticCache.respuestas);
          setLoading(false);
        } else {
          setLoading(true);
        }

        setVerificandoIntentos(true);

        const { data: userData } = await supabase.auth.getUser();

        if (!userData?.user) {
          router.push("/login");
          return;
        }

        const currentUserId = userData.user.id;
        setUserId(currentUserId);

        const paramsUrl = new URLSearchParams(window.location.search);
        const previewPorUrl = paramsUrl.get("preview") === "1";

        const [
          { data: perfil },
          { data: qz, error: quizError },
          { count: intentosCount },
          { data: bestIntento },
          { data: preg, error: preguntasError },
        ] = await Promise.all([
          supabase
            .from("usuarios")
            .select("rol")
            .eq("id", currentUserId)
            .single(),

          supabase
            .from("quizzes")
            .select("id,titulo,descripcion,xp,intentos_max,tiempo_limite_min")
            .eq("id", quizId)
            .single(),

          supabase
            .from("intentos_quiz")
            .select("id", { count: "exact", head: true })
            .eq("quiz_id", quizId)
            .eq("usuario_id", currentUserId),

          supabase
            .from("intentos_quiz")
            .select("puntaje")
            .eq("quiz_id", quizId)
            .eq("usuario_id", currentUserId)
            .order("puntaje", { ascending: false })
            .limit(1),

          supabase
            .from("preguntas")
            .select("id,enunciado")
            .eq("quiz_id", quizId)
            .order("orden", { ascending: true }),
        ]);

        if (quizError) {
          console.error("Error cargando quiz:", quizError);
        }

        if (preguntasError) {
          console.error("Error cargando preguntas:", preguntasError);
        }

        const rolUser = perfil?.rol || "estudiante";
        const preview = rolUser === "profesor" || previewPorUrl;
        const preguntasData = (preg as Pregunta[]) ?? [];
        const mapa: Record<string, Respuesta[]> = {};

        if (preguntasData.length > 0) {
          const preguntaIds = preguntasData.map((p) => p.id);

          const { data: respuestasData, error: respuestasError } = await supabase
            .from("respuestas")
            .select("id,texto,es_correcta,orden,pregunta_id")
            .in("pregunta_id", preguntaIds)
            .order("orden", { ascending: true });

          if (respuestasError) {
            console.error("Error cargando respuestas:", respuestasError);
          }

          preguntasData.forEach((p) => {
            mapa[p.id] = [];
          });

          ((respuestasData as any[]) ?? []).forEach((r) => {
            if (!mapa[r.pregunta_id]) {
              mapa[r.pregunta_id] = [];
            }

            mapa[r.pregunta_id].push({
              id: r.id,
              texto: r.texto,
              es_correcta: r.es_correcta,
            });
          });
        }

        const intentos = intentosCount || 0;
        const best = bestIntento?.[0]?.puntaje || 0;

        setRol(rolUser);
        setEsPreview(preview);
        setQuizInfo((qz as QuizInfo) ?? null);
        setPreguntas(preguntasData);
        setRespuestas(mapa);
        setIntentosRealizados(intentos);
        setMejorPuntaje(best);

        guardarStaticCache(quizId, {
          quizInfo: (qz as QuizInfo) ?? null,
          preguntas: preguntasData,
          respuestas: mapa,
        });

        guardarUserCache(currentUserId, quizId, {
          rol: rolUser,
          intentosRealizados: intentos,
          mejorPuntaje: best,
          esPreview: preview,
        });
      } catch (e) {
        console.error("Error inicializando quiz:", e);
      } finally {
        setLoading(false);
        setVerificandoIntentos(false);
      }
    };

    fetchData();
  }, [quizId, router]);

  useEffect(() => {
    seleccionadasRef.current = seleccionadas;
  }, [seleccionadas]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!(estado === "finalizado" && envioAutomaticoPorTiempo)) return;

    setMostrarAvisoTiempo(true);

    const timer = setTimeout(() => {
      setMostrarAvisoTiempo(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, [estado, envioAutomaticoPorTiempo]);

  const seleccionarRespuesta = (preguntaId: string, respuestaId: string) => {
    const next = {
      ...seleccionadasRef.current,
      [preguntaId]: respuestaId,
    };

    seleccionadasRef.current = next;
    setSeleccionadas(next);
  };

  const iniciar = () => {
    setEnvioAutomaticoPorTiempo(false);
    setMostrarAvisoTiempo(false);

    if (verificandoIntentos && !esPreview) {
      alert("Espera un momento. Estamos verificando tus intentos disponibles.");
      return;
    }

    if (esPreview) {
      enviadoRef.current = false;
      setEstado("en_curso");

      if (quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0) {
        setTimeLeftSec(quizInfo.tiempo_limite_min * 60);
      }

      arrancarCronometro();
      return;
    }

    if (intentosRealizados >= (quizInfo?.intentos_max ?? 1) || mejorPuntaje === 100) {
      alert("❌ Ya alcanzaste el número máximo de intentos para este quiz.");
      return;
    }

    enviadoRef.current = false;
    setEstado("en_curso");

    if (quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0) {
      setTimeLeftSec(quizInfo.tiempo_limite_min * 60);
    }

    arrancarCronometro();
  };

  const arrancarCronometro = () => {
    if (!quizInfo?.tiempo_limite_min || quizInfo.tiempo_limite_min <= 0) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev === null) return null;

        if (prev <= 1) {
          clearInterval(intervalRef.current as NodeJS.Timeout);

          if (!enviadoRef.current) enviarQuiz(true);

          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  const enviarQuiz = async (auto: boolean = false) => {
    if (enviadoRef.current) return;

    const seleccionadasActuales = seleccionadasRef.current;

    if (!auto) {
      const primeraSinResponder = preguntas.findIndex(
        (p) => !seleccionadasActuales[p.id]
      );

      if (primeraSinResponder !== -1) {
        alert(`Responde la pregunta ${primeraSinResponder + 1} antes de enviar el quiz.`);
        return;
      }
    }

    enviadoRef.current = true;
    setEnvioAutomaticoPorTiempo(auto);

    const total = preguntas.length;
    let correctas = 0;

    preguntas.forEach((p) => {
      const respuesta = respuestas[p.id]?.find(
        (r) => r.id === (seleccionadasActuales[p.id] || "")
      );

      if (respuesta?.es_correcta) correctas++;
    });

    setResultado({ correctas, total });
    setEstado("finalizado");

    if (intervalRef.current) clearInterval(intervalRef.current);

    if (esPreview || !userId || !quizInfo) return;

    if (intentosRealizados >= (quizInfo.intentos_max ?? 1)) {
      alert("❌ Ya alcanzaste el número máximo de intentos para este quiz.");
      return;
    }

    const puntaje = total > 0 ? Math.round((correctas / total) * 100) : 0;

    const { data: bestPrev } = await supabase
      .from("intentos_quiz")
      .select("puntaje")
      .eq("quiz_id", quizId)
      .eq("usuario_id", userId)
      .order("puntaje", { ascending: false })
      .limit(1);

    const prevBest = bestPrev?.[0]?.puntaje || 0;

    const intentosDespuesDeEste = intentosRealizados + 1;
    const quizCompletado =
      puntaje === 100 || intentosDespuesDeEste >= (quizInfo.intentos_max ?? 1);

    await supabase.from("intentos_quiz").insert({
      quiz_id: quizId,
      usuario_id: userId,
      puntaje,
      completado: quizCompletado,
    });

    const nuevoMejor = Math.max(prevBest, puntaje);

    setIntentosRealizados(intentosDespuesDeEste);
    setMejorPuntaje(nuevoMejor);

    guardarUserCache(userId, quizId, {
      rol,
      intentosRealizados: intentosDespuesDeEste,
      mejorPuntaje: nuevoMejor,
      esPreview,
    });

    const xpQuiz = quizInfo.xp ?? 0;
    const xpNuevo = Math.round((xpQuiz * puntaje) / 100);
    const xpPrev = Math.round((xpQuiz * prevBest) / 100);
    const delta = Math.max(xpNuevo - xpPrev, 0);

    if (delta > 0) {
      const { data, error } = await supabase.rpc("sumar_xp", {
        user_id: userId,
        xp_extra: delta,
      });

      if (error) {
        console.error("Error al sumar XP:", error);
      } else if (data?.nuevo_nivel === true) {
        window.dispatchEvent(
          new CustomEvent("nivelSubido", { detail: data.nivel_actual })
        );
      }
    }

    setXpGanado(Math.max(xpNuevo, xpPrev));

    const { data: quizzesMateria } = await supabase
      .from("quizzes")
      .select("id,intentos_max")
      .eq("materia_id", materiaId);

    const totalQuizzes = (quizzesMateria || []).length;
    const quizIdsMateria = (quizzesMateria || []).map((q) => q.id);

    let progreso = 0;

    if (quizIdsMateria.length > 0) {
      const { data: intentosUsuario } = await supabase
        .from("intentos_quiz")
        .select("quiz_id,puntaje")
        .eq("usuario_id", userId)
        .in("quiz_id", quizIdsMateria);

      const completadosSet = new Set<string>();

      for (const quizMateria of quizzesMateria || []) {
        const intentosDelQuiz = (intentosUsuario || []).filter(
          (i) => i.quiz_id === quizMateria.id
        );

        const tiene100 = intentosDelQuiz.some((i) => i.puntaje === 100);
        const agotoIntentos =
          intentosDelQuiz.length >= (quizMateria.intentos_max ?? 1);

        if (tiene100 || agotoIntentos) {
          completadosSet.add(quizMateria.id);
        }
      }

      progreso =
        totalQuizzes > 0
          ? Math.min(100, Math.round((completadosSet.size / totalQuizzes) * 100))
          : 0;
    }

    await supabase
      .from("progreso")
      .update({ progreso })
      .eq("usuario_id", userId)
      .eq("materia_id", materiaId);

    limpiarCachesDerivados();

    try {
      const { verificarLogros } = await import("@/utils/verificarLogros");
      const porcentaje = puntaje;

      if (porcentaje === 100) {
        const { count: completados100 } = await supabase
          .from("intentos_quiz")
          .select("*", { count: "exact" })
          .eq("usuario_id", userId)
          .eq("completado", true)
          .eq("puntaje", 100);

        await verificarLogros(userId, "quiz_100", completados100 ?? 0);
      }

      if (porcentaje >= 75) {
        const { count: completados75 } = await supabase
          .from("intentos_quiz")
          .select("*", { count: "exact" })
          .eq("usuario_id", userId)
          .eq("completado", true)
          .gte("puntaje", 75);

        await verificarLogros(userId, "quiz_75", completados75 ?? 0);
      }

      if (progreso === 100) {
        const { count: cursosCompletos } = await supabase
          .from("progreso")
          .select("*", { count: "exact" })
          .eq("usuario_id", userId)
          .eq("progreso", 100);

        await verificarLogros(userId, "curso", cursosCompletos ?? 0);
      }
    } catch (error) {
      console.error("Error al verificar logros del quiz o curso:", error);
    }
  };

  const reiniciarQuiz = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    seleccionadasRef.current = {};
    setSeleccionadas({});
    setEstado("intro");
    setResultado(null);
    setTimeLeftSec(null);
    setEnvioAutomaticoPorTiempo(false);
    setMostrarAvisoTiempo(false);
    enviadoRef.current = false;
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const decodeHtmlAttr = (value: string) => {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  };

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const renderQuizHTML = (content: string) => {
    if (!content) return "";

    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
    let html = hasHtml ? content : `<p>${escapeHtml(content)}</p>`;

    html = html.replace(
      /<span[^>]*data-type=["']inline-math["'][^>]*data-latex=["']([^"']+)["'][^>]*><\/span>/g,
      (_, latex) => {
        try {
          return katex.renderToString(decodeHtmlAttr(latex), {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          return decodeHtmlAttr(latex);
        }
      }
    );

    html = html.replace(
      /<span[^>]*data-latex=["']([^"']+)["'][^>]*data-type=["']inline-math["'][^>]*><\/span>/g,
      (_, latex) => {
        try {
          return katex.renderToString(decodeHtmlAttr(latex), {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          return decodeHtmlAttr(latex);
        }
      }
    );

    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
      try {
        return katex.renderToString(String(latex).trim(), {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        return String(latex);
      }
    });

    html = html.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
      try {
        return katex.renderToString(String(latex).trim(), {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        return String(latex);
      }
    });

    return html;
  };

  const handleQuizContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (target.tagName === "IMG") {
      const src = target.getAttribute("src");
      if (src) setPreviewImage(src);
    }
  };

  if (loading) {
    return (
      <LayoutGeneral rol={rol}>
        <div className="p-4 sm:p-6 rounded-xl shadow space-y-5 sm:space-y-6 min-w-0 overflow-hidden animate-pulse"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            className="h-8 rounded w-2/3 mx-auto"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <div
            className="h-4 rounded w-1/2 mx-auto"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <div
            className="p-4 rounded-lg space-y-3"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="h-5 rounded w-44 mx-auto"
              style={{ backgroundColor: "var(--color-border)" }}
            />
            <div
              className="h-5 rounded w-32 mx-auto"
              style={{ backgroundColor: "var(--color-border)" }}
            />
            <div
              className="h-10 rounded w-28 mx-auto"
              style={{ backgroundColor: "var(--color-border)" }}
            />
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  const intentosMax = quizInfo?.intentos_max ?? 1;
  const sinMasIntentos =
    !esPreview &&
    !verificandoIntentos &&
    (intentosRealizados >= intentosMax || mejorPuntaje === 100);

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
  };

  return (
    <LayoutGeneral rol={rol}>
      <div className="p-4 sm:p-6 rounded-xl shadow space-y-5 sm:space-y-6 min-w-0 overflow-hidden" style={cardStyle}>
        <h1
          className="text-xl sm:text-2xl font-bold break-words text-center min-h-11 flex items-center justify-center gap-2"
          style={{ color: "var(--color-heading)" }}
        >
          <span aria-hidden="true">📝</span>
          <span>{quizInfo?.titulo || "Resolver Quiz"}</span>
        </h1>

        {quizInfo?.descripcion && (
          <p
            className="text-center italic"
            style={{ color: "var(--color-muted)" }}
          >
            {quizInfo.descripcion}
          </p>
        )}

        {esPreview && (
          <p
            className="text-center"
            style={{ color: "var(--color-secondary)" }}
          >
            👨‍🏫 Modo previsualización: las respuestas no se guardan ni otorgan XP.
          </p>
        )}

        <p className="text-sm text-center" style={{ color: "var(--color-muted)" }}>
          {verificandoIntentos && !esPreview
            ? "Verificando intentos disponibles..."
            : `Intentos realizados: ${intentosRealizados} / ${intentosMax}`}
        </p>

        {estado === "intro" && (
          <div
            className="p-4 rounded-lg space-y-3 text-center flex flex-col items-center"
            style={cardStyle}
          >
            <p style={{ color: "var(--color-text)" }}>
              {quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0
                ? `⏱ Tiempo límite: ${quizInfo.tiempo_limite_min} min`
                : "⏱ Tiempo límite: sin límite"}
            </p>
            <p style={{ color: "var(--color-text)" }}>📝 Preguntas: {preguntas.length}</p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={iniciar}
                disabled={verificandoIntentos || sinMasIntentos}
                className="px-4 py-2 rounded text-white hover:opacity-90 disabled:opacity-60 w-full sm:w-auto"
                style={{
                  backgroundColor:
                    verificandoIntentos || sinMasIntentos
                      ? "var(--color-secondary)"
                      : "var(--color-primary)",
                  cursor:
                    verificandoIntentos || sinMasIntentos
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {verificandoIntentos && !esPreview ? "Verificando..." : "Iniciar"}
              </button>

              {sinMasIntentos && (
                <div className="text-sm space-y-1 text-center">
                  <p style={{ color: "var(--color-danger)" }}>
                    Ya no tienes intentos disponibles.
                  </p>
                  <p style={{ color: "var(--color-primary)" }}>
                    🏆 Mejor puntaje obtenido:{" "}
                    <span className="font-bold">{mejorPuntaje}%</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {estado === "en_curso" && timeLeftSec !== null && quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0 && (
          <div
            className="text-center text-lg font-semibold"
            style={{ color: timeLeftSec <= 60 ? "var(--color-danger)" : "var(--color-heading)" }}
          >
            ⏳ {mmss(timeLeftSec)}
          </div>
        )}

        {(estado === "en_curso" || estado === "finalizado") && (
          <div className="space-y-4">
            {preguntas.map((p, idx) => (
              <div key={p.id} className="p-3 sm:p-4 rounded-lg min-w-0 overflow-hidden" style={cardStyle}>
                <div
                  className="font-semibold mb-3 flex gap-2 min-w-0 items-start"
                  style={{ color: "var(--color-heading)" }}
                >
                  <span className="shrink-0 pt-1">{idx + 1}.</span>

                  <div
                    className="quiz-render flex-1 max-w-none min-w-0 overflow-x-auto text-center [&_.katex-display]:overflow-x-auto [&_p]:my-0 [&_img]:max-w-full [&_img]:max-h-56 [&_img]:rounded-lg [&_img]:my-2 [&_img]:mx-auto [&_img]:cursor-pointer"
                    style={{ color: "var(--color-text)" }}
                    onClick={handleQuizContentClick}
                    dangerouslySetInnerHTML={{ __html: renderQuizHTML(p.enunciado) }}
                  />
                </div>

                <div className="space-y-2">
                  {(respuestas[p.id] || []).map((r) => {
                    const disabled = estado === "finalizado";
                    const selected = seleccionadas[p.id] === r.id;

                    return (
                      <div key={r.id} className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name={p.id}
                          value={r.id}
                          checked={selected}
                          disabled={disabled}
                          onChange={() => seleccionarRespuesta(p.id, r.id)}
                          className="shrink-0"
                        />

                        <div
                          className="quiz-render flex-1 max-w-none min-w-0 overflow-x-auto rounded-lg px-3 py-2 text-sm text-center [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-center [&_p]:my-0 [&_p]:text-center [&_img]:max-w-full [&_img]:max-h-44 [&_img]:rounded-lg [&_img]:my-2 [&_img]:mx-auto [&_img]:cursor-pointer"
                          style={{
                            backgroundColor: selected
                              ? "color-mix(in srgb, var(--color-primary) 12%, var(--color-card))"
                              : "var(--color-bg)",
                            border: selected
                              ? "1px solid var(--color-primary)"
                              : "1px solid var(--color-border)",
                            color: "var(--color-text)",
                          }}
                          onClick={handleQuizContentClick}
                          dangerouslySetInnerHTML={{ __html: renderQuizHTML(r.texto) }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {estado === "en_curso" && (
          <div className="flex justify-center">
            <button
              onClick={() => enviarQuiz(false)}
              className="px-4 py-2 rounded text-white hover:opacity-90 w-full sm:w-auto"
              style={{ backgroundColor: "var(--color-success)" }}
            >
              Enviar respuestas
            </button>
          </div>
        )}

        {resultado && (
          <div
            className="mt-4 p-3 sm:p-4 rounded-lg space-y-3 min-w-0 overflow-hidden text-center"
            style={cardStyle}
          >
            <p style={{ color: "var(--color-text)" }}>
              Respuestas correctas:{" "}
              <span style={{ color: "var(--color-success)", fontWeight: "bold" }}>
                {resultado.correctas}
              </span>{" "}
              de {resultado.total}
            </p>

            <p style={{ color: "var(--color-text)" }}>
              Puntaje final:{" "}
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>
                {resultado.total > 0
                  ? Math.round((resultado.correctas / resultado.total) * 100)
                  : 0}
                %
              </span>
            </p>

            {!esPreview && (
              <>
                {sinMasIntentos || resultado.correctas === resultado.total ? (
                  <div className="space-y-2">
                    <p style={{ color: "var(--color-primary)" }}>
                      XP ganado: <span className="font-bold">{xpGanado}</span>
                    </p>
                    <div className="flex justify-center">
                      <button
                        onClick={() => router.push(`/curso/${materiaId}`)}
                        className="mt-3 px-4 py-2 rounded text-white hover:opacity-90 w-full sm:w-auto"
                        style={{ backgroundColor: "var(--color-secondary)" }}
                      >
                        Regresar al curso
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-primary)" }}>
                    Puedes volver a intentarlo para mejorar tu puntaje y XP.
                  </p>
                )}
              </>
            )}

            {!esPreview && !sinMasIntentos && resultado.correctas < resultado.total && (
              <div className="flex justify-center">
                <button
                  onClick={reiniciarQuiz}
                  className="mt-3 px-4 py-2 rounded text-white hover:opacity-90 w-full sm:w-auto"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Reintentar quiz
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {estado === "en_curso" &&
        timeLeftSec !== null &&
        quizInfo?.tiempo_limite_min &&
        quizInfo.tiempo_limite_min > 0 &&
        timeLeftSec <= 60 &&
        createPortal(
          <div
            className="fixed z-[140] rounded-lg px-4 py-2 shadow-lg font-bold pointer-events-none"
            style={{
              top: "24px",
              right: "24px",
              backgroundColor: "var(--color-danger)",
              color: "#fff",
            }}
          >
            ⏳ {mmss(timeLeftSec)}
          </div>,
          document.body
        )}

      {mostrarAvisoTiempo &&
        createPortal(
          <div
            className="fixed z-[140] rounded-lg px-4 py-3 shadow-lg font-semibold pointer-events-none text-sm leading-snug"
            style={{
              top: "24px",
              right: "24px",
              width: "min(520px, calc(100vw - 48px))",
              backgroundColor: "var(--color-danger)",
              color: "#fff",
            }}
          >
            ⏳ Se terminó el tiempo. Se enviaron automáticamente las respuestas que alcanzaste a seleccionar.
          </div>,
          document.body
        )}

      {previewImage &&
        createPortal(
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[140] p-3"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-[92vw] max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg flex items-center justify-center"
                aria-label="Cerrar imagen"
              >
                ×
              </button>

              <img
                src={previewImage}
                className="max-w-full max-h-[90vh] rounded-lg"
                alt="Vista ampliada"
              />
            </div>
          </div>,
          document.body
        )}
    </LayoutGeneral>
  );
}
