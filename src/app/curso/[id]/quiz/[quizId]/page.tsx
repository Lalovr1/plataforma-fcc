/**
 * Página para resolver o previsualizar un quiz:
 * - Estudiante: responde, guarda intentos, cronómetro y XP proporcional.
 * - Profesor: previsualiza (no guarda ni otorga XP).
 * - Auto-envía al agotar tiempo (usa minutos desde la BD).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Pregunta = { id: string; enunciado: string };
type Respuesta = { id: string; texto: string; es_correcta: boolean };

type EstadoQuiz = "intro" | "en_curso" | "finalizado";

export default function ResolverQuizPage() {
  const params = useParams();
  const router = useRouter();
  const materiaId = params?.id as string;
  const quizId = params?.quizId as string;

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta[]>>({});
  const [seleccionadas, setSeleccionadas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<{ correctas: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizInfo, setQuizInfo] = useState<any>(null);
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);

      const { data: perfil } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", userData.user.id)
        .single();
      const rolUser = perfil?.rol || "estudiante";
      setRol(rolUser);

      const { data: qz } = await supabase
        .from("quizzes")
        .select("id,titulo,descripcion,xp,intentos_max,tiempo_limite_min")
        .eq("id", quizId)
        .single();
      setQuizInfo(qz);

      const { count: intentosCount } = await supabase
        .from("intentos_quiz")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quizId)
        .eq("usuario_id", userData.user.id);

      setIntentosRealizados(intentosCount || 0);

      const { data: bestIntento } = await supabase
        .from("intentos_quiz")
        .select("puntaje")
        .eq("quiz_id", quizId)
        .eq("usuario_id", userData.user.id)
        .order("puntaje", { ascending: false })
        .limit(1);

      setMejorPuntaje(bestIntento?.[0]?.puntaje || 0);

      const { data: preg } = await supabase
        .from("preguntas")
        .select("id,enunciado")
        .eq("quiz_id", quizId)
        .order("orden", { ascending: true });

      if (!preg) {
        setLoading(false);
        return;
      }

      setPreguntas(preg as Pregunta[]);

      const mapa: Record<string, Respuesta[]> = {};
      for (const p of preg as Pregunta[]) {
        const { data: resp } = await supabase
          .from("respuestas")
          .select("id,texto,es_correcta")
          .eq("pregunta_id", p.id);
        mapa[p.id] = (resp || []) as Respuesta[];
      }
      setRespuestas(mapa);

      const paramsUrl = new URLSearchParams(window.location.search);
      if (rolUser === "profesor" || paramsUrl.get("preview") === "1") {
        setEsPreview(true);
      }

      setLoading(false);
    };

    fetchData();
  }, [quizId, router]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const iniciar = () => {
    if (esPreview) {
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
    enviadoRef.current = true;

    const total = preguntas.length;
    let correctas = 0;
    preguntas.forEach((p) => {
      const respuesta = respuestas[p.id]?.find((r) => r.id === (seleccionadas[p.id] || ""));
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

    const puntaje = Math.round((correctas / total) * 100);

    const { data: bestPrev } = await supabase
      .from("intentos_quiz")
      .select("puntaje")
      .eq("quiz_id", quizId)
      .eq("usuario_id", userId)
      .order("puntaje", { ascending: false })
      .limit(1);

    const prevBest = bestPrev?.[0]?.puntaje || 0;

    await supabase.from("intentos_quiz").insert({
      quiz_id: quizId,
      usuario_id: userId,
      puntaje,
      completado: true,
    });

    setIntentosRealizados((prev) => prev + 1);

    const xpQuiz = quizInfo.xp ?? 0;
    const xpNuevo = Math.round((xpQuiz * puntaje) / 100);
    const xpPrev = Math.round((xpQuiz * prevBest) / 100);
    const delta = Math.max(xpNuevo - xpPrev, 0);

    if (delta > 0) {
      const { data, error } = await supabase.rpc("sumar_xp", { 
        user_id: userId, 
        xp_extra: delta 
      });

      if (error) {
        console.error("Error al sumar XP:", error);
      } else {
        console.log("XP actualizado:", data);

        if (data?.nuevo_nivel === true) {
          window.dispatchEvent(new CustomEvent("nivelSubido", { detail: data.nivel_actual }));
        }
      }
    } 

    setXpGanado(Math.max(xpNuevo, xpPrev));

    const { data: quizzesMateria } = await supabase
      .from("quizzes")
      .select("id")
      .eq("materia_id", materiaId);

    const totalQuizzes = (quizzesMateria || []).length;

    const { data: intentosUsuario } = await supabase
      .from("intentos_quiz")
      .select("quiz_id")
      .eq("usuario_id", userId)
      .eq("completado", true)
      .in(
        "quiz_id",
        (quizzesMateria || []).map((q) => q.id)
      );

    const completadosUnicos = new Set((intentosUsuario || []).map((i) => i.quiz_id)).size;

    const progreso =
      totalQuizzes > 0
        ? Math.min(100, Math.round((completadosUnicos / totalQuizzes) * 100))
        : 0;

    await supabase
      .from("progreso")
      .update({ progreso })
      .eq("usuario_id", userId)
      .eq("materia_id", materiaId);
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <LayoutGeneral rol={rol}>
        <p style={{ color: "var(--color-muted)" }}>Cargando quiz...</p>
      </LayoutGeneral>
    );
  }

  const intentosMax = quizInfo?.intentos_max ?? 1;
  const sinMasIntentos = !esPreview && (intentosRealizados >= intentosMax || mejorPuntaje === 100);

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
  };

  return (
    <LayoutGeneral rol={rol}>
      <div className="p-6 rounded-xl shadow space-y-6" style={cardStyle}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-heading)" }}>
          {quizInfo?.titulo || "Resolver Quiz"}
        </h1>

        {quizInfo?.descripcion && (
          <p style={{ color: "var(--color-text)" }}>{quizInfo.descripcion}</p>
        )}

        {esPreview && (
          <p style={{ color: "var(--color-secondary)" }}>
            👨‍🏫 Modo previsualización: las respuestas no se guardan ni otorgan XP.
          </p>
        )}

        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Intentos realizados: {intentosRealizados} / {intentosMax}
        </p>

        {/* Intro */}
        {estado === "intro" && (
          <div className="p-4 rounded-lg space-y-3" style={cardStyle}>
            <p style={{ color: "var(--color-text)" }}>
              {quizInfo?.tiempo_limite_min && quizInfo.tiempo_limite_min > 0
                ? `⏱ Tiempo límite: ${quizInfo.tiempo_limite_min} min`
                : "⏱ Tiempo límite: sin límite"}
            </p>
            <p style={{ color: "var(--color-text)" }}>📝 Preguntas: {preguntas.length}</p>
            <div className="flex gap-2">
              <button
                onClick={iniciar}
                disabled={sinMasIntentos}
                className="px-4 py-2 rounded text-white hover:opacity-90"
                style={{
                  backgroundColor: sinMasIntentos
                    ? "var(--color-secondary)"
                    : "var(--color-primary)",
                  cursor: sinMasIntentos ? "not-allowed" : "pointer",
                }}
              >
                Iniciar
              </button>
              {sinMasIntentos && (
                <div className="text-sm space-y-1">
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

        {/* Cronómetro */}
        {estado === "en_curso" && timeLeftSec !== null && quizInfo?.tiempo_limite_min > 0 && (
          <div className="text-center text-lg font-semibold" style={{ color: "var(--color-heading)" }}>
            ⏳ {mmss(timeLeftSec)}
          </div>
        )}

        {/* Preguntas */}
        {(estado === "en_curso" || estado === "finalizado") && (
          <div className="space-y-4">
            {preguntas.map((p, idx) => (
              <div key={p.id} className="p-4 rounded-lg" style={cardStyle}>
                <h3 className="font-semibold mb-2 flex gap-2" style={{ color: "var(--color-heading)" }}>
                  <span>{idx + 1}.</span>
                  <span className="prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {p.enunciado}
                    </ReactMarkdown>
                  </span>
                </h3>

                <div className="space-y-2">
                  {(respuestas[p.id] || []).map((r) => {
                    const disabled = estado === "finalizado";
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={p.id}
                          value={r.id}
                          checked={seleccionadas[p.id] === r.id}
                          disabled={disabled}
                          onChange={() =>
                            setSeleccionadas((prev) => ({ ...prev, [p.id]: r.id }))
                          }
                        />
                        <span className="prose max-w-none" style={{ color: "var(--color-text)" }}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {r.texto}
                          </ReactMarkdown>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botón enviar */}
        {estado === "en_curso" && (
          <button
            onClick={() => enviarQuiz(false)}
            className="px-4 py-2 rounded text-white hover:opacity-90"
            style={{ backgroundColor: "var(--color-success)" }}
          >
            Enviar respuestas
          </button>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="mt-4 p-4 rounded-lg space-y-2" style={cardStyle}>
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
                {Math.round((resultado.correctas / resultado.total) * 100)}%
              </span>
            </p>

            {!esPreview && (
              <>
                {sinMasIntentos || resultado.correctas === resultado.total ? (
                  <div className="space-y-2">
                    <p style={{ color: "var(--color-primary)" }}>
                      XP ganado: <span className="font-bold">{xpGanado}</span>
                    </p>
                    <button
                      onClick={() => router.push(`/curso/${materiaId}`)}
                      className="mt-3 px-4 py-2 rounded text-white hover:opacity-90"
                      style={{ backgroundColor: "var(--color-secondary)" }}
                    >
                      Regresar al curso
                    </button>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-primary)" }}>
                    Puedes volver a intentarlo para mejorar tu puntaje y XP.
                  </p>
                )}
              </>
            )}

            {!esPreview && !sinMasIntentos && resultado.correctas < resultado.total && (
              <button
                onClick={() => {
                  setEstado("intro");
                  setResultado(null);
                  setSeleccionadas({});
                  enviadoRef.current = false;
                }}
                className="mt-3 px-4 py-2 rounded text-white hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Reintentar quiz
              </button>
            )}
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}
