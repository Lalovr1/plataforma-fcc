"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Seccion {
  id?: string;
  nombre: string;
}

export interface Periodo {
  id?: string;
  nombre: "Primavera" | "Verano" | "Otoño";
  anio: number;
  secciones: Seccion[];
}

export interface CursoCarrera {
  id?: string;
  carrera_id: number | null;
  semestre: number | null;
  area: string;
  periodos: Periodo[];
}

interface Carrera {
  id: number;
  nombre: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  carrera: CursoCarrera | null;
  carrerasDisponibles: Carrera[];
  onSave: (carrera: CursoCarrera) => void;
}

export default function EditarCarreraModal({
  open,
  onClose,
  carrera,
  carrerasDisponibles,
  onSave,
}: Props) {
  const [localCarrera, setLocalCarrera] = useState<CursoCarrera | null>(carrera);
  const [portalReady, setPortalReady] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    setLocalCarrera(carrera);
    setValidationMessage("");
  }, [carrera]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !localCarrera || !portalReady || typeof document === "undefined") {
    return null;
  }

  const handlePeriodoChange = (idx: number, patch: Partial<Periodo>) => {
    setLocalCarrera({
      ...localCarrera,
      periodos: localCarrera.periodos.map((p, i) =>
        i === idx ? { ...p, ...patch } : p
      ),
    });
  };

  const handleSeccionChange = (pIdx: number, sIdx: number, nombre: string) => {
    setLocalCarrera({
      ...localCarrera,
      periodos: localCarrera.periodos.map((p, i) =>
        i === pIdx
          ? {
              ...p,
              secciones: p.secciones.map((s, j) =>
                j === sIdx ? { ...s, nombre } : s
              ),
            }
          : p
      ),
    });
  };

  const addPeriodo = () => {
    setLocalCarrera({
      ...localCarrera,
      periodos: [
        ...localCarrera.periodos,
        {
          nombre: "Primavera",
          anio: new Date().getFullYear(),
          secciones: [],
        },
      ],
    });
  };

  const removePeriodo = (idx: number) => {
    setLocalCarrera({
      ...localCarrera,
      periodos: localCarrera.periodos.filter((_, i) => i !== idx),
    });
  };

  const addSeccion = (pIdx: number) => {
    setLocalCarrera({
      ...localCarrera,
      periodos: localCarrera.periodos.map((p, i) =>
        i === pIdx
          ? { ...p, secciones: [...p.secciones, { nombre: "" }] }
          : p
      ),
    });
  };

  const removeSeccion = (pIdx: number, sIdx: number) => {
    setLocalCarrera({
      ...localCarrera,
      periodos: localCarrera.periodos.map((p, i) =>
        i === pIdx
          ? {
              ...p,
              secciones: p.secciones.filter((_, j) => j !== sIdx),
            }
          : p
      ),
    });
  };

  const handleSave = () => {
    if (!localCarrera.carrera_id || !localCarrera.semestre) {
      setValidationMessage("Debes seleccionar una carrera y un semestre.");
      return;
    }

    setValidationMessage("");
    onSave(localCarrera);
    onClose();
  };

  return createPortal(
    <div className="editar-carrera-overlay">
      <style>{`
        .editar-carrera-overlay {
          --carrera-accent: var(--fcc-premium-accent, var(--color-accent));
          --carrera-cyan: var(--fcc-premium-cyan, var(--color-accent));
          --carrera-surface: var(--fcc-premium-surface, var(--color-card));
          --carrera-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --carrera-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
          --carrera-text: var(--fcc-premium-text, var(--color-text));
          --carrera-muted: var(--fcc-premium-muted, var(--color-muted));
          --carrera-border: var(--fcc-premium-border, var(--color-border));
          --carrera-shadow: var(--fcc-premium-shadow, 0 24px 70px rgba(2, 8, 23, 0.2));
          --carrera-danger: var(--color-danger, #ef4444);

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

        .editar-carrera-modal {
          position: relative;
          width: min(94vw, 760px);
          max-height: 90dvh;
          overflow-y: auto;
          border-radius: 28px;
          padding: clamp(18px, 3vw, 26px);
          color: var(--carrera-text);
          background:
            radial-gradient(
              circle at 50% 0%,
              color-mix(in srgb, var(--carrera-accent) 6%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--carrera-surface),
              var(--carrera-surface-soft)
            );
          border: 1px solid color-mix(in srgb, var(--carrera-accent) 16%, var(--carrera-border));
          box-shadow: var(--carrera-shadow);
        }

        .editar-carrera-modal::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid, rgba(99, 102, 241, 0.08)) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at 50% 0%, black, transparent 72%);
          opacity: 0.2;
        }

        .editar-carrera-content {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .editar-carrera-header {
          display: grid;
          justify-items: center;
          gap: 6px;
          text-align: center;
        }

        .editar-carrera-title {
          margin: 0;
          color: var(--carrera-text);
          font-size: clamp(1.45rem, 3vw, 1.85rem);
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .editar-carrera-subtitle {
          margin: 0;
          max-width: 440px;
          color: var(--carrera-muted);
          font-size: 0.9rem;
          font-weight: 750;
          line-height: 1.4;
        }

        .editar-carrera-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .editar-carrera-field {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editar-carrera-label {
          color: var(--carrera-muted);
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-align: center;
          text-transform: uppercase;
        }

        .editar-carrera-input,
        .editar-carrera-select {
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
          padding: 0 12px;
          color: var(--carrera-text);
          background: color-mix(in srgb, var(--carrera-surface-strong) 74%, transparent);
          border: 1px solid var(--carrera-border);
          outline: none;
          font-size: 0.9rem;
          font-weight: 800;
          text-align: center;
          text-align-last: center;
          transition:
            border-color 170ms ease,
            background 170ms ease;
        }

        .editar-carrera-input:focus,
        .editar-carrera-select:focus {
          border-color: color-mix(in srgb, var(--carrera-accent) 52%, var(--carrera-border));
          background: color-mix(in srgb, var(--carrera-surface-strong) 90%, transparent);
        }

        .editar-carrera-section {
          display: grid;
          gap: 10px;
        }

        .editar-carrera-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .editar-carrera-section-title {
          margin: 0;
          color: var(--carrera-text);
          font-size: 0.98rem;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .editar-carrera-periodos {
          display: grid;
          gap: 10px;
        }

        .editar-carrera-periodo {
          display: grid;
          gap: 10px;
          border-radius: 20px;
          padding: 12px;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--carrera-surface-strong) 72%, transparent),
              color-mix(in srgb, var(--carrera-surface-soft) 88%, transparent)
            );
          border: 1px solid var(--carrera-border);
        }

        .editar-carrera-periodo-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(96px, 130px) auto;
          gap: 10px;
          align-items: center;
        }

        .editar-carrera-secciones {
          display: grid;
          gap: 8px;
          padding-left: 12px;
          border-left: 2px solid color-mix(in srgb, var(--carrera-accent) 16%, var(--carrera-border));
        }

        .editar-carrera-seccion-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }

        .editar-carrera-empty {
          margin: 0;
          border-radius: 14px;
          padding: 10px 12px;
          color: var(--carrera-muted);
          background: color-mix(in srgb, var(--carrera-surface-strong) 52%, transparent);
          border: 1px dashed var(--carrera-border);
          font-size: 0.82rem;
          font-weight: 800;
          text-align: center;
        }

        .editar-carrera-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          padding: 0 14px;
          color: var(--carrera-text);
          background: color-mix(in srgb, var(--carrera-surface-strong) 78%, transparent);
          border: 1px solid var(--carrera-border);
          font-size: 0.82rem;
          font-weight: 950;
          white-space: nowrap;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease,
            opacity 170ms ease;
        }

        .editar-carrera-button:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--carrera-accent) 28%, var(--carrera-border));
        }

        .editar-carrera-button.primary {
          color: #ffffff;
          background: var(--carrera-accent);
          border-color: color-mix(in srgb, var(--carrera-accent) 64%, white);
        }

        .editar-carrera-button.soft {
          color: var(--carrera-accent);
          background: color-mix(in srgb, var(--carrera-accent) 7%, var(--carrera-surface-strong));
          border-color: color-mix(in srgb, var(--carrera-accent) 18%, var(--carrera-border));
        }

        .editar-carrera-button.danger {
          width: 38px;
          padding: 0;
          color: var(--carrera-danger);
          background: color-mix(in srgb, var(--carrera-danger) 7%, var(--carrera-surface-strong));
          border-color: color-mix(in srgb, var(--carrera-danger) 18%, var(--carrera-border));
        }

        .theme-oscuro .editar-carrera-button.primary {
          color: #050505;
        }

        .editar-carrera-warning {
          border-radius: 16px;
          padding: 11px 12px;
          color: var(--carrera-danger);
          background: color-mix(in srgb, var(--carrera-danger) 8%, var(--carrera-surface));
          border: 1px solid color-mix(in srgb, var(--carrera-danger) 26%, var(--carrera-border));
          font-size: 0.88rem;
          font-weight: 850;
          text-align: center;
        }

        .editar-carrera-actions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 2px;
        }

        @media (max-width: 760px) {
          .editar-carrera-grid {
            grid-template-columns: 1fr;
          }

          .editar-carrera-periodo-row,
          .editar-carrera-seccion-row {
            grid-template-columns: 1fr;
          }

          .editar-carrera-secciones {
            padding-left: 0;
            border-left: 0;
          }

          .editar-carrera-button,
          .editar-carrera-button.danger {
            width: 100%;
          }

          .editar-carrera-section-head,
          .editar-carrera-actions {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="editar-carrera-modal" role="dialog" aria-modal="true">
        <div className="editar-carrera-content">
          <div className="editar-carrera-header">
            <h2 className="editar-carrera-title">Editar carrera</h2>
            <p className="editar-carrera-subtitle">
              Ajusta la carrera, semestre, área, períodos y secciones ligadas a este curso.
            </p>
          </div>

          <div className="editar-carrera-grid">
            {/* Carrera */}
            <div className="editar-carrera-field">
              <label className="editar-carrera-label">Carrera</label>
              <select
                value={localCarrera.carrera_id || ""}
                onChange={(e) =>
                  setLocalCarrera({
                    ...localCarrera,
                    carrera_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="editar-carrera-select"
              >
                <option value="">Seleccione carrera</option>
                {carrerasDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Semestre */}
            <div className="editar-carrera-field">
              <label className="editar-carrera-label">Semestre</label>
              <select
                value={localCarrera.semestre || ""}
                onChange={(e) =>
                  setLocalCarrera({
                    ...localCarrera,
                    semestre: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="editar-carrera-select"
              >
                <option value="">Seleccione semestre</option>
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Semestre {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Área */}
            <div className="editar-carrera-field">
              <label className="editar-carrera-label">Área</label>
              <select
                value={localCarrera.area}
                onChange={(e) =>
                  setLocalCarrera({ ...localCarrera, area: e.target.value })
                }
                className="editar-carrera-select"
              >
                <option value="Ciencias Básicas">Ciencias Básicas</option>
                <option value="Computación">Computación</option>
              </select>
            </div>
          </div>

          {/* Períodos */}
          <div className="editar-carrera-section">
            <div className="editar-carrera-section-head">
              <h3 className="editar-carrera-section-title">Períodos</h3>

              <button
                type="button"
                onClick={addPeriodo}
                className="editar-carrera-button soft"
              >
                + Agregar período
              </button>
            </div>

            <div className="editar-carrera-periodos">
              {localCarrera.periodos.length === 0 && (
                <p className="editar-carrera-empty">
                  Aún no hay períodos configurados.
                </p>
              )}

              {localCarrera.periodos.map((p, pIdx) => (
                <div key={pIdx} className="editar-carrera-periodo">
                  <div className="editar-carrera-periodo-row">
                    <select
                      value={p.nombre}
                      onChange={(e) =>
                        handlePeriodoChange(pIdx, {
                          nombre: e.target.value as Periodo["nombre"],
                        })
                      }
                      className="editar-carrera-select"
                    >
                      <option value="Primavera">Primavera</option>
                      <option value="Verano">Verano</option>
                      <option value="Otoño">Otoño</option>
                    </select>

                    <input
                      type="number"
                      value={p.anio}
                      onChange={(e) =>
                        handlePeriodoChange(pIdx, {
                          anio: Number(e.target.value),
                        })
                      }
                      className="editar-carrera-input"
                    />

                    <button
                      type="button"
                      onClick={() => removePeriodo(pIdx)}
                      className="editar-carrera-button danger"
                      aria-label="Eliminar período"
                      title="Eliminar período"
                    >
                      ×
                    </button>
                  </div>

                  {/* Secciones */}
                  <div className="editar-carrera-secciones">
                    {p.secciones.length === 0 && (
                      <p className="editar-carrera-empty">
                        Sin secciones agregadas.
                      </p>
                    )}

                    {p.secciones.map((s, sIdx) => (
                      <div key={sIdx} className="editar-carrera-seccion-row">
                        <input
                          type="text"
                          value={s.nombre}
                          onChange={(e) =>
                            handleSeccionChange(pIdx, sIdx, e.target.value)
                          }
                          className="editar-carrera-input"
                          placeholder="Nombre sección"
                        />

                        <button
                          type="button"
                          onClick={() => removeSeccion(pIdx, sIdx)}
                          className="editar-carrera-button danger"
                          aria-label="Eliminar sección"
                          title="Eliminar sección"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addSeccion(pIdx)}
                      className="editar-carrera-button soft"
                    >
                      + Agregar sección
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {validationMessage && (
            <div className="editar-carrera-warning">{validationMessage}</div>
          )}

          {/* Botones */}
          <div className="editar-carrera-actions">
            <button
              type="button"
              onClick={onClose}
              className="editar-carrera-button"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="editar-carrera-button primary"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
