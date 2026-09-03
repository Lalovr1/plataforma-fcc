"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/utils/supabaseClient";
import ConfirmarSalidaEdicion from "@/components/ConfirmarSalidaEdicion";
import CargadorFCC, {
  DURACION_MINIMA_CARGADOR_FCC_MS,
} from "@/components/CargadorFCC";
import { contenidoQuizATextoIA } from "@/lib/ai/quizMedia";

type EstadoExplicacion =
  | "ia"
  | "manual"
  | "manual_pendiente"
  | "sin_generar";

type PreguntaExplicacion = {
  id: string;
  orden: number;
  enunciado: string;
  estado: EstadoExplicacion;
  retroalimentacion_correcta: string;
  retroalimentacion_incorrecta: string;
  motivo_no_disponible: string | null;
};

type ResumenExplicaciones = {
  total: number;
  completas: number;
  pendientes: number;
};

type Props = {
  quizId: string;
  quizTitulo?: string | null;
  onClose: () => void;
  onResumenChange?: (resumen: ResumenExplicaciones) => void;
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

function textoVisible(value: string) {
  return contenidoQuizATextoIA(
    String(value || "").replace(
      /<img[^>]*>/gi,
      " [Imagen] "
    )
  ).trim();
}

export default function ExplicacionesQuiz({
  quizId,
  quizTitulo,
  onClose,
  onResumenChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preguntas, setPreguntas] = useState<PreguntaExplicacion[]>([]);
  const [originales, setOriginales] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [guardandoSalida, setGuardandoSalida] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const firmaPregunta = (pregunta: PreguntaExplicacion) =>
    JSON.stringify({
      correcta: pregunta.retroalimentacion_correcta,
      incorrecta: pregunta.retroalimentacion_incorrecta,
    });

  const resumen = useMemo<ResumenExplicaciones>(() => {
    const completas = preguntas.filter(
      (pregunta) =>
        pregunta.estado === "ia" ||
        pregunta.estado === "manual"
    ).length;

    return {
      total: preguntas.length,
      completas,
      pendientes: Math.max(0, preguntas.length - completas),
    };
  }, [preguntas]);

  const idsModificados = useMemo(
    () =>
      preguntas
        .filter(
          (pregunta) =>
            originales[pregunta.id] !== firmaPregunta(pregunta)
        )
        .map((pregunta) => pregunta.id),
    [preguntas, originales]
  );

  const hayCambios = idsModificados.length > 0;

  useEffect(() => {
    if (!open || !hayCambios) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [open, hayCambios]);

  const cargar = async () => {
    const inicioCarga = performance.now();
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Tu sesión no está disponible."
        );
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
          data?.error ||
            "No se pudieron cargar las explicaciones."
        );
      }

      const lista: PreguntaExplicacion[] =
        Array.isArray(data.preguntas)
          ? data.preguntas
          : [];

      setPreguntas(lista);

      setOriginales(
        Object.fromEntries(
          lista.map((pregunta) => [
            pregunta.id,
            firmaPregunta(pregunta),
          ])
        )
      );

      if (data?.resumen) {
        onResumenChange?.({
          total: Number(data.resumen.total ?? 0),
          completas: Number(data.resumen.completas ?? 0),
          pendientes: Number(data.resumen.pendientes ?? 0),
        });
      }
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las explicaciones.";

      setError(mensaje);
    } finally {
      await esperarMinimoCargadorFCC(inicioCarga);
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [quizId]);

  useEffect(() => {
    onResumenChange?.(resumen);
  }, [resumen.total, resumen.completas, resumen.pendientes]);

  const actualizarCampo = (
    preguntaId: string,
    campo:
      | "retroalimentacion_correcta"
      | "retroalimentacion_incorrecta",
    value: string
  ) => {
    setPreguntas((prev) =>
      prev.map((pregunta) =>
        pregunta.id === preguntaId
          ? {
              ...pregunta,
              [campo]: value.slice(0, 2500),
            }
          : pregunta
      )
    );
  };

  const guardar = async () => {
    if (!hayCambios) {
      toast("No hay cambios por guardar.");
      return false;
    }

    try {
      setSaving(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Tu sesión no está disponible."
        );
      }

      const cambios = preguntas
        .filter((pregunta) =>
          idsModificados.includes(pregunta.id)
        )
        .map((pregunta) => ({
          preguntaId: pregunta.id,
          correcta: pregunta.retroalimentacion_correcta.trim(),
          incorrecta: pregunta.retroalimentacion_incorrecta.trim(),
        }));

      const response = await fetch(
        "/api/ia/explicaciones-quiz",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            quizId,
            cambios,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "No se pudieron guardar las explicaciones."
        );
      }

      const lista: PreguntaExplicacion[] =
        Array.isArray(data.preguntas)
          ? data.preguntas
          : [];

      setPreguntas(lista);

      setOriginales(
        Object.fromEntries(
          lista.map((pregunta) => [
            pregunta.id,
            firmaPregunta(pregunta),
          ])
        )
      );

      onResumenChange?.({
        total: Number(data?.resumen?.total ?? lista.length),
        completas: Number(data?.resumen?.completas ?? 0),
        pendientes: Number(data?.resumen?.pendientes ?? 0),
      });

      toast.success(
        "Explicaciones guardadas"
      );

      return true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar las explicaciones."
      );

      return false;
    } finally {
      setSaving(false);
    }
  };

  const cerrar = () => {
    if (hayCambios) {
      setConfirmarSalida(true);
      return;
    }

    onClose();
  };

  const descartarYSalir = () => {
    setConfirmarSalida(false);
    onClose();
  };

  const guardarYSalir = async () => {
    if (guardandoSalida) return;

    setGuardandoSalida(true);

    try {
      const guardado = await guardar();

      if (!guardado) return;

      setConfirmarSalida(false);
      onClose();
    } finally {
      setGuardandoSalida(false);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return createPortal(
      <CargadorFCC
        sobreModal
        mensaje="Preparando explicaciones"
        detalle=""
      />,
      document.body
    );
  }

  return (
    <>
      {createPortal(
        <div className="explicaciones-quiz-overlay fcc-modal-backdrop-enter-standard">
      <style>{`
        .explicaciones-quiz-overlay {
          --exp-accent: var(--fcc-premium-accent);
          --exp-surface: var(--fcc-premium-surface);
          --exp-surface-soft: var(--fcc-premium-surface-soft);
          --exp-surface-strong: var(--fcc-premium-surface-strong);
          --exp-text: var(--fcc-premium-text);
          --exp-text-soft: var(--fcc-premium-text-soft);
          --exp-muted: var(--fcc-premium-muted);
          --exp-border: var(--fcc-premium-border);
          --exp-shadow: var(--fcc-premium-shadow);

          position: fixed;
          inset: 0;
          z-index: 145;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          background: rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(8px);
        }

        .explicaciones-quiz-modal {
          width: min(100%, 980px);
          max-height: 92dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 28px;
          color: var(--exp-text);
          background: var(--exp-surface);
          border: 1px solid var(--exp-border);
          box-shadow: var(--exp-shadow);
          position: relative;
        }

        .explicaciones-quiz-scroll {
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 26px;
        }

        .explicaciones-quiz-header {
          display: grid;
          gap: 8px;
          text-align: center;
        }

        .explicaciones-quiz-kicker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #6d4aff;
          font-size: 0.76rem;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .explicaciones-quiz-title {
          margin: 0;
          color: var(--exp-text);
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .explicaciones-quiz-description {
          max-width: 720px;
          margin: 0 auto;
          color: var(--exp-muted);
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1.5;
        }

        .explicaciones-quiz-quiz-name {
          color: var(--exp-text-soft);
          font-size: 0.78rem;
          font-weight: 850;
        }

        .explicaciones-quiz-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-top: 18px;
        }

        .explicaciones-quiz-stat {
          min-height: 64px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          padding: 11px 13px;
          background: color-mix(
            in srgb,
            var(--exp-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--exp-border);
        }

        .explicaciones-quiz-stat strong {
          display: block;
          color: var(--exp-text);
          font-size: 1rem;
          font-weight: 950;
        }

        .explicaciones-quiz-stat span {
          display: block;
          color: var(--exp-muted);
          font-size: 0.7rem;
          font-weight: 750;
        }

        .explicaciones-quiz-stat.complete {
          color: #059669;
          border-color: color-mix(
            in srgb,
            #10b981 24%,
            var(--exp-border)
          );
        }

        .explicaciones-quiz-stat.pending {
          color: #dc2626;
          border-color: color-mix(
            in srgb,
            #ef4444 28%,
            var(--exp-border)
          );
        }

        .explicaciones-quiz-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 14px;
          border-radius: 16px;
          padding: 13px 14px;
          color: #b91c1c;
          background: color-mix(
            in srgb,
            #ef4444 7%,
            var(--exp-surface)
          );
          border: 1px solid color-mix(
            in srgb,
            #ef4444 25%,
            var(--exp-border)
          );
          font-size: 0.82rem;
          font-weight: 750;
          line-height: 1.45;
        }

        .explicaciones-quiz-list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .explicaciones-quiz-card {
          display: grid;
          gap: 13px;
          border-radius: 19px;
          padding: 15px;
          background: color-mix(
            in srgb,
            var(--exp-surface-strong) 68%,
            transparent
          );
          border: 1px solid var(--exp-border);
        }

        .explicaciones-quiz-card.pending {
          border-color: color-mix(
            in srgb,
            #ef4444 30%,
            var(--exp-border)
          );
        }

        .explicaciones-quiz-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .explicaciones-quiz-question {
          min-width: 0;
        }

        .explicaciones-quiz-question strong {
          display: block;
          color: var(--exp-text);
          font-size: 0.88rem;
          font-weight: 950;
        }

        .explicaciones-quiz-question p {
          margin: 4px 0 0;
          color: var(--exp-text-soft);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.4;
        }

        .explicaciones-quiz-question-content {
          min-width: 0;
          margin-top: 4px;
          overflow-x: auto;
          color: var(--exp-text-soft);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.4;
        }

        .explicaciones-quiz-question-content .katex-display {
          margin: 2px 0;
          text-align: left;
        }

        .explicaciones-quiz-status {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 0.7rem;
          font-weight: 900;
        }

        .explicaciones-quiz-status.ready {
          color: #059669;
          background: color-mix(
            in srgb,
            #10b981 9%,
            transparent
          );
        }

        .explicaciones-quiz-status.pending {
          color: #dc2626;
          background: color-mix(
            in srgb,
            #ef4444 9%,
            transparent
          );
        }

        .explicaciones-quiz-origin {
          margin-top: -5px;
          color: var(--exp-muted);
          font-size: 0.7rem;
          font-weight: 750;
        }

        .explicaciones-quiz-pending-reason {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          border-radius: 13px;
          padding: 10px 11px;
          color: #b91c1c;
          background: color-mix(
            in srgb,
            #ef4444 6%,
            transparent
          );
          font-size: 0.76rem;
          font-weight: 750;
          line-height: 1.4;
        }

        .explicaciones-quiz-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .explicaciones-quiz-field {
          display: grid;
          gap: 6px;
        }

        .explicaciones-quiz-label {
          color: var(--exp-text-soft);
          font-size: 0.73rem;
          font-weight: 900;
        }

        .explicaciones-quiz-textarea {
          width: 100%;
          min-height: 118px;
          resize: vertical;
          border-radius: 14px;
          padding: 11px 12px;
          color: var(--exp-text);
          background: var(--exp-surface);
          border: 1px solid var(--exp-border);
          outline: none;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.45;
        }

        .explicaciones-quiz-textarea:focus {
          border-color: color-mix(
            in srgb,
            var(--exp-accent) 52%,
            var(--exp-border)
          );
        }

        .explicaciones-quiz-footer {
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 14px 22px 20px;
          background: var(--exp-surface);
          border-top: 1px solid var(--exp-border);
        }

        .explicaciones-quiz-button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 14px;
          padding: 0 15px;
          font-size: 0.88rem;
          font-weight: 950;
          transition: transform 170ms ease, opacity 170ms ease;
        }

        .explicaciones-quiz-button:hover {
          transform: translateY(-1px);
        }

        .explicaciones-quiz-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
          transform: none;
        }

        .explicaciones-quiz-button.secondary {
          color: var(--exp-text);
          background: var(--exp-surface-strong);
          border: 1px solid var(--exp-border);
        }

        .explicaciones-quiz-button.success {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #10b981,
            #14b8a6
          );
        }

        .explicaciones-quiz-button.danger {
          color: #ffffff;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 1px solid color-mix(in srgb, #ef4444 70%, white);
        }

        .explicaciones-quiz-close {
          position: absolute;
          right: 14px;
          top: 14px;
          z-index: 4;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #ffffff;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 1px solid color-mix(in srgb, #ef4444 70%, white);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
          transition: transform 170ms ease, filter 170ms ease;
        }

        .explicaciones-quiz-close:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .explicaciones-quiz-loading,
        .explicaciones-quiz-error,
        .explicaciones-quiz-empty {
          min-height: 260px;
          display: grid;
          place-items: center;
          gap: 10px;
          padding: 24px;
          text-align: center;
          color: var(--exp-muted);
          font-weight: 750;
        }

        .explicaciones-quiz-error {
          color: #b91c1c;
        }

        @media (max-width: 700px) {
          .explicaciones-quiz-scroll {
            padding: 18px;
          }

          .explicaciones-quiz-summary,
          .explicaciones-quiz-fields {
            grid-template-columns: 1fr;
          }

          .explicaciones-quiz-card-head {
            display: grid;
          }

          .explicaciones-quiz-footer {
            padding:
              12px
              16px
              calc(16px + env(safe-area-inset-bottom));
          }

          .explicaciones-quiz-button {
            width: 100%;
          }
        }
      `}</style>

      <section className="explicaciones-quiz-modal fcc-modal-enter-standard">
        <div className="explicaciones-quiz-scroll">
          <header className="explicaciones-quiz-header">
            <span className="explicaciones-quiz-kicker">
              <Sparkles
                size={16}
                strokeWidth={2.5}
              />
              Explicaciones para estudiantes
            </span>

            <h3 className="explicaciones-quiz-title">
              Revisa lo que verá el estudiante
            </h3>

            <p className="explicaciones-quiz-description">
              Estas explicaciones se mostrarán cuando el estudiante termine
              definitivamente el quiz. Puedes modificar las generadas
              automáticamente o completar las que estén pendientes.
            </p>

            {quizTitulo?.trim() && (
              <span className="explicaciones-quiz-quiz-name">
                {quizTitulo}
              </span>
            )}
          </header>

          {!error && (
            <>
              <div className="explicaciones-quiz-summary">
                <div className="explicaciones-quiz-stat">
                  <Sparkles size={18} />
                  <div>
                    <strong>{resumen.total}</strong>
                    <span>preguntas</span>
                  </div>
                </div>

                <div className="explicaciones-quiz-stat complete">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{resumen.completas}</strong>
                    <span>con explicación</span>
                  </div>
                </div>

                <div className="explicaciones-quiz-stat pending">
                  <AlertCircle size={18} />
                  <div>
                    <strong>{resumen.pendientes}</strong>
                    <span>pendientes</span>
                  </div>
                </div>
              </div>

              {resumen.pendientes > 0 && (
                <div className="explicaciones-quiz-alert">
                  <AlertCircle
                    size={18}
                    strokeWidth={2.5}
                  />
                  <span>
                    Si una pregunta queda pendiente, el estudiante seguirá viendo
                    si respondió correctamente y, cuando se equivoque, cuál era la
                    respuesta correcta. Lo único que no se mostrará será la explicación
                    adicional hasta que completes ambos campos. Puedes hacerlo ahora o
                    volver más adelante desde el editor del quiz.
                  </span>
                </div>
              )}
            </>
          )}

          {error ? (
            <div className="explicaciones-quiz-error">
              <AlertCircle size={28} />
              <span>{error}</span>

              <button
                type="button"
                onClick={() => void cargar()}
                className="explicaciones-quiz-button secondary"
              >
                Reintentar
              </button>
            </div>
          ) : preguntas.length === 0 ? (
            <div className="explicaciones-quiz-empty">
              Este quiz todavía no tiene preguntas.
            </div>
          ) : (
            <div className="explicaciones-quiz-list">
              {preguntas.map((pregunta, index) => {
                const pendiente =
                  pregunta.estado === "manual_pendiente" ||
                  pregunta.estado === "sin_generar";

                return (
                  <article
                    key={pregunta.id}
                    className={`explicaciones-quiz-card ${
                      pendiente ? "pending" : ""
                    }`}
                  >
                    <div className="explicaciones-quiz-card-head">
                      <div className="explicaciones-quiz-question">
                        <strong>
                          Pregunta {index + 1}
                        </strong>

                        <div className="explicaciones-quiz-question-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <span>{children}</span>,
                            }}
                          >
                            {textoVisible(pregunta.enunciado) ||
                              "Pregunta sin texto visible"}
                          </ReactMarkdown>
                        </div>
                      </div>

                      <span
                        className={`explicaciones-quiz-status ${
                          pendiente ? "pending" : "ready"
                        }`}
                      >
                        {pendiente ? (
                          <>
                            <AlertCircle size={13} />
                            Pendiente
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} />
                            Lista
                          </>
                        )}
                      </span>
                    </div>

                    {!pendiente && (
                      <p className="explicaciones-quiz-origin">
                        {pregunta.estado === "ia"
                          ? "Generada automáticamente. Puedes editarla si lo necesitas."
                          : "Editada por el profesor."}
                      </p>
                    )}

                    {pendiente && (
                      <div className="explicaciones-quiz-pending-reason">
                        <AlertCircle
                          size={16}
                          strokeWidth={2.4}
                        />
                        <span>
                          {pregunta.motivo_no_disponible ||
                            "Esta pregunta todavía no tiene explicaciones completas."}
                        </span>
                      </div>
                    )}

                    <div className="explicaciones-quiz-fields">
                      <label className="explicaciones-quiz-field">
                        <span className="explicaciones-quiz-label">
                          Si responde correctamente
                        </span>

                        <textarea
                          value={pregunta.retroalimentacion_correcta}
                          onChange={(event) =>
                            actualizarCampo(
                              pregunta.id,
                              "retroalimentacion_correcta",
                              event.target.value
                            )
                          }
                          maxLength={2500}
                          className="explicaciones-quiz-textarea"
                          placeholder="Explica por qué la respuesta es correcta..."
                        />
                      </label>

                      <label className="explicaciones-quiz-field">
                        <span className="explicaciones-quiz-label">
                          Si responde incorrectamente
                        </span>

                        <textarea
                          value={pregunta.retroalimentacion_incorrecta}
                          onChange={(event) =>
                            actualizarCampo(
                              pregunta.id,
                              "retroalimentacion_incorrecta",
                              event.target.value
                            )
                          }
                          maxLength={2500}
                          className="explicaciones-quiz-textarea"
                          placeholder="Explica qué concepto debería revisar..."
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="explicaciones-quiz-footer">
          <button
            type="button"
            onClick={cerrar}
            disabled={loading || saving}
            className="explicaciones-quiz-button secondary"
          >
            Volver
          </button>

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={
              loading ||
              saving ||
              !hayCambios
            }
            className="explicaciones-quiz-button success"
          >
            {saving ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save size={17} />
            )}

            {saving
              ? "Guardando..."
              : "Guardar explicaciones"}
          </button>
        </footer>
      </section>
        </div>,
        document.body
      )}

      <ConfirmarSalidaEdicion
        open={confirmarSalida}
        titulo="¿Salir de las explicaciones?"
        descripcion="Hay cambios sin guardar. Puedes seguir editando, descartarlos o guardar las explicaciones antes de salir."
        guardando={guardandoSalida}
        onContinuar={() => setConfirmarSalida(false)}
        onDescartar={descartarYSalir}
        onGuardar={guardarYSalir}
      />
    </>
  );
}
