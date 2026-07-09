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

  const intentosMax = quizInfo?.intentos_max ?? 1;
  const sinMasIntentos =
    !esPreview &&
    !verificandoIntentos &&
    (intentosRealizados >= intentosMax || mejorPuntaje === 100);

  const tiempoTieneLimite =
    !!quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0;

  const estilos = (
    <style>{`
      .quiz-page {
        --quiz-accent: var(--fcc-premium-accent);
        --quiz-accent-hover: var(--fcc-premium-accent-hover);
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

        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .quiz-card {
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

      .quiz-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--quiz-accent) 8%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--quiz-accent) 6%, transparent) 22% 22.4%,
            transparent 22.4% 100%
          );
        opacity: 0.72;
      }

      .quiz-card.no-diagonal::before,
      .quiz-question-card::before,
      .quiz-answer-card::before {
        content: none;
      }

      .quiz-card-content {
        position: relative;
        z-index: 2;
      }

      .quiz-header {
        padding: 22px clamp(18px, 3vw, 30px);
        text-align: center;
      }

      .quiz-eyebrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
        color: var(--quiz-accent);
        font-size: 0.74rem;
        font-weight: 950;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .quiz-eyebrow::before,
      .quiz-eyebrow::after {
        content: "";
        width: 36px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--quiz-accent) 62%, transparent)
        );
      }

      .quiz-eyebrow::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--quiz-accent) 62%, transparent),
          transparent
        );
      }

      .quiz-title {
        max-width: 900px;
        margin: 0 auto;
        color: var(--quiz-text);
        font-size: clamp(1.7rem, 4vw, 3.1rem);
        font-weight: 950;
        line-height: 0.98;
        letter-spacing: -0.06em;
        text-wrap: balance;
      }

      .quiz-description {
        max-width: 780px;
        margin: 12px auto 0;
        color: var(--quiz-muted);
        font-size: 0.98rem;
        font-weight: 650;
        line-height: 1.55;
      }

      .quiz-preview-note {
        margin: 16px auto 0;
        width: min(100%, 720px);
        border-radius: 18px;
        padding: 12px 14px;
        color: var(--quiz-text-soft);
        background: color-mix(in srgb, var(--quiz-cyan) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--quiz-cyan) 18%, var(--quiz-border));
        font-size: 0.9rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .quiz-intro-card,
      .quiz-result-card {
        padding: 20px;
      }

      .quiz-intro-content,
      .quiz-result-content {
        display: grid;
        gap: 16px;
        justify-items: center;
        text-align: center;
      }

      .quiz-intro-grid {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .quiz-stat-box {
        min-height: 88px;
        display: grid;
        align-content: center;
        gap: 6px;
        border-radius: 20px;
        padding: 14px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface-strong) 72%, transparent),
            color-mix(in srgb, var(--quiz-surface-soft) 86%, transparent)
          );
        border: 1px solid var(--quiz-border);
      }

      .quiz-stat-label {
        color: var(--quiz-muted);
        font-size: 0.75rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .quiz-stat-value {
        color: var(--quiz-text);
        font-size: 1.05rem;
        font-weight: 950;
        line-height: 1.1;
      }

      .quiz-primary-button,
      .quiz-secondary-button,
      .quiz-success-button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        padding: 0 18px;
        font-size: 0.94rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          border-color 170ms ease,
          background 170ms ease,
          box-shadow 170ms ease;
      }

      .quiz-primary-button,
      .quiz-success-button {
        color: #ffffff;
        background: var(--quiz-button);
        box-shadow: 0 14px 26px color-mix(in srgb, var(--quiz-accent) 22%, transparent);
      }

      .theme-oscuro .quiz-primary-button,
      .theme-oscuro .quiz-success-button {
        color: #050505;
      }

      .quiz-success-button {
        background:
          linear-gradient(
            135deg,
            var(--color-success),
            color-mix(in srgb, var(--color-success) 72%, var(--quiz-cyan))
          );
      }

      .quiz-secondary-button {
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-surface-strong) 78%, transparent);
        border: 1px solid var(--quiz-border);
      }

      .quiz-primary-button:hover,
      .quiz-secondary-button:hover,
      .quiz-success-button:hover {
        transform: translateY(-1px);
      }

      .quiz-primary-button:disabled,
      .quiz-success-button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
        transform: none;
      }

      .quiz-warning {
        color: var(--color-danger);
        font-size: 0.92rem;
        font-weight: 850;
      }

      .quiz-info-text {
        color: var(--quiz-muted);
        font-size: 0.92rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .quiz-timer-card {
        padding: 14px 18px;
        text-align: center;
      }

      .quiz-timer-value {
        color: var(--quiz-text);
        font-size: clamp(1.45rem, 3vw, 2rem);
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .quiz-timer-value.danger {
        color: var(--color-danger);
      }

      .quiz-questions {
        display: grid;
        gap: 16px;
      }

      .quiz-question-card {
        padding: 60px 20px 96px;
        overflow: visible;
      }
      .quiz-question-card > .quiz-card-content {
        position: static;
      }


      .quiz-question-top {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        margin-bottom: 16px;
      }

      .quiz-question-number {
        position: absolute;
        left: 14px;
        top: 14px;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--quiz-accent);
        background: color-mix(in srgb, var(--quiz-accent) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 18%, transparent);
        font-weight: 950;
      }

      .quiz-question-text {
        min-width: 0;
        color: var(--quiz-text);
        font-size: 1.02rem;
        font-weight: 780;
        line-height: 1.5;
      }

      .quiz-answers {
        display: grid;
        gap: 10px;
        padding-bottom: 2px;
      }

      .quiz-answer-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .quiz-radio {
        width: 18px;
        height: 18px;
        accent-color: var(--quiz-accent);
      }

      .quiz-answer-card {
        min-width: 0;
        border-radius: 16px;
        padding: 12px 14px;
        color: var(--quiz-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface-strong) 74%, transparent),
            color-mix(in srgb, var(--quiz-surface-soft) 86%, transparent)
          );
        border: 1px solid var(--quiz-border);
        cursor: pointer;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .quiz-answer-card:hover {
        transform: translateY(-1px);
        border-color: var(--quiz-border-strong);
      }

      .quiz-answer-card.selected {
        border-color: var(--quiz-accent);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-accent) 13%, var(--quiz-surface-strong)),
            color-mix(in srgb, var(--quiz-accent) 8%, var(--quiz-surface-soft))
          );
      }

      .quiz-render {
        color: inherit;
      }

      .quiz-render p {
        margin: 0;
      }

      .quiz-render img {
        border: 2px solid color-mix(in srgb, var(--quiz-accent) 34%, var(--quiz-border));
        box-shadow: none;
        transition:
          border-color 170ms ease,
          transform 170ms ease;
      }

      .quiz-render img:hover {
        border-color: color-mix(in srgb, var(--quiz-accent) 62%, var(--quiz-border));
        transform: translateY(-1px);
      }

      .quiz-actions {
        display: flex;
        justify-content: center;
      }

      .quiz-result-score {
        display: grid;
        gap: 8px;
      }

      .quiz-result-main {
        color: var(--quiz-text);
        font-size: 1.08rem;
        font-weight: 850;
      }

      .quiz-result-main strong {
        color: var(--quiz-accent);
        font-weight: 950;
      }

      .quiz-result-success {
        color: var(--color-success);
        font-weight: 950;
      }

      .quiz-floating-alert,
      .quiz-floating-timer {
        position: fixed;
        right: 24px;
        top: 24px;
        z-index: 140;
        pointer-events: none;
        border-radius: 16px;
        background: var(--color-danger);
        color: #ffffff;
        box-shadow: var(--quiz-shadow);
      }

      .quiz-floating-timer {
        padding: 10px 16px;
        font-weight: 950;
      }

      .quiz-floating-alert {
        width: min(520px, calc(100vw - 48px));
        padding: 14px 16px;
        font-size: 0.9rem;
        font-weight: 850;
        line-height: 1.35;
      }

      .quiz-preview-overlay {
        position: fixed;
        inset: 0;
        z-index: 140;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(2, 8, 23, 0.72);
        backdrop-filter: blur(8px);
      }

      .quiz-preview-modal {
        position: relative;
        max-width: 92vw;
        max-height: 92vh;
      }

      .quiz-preview-close {
        position: absolute;
        right: 12px;
        top: 12px;
        z-index: 2;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: #ffffff;
        background: var(--color-danger);
        border: 1px solid color-mix(in srgb, var(--color-danger) 65%, white);
        box-shadow: none;
        font-size: 1.35rem;
        font-weight: 950;
        line-height: 1;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          background 170ms ease;
      }

      .quiz-preview-close:hover {
        transform: translateY(-1px);
        opacity: 0.94;
      }

      .quiz-preview-image {
        max-width: 100%;
        max-height: 90vh;
        border-radius: 18px;
        border: 2px solid color-mix(in srgb, var(--quiz-accent) 34%, var(--quiz-border));
        box-shadow: none;
      }

      .quiz-skeleton {
        animation: quizPulse 1.35s ease-in-out infinite;
      }

      .quiz-skeleton-block {
        border-radius: 18px;
        background: color-mix(in srgb, var(--quiz-border-strong) 30%, transparent);
      }

      @keyframes quizPulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }

      @media (max-width: 640px) {
        .quiz-header,
        .quiz-intro-card,
        .quiz-result-card {
          border-radius: 24px;
          padding: 16px;
        }

        .quiz-question-card {
          border-radius: 24px;
          padding: 48px 16px 80px;
        }

        .quiz-intro-grid {
          grid-template-columns: 1fr;
        }

        .quiz-question-top {
          grid-template-columns: 1fr;
        }

        .quiz-question-number {
          left: 12px;
          top: 12px;
          margin: 0;
        }

        .quiz-answer-row {
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 10px;
        }

        .quiz-radio {
          margin: 0;
          flex: 0 0 auto;
        }

        .quiz-primary-button,
        .quiz-secondary-button,
        .quiz-success-button {
          width: 100%;
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <LayoutGeneral rol={rol}>
        {estilos}

        <div className="quiz-page">
          <section className="quiz-card quiz-header quiz-skeleton">
            <div className="quiz-card-content">
              <div
                className="quiz-skeleton-block"
                style={{
                  width: "180px",
                  height: "16px",
                  margin: "0 auto 16px",
                }}
              />

              <div
                className="quiz-skeleton-block"
                style={{
                  width: "min(680px, 86%)",
                  height: "44px",
                  margin: "0 auto",
                }}
              />

              <div
                className="quiz-skeleton-block"
                style={{
                  width: "min(520px, 70%)",
                  height: "18px",
                  margin: "16px auto 0",
                }}
              />
            </div>
          </section>

          <section className="quiz-card quiz-intro-card quiz-skeleton">
            <div className="quiz-card-content quiz-intro-content">
              <div
                className="quiz-skeleton-block"
                style={{
                  width: "100%",
                  height: "118px",
                }}
              />

              <div
                className="quiz-skeleton-block"
                style={{
                  width: "160px",
                  height: "44px",
                }}
              />
            </div>
          </section>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol={rol}>
      {estilos}

      <div className="quiz-page">
        <section className="quiz-card quiz-header">
          <div className="quiz-card-content">
            <p className="quiz-eyebrow">
              {esPreview ? "Previsualización" : "Quiz"}
            </p>

            <h1 className="quiz-title">{quizInfo?.titulo || "Resolver Quiz"}</h1>

            {quizInfo?.descripcion && (
              <p className="quiz-description">{quizInfo.descripcion}</p>
            )}

            {esPreview && (
              <p className="quiz-preview-note">
                Modo previsualización: las respuestas no se guardan ni otorgan
                XP.
              </p>
            )}

          </div>
        </section>

        {estado === "intro" && (
          <section className="quiz-card quiz-intro-card no-diagonal">
            <div className="quiz-card-content quiz-intro-content">
              <div className="quiz-intro-grid">
                <div className="quiz-stat-box">
                  <span className="quiz-stat-label">Tiempo</span>
                  <span className="quiz-stat-value">
                    {tiempoTieneLimite
                      ? `${quizInfo?.tiempo_limite_min} min`
                      : "Sin límite"}
                  </span>
                </div>

                <div className="quiz-stat-box">
                  <span className="quiz-stat-label">Preguntas</span>
                  <span className="quiz-stat-value">{preguntas.length}</span>
                </div>

                <div className="quiz-stat-box">
                  <span className="quiz-stat-label">Intentos</span>
                  <span className="quiz-stat-value">
                    {intentosRealizados} / {intentosMax}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={iniciar}
                disabled={verificandoIntentos || sinMasIntentos}
                className="quiz-primary-button"
              >
                {verificandoIntentos && !esPreview ? "Verificando..." : "Iniciar"}
              </button>

              {sinMasIntentos && (
                <div className="quiz-info-text">
                  <p className="quiz-warning">Ya no tienes intentos disponibles.</p>
                  <p>
                    Mejor puntaje obtenido:{" "}
                    <strong style={{ color: "var(--quiz-accent)" }}>
                      {mejorPuntaje}%
                    </strong>
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {estado === "en_curso" &&
          timeLeftSec !== null &&
          tiempoTieneLimite && (
            <section className="quiz-card quiz-timer-card no-diagonal">
              <div className="quiz-card-content">
                <p
                  className={`quiz-timer-value ${
                    timeLeftSec <= 60 ? "danger" : ""
                  }`}
                >
                  {mmss(timeLeftSec)}
                </p>
              </div>
            </section>
          )}

        {(estado === "en_curso" || estado === "finalizado") && (
          <div className="quiz-questions">
            {preguntas.map((p, idx) => (
              <section
                key={p.id}
                className="quiz-card quiz-question-card no-diagonal"
              >
                <div className="quiz-card-content">
                  <div className="quiz-question-top">
                    <span className="quiz-question-number">{idx + 1}</span>

                    <div
                      className="quiz-render quiz-question-text max-w-none overflow-x-auto text-center [&_.katex-display]:overflow-x-auto [&_img]:max-w-full [&_img]:max-h-56 [&_img]:rounded-lg [&_img]:my-2 [&_img]:mx-auto [&_img]:cursor-pointer"
                      onClick={handleQuizContentClick}
                      dangerouslySetInnerHTML={{
                        __html: renderQuizHTML(p.enunciado),
                      }}
                    />
                  </div>

                  <div className="quiz-answers">
                    {(respuestas[p.id] || []).map((r) => {
                      const disabled = estado === "finalizado";
                      const selected = seleccionadas[p.id] === r.id;

                      return (
                        <label
                          key={r.id}
                          className="quiz-answer-row"
                          style={{
                            cursor: disabled ? "default" : "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name={p.id}
                            value={r.id}
                            checked={selected}
                            disabled={disabled}
                            onChange={() => seleccionarRespuesta(p.id, r.id)}
                            className="quiz-radio"
                          />

                          <div
                            className={`quiz-render quiz-answer-card ${
                              selected ? "selected" : ""
                            } max-w-none overflow-x-auto text-sm text-center [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-center [&_p]:text-center [&_img]:max-w-full [&_img]:max-h-44 [&_img]:rounded-lg [&_img]:my-2 [&_img]:mx-auto [&_img]:cursor-pointer`}
                            onClick={handleQuizContentClick}
                            dangerouslySetInnerHTML={{
                              __html: renderQuizHTML(r.texto),
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {estado === "en_curso" && (
          <div className="quiz-actions">
            <button
              type="button"
              onClick={() => enviarQuiz(false)}
              className="quiz-success-button"
            >
              Enviar respuestas
            </button>
          </div>
        )}

        {resultado && (
          <section className="quiz-card quiz-result-card no-diagonal">
            <div className="quiz-card-content quiz-result-content">
              <div className="quiz-result-score">
                <p className="quiz-result-main">
                  Respuestas correctas:{" "}
                  <span className="quiz-result-success">
                    {resultado.correctas}
                  </span>{" "}
                  de {resultado.total}
                </p>

                <p className="quiz-result-main">
                  Puntaje final:{" "}
                  <strong>
                    {resultado.total > 0
                      ? Math.round((resultado.correctas / resultado.total) * 100)
                      : 0}
                    %
                  </strong>
                </p>

                {!esPreview && (
                  <>
                    {sinMasIntentos || resultado.correctas === resultado.total ? (
                      <p className="quiz-result-main">
                        XP ganado: <strong>{xpGanado}</strong>
                      </p>
                    ) : (
                      <p className="quiz-info-text">
                        Puedes volver a intentarlo para mejorar tu puntaje y XP.
                      </p>
                    )}
                  </>
                )}
              </div>

              {!esPreview &&
                (sinMasIntentos || resultado.correctas === resultado.total) && (
                  <button
                    type="button"
                    onClick={() => router.push(`/curso/${materiaId}`)}
                    className="quiz-secondary-button"
                  >
                    Regresar al curso
                  </button>
                )}

              {!esPreview &&
                !sinMasIntentos &&
                resultado.correctas < resultado.total && (
                  <button
                    type="button"
                    onClick={reiniciarQuiz}
                    className="quiz-primary-button"
                  >
                    Reintentar quiz
                  </button>
                )}
            </div>
          </section>
        )}
      </div>

      {estado === "en_curso" &&
        timeLeftSec !== null &&
        tiempoTieneLimite &&
        timeLeftSec <= 60 &&
        createPortal(
          <div className="quiz-floating-timer">{mmss(timeLeftSec)}</div>,
          document.body
        )}

      {mostrarAvisoTiempo &&
        createPortal(
          <div className="quiz-floating-alert">
            Se terminó el tiempo. Se enviaron automáticamente las respuestas que
            alcanzaste a seleccionar.
          </div>,
          document.body
        )}

      {previewImage &&
        createPortal(
          <div
            className="quiz-preview-overlay"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="quiz-preview-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="quiz-preview-close"
                aria-label="Cerrar imagen"
              >
                ×
              </button>

              <img
                src={previewImage}
                className="quiz-preview-image"
                alt="Vista ampliada"
              />
            </div>
          </div>,
          document.body
        )}
    </LayoutGeneral>
  );
}
