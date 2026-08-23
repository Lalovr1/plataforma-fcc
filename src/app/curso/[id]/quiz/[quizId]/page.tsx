/**
 * Página para resolver o previsualizar un quiz:
 * - Estudiante: responde, guarda intentos, cronómetro y XP proporcional.
 * - Profesor: previsualiza (no guarda ni otorga XP).
 * - Auto-envía al agotar tiempo (usa minutos desde la BD).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";
import { iniciarIndicadorNavegacionFCC } from "@/components/IndicadorNavegacionFCC";
import {
  extraerFuentesImagenHtml,
  precargarImagenes,
} from "@/lib/imagenes";
import { AlertCircle, CheckCircle2, Sparkles, Target, Trophy } from "lucide-react";
import "katex/dist/katex.min.css";

type Pregunta = { id: string; enunciado: string };
type Respuesta = {
  id: string;
  texto: string;
  es_correcta?: boolean;
};

type QuizInfo = {
  id: string;
  titulo: string;
  descripcion: string | null;
  xp: number | null;
  intentos_max: number | null;
  tiempo_limite_min: number | null;
};

type EstadoQuiz = "intro" | "en_curso" | "finalizado";

type IntentoActivoServidor = {
  intento_id: string;
  iniciado_en: string;
  expira_en: string | null;
  respuestas: Record<string, string> | null;
  numero_intento: number;
  intentos_max: number;
  server_now: string;
  expirado: boolean;
};

type QuizActiveLocalCache = {
  intentoId: string;
  seleccionadas: Record<string, string>;
};

type SalidaPendiente =
  | { tipo: "atras" }
  | { tipo: "navegar"; destino: string }
  | { tipo: "logout" };

type RetroalimentacionIntento = {
  pregunta_id: string | null;
  respuesta_id: string | null;
  orden_pregunta: number;
  es_correcta: boolean;
  respuesta_seleccionada_texto: string | null;
  respuesta_correcta_texto: string | null;
  explicacion: string | null;
};

const ACTIVE_CACHE_KEY_BASE = "fcc_academy_quiz_active_v1";
const AUTO_RESULT_SEEN_KEY_BASE = "fcc_academy_quiz_auto_result_seen_v1";

function getActiveCacheKey(userId: string, quizId: string) {
  return `${ACTIVE_CACHE_KEY_BASE}_${userId}_${quizId}`;
}

function guardarActiveLocalCache(
  userId: string,
  quizId: string,
  intentoId: string,
  seleccionadas: Record<string, string>
) {
  try {
    const data: QuizActiveLocalCache = {
      intentoId,
      seleccionadas,
    };

    localStorage.setItem(
      getActiveCacheKey(userId, quizId),
      JSON.stringify(data)
    );
  } catch {}
}

function leerActiveLocalCache(
  userId: string,
  quizId: string
): QuizActiveLocalCache | null {
  try {
    const raw = localStorage.getItem(getActiveCacheKey(userId, quizId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.intentoId || typeof parsed?.seleccionadas !== "object") {
      return null;
    }

    return {
      intentoId: String(parsed.intentoId),
      seleccionadas: parsed.seleccionadas ?? {},
    };
  } catch {
    return null;
  }
}

function limpiarActiveLocalCache(userId: string, quizId: string) {
  try {
    localStorage.removeItem(getActiveCacheKey(userId, quizId));
  } catch {}
}

function getAutoResultSeenKey(userId: string, quizId: string) {
  return `${AUTO_RESULT_SEEN_KEY_BASE}_${userId}_${quizId}`;
}

function resultadoAutomaticoYaVisto(
  userId: string,
  quizId: string,
  intentoId: string
) {
  try {
    return localStorage.getItem(getAutoResultSeenKey(userId, quizId)) === intentoId;
  } catch {
    return false;
  }
}

function marcarResultadoAutomaticoVisto(
  userId: string,
  quizId: string,
  intentoId: string
) {
  try {
    localStorage.setItem(
      getAutoResultSeenKey(userId, quizId),
      intentoId
    );
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
  const [errorCarga, setErrorCarga] = useState("");
  const [reintentoCarga, setReintentoCarga] = useState(0);
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rol, setRol] = useState<string>("estudiante");
  const [intentosRealizados, setIntentosRealizados] = useState<number>(0);
  const [esPreview, setEsPreview] = useState<boolean>(false);

  const [xpGanado, setXpGanado] = useState<number>(0);

  const [estado, setEstado] = useState<EstadoQuiz>("intro");
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const [deadlineLocalMs, setDeadlineLocalMs] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const enviadoRef = useRef<boolean>(false);

  const [intentoActivoId, setIntentoActivoId] = useState<string | null>(null);
  const intentoActivoIdRef = useRef<string | null>(null);
  const historyGuardActivoRef = useRef(false);
  const ignorarPopstateRef = useRef(false);
  const [mostrarAvisoSalida, setMostrarAvisoSalida] = useState(false);
  const [procesandoSalida, setProcesandoSalida] = useState(false);
  const [salidaPendiente, setSalidaPendiente] = useState<SalidaPendiente | null>(null);
  const [expiraEnIso, setExpiraEnIso] = useState<string | null>(null);
  const [mensajeResultadoAutomatico, setMensajeResultadoAutomatico] = useState<string | null>(null);
  const [preguntaPendienteEnvio, setPreguntaPendienteEnvio] = useState<number | null>(null);
  const [iniciandoIntento, setIniciandoIntento] = useState(false);
  const [finalizarPorExpiracionPendiente, setFinalizarPorExpiracionPendiente] =
    useState(false);

  const [mejorPuntaje, setMejorPuntaje] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [retroalimentacionIntento, setRetroalimentacionIntento] = useState<
    Record<string, RetroalimentacionIntento>
  >({});
  const [ultimoIntentoId, setUltimoIntentoId] = useState<string | null>(null);
  const [resultadoHistorico, setResultadoHistorico] = useState(false);
  const [cargandoResultadoAnterior, setCargandoResultadoAnterior] = useState(false);

  const cargarRetroalimentacionIntento = async (intentoId: string) => {
    const { data, error } = await supabase.rpc(
      "obtener_retroalimentacion_intento",
      {
        p_intento_id: intentoId,
      }
    );

    if (error) {
      throw error;
    }

    return ((data as RetroalimentacionIntento[]) ?? []).map((item) => ({
      ...item,
      es_correcta: Boolean(item.es_correcta),
      orden_pregunta: Number(item.orden_pregunta ?? 0),
    }));
  };

  const aplicarRetroalimentacionIntento = (
    items: RetroalimentacionIntento[]
  ) => {
    const mapa: Record<string, RetroalimentacionIntento> = {};

    items.forEach((item) => {
      if (item.pregunta_id) {
        mapa[item.pregunta_id] = item;
      }
    });

    setRetroalimentacionIntento(mapa);
    return mapa;
  };

  const activarBarreraHistorial = () => {
    if (typeof window === "undefined") return;

    if (window.history.state?.fccQuizGuard === quizId) {
      historyGuardActivoRef.current = true;
      return;
    }

    const baseState = { ...(window.history.state ?? {}) };
    delete baseState.fccQuizEnCurso;
    delete baseState.fccQuizGuard;

    window.history.replaceState(
      {
        ...baseState,
        fccQuizBase: quizId,
      },
      "",
      window.location.href
    );

    window.history.pushState(
      {
        ...baseState,
        fccQuizGuard: quizId,
      },
      "",
      window.location.href
    );

    historyGuardActivoRef.current = true;
  };

  const quitarBarreraHistorial = () => {
    if (typeof window === "undefined") return;
    if (!historyGuardActivoRef.current) return;

    ignorarPopstateRef.current = true;
    historyGuardActivoRef.current = false;
    window.history.back();
  };

  const activarBarreraResultado = () => {
    if (typeof window === "undefined") return;

    const actual = { ...(window.history.state ?? {}) };

    if (actual.fccQuizResultado === quizId) {
      return;
    }

    if (actual.fccQuizGuard === quizId) {
      delete actual.fccQuizGuard;
      delete actual.fccQuizEnCurso;

      window.history.replaceState(
        {
          ...actual,
          fccQuizResultado: quizId,
        },
        "",
        window.location.href
      );

      historyGuardActivoRef.current = false;
      return;
    }

    delete actual.fccQuizGuard;
    delete actual.fccQuizEnCurso;
    delete actual.fccQuizResultado;

    window.history.replaceState(
      {
        ...actual,
        fccQuizBase: quizId,
      },
      "",
      window.location.href
    );

    window.history.pushState(
      {
        ...actual,
        fccQuizResultado: quizId,
      },
      "",
      window.location.href
    );

    historyGuardActivoRef.current = false;
  };

  const prepararIntentoActivo = (
    activo: IntentoActivoServidor,
    currentUserId: string
  ) => {
    const intentoId = String(activo.intento_id);
    const respuestasServidor =
      activo.respuestas && typeof activo.respuestas === "object"
        ? activo.respuestas
        : {};

    const cacheLocal = leerActiveLocalCache(currentUserId, quizId);

    const respuestasRestauradas =
      cacheLocal?.intentoId === intentoId
        ? {
            ...respuestasServidor,
            ...cacheLocal.seleccionadas,
          }
        : respuestasServidor;

    intentoActivoIdRef.current = intentoId;
    setIntentoActivoId(intentoId);

    seleccionadasRef.current = respuestasRestauradas;
    setSeleccionadas(respuestasRestauradas);

    guardarActiveLocalCache(
      currentUserId,
      quizId,
      intentoId,
      respuestasRestauradas
    );

    const expiraMs = activo.expira_en
      ? Date.parse(activo.expira_en)
      : null;
    const serverNowMs = activo.server_now
      ? Date.parse(activo.server_now)
      : Date.now();

    setExpiraEnIso(activo.expira_en ?? null);
    setMensajeResultadoAutomatico(null);

    if (expiraMs !== null && Number.isFinite(expiraMs)) {
      const restanteMs = Math.max(0, expiraMs - serverNowMs);
      const restanteSec = Math.max(0, Math.ceil(restanteMs / 1000));

      setTimeLeftSec(restanteSec);
      setDeadlineLocalMs(Date.now() + restanteMs);
    } else {
      setTimeLeftSec(null);
      setDeadlineLocalMs(null);
    }

    enviadoRef.current = false;
    setEstado("en_curso");
    activarBarreraHistorial();

    if (activo.expirado) {
      setFinalizarPorExpiracionPendiente(true);
    }

    if (
      cacheLocal?.intentoId === intentoId &&
      Object.keys(cacheLocal.seleccionadas).length > 0 &&
      !activo.expirado
    ) {
      void Promise.allSettled(
        Object.entries(respuestasRestauradas).map(
          ([preguntaId, respuestaId]) =>
            supabase.rpc("guardar_respuesta_intento_activo", {
              p_intento_id: intentoId,
              p_pregunta_id: preguntaId,
              p_respuesta_id: respuestaId,
            })
        )
      );
    }
  };

  const aplicarUltimoIntentoAutomatico = async (
    resumen: any,
    currentUserId: string
  ) => {
    if (!resumen?.intento_id || !resumen?.envio_automatico) return false;

    const seleccionadasAutomaticas =
      resumen.respuestas && typeof resumen.respuestas === "object"
        ? resumen.respuestas
        : {};

    seleccionadasRef.current = seleccionadasAutomaticas;
    setSeleccionadas(seleccionadasAutomaticas);

    setResultado({
      correctas: Number(resumen.correctas ?? 0),
      total: Number(resumen.total ?? preguntas.length ?? 0),
    });

    const numeroIntento = Number(resumen.numero_intento ?? 0);
    const puntaje = Number(resumen.puntaje ?? 0);
    const intentosMaxResumen = Number(
      resumen.intentos_max ?? quizInfo?.intentos_max ?? 1
    );

    setIntentosRealizados((prev) => Math.max(prev, numeroIntento));
    setMejorPuntaje((prev) => Math.max(prev, puntaje));
    setXpGanado(Number(resumen.xp_agregado ?? 0));
    setResultadoHistorico(true);
    setEnvioAutomaticoPorTiempo(false);
    setMostrarAvisoTiempo(false);
    setFinalizarPorExpiracionPendiente(false);
    setDeadlineLocalMs(null);
    setTimeLeftSec(null);
    setExpiraEnIso(resumen.expiraba_en ?? null);
    intentoActivoIdRef.current = null;
    setIntentoActivoId(null);
    limpiarActiveLocalCache(currentUserId, quizId);

    const hora = formatearHora(resumen.expiraba_en ?? null);

    setMensajeResultadoAutomatico(
      hora
        ? `El tiempo de tu último intento terminó a las ${hora}. Se enviaron automáticamente las respuestas que alcanzaron a guardarse dentro del tiempo establecido.`
        : "El tiempo de tu último intento terminó. Se enviaron automáticamente las respuestas que alcanzaron a guardarse dentro del tiempo establecido."
    );

    const puedeVerExplicaciones =
      puntaje === 100 || numeroIntento >= intentosMaxResumen;

    if (puedeVerExplicaciones) {
      try {
        const items = await cargarRetroalimentacionIntento(
          String(resumen.intento_id)
        );
        aplicarRetroalimentacionIntento(items);
        setUltimoIntentoId(String(resumen.intento_id));
      } catch {
        setRetroalimentacionIntento({});
      }
    } else {
      setRetroalimentacionIntento({});
    }

    marcarResultadoAutomaticoVisto(
      currentUserId,
      quizId,
      String(resumen.intento_id)
    );

    activarBarreraResultado();
    setEstado("finalizado");
    return true;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!quizId) throw new Error("El identificador del quiz no es válido.");

        setLoading(true);
        setVerificandoIntentos(true);
        setErrorCarga("");

        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!userData?.user) {
          router.push("/login");
          return;
        }

        const currentUserId = userData.user.id;
        setUserId(currentUserId);


        const [
          { data: perfil, error: perfilError },
          { data: qz, error: quizError },
          { count: intentosCount, error: intentosCountError },
          { data: bestIntento, error: bestIntentoError },
          { data: ultimoIntento, error: ultimoIntentoError },
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
            .from("intentos_quiz")
            .select("id,puntaje,numero_intento")
            .eq("quiz_id", quizId)
            .eq("usuario_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(1),

          supabase
            .from("preguntas")
            .select("id,enunciado")
            .eq("quiz_id", quizId)
            .order("orden", { ascending: true }),
        ]);

        const errorInicial =
          perfilError ??
          quizError ??
          intentosCountError ??
          bestIntentoError ??
          ultimoIntentoError ??
          preguntasError;

        if (errorInicial || !qz) {
          throw errorInicial ?? new Error("El quiz no está disponible.");
        }

        const rolUser = perfil?.rol || "estudiante";
        const preview = rolUser === "profesor";
        const preguntasData = (preg as Pregunta[]) ?? [];
        const mapa: Record<string, Respuesta[]> = {};

        if (preguntasData.length > 0) {
          const { data: respuestasData, error: respuestasError } =
            await supabase.rpc("obtener_respuestas_quiz", {
              p_quiz_id: quizId,
            });

          if (respuestasError) {
            throw respuestasError;
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
              ...(rolUser === "profesor"
                ? { es_correcta: Boolean(r.es_correcta) }
                : {}),
            });
          });
        }

        const imagenesQuiz = extraerFuentesImagenHtml(
          ...preguntasData.map((pregunta) => pregunta.enunciado),
          ...Object.values(mapa).flatMap((opciones) =>
            opciones.map((respuesta) => respuesta.texto)
          )
        );

        const imagenesQuizCompletas = await precargarImagenes(
          imagenesQuiz,
          30_000
        );

        if (!imagenesQuizCompletas) {
          throw new Error(
            "La conexión no permitió preparar todas las imágenes del quiz."
          );
        }

        const intentos = intentosCount || 0;
        const best = bestIntento?.[0]?.puntaje || 0;
        const ultimo = ultimoIntento?.[0] ?? null;
        const intentosMaxActual = Number(
          (qz as QuizInfo | null)?.intentos_max ?? 1
        );

        const puedeConsultarUltimo =
          !preview &&
          Boolean(ultimo?.id) &&
          (Number(ultimo?.puntaje ?? 0) === 100 ||
            Number(ultimo?.numero_intento ?? 0) >= intentosMaxActual);

        setUltimoIntentoId(
          puedeConsultarUltimo && ultimo ? String(ultimo.id) : null
        );

        setRol(rolUser);
        setEsPreview(preview);
        setQuizInfo((qz as QuizInfo) ?? null);
        setPreguntas(preguntasData);
        setRespuestas(mapa);
        setIntentosRealizados(intentos);
        setMejorPuntaje(best);

        if (!preview) {
          const { data: intentoActivo, error: intentoActivoError } =
            await supabase.rpc("obtener_intento_activo_quiz", {
              p_quiz_id: quizId,
            });

          if (intentoActivoError) {
            throw intentoActivoError;
          } else if (intentoActivo?.intento_id) {
            prepararIntentoActivo(
              intentoActivo as IntentoActivoServidor,
              currentUserId
            );
          } else {
            const { data: ultimoResumen, error: ultimoResumenError } =
              await supabase.rpc("obtener_ultimo_intento_quiz_resumen", {
                p_quiz_id: quizId,
              });

            if (ultimoResumenError) {
              throw ultimoResumenError;
            } else if (
              ultimoResumen?.envio_automatico &&
              ultimoResumen?.intento_id &&
              !resultadoAutomaticoYaVisto(
                currentUserId,
                quizId,
                String(ultimoResumen.intento_id)
              )
            ) {
              await aplicarUltimoIntentoAutomatico(
                ultimoResumen,
                currentUserId
              );
            }
          }
        }
      } catch (e) {
        console.error("Error inicializando quiz:", e);
        setErrorCarga(
          e instanceof Error
            ? e.message
            : "No se pudo confirmar toda la información del quiz."
        );
      } finally {
        setLoading(false);
        setVerificandoIntentos(false);
      }
    };

    fetchData();
  }, [quizId, router, reintentoCarga]);

  useEffect(() => {
    seleccionadasRef.current = seleccionadas;
  }, [seleccionadas]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (ignorarPopstateRef.current) {
        ignorarPopstateRef.current = false;
        return;
      }

      if (
        estado === "finalizado" &&
        !esPreview &&
        event.state?.fccQuizBase === quizId
      ) {
        seleccionadasRef.current = {};
        setSeleccionadas({});
        setResultado(null);
        setRetroalimentacionIntento({});
        setResultadoHistorico(false);
        setEnvioAutomaticoPorTiempo(false);
        setMostrarAvisoTiempo(false);
        setMensajeResultadoAutomatico(null);
        setXpGanado(0);
        enviadoRef.current = false;
        setEstado("intro");
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      if (
        estado === "en_curso" &&
        !esPreview &&
        intentoActivoIdRef.current &&
        event.state?.fccQuizBase === quizId
      ) {
        const guardState = { ...(event.state ?? {}) };
        delete guardState.fccQuizBase;
        guardState.fccQuizGuard = quizId;

        window.history.pushState(
          guardState,
          "",
          window.location.href
        );

        historyGuardActivoRef.current = true;
        setSalidaPendiente({ tipo: "atras" });
        setMostrarAvisoSalida(true);
        return;
      }

      if (
        event.state?.fccQuizGuard === quizId &&
        estado === "intro" &&
        !esPreview &&
        userId &&
        intentoActivoIdRef.current
      ) {
        historyGuardActivoRef.current = true;

        void supabase
          .rpc("obtener_intento_activo_quiz", {
            p_quiz_id: quizId,
          })
          .then(async ({ data, error }) => {
            if (!error && data?.intento_id) {
              prepararIntentoActivo(
                data as IntentoActivoServidor,
                userId
              );
              return;
            }

            const { data: ultimoResumen } = await supabase.rpc(
              "obtener_ultimo_intento_quiz_resumen",
              { p_quiz_id: quizId }
            );

            if (
              ultimoResumen?.envio_automatico &&
              ultimoResumen?.intento_id &&
              !resultadoAutomaticoYaVisto(
                userId,
                quizId,
                String(ultimoResumen.intento_id)
              )
            ) {
              await aplicarUltimoIntentoAutomatico(
                ultimoResumen,
                userId
              );
            }
          });

        return;
      }

      historyGuardActivoRef.current =
        event.state?.fccQuizGuard === quizId;
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [estado, esPreview, quizId, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const activo =
      estado === "en_curso" &&
      !esPreview &&
      Boolean(intentoActivoId);

    if (activo) {
      (window as any).__fccQuizIntentoActivo = {
        quizId,
        expiraEn: expiraEnIso,
      };
    } else if ((window as any).__fccQuizIntentoActivo?.quizId === quizId) {
      delete (window as any).__fccQuizIntentoActivo;
    }

    return () => {
      if ((window as any).__fccQuizIntentoActivo?.quizId === quizId) {
        delete (window as any).__fccQuizIntentoActivo;
      }
    };
  }, [estado, esPreview, intentoActivoId, expiraEnIso, quizId]);

  useEffect(() => {
    const handleSolicitudSalida = (event: Event) => {
      if (
        estado !== "en_curso" ||
        esPreview ||
        !intentoActivoIdRef.current
      ) {
        return;
      }

      const detail = (event as CustomEvent).detail ?? {};

      if (detail.accion === "logout") {
        setSalidaPendiente({ tipo: "logout" });
      } else if (detail.destino) {
        setSalidaPendiente({
          tipo: "navegar",
          destino: String(detail.destino),
        });
      } else {
        return;
      }

      setMostrarAvisoSalida(true);
    };

    window.addEventListener(
      "fcc:quiz-solicitar-salida",
      handleSolicitudSalida
    );

    return () => {
      window.removeEventListener(
        "fcc:quiz-solicitar-salida",
        handleSolicitudSalida
      );
    };
  }, [estado, esPreview]);

  useEffect(() => {
    if (!(estado === "finalizado" && envioAutomaticoPorTiempo)) return;

    setMostrarAvisoTiempo(true);

    const timer = setTimeout(() => {
      setMostrarAvisoTiempo(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, [estado, envioAutomaticoPorTiempo]);

  useEffect(() => {
    if (
      estado !== "en_curso" ||
      esPreview ||
      !userId ||
      !intentoActivoId
    ) {
      return;
    }

    let sincronizando = false;

    const sincronizar = async () => {
      if (sincronizando) return;
      sincronizando = true;

      try {
        const respuestasActuales = seleccionadasRef.current;

        await Promise.allSettled(
          Object.entries(respuestasActuales).map(
            ([preguntaId, respuestaId]) =>
              supabase.rpc("guardar_respuesta_intento_activo", {
                p_intento_id: intentoActivoId,
                p_pregunta_id: preguntaId,
                p_respuesta_id: respuestaId,
              })
          )
        );
      } finally {
        sincronizando = false;
      }
    };

    const handleOnline = () => {
      void sincronizar();
    };

    const timer = window.setInterval(() => {
      void sincronizar();
    }, 5000);

    window.addEventListener("online", handleOnline);
    void sincronizar();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [estado, esPreview, userId, intentoActivoId]);

  const seleccionarRespuesta = (preguntaId: string, respuestaId: string) => {
    const next = {
      ...seleccionadasRef.current,
      [preguntaId]: respuestaId,
    };

    seleccionadasRef.current = next;
    setSeleccionadas(next);

    const activeId = intentoActivoIdRef.current;

    if (!esPreview && activeId && userId) {
      guardarActiveLocalCache(userId, quizId, activeId, next);

      void supabase
        .rpc("guardar_respuesta_intento_activo", {
          p_intento_id: activeId,
          p_pregunta_id: preguntaId,
          p_respuesta_id: respuestaId,
        })
        .then(({ error }) => {
          if (!error) return;

          console.warn(
            "No se pudo guardar inmediatamente la respuesta del intento:",
            error
          );

          if (
            String(error.message ?? "")
              .toLowerCase()
              .includes("tiempo")
          ) {
            setFinalizarPorExpiracionPendiente(true);
          }
        });
    }
  };

  const iniciar = async () => {
    setEnvioAutomaticoPorTiempo(false);
    setMostrarAvisoTiempo(false);
    setRetroalimentacionIntento({});
    setResultadoHistorico(false);
    setMensajeResultadoAutomatico(null);
    setPreguntaPendienteEnvio(null);

    if (verificandoIntentos && !esPreview) {
      alert("Espera un momento. Estamos verificando tus intentos disponibles.");
      return;
    }

    if (esPreview) {
      enviadoRef.current = false;
      setEstado("en_curso");

      if (quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0) {
        const segundos = quizInfo.tiempo_limite_min * 60;
        setTimeLeftSec(segundos);
        setDeadlineLocalMs(Date.now() + segundos * 1000);
      } else {
        setTimeLeftSec(null);
        setDeadlineLocalMs(null);
      }

      return;
    }

    if (
      intentosRealizados >= (quizInfo?.intentos_max ?? 1) ||
      mejorPuntaje === 100
    ) {
      alert("❌ Ya alcanzaste el número máximo de intentos para este quiz.");
      return;
    }

    if (!userId) {
      alert("No se pudo identificar al usuario.");
      return;
    }

    try {
      setIniciandoIntento(true);

      const { data, error } = await supabase.rpc(
        "iniciar_o_reanudar_intento_quiz",
        {
          p_quiz_id: quizId,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.intento_id) {
        throw new Error("No se pudo crear o recuperar el intento.");
      }

      prepararIntentoActivo(
        data as IntentoActivoServidor,
        userId
      );
    } catch (error: any) {
      console.error("Error iniciando intento:", error);

      alert(
        error?.message ||
          "No se pudo iniciar el intento. Intenta nuevamente."
      );
    } finally {
      setIniciandoIntento(false);
    }
  };

  const enviarQuiz = async (
    auto: boolean = false
  ): Promise<boolean> => {
    if (enviadoRef.current) return false;

    const seleccionadasActuales = seleccionadasRef.current;

    if (!auto) {
      const primeraSinResponder = preguntas.findIndex(
        (p) => !seleccionadasActuales[p.id]
      );

      if (primeraSinResponder !== -1) {
        setPreguntaPendienteEnvio(primeraSinResponder + 1);
        return false;
      }
    }

    enviadoRef.current = true;
    setEnvioAutomaticoPorTiempo(auto);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (esPreview) {
      const total = preguntas.length;
      let correctas = 0;

      preguntas.forEach((p) => {
        const respuesta = respuestas[p.id]?.find(
          (r) => r.id === (seleccionadasActuales[p.id] || "")
        );

        if (respuesta?.es_correcta) {
          correctas++;
        }
      });

      setResultado({
        correctas,
        total,
      });

      setEstado("finalizado");
      return true;
    }

    if (!userId || !quizInfo) {
      enviadoRef.current = false;
      alert("No se pudo identificar al usuario o al quiz.");
      return false;
    }

    try {
      const activeId = intentoActivoIdRef.current;

      if (!activeId) {
        throw new Error("No se pudo identificar el intento activo.");
      }

      const { data, error } = await supabase.rpc(
        "finalizar_intento_quiz_activo",
        {
          p_intento_activo_id: activeId,
          p_respuestas: seleccionadasActuales,
          p_envio_automatico: auto,
        }
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("No se recibió el resultado del intento.");
      }

      const resultadoServidor = data as {
        intento_id: string;
        numero_intento: number;
        intentos_max: number;
        correctas: number;
        total: number;
        puntaje: number;
        completado: boolean;
        xp_quiz: number;
        xp_agregado: number;
        xp_total: number;
        nivel_actual: number;
        nuevo_nivel: boolean;
      };

      if (auto) {
        marcarResultadoAutomaticoVisto(
          userId,
          quizId,
          String(resultadoServidor.intento_id)
        );
      }

      const nuevoMejor = Math.max(
        mejorPuntaje,
        resultadoServidor.puntaje
      );

      setResultado({
        correctas: resultadoServidor.correctas,
        total: resultadoServidor.total,
      });

      setIntentosRealizados(resultadoServidor.numero_intento);
      setMejorPuntaje(nuevoMejor);
      setXpGanado(resultadoServidor.xp_agregado);
      setResultadoHistorico(false);

      const puedeVerExplicaciones =
        resultadoServidor.puntaje === 100 ||
        resultadoServidor.numero_intento >= resultadoServidor.intentos_max;

      if (puedeVerExplicaciones) {
        try {
          const items = await cargarRetroalimentacionIntento(
            resultadoServidor.intento_id
          );
          aplicarRetroalimentacionIntento(items);
          setUltimoIntentoId(resultadoServidor.intento_id);
        } catch (feedbackError) {
          console.warn(
            "No se pudieron cargar las explicaciones del intento:",
            feedbackError
          );
          setRetroalimentacionIntento({});
        }
      } else {
        setRetroalimentacionIntento({});
      }

      limpiarActiveLocalCache(userId, quizId);
      intentoActivoIdRef.current = null;
      setIntentoActivoId(null);
      setDeadlineLocalMs(null);
      setTimeLeftSec(null);
      setExpiraEnIso(null);
      setMensajeResultadoAutomatico(null);
      activarBarreraResultado();

      setEstado("finalizado");

      if (auto && typeof window !== "undefined") {
        window.setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 0);
      }

      window.dispatchEvent(new Event("xpActualizada"));

      if (resultadoServidor.nuevo_nivel) {
        window.dispatchEvent(
          new CustomEvent("nivelSubido", {
            detail: resultadoServidor.nivel_actual,
          })
        );
      }

      try {
        const { verificarLogros } = await import(
          "@/utils/verificarLogros"
        );

        const porcentaje = resultadoServidor.puntaje;

        if (porcentaje === 100) {
          const { count: completados100 } = await supabase
            .from("intentos_quiz")
            .select("*", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .eq("completado", true)
            .eq("puntaje", 100);

          await verificarLogros(
            userId,
            "quiz_100",
            completados100 ?? 0
          );
        }

        if (porcentaje >= 75) {
          const { count: completados75 } = await supabase
            .from("intentos_quiz")
            .select("*", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .eq("completado", true)
            .gte("puntaje", 75);

          await verificarLogros(
            userId,
            "quiz_75",
            completados75 ?? 0
          );
        }

        const { data: progresoActual } = await supabase
          .from("progreso")
          .select("progreso")
          .eq("usuario_id", userId)
          .eq("materia_id", materiaId)
          .maybeSingle();

        const progreso = Number(progresoActual?.progreso ?? 0);

        if (progreso === 100) {
          const { count: cursosCompletos } = await supabase
            .from("progreso")
            .select("*", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .eq("progreso", 100);

          await verificarLogros(
            userId,
            "curso",
            cursosCompletos ?? 0
          );
        }
      } catch (error) {
        console.error(
          "Error al verificar logros del quiz:",
          error
        );
      }
      return true;
    } catch (error: any) {
      console.error("Error finalizando intento:", error);

      enviadoRef.current = false;

      alert(
        error?.message ||
          "No se pudo registrar el intento. Intenta nuevamente."
      );

      return false;
    }
  };

  useEffect(() => {
    if (
      estado !== "en_curso" ||
      deadlineLocalMs === null ||
      enviadoRef.current
    ) {
      return;
    }

    let envioDisparado = false;

    const tick = () => {
      const restante = Math.max(
        0,
        Math.ceil((deadlineLocalMs - Date.now()) / 1000)
      );

      setTimeLeftSec(restante);

      if (
        restante <= 0 &&
        !envioDisparado &&
        !enviadoRef.current
      ) {
        envioDisparado = true;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        void enviarQuiz(true);
      }
    };

    tick();

    intervalRef.current = setInterval(tick, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [estado, deadlineLocalMs]);

  useEffect(() => {
    if (
      !finalizarPorExpiracionPendiente ||
      estado !== "en_curso" ||
      esPreview ||
      !intentoActivoId
    ) {
      return;
    }

    setFinalizarPorExpiracionPendiente(false);
    void enviarQuiz(true);
  }, [
    finalizarPorExpiracionPendiente,
    estado,
    esPreview,
    intentoActivoId,
  ]);

  const confirmarSalidaQuiz = async () => {
    if (procesandoSalida) return;

    try {
      setProcesandoSalida(true);

      const pendiente = salidaPendiente ?? { tipo: "atras" as const };

      setMostrarAvisoSalida(false);
      setSalidaPendiente(null);

      if (pendiente.tipo === "atras") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        setDeadlineLocalMs(null);
        setTimeLeftSec(null);
        setEstado("intro");
        quitarBarreraHistorial();
        return;
      }

      if (pendiente.tipo === "navegar") {
        iniciarIndicadorNavegacionFCC("Abriendo la sección", {
          destino: pendiente.destino,
        });
        router.push(pendiente.destino);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("fcc:quiz-salida-confirmada", {
          detail: { accion: "logout" },
        })
      );
    } finally {
      setProcesandoSalida(false);
    }
  };

  const cancelarSalidaQuiz = () => {
    if (procesandoSalida) return;
    setMostrarAvisoSalida(false);
    setSalidaPendiente(null);
  };

  const verUltimoResultado = async () => {
    if (!ultimoIntentoId) return;

    try {
      setCargandoResultadoAnterior(true);

      const items = await cargarRetroalimentacionIntento(ultimoIntentoId);

      if (items.length === 0) {
        alert("No se pudo recuperar el último resultado.");
        return;
      }

      aplicarRetroalimentacionIntento(items);
      const seleccionadasAnteriores: Record<string, string> = {};

      items.forEach((item) => {
        if (item.pregunta_id && item.respuesta_id) {
          seleccionadasAnteriores[item.pregunta_id] = item.respuesta_id;
        }
      });

      seleccionadasRef.current = seleccionadasAnteriores;
      setSeleccionadas(seleccionadasAnteriores);

      setResultado({
        correctas: items.filter((item) => item.es_correcta).length,
        total: items.length,
      });

      setResultadoHistorico(true);
      setXpGanado(0);
      activarBarreraResultado();
      setEstado("finalizado");
    } catch (error) {
      console.warn("No se pudo cargar el último resultado:", error);
      alert("No se pudo recuperar el último resultado.");
    } finally {
      setCargandoResultadoAnterior(false);
    }
  };

  const reiniciarQuiz = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (
      typeof window !== "undefined" &&
      window.history.state?.fccQuizResultado === quizId
    ) {
      ignorarPopstateRef.current = true;
      window.history.back();
    }

    seleccionadasRef.current = {};
    setSeleccionadas({});
    setEstado("intro");
    setResultado(null);
    setTimeLeftSec(null);
    setDeadlineLocalMs(null);
    setEnvioAutomaticoPorTiempo(false);
    setRetroalimentacionIntento({});
    setResultadoHistorico(false);
    setMostrarAvisoTiempo(false);
    setMensajeResultadoAutomatico(null);
    enviadoRef.current = false;
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatearHora = (value: string | null | undefined) => {
    if (!value) return null;

    try {
      return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(value))
        .replace(/\.$/, "");
    } catch {
      return null;
    }
  };

  const horaCierreIntento = formatearHora(expiraEnIso);

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
            strict: "ignore",
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
            strict: "ignore",
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
          strict: "ignore",
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
          strict: "ignore",
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
  const quizCompletadoPerfecto =
    !esPreview &&
    !verificandoIntentos &&
    mejorPuntaje === 100;
  const intentosAgotados =
    !esPreview &&
    !verificandoIntentos &&
    mejorPuntaje < 100 &&
    intentosRealizados >= intentosMax;
  const sinMasIntentos = quizCompletadoPerfecto || intentosAgotados;
  const puntajeResultado =
    resultado && resultado.total > 0
      ? Math.round((resultado.correctas / resultado.total) * 100)
      : 0;

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
        padding: 26px clamp(18px, 3vw, 30px) 32px;
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
      .quiz-success-button,
      .quiz-danger-button {
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

      .quiz-emphasis-button {
        color: var(--quiz-accent);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-accent) 13%, var(--quiz-surface-strong)),
            color-mix(in srgb, var(--quiz-accent) 8%, var(--quiz-surface))
          );
        border-color: color-mix(
          in srgb,
          var(--quiz-accent) 42%,
          var(--quiz-border)
        );
        box-shadow:
          0 8px 20px color-mix(in srgb, var(--quiz-accent) 12%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--quiz-surface-strong) 76%, transparent);
      }

      .quiz-primary-button:hover,
      .quiz-secondary-button:hover,
      .quiz-success-button:hover,
      .quiz-danger-button:hover {
        transform: translateY(-1px);
      }

      .quiz-primary-button:disabled,
      .quiz-success-button:disabled,
      .quiz-danger-button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
        transform: none;
      }

      .quiz-danger-button {
        color: #ffffff;
        background: linear-gradient(135deg, #dc2626, #ef4444);
        box-shadow: 0 14px 26px rgba(220, 38, 38, 0.22);
      }

      .quiz-active-notice,
      .quiz-auto-result-note {
        width: min(100%, 720px);
        border-radius: 17px;
        padding: 12px 14px;
        color: var(--quiz-text-soft);
        background: color-mix(in srgb, var(--quiz-accent) 7%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 20%, var(--quiz-border));
        font-size: 0.88rem;
        font-weight: 760;
        line-height: 1.45;
      }

      .quiz-auto-result-note {
        color: color-mix(in srgb, #d97706 72%, var(--quiz-text));
        background: color-mix(in srgb, #f59e0b 7%, var(--quiz-surface));
        border-color: color-mix(in srgb, #f59e0b 24%, var(--quiz-border));
      }

      .quiz-best-summary {
        width: min(100%, 520px);
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        border-radius: 18px;
        padding: 13px 15px;
        text-align: left;
        color: var(--quiz-text);
        background: color-mix(in srgb, var(--quiz-accent) 7%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 20%, var(--quiz-border));
      }

      .quiz-best-summary-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--quiz-accent);
        background: color-mix(in srgb, var(--quiz-accent) 10%, transparent);
      }

      .quiz-best-summary-copy {
        display: grid;
        gap: 2px;
      }

      .quiz-best-summary-copy span {
        color: var(--quiz-muted);
        font-size: 0.76rem;
        font-weight: 850;
      }

      .quiz-best-summary-copy strong {
        color: var(--quiz-text);
        font-size: 1rem;
        font-weight: 950;
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

      .quiz-completion-note {
        width: min(100%, 610px);
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        border-radius: 18px;
        padding: 14px 16px;
        text-align: left;
        border: 1px solid var(--quiz-border);
      }

      .quiz-completion-note.perfect {
        color: color-mix(in srgb, var(--color-success) 78%, var(--quiz-text));
        background: color-mix(in srgb, var(--color-success) 8%, var(--quiz-surface));
        border-color: color-mix(in srgb, var(--color-success) 24%, var(--quiz-border));
      }

      .quiz-completion-note.exhausted {
        color: color-mix(in srgb, #d97706 76%, var(--quiz-text));
        background: color-mix(in srgb, #f59e0b 7%, var(--quiz-surface));
        border-color: color-mix(in srgb, #f59e0b 22%, var(--quiz-border));
      }

      .quiz-completion-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: color-mix(in srgb, currentColor 10%, transparent);
      }

      .quiz-completion-copy {
        display: grid;
        gap: 2px;
      }

      .quiz-completion-copy strong {
        color: var(--quiz-text);
        font-size: 0.98rem;
        font-weight: 950;
      }

      .quiz-completion-copy span {
        color: var(--quiz-muted);
        font-size: 0.86rem;
        font-weight: 760;
        line-height: 1.4;
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

      .quiz-question-card.has-feedback {
        padding-bottom: 20px;
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

      .quiz-feedback-card {
        display: grid;
        gap: 9px;
        margin-top: 14px;
        border-radius: 16px;
        padding: 13px 14px;
        text-align: left;
        border: 1px solid var(--quiz-border);
      }

      .quiz-question-card.has-feedback .quiz-feedback-card {
        margin-top: 72px;
      }

      .quiz-feedback-card.correct {
        background: color-mix(in srgb, var(--color-success) 7%, var(--quiz-surface));
        border-color: color-mix(in srgb, var(--color-success) 24%, var(--quiz-border));
      }

      .quiz-feedback-card.incorrect {
        background: color-mix(in srgb, #f59e0b 7%, var(--quiz-surface));
        border-color: color-mix(in srgb, #f59e0b 24%, var(--quiz-border));
      }

      .quiz-feedback-head {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        font-weight: 950;
      }

      .quiz-feedback-card.correct .quiz-feedback-head {
        color: var(--color-success);
      }

      .quiz-feedback-card.incorrect .quiz-feedback-head {
        color: #d97706;
      }

      .quiz-feedback-explanation {
        display: grid;
        gap: 5px;
      }

      .quiz-feedback-explanation-label {
        color: var(--quiz-muted);
        font-size: 0.7rem;
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .quiz-feedback-text {
        margin: 0;
        color: var(--quiz-text-soft);
        font-size: 0.88rem;
        font-weight: 720;
        line-height: 1.5;
      }

      .quiz-feedback-correct-answer {
        display: grid;
        gap: 4px;
        border-top: 1px solid var(--quiz-border);
        padding-top: 9px;
      }

      .quiz-feedback-correct-answer > span {
        color: var(--quiz-muted);
        font-size: 0.7rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .quiz-history-button {
        margin-top: 4px;
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

      .quiz-result-visual {
        width: min(100%, 520px);
        display: grid;
        justify-items: center;
        gap: 8px;
        border-radius: 20px;
        padding: 14px 16px;
        background: color-mix(in srgb, var(--quiz-accent) 6%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 18%, var(--quiz-border));
      }

      .quiz-result-visual.perfect {
        color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 7%, var(--quiz-surface));
        border-color: color-mix(in srgb, var(--color-success) 22%, var(--quiz-border));
      }

      .quiz-result-visual.retry {
        color: var(--quiz-accent);
      }

      .quiz-result-visual.finished {
        color: #d97706;
        background: color-mix(in srgb, #f59e0b 6%, var(--quiz-surface));
        border-color: color-mix(in srgb, #f59e0b 20%, var(--quiz-border));
      }

      .quiz-result-visual-icon {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        background: color-mix(in srgb, currentColor 10%, transparent);
      }

      .quiz-result-visual strong {
        color: var(--quiz-text);
        font-size: 0.96rem;
        font-weight: 950;
        text-align: center;
      }

      .quiz-result-visual span {
        color: var(--quiz-muted);
        font-size: 0.84rem;
        font-weight: 740;
        line-height: 1.4;
        text-align: center;
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

      .quiz-exit-overlay {
        --quiz-accent: var(--fcc-premium-accent);
        --quiz-surface: var(--fcc-premium-surface);
        --quiz-surface-soft: var(--fcc-premium-surface-soft);
        --quiz-surface-strong: var(--fcc-premium-surface-strong);
        --quiz-text: var(--fcc-premium-text);
        --quiz-muted: var(--fcc-premium-muted);
        --quiz-border: var(--fcc-premium-border);
        --quiz-shadow: var(--fcc-premium-shadow);
        --quiz-button: var(--fcc-premium-button);

        position: fixed;
        inset: 0;
        z-index: 180;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(2, 8, 23, 0.72);
        backdrop-filter: blur(8px);
      }

      .quiz-exit-modal {
        width: min(92vw, 500px);
        border-radius: 26px;
        padding: 24px;
        color: var(--quiz-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--quiz-surface) 98%, transparent),
            color-mix(in srgb, var(--quiz-surface-soft) 99%, transparent)
          );
        border: 1px solid color-mix(
          in srgb,
          var(--quiz-accent) 18%,
          var(--quiz-border)
        );
        box-shadow: var(--quiz-shadow);
      }

      .quiz-exit-modal h2 {
        color: var(--quiz-text);
        font-size: 1.35rem;
        font-weight: 950;
        letter-spacing: -0.04em;
        text-align: center;
      }

      .quiz-exit-modal p {
        margin: 10px auto 0;
        max-width: 420px;
        color: var(--quiz-muted);
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.45;
        text-align: center;
      }

      .quiz-exit-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 20px;
      }

      .quiz-validation-modal {
        width: min(92vw, 430px);
      }

      .quiz-validation-icon {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        margin: 0 auto 10px;
        border-radius: 16px;
        color: #d97706;
        background: color-mix(in srgb, #f59e0b 10%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, #f59e0b 24%, var(--quiz-border));
      }

      .quiz-result-status-top {
        display: grid;
        gap: 5px;
        border-radius: 18px;
        padding: 13px 16px;
        text-align: center;
        color: var(--quiz-text-soft);
        background: color-mix(in srgb, var(--quiz-accent) 7%, var(--quiz-surface));
        border: 1px solid color-mix(in srgb, var(--quiz-accent) 20%, var(--quiz-border));
      }

      .quiz-result-status-top.warning {
        background: color-mix(in srgb, #f59e0b 8%, var(--quiz-surface));
        border-color: color-mix(in srgb, #f59e0b 24%, var(--quiz-border));
      }

      .quiz-result-status-top strong {
        color: var(--quiz-text);
        font-size: 0.95rem;
        font-weight: 950;
      }

      .quiz-result-status-top span {
        color: var(--quiz-muted);
        font-size: 0.86rem;
        font-weight: 720;
        line-height: 1.45;
      }

      @media (max-width: 640px) {
        .quiz-exit-actions {
          flex-direction: column-reverse;
        }

        .quiz-exit-actions button {
          width: 100%;
        }
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
        right: 8px;
        top: 8px;
        z-index: 2;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: var(--quiz-text);
        background: var(--quiz-surface-strong);
        border: 1px solid var(--quiz-border);
        box-shadow: var(--fcc-premium-shadow-soft);
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1;
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

        .quiz-question-card.has-feedback {
          padding-bottom: 16px;
        }

        .quiz-question-card.has-feedback .quiz-feedback-card {
          margin-top: 54px;
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

  if (loading || (!esPreview && verificandoIntentos)) {
    return (
      <LayoutGeneral rol={rol}>
        <CargadorFCC
          mensaje="Preparando el quiz"
          detalle="Confirmando preguntas, respuestas, intentos y tiempo disponible…"
        />
      </LayoutGeneral>
    );
  }

  if (errorCarga) {
    return (
      <LayoutGeneral rol={rol}>
        <EstadoErrorCargaFCC
          titulo="El quiz no se mostró incompleto"
          detalle={errorCarga}
          onRetry={() => setReintentoCarga((valor) => valor + 1)}
        />
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

        {estado === "finalizado" && !esPreview && resultado && (
          <div
            className={`quiz-result-status-top ${
              mensajeResultadoAutomatico ? "warning" : ""
            }`}
          >
            <strong>
              {mensajeResultadoAutomatico
                ? "Intento finalizado por tiempo"
                : resultadoHistorico
                  ? "Resultado registrado"
                  : "Intento finalizado"}
            </strong>

            <span>
              {mensajeResultadoAutomatico
                ? `${mensajeResultadoAutomatico} Estás viendo las respuestas registradas. Consulta tu resultado al final de la página.`
                : resultadoHistorico
                  ? "Estás viendo las respuestas de tu último intento. Consulta el resultado al final de la página."
                  : "Ya no estás respondiendo el quiz. Puedes revisar tus respuestas y consultar el resultado al final de la página."}
            </span>
          </div>
        )}

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

              {!esPreview && intentoActivoId && (
                <p className="quiz-active-notice">
                  Tienes un intento en curso. Tus respuestas siguen guardadas
                  {horaCierreIntento
                    ? ` y podrás retomarlo hasta las ${horaCierreIntento}.`
                    : "."}
                </p>
              )}

              {!esPreview &&
                !sinMasIntentos &&
                !intentoActivoId &&
                intentosRealizados > 0 && (
                  <div className="quiz-best-summary">
                    <div className="quiz-best-summary-icon" aria-hidden="true">
                      <Target size={23} strokeWidth={2.35} />
                    </div>

                    <div className="quiz-best-summary-copy">
                      <span>Mejor puntaje obtenido</span>
                      <strong>{mejorPuntaje} pts</strong>
                    </div>
                  </div>
                )}

              <button
                type="button"
                onClick={iniciar}
                disabled={
                  verificandoIntentos ||
                  sinMasIntentos ||
                  iniciandoIntento
                }
                className="quiz-primary-button"
              >
                {iniciandoIntento
                  ? "Iniciando..."
                  : verificandoIntentos && !esPreview
                  ? "Verificando..."
                  : quizCompletadoPerfecto
                  ? "Completado"
                  : intentosAgotados
                  ? "Intentos agotados"
                  : intentoActivoId && !esPreview
                  ? "Continuar intento"
                  : "Iniciar"}
              </button>

              {quizCompletadoPerfecto && (
                <div className="quiz-completion-note perfect">
                  <div className="quiz-completion-icon" aria-hidden="true">
                    <Trophy size={23} strokeWidth={2.4} />
                  </div>
                  <div className="quiz-completion-copy">
                    <strong>¡Quiz completado!</strong>
                    <span>
                      Alcanzaste el puntaje máximo: <b>100 pts</b>.
                    </span>
                  </div>
                </div>
              )}

              {intentosAgotados && (
                <div className="quiz-completion-note exhausted">
                  <div className="quiz-completion-icon" aria-hidden="true">
                    <CheckCircle2 size={23} strokeWidth={2.4} />
                  </div>
                  <div className="quiz-completion-copy">
                    <strong>Intentos agotados</strong>
                    <span>
                      Mejor puntaje obtenido: <b>{mejorPuntaje} pts</b>.
                    </span>
                  </div>
                </div>
              )}

              {sinMasIntentos && ultimoIntentoId && (
                <button
                  type="button"
                  onClick={() => void verUltimoResultado()}
                  disabled={cargandoResultadoAnterior}
                  className="quiz-secondary-button quiz-emphasis-button quiz-history-button"
                >
                  {cargandoResultadoAnterior
                    ? "Cargando resultado..."
                    : "Ver último resultado y explicaciones"}
                </button>
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
            {preguntas.map((p, idx) => {
              const feedback = retroalimentacionIntento[p.id];

              return (
              <section
                key={p.id}
                id={`quiz-pregunta-${idx + 1}`}
                className={`quiz-card quiz-question-card no-diagonal ${
                  estado === "finalizado" && !esPreview && feedback
                    ? "has-feedback"
                    : ""
                }`}
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

                  {estado === "finalizado" &&
                    !esPreview &&
                    feedback && (
                      <div
                        className={`quiz-feedback-card ${
                          feedback.es_correcta ? "correct" : "incorrect"
                        }`}
                      >
                        <div className="quiz-feedback-head">
                          <span>{feedback.es_correcta ? "✓" : "!"}</span>
                          <span>
                            {feedback.es_correcta
                              ? "Respuesta correcta"
                              : "Respuesta incorrecta"}
                          </span>
                        </div>

                        {feedback.explicacion && (
                          <div className="quiz-feedback-explanation">
                            <span className="quiz-feedback-explanation-label">
                              {feedback.es_correcta
                                ? "Por qué está bien"
                                : "Qué debes revisar"}
                            </span>

                            <p className="quiz-feedback-text">
                              {feedback.explicacion}
                            </p>
                          </div>
                        )}

                        {!feedback.es_correcta &&
                          feedback.respuesta_correcta_texto && (
                            <div className="quiz-feedback-correct-answer">
                              <span>Respuesta correcta</span>

                              <div
                                className="quiz-render"
                                dangerouslySetInnerHTML={{
                                  __html: renderQuizHTML(
                                    feedback.respuesta_correcta_texto
                                  ),
                                }}
                              />
                            </div>
                          )}
                      </div>
                    )}
                </div>
              </section>
              );
            })}
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
              {!esPreview && (
                <div
                  className={`quiz-result-visual ${
                    puntajeResultado === 100
                      ? "perfect"
                      : !sinMasIntentos
                      ? "retry"
                      : "finished"
                  }`}
                >
                  <div className="quiz-result-visual-icon" aria-hidden="true">
                    {puntajeResultado === 100 ? (
                      <Trophy size={26} strokeWidth={2.35} />
                    ) : !sinMasIntentos ? (
                      <Sparkles size={25} strokeWidth={2.25} />
                    ) : (
                      <CheckCircle2 size={25} strokeWidth={2.3} />
                    )}
                  </div>

                  <strong>
                    {puntajeResultado === 100
                      ? "¡Excelente, completaste el quiz!"
                      : !sinMasIntentos
                      ? "Tu intento quedó registrado"
                      : "Resultado registrado"}
                  </strong>

                  <span>
                    {puntajeResultado === 100
                      ? "Obtuviste el puntaje máximo."
                      : !sinMasIntentos
                      ? "Aún tienes intentos disponibles para seguir mejorando."
                      : "Puedes revisar tus respuestas y la retroalimentación disponible."}
                  </span>
                </div>
              )}

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
                  <strong>{puntajeResultado} pts</strong>
                </p>

                {!esPreview && xpGanado > 0 && (
                  <p className="quiz-result-main">
                    XP ganado en este intento: <strong>{xpGanado}</strong>
                  </p>
                )}
              </div>

              {!esPreview &&
                (sinMasIntentos || resultado.correctas === resultado.total) && (
                  <button
                    type="button"
                    onClick={() => {
                      const destino = `/curso/${materiaId}`;
                      iniciarIndicadorNavegacionFCC("Regresando al curso", {
                        destino,
                      });
                      router.push(destino);
                    }}
                    className="quiz-secondary-button quiz-emphasis-button"
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
            alcanzaron a guardarse dentro del tiempo establecido.
          </div>,
          document.body
        )}

      {mostrarAvisoSalida &&
        createPortal(
          <div
            className="quiz-exit-overlay"
            onClick={cancelarSalidaQuiz}
          >
            <div
              className="quiz-exit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>¿Salir del intento?</h2>

              <p>
                Tu intento seguirá activo y tus respuestas están guardadas.{" "}
                {horaCierreIntento ? (
                  <>
                    Puedes retomarlo desde este u otro dispositivo hasta las{" "}
                    <strong>{horaCierreIntento}</strong>. Las respuestas guardadas
                    se enviarán automáticamente a esa hora.
                  </>
                ) : (
                  <>Puedes retomarlo más tarde desde este u otro dispositivo.</>
                )}
              </p>

              <div className="quiz-exit-actions">
                <button
                  type="button"
                  onClick={cancelarSalidaQuiz}
                  disabled={procesandoSalida}
                  className="quiz-secondary-button"
                >
                  Seguir resolviendo
                </button>

                <button
                  type="button"
                  onClick={() => void confirmarSalidaQuiz()}
                  disabled={procesandoSalida}
                  className="quiz-danger-button"
                >
                  {procesandoSalida
                    ? "Saliendo..."
                    : salidaPendiente?.tipo === "logout"
                    ? "Cerrar sesión"
                    : "Salir por ahora"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}


      {preguntaPendienteEnvio !== null &&
        createPortal(
          <div
            className="quiz-exit-overlay"
            onClick={() => setPreguntaPendienteEnvio(null)}
          >
            <div
              className="quiz-exit-modal quiz-validation-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="quiz-validation-icon" aria-hidden="true">
                <AlertCircle size={26} strokeWidth={2.35} />
              </div>

              <h2>Falta una respuesta</h2>

              <p>
                Responde la pregunta {preguntaPendienteEnvio} antes de enviar
                el quiz.
              </p>

              <div className="quiz-exit-actions">
                <button
                  type="button"
                  className="quiz-primary-button"
                  onClick={() => {
                    const numeroPregunta = preguntaPendienteEnvio;
                    setPreguntaPendienteEnvio(null);

                    window.setTimeout(() => {
                      document
                        .getElementById(`quiz-pregunta-${numeroPregunta}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }, 0);
                  }}
                >
                  Ir a la pregunta
                </button>
              </div>
            </div>
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
                ✕
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
