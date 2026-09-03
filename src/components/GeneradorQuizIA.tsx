"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/utils/supabaseClient";
import CargadorIAFCC, {
  AvisoIAFCC,
} from "@/components/CargadorIAFCC";
import {
  ErrorIAVisible,
  mensajeErrorIA,
} from "@/lib/ai/errorPublicoCliente";

const MAX_BLOQUES_CONTEXTO = 4;

type BloqueGenerador = {
  id: string;
  titulo?: string | null;
  tipo: string;
  unidad_id?: string | null;
  orden?: number | null;
};

type UnidadGenerador = {
  id: string;
  numero: number;
  nombre?: string | null;
  orden?: number | null;
};

export type BorradorQuizIA = {
  titulo: string;
  descripcion: string;
  preguntas: Array<{
    enunciado: string;
    respuestas: Array<{
      texto: string;
      es_correcta: boolean;
    }>;
  }>;
};

type GeneradorQuizIAProps = {
  materiaId: string;
  bloquePrincipalId: string;
  bloques: BloqueGenerador[];
  unidades: UnidadGenerador[];
  hayBorrador: boolean;
  onAplicar: (borrador: BorradorQuizIA, bloqueIds: string[]) => void;
};

type TipoPreguntas = "automatico" | "conceptual" | "practico" | "mixto";

export default function GeneradorQuizIA({
  materiaId,
  bloquePrincipalId,
  bloques,
  unidades,
  hayBorrador,
  onAplicar,
}: GeneradorQuizIAProps) {
  const [portalReady, setPortalReady] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [borradorListo, setBorradorListo] = useState(false);
  const [cantidadPreguntas, setCantidadPreguntas] = useState(5);
  const [opcionesPorPregunta, setOpcionesPorPregunta] = useState(4);
  const [tipoPreguntas, setTipoPreguntas] =
    useState<TipoPreguntas>("automatico");
  const [instrucciones, setInstrucciones] = useState("");
  const [bloquesSeleccionados, setBloquesSeleccionados] = useState<string[]>([]);
  const [intentosUsados, setIntentosUsados] = useState(0);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const bloquePrincipal = useMemo(
    () => bloques.find((bloque) => bloque.id === bloquePrincipalId) ?? null,
    [bloquePrincipalId, bloques]
  );

  const bloquesDisponibles = useMemo(() => {
    if (!bloquePrincipal) return [];

    const ordenPrincipal = Number(bloquePrincipal.orden ?? 0);

    return bloques
      .filter(
        (bloque) =>
          bloque.unidad_id === bloquePrincipal.unidad_id &&
          Number(bloque.orden ?? 0) <= ordenPrincipal
      )
      .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));
  }, [bloquePrincipal, bloques]);

  const unidadPrincipal = useMemo(() => {
    if (!bloquePrincipal?.unidad_id) return null;
    return unidades.find((unidad) => unidad.id === bloquePrincipal.unidad_id) ?? null;
  }, [bloquePrincipal, unidades]);

  useEffect(() => {
    if (!abierto || !bloquePrincipalId) return;

    setBloquesSeleccionados((actuales) => {
      const permitidos = new Set(bloquesDisponibles.map((bloque) => bloque.id));
      const conservados = actuales.filter((id) => permitidos.has(id));

      return Array.from(new Set([bloquePrincipalId, ...conservados]));
    });
  }, [abierto, bloquePrincipalId, bloquesDisponibles]);

  useEffect(() => {
    if (!abierto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [abierto]);

  const abrir = () => {
    if (!bloquePrincipalId || !bloquePrincipal) {
      toast.error("Selecciona primero el bloque principal del quiz.");
      return;
    }

    setBloquesSeleccionados([bloquePrincipalId]);
    setBorradorListo(false);
    setAbierto(true);
  };

  const alternarBloque = (id: string) => {
    if (id === bloquePrincipalId) return;

    setBloquesSeleccionados((actuales) => {
      if (actuales.includes(id)) {
        return actuales.filter((bloqueId) => bloqueId !== id);
      }

      if (actuales.length >= MAX_BLOQUES_CONTEXTO) {
        toast.error(
          `Puedes seleccionar como máximo ${MAX_BLOQUES_CONTEXTO} bloques: ` +
            "el principal y hasta 3 anteriores."
        );
        return actuales;
      }

      return [...actuales, id];
    });
  };

  const generar = async () => {
    if (!bloquePrincipalId || generando) return;

    if (intentosUsados >= 3) {
      toast.error("Este borrador ya utilizó sus 3 generaciones con IA.");
      return;
    }

    try {
      setGenerando(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new ErrorIAVisible(
          "Tu sesión no está disponible. Vuelve a iniciar sesión."
        );
      }

      const response = await fetch("/api/ia/generar-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          materiaId,
          bloquePrincipalId,
          bloqueIds: bloquesSeleccionados,
          cantidadPreguntas,
          opcionesPorPregunta,
          tipoPreguntas,
          instrucciones,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok || !data?.borrador) {
        throw new ErrorIAVisible(mensajeErrorIA(data, "generar"));
      }

      const bloquesUsados = Array.isArray(data?.contexto?.bloques_utilizados)
        ? data.contexto.bloques_utilizados
            .map((bloque: { id?: unknown }) => String(bloque?.id ?? ""))
            .filter(Boolean)
        : bloquesSeleccionados;

      onAplicar(data.borrador as BorradorQuizIA, bloquesUsados);
      setIntentosUsados((actuales) => Math.min(actuales + 1, 3));
      setBorradorListo(true);
    } catch (error) {
      console.warn("No se pudo generar el quiz con IA:", error);
      toast.error(
        error instanceof ErrorIAVisible
          ? error.message
          : "No se pudo generar el quiz con IA en este momento. No se descontó ningún intento."
      );
    } finally {
      setGenerando(false);
    }
  };

  const modal =
    abierto && portalReady
      ? createPortal(
          generando ? (
            <CargadorIAFCC
              mensaje="Generando tu quiz"
              frases={[
                "Analizando el contenido seleccionado…",
                "Creando nuevas preguntas…",
                "Preparando opciones de respuesta…",
                "Dando forma al borrador…",
              ]}
            />
          ) : borradorListo ? (
            <AvisoIAFCC
              etiqueta="Borrador generado"
              titulo="Tu quiz está listo para revisarse"
              descripcion="La IA puede cometer errores. Lee cada pregunta y confirma que las respuestas sean correctas antes de guardar el quiz."
              nota="Todo el contenido seguirá siendo editable."
              textoPrincipal="Entendido"
              onPrincipal={() => {
                setBorradorListo(false);
                setAbierto(false);
              }}
            />
          ) : (
            <div className="generador-quiz-ia-overlay fcc-modal-backdrop-enter-standard">
            <style>{`
              .generador-quiz-ia-overlay {
                position: fixed;
                inset: 0;
                z-index: 10020;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: color-mix(in srgb, #06152f 58%, transparent);
                backdrop-filter: blur(8px);
              }

              .generador-quiz-ia-modal {
                width: min(760px, 100%);
                max-height: min(940px, calc(100dvh - 24px));
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border-radius: 28px;
                color: var(--fcc-premium-text);
                background: var(--fcc-premium-surface);
                border: 1px solid var(--fcc-premium-border-strong);
                box-shadow: var(--fcc-premium-shadow);
              }

              .generador-quiz-ia-header,
              .generador-quiz-ia-body,
              .generador-quiz-ia-actions {
                padding: 24px 28px;
              }

              .generador-quiz-ia-header {
                position: relative;
                flex: 0 0 auto;
                text-align: center;
                border-bottom: 1px solid var(--fcc-premium-border);
              }

              .generador-quiz-ia-kicker {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                color: var(--fcc-premium-accent);
                font-weight: 800;
                font-size: .78rem;
                letter-spacing: .12em;
                text-transform: uppercase;
              }

              .generador-quiz-ia-header h3 {
                margin: 8px 42px 5px;
                font-size: clamp(1.35rem, 3vw, 2rem);
              }

              .generador-quiz-ia-header p,
              .generador-quiz-ia-note,
              .generador-quiz-ia-section span {
                color: var(--fcc-premium-muted);
              }

              .generador-quiz-ia-close {
                position: absolute;
                top: 18px;
                right: 18px;
                width: 38px;
                height: 38px;
                display: grid;
                place-items: center;
                border: 0;
                border-radius: 999px;
                color: white;
                background: #ef4444;
                cursor: pointer;
              }

              .generador-quiz-ia-body {
                flex: 1 1 auto;
                min-height: 0;
                display: grid;
                gap: 20px;
                overflow-y: auto;
                overflow-x: hidden;
                overscroll-behavior: contain;
                scrollbar-width: thin;
                scrollbar-color:
                  color-mix(in srgb, var(--fcc-premium-accent) 38%, transparent)
                  transparent;
              }

              .generador-quiz-ia-body::-webkit-scrollbar {
                width: 9px;
              }

              .generador-quiz-ia-body::-webkit-scrollbar-track {
                background: transparent;
                margin-block: 10px;
              }

              .generador-quiz-ia-body::-webkit-scrollbar-thumb {
                border: 2px solid transparent;
                border-radius: 999px;
                background:
                  color-mix(in srgb, var(--fcc-premium-accent) 38%, transparent)
                  padding-box;
              }

              .generador-quiz-ia-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
              }

              .generador-quiz-ia-field,
              .generador-quiz-ia-section {
                display: grid;
                gap: 8px;
              }

              .generador-quiz-ia-field label,
              .generador-quiz-ia-section strong {
                font-size: .82rem;
                font-weight: 800;
              }

              .generador-quiz-ia-input,
              .generador-quiz-ia-select,
              .generador-quiz-ia-textarea {
                width: 100%;
                border-radius: 14px;
                border: 1px solid var(--fcc-premium-border);
                background: var(--fcc-premium-surface-strong);
                color: var(--fcc-premium-text);
                padding: 12px 14px;
              }

              .generador-quiz-ia-textarea {
                min-height: 90px;
                resize: vertical;
              }

              .generador-quiz-ia-context-list {
                display: grid;
                gap: 8px;
              }

              .generador-quiz-ia-context {
                display: flex;
                align-items: center;
                gap: 11px;
                padding: 12px 14px;
                border-radius: 14px;
                border: 1px solid var(--fcc-premium-border);
                background: var(--fcc-premium-surface-soft);
                cursor: pointer;
              }

              .generador-quiz-ia-context.main {
                border-color: color-mix(in srgb, var(--fcc-premium-accent) 45%, var(--fcc-premium-border));
              }

              .generador-quiz-ia-context-note {
                margin: 2px 0 0;
                color: var(--fcc-premium-muted);
                font-size: .78rem;
                font-weight: 700;
                line-height: 1.48;
              }

              .generador-quiz-ia-warning {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                padding: 12px 14px;
                border-radius: 14px;
                color: color-mix(in srgb, #d97706 72%, var(--fcc-premium-text));
                background: color-mix(in srgb, #f59e0b 8%, var(--fcc-premium-surface));
                border: 1px solid color-mix(in srgb, #f59e0b 28%, var(--fcc-premium-border));
              }

              .generador-quiz-ia-actions {
                flex: 0 0 auto;
                display: flex;
                justify-content: center;
                gap: 10px;
                border-top: 1px solid var(--fcc-premium-border);
              }

              @media (max-width: 640px) {
                .generador-quiz-ia-overlay { padding: 8px; }
                .generador-quiz-ia-modal {
                  max-height: calc(100dvh - 16px);
                  border-radius: 22px;
                }
                .generador-quiz-ia-header,
                .generador-quiz-ia-body,
                .generador-quiz-ia-actions { padding: 18px; }
                .generador-quiz-ia-grid { grid-template-columns: 1fr; }
                .generador-quiz-ia-actions { flex-direction: column-reverse; }
              }
            `}</style>

            <div className="generador-quiz-ia-modal fcc-modal-enter-standard">
              <header className="generador-quiz-ia-header">
                <button
                  type="button"
                  className="generador-quiz-ia-close"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar generador"
                >
                  <X size={20} strokeWidth={2.6} />
                </button>

                <span className="generador-quiz-ia-kicker">
                  <Sparkles size={16} strokeWidth={2.5} />
                  Generador con IA
                </span>
                <h3>Crear borrador de quiz</h3>
                <p>
                  La IA utilizará solamente el contenido que selecciones y tú
                  podrás editar todo antes de guardarlo.
                </p>
              </header>

              <div className="generador-quiz-ia-body">
                <div className="generador-quiz-ia-grid">
                  <div className="generador-quiz-ia-field">
                    <label htmlFor="generador-cantidad">Preguntas</label>
                    <input
                      id="generador-cantidad"
                      className="generador-quiz-ia-input"
                      type="number"
                      min={1}
                      max={20}
                      value={cantidadPreguntas}
                      onChange={(event) =>
                        setCantidadPreguntas(
                          Math.min(20, Math.max(1, Number(event.target.value || 1)))
                        )
                      }
                    />
                  </div>

                  <div className="generador-quiz-ia-field">
                    <label htmlFor="generador-opciones">Opciones por pregunta</label>
                    <input
                      id="generador-opciones"
                      className="generador-quiz-ia-input"
                      type="number"
                      min={2}
                      max={6}
                      value={opcionesPorPregunta}
                      onChange={(event) =>
                        setOpcionesPorPregunta(
                          Math.min(6, Math.max(2, Number(event.target.value || 2)))
                        )
                      }
                    />
                  </div>
                </div>

                <div className="generador-quiz-ia-field">
                  <label htmlFor="generador-tipo">Tipo de preguntas</label>
                  <select
                    id="generador-tipo"
                    className="generador-quiz-ia-select"
                    value={tipoPreguntas}
                    onChange={(event) =>
                      setTipoPreguntas(event.target.value as TipoPreguntas)
                    }
                  >
                    <option value="automatico">Automático según el contenido</option>
                    <option value="conceptual">Conceptuales</option>
                    <option value="practico">Ejercicios prácticos</option>
                    <option value="mixto">Mixtas</option>
                  </select>
                </div>

                <section className="generador-quiz-ia-section">
                  <strong>Contenido académico</strong>
                  <span>
                    {unidadPrincipal
                      ? `Unidad ${unidadPrincipal.numero}${
                          unidadPrincipal.nombre ? ` - ${unidadPrincipal.nombre}` : ""
                        }`
                      : "Bloques disponibles"}
                  </span>

                  <div className="generador-quiz-ia-context-list">
                    {bloquesDisponibles.map((bloque) => {
                      const principal = bloque.id === bloquePrincipalId;
                      const seleccionado =
                        principal || bloquesSeleccionados.includes(bloque.id);

                      return (
                        <label
                          key={bloque.id}
                          className={`generador-quiz-ia-context ${
                            principal ? "main" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            disabled={principal}
                            onChange={() => alternarBloque(bloque.id)}
                          />
                          <span>
                            {bloque.titulo?.trim() || "Bloque sin título"}
                            {principal ? " - principal" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="generador-quiz-ia-context-note">
                    {bloquesSeleccionados.length}/{MAX_BLOQUES_CONTEXTO} bloques seleccionados.
                    Sólo se enviarán texto y fórmulas LaTeX; no se enviarán imágenes,
                    videos, PDFs, documentos ni enlaces externos.
                  </p>
                </section>

                <div className="generador-quiz-ia-field">
                  <label htmlFor="generador-instrucciones">
                    Indicaciones adicionales (opcional)
                  </label>
                  <textarea
                    id="generador-instrucciones"
                    className="generador-quiz-ia-textarea"
                    maxLength={1200}
                    value={instrucciones}
                    onChange={(event) => setInstrucciones(event.target.value)}
                    placeholder="Ej. Da prioridad a ejercicios de aplicación y evita preguntas de memorización."
                  />
                </div>

                {hayBorrador && (
                  <div className="generador-quiz-ia-warning">
                    <AlertTriangle size={19} strokeWidth={2.4} />
                    <span>
                      Al aplicar una nueva generación se reemplazarán las preguntas
                      que actualmente están en el formulario sin guardar.
                    </span>
                  </div>
                )}

                <p className="generador-quiz-ia-note">
                  Generaciones disponibles en este borrador: {Math.max(0, 3 - intentosUsados)} de 3.
                </p>
              </div>

              <footer className="generador-quiz-ia-actions">
                <button
                  type="button"
                  className="constructor-quiz-button add-action"
                  onClick={() => setAbierto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="constructor-quiz-button ai-launch"
                  disabled={generando || intentosUsados >= 3}
                  onClick={() => void generar()}
                >
                  <Check size={17} strokeWidth={2.6} />
                  {hayBorrador ? "Generar y reemplazar" : "Generar borrador"}
                </button>
              </footer>
            </div>

          </div>
          ),
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="constructor-quiz-button ai-launch"
      >
        <Sparkles size={17} strokeWidth={2.6} />
        Generar con IA
      </button>
      {modal}
    </>
  );
}
