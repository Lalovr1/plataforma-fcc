"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Save, Trash2 } from "lucide-react";

export interface Carrera {
  id: number;
  nombre: string;
}

export interface Seccion {
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

type ModoCarreraModal = "agregar" | "editar";

interface Props {
  open: boolean;
  onClose: () => void;
  carrera: CursoCarrera | null;
  carrerasDisponibles: Carrera[];
  onSave: (carrera: CursoCarrera) => void | boolean | Promise<void | boolean>;
  modo?: ModoCarreraModal;
  closeOnBackdrop?: boolean;
  carrerasYaAgregadas?: CursoCarrera[];
  carreraActualIndex?: number | null;
}

export function crearCarreraInicial(): CursoCarrera {
  return {
    carrera_id: null,
    semestre: null,
    area: "Ciencias Básicas",
    periodos: [
      {
        nombre: "Primavera",
        anio: new Date().getFullYear(),
        secciones: [],
      },
    ],
  };
}

export function clonarCursoCarrera(carrera: CursoCarrera): CursoCarrera {
  return {
    ...carrera,
    periodos: carrera.periodos.map((periodo) => ({
      ...periodo,
      secciones: periodo.secciones.map((seccion) => ({ ...seccion })),
    })),
  };
}

type ValidarCursoCarreraOptions = {
  carrerasExistentes?: CursoCarrera[];
  ignorarIndex?: number | null;
};

function normalizarTexto(valor: string) {
  return valor.trim().toLowerCase();
}

function periodoKey(periodo: Periodo) {
  return `${periodo.nombre}-${Number(periodo.anio)}`;
}

export function validarCursoCarrera(
  carrera: CursoCarrera,
  options: ValidarCursoCarreraOptions = {}
): string | null {
  if (!carrera.carrera_id) {
    return "Selecciona una carrera.";
  }

  if (!carrera.semestre) {
    return "Selecciona un semestre.";
  }

  if (!carrera.area.trim()) {
    return "Selecciona un área.";
  }

  if (carrera.periodos.length === 0) {
    return "Agrega al menos un período.";
  }

  if (carrera.periodos.some((periodo) => !periodo.anio || periodo.anio < 2000)) {
    return "Revisa el año de los períodos.";
  }

  const periodoKeys = new Set<string>();

  for (const periodo of carrera.periodos) {
    const key = periodoKey(periodo);

    if (periodoKeys.has(key)) {
      return `No repitas ${periodo.nombre} ${periodo.anio}. Agrega sus secciones dentro de ese mismo período.`;
    }

    periodoKeys.add(key);
  }

  if (carrera.periodos.some((periodo) => periodo.secciones.length === 0)) {
    return "Cada período necesita al menos una sección.";
  }

  if (
    carrera.periodos.some((periodo) =>
      periodo.secciones.some((seccion) => !seccion.nombre.trim())
    )
  ) {
    return "Completa el nombre de todas las secciones.";
  }

  for (const periodo of carrera.periodos) {
    const secciones = new Set<string>();

    for (const seccion of periodo.secciones) {
      const nombre = normalizarTexto(seccion.nombre);

      if (secciones.has(nombre)) {
        return `No repitas la sección "${seccion.nombre.trim()}" dentro de ${periodo.nombre} ${periodo.anio}.`;
      }

      secciones.add(nombre);
    }
  }

  const carreraDuplicada = options.carrerasExistentes?.some(
    (carreraExistente, index) => {
      const esMismaPorIndex =
        options.ignorarIndex !== null &&
        options.ignorarIndex !== undefined &&
        index === options.ignorarIndex;

      const esMismaPorId =
        Boolean(carrera.id) && Boolean(carreraExistente.id) && carrera.id === carreraExistente.id;

      if (esMismaPorIndex || esMismaPorId) return false;

      return (
        carreraExistente.carrera_id === carrera.carrera_id &&
        carreraExistente.semestre === carrera.semestre
      );
    }
  );

  if (carreraDuplicada) {
    return "Ya existe esta carrera para el mismo semestre. Edita la existente o usa un semestre diferente.";
  }

  return null;
}

export function normalizarCursoCarrera(carrera: CursoCarrera): CursoCarrera {
  return {
    ...carrera,
    area: carrera.area.trim(),
    periodos: carrera.periodos.map((periodo) => ({
      ...periodo,
      anio: Number(periodo.anio),
      secciones: periodo.secciones.map((seccion) => ({
        ...seccion,
        nombre: seccion.nombre.trim(),
      })),
    })),
  };
}

export default function EditarCarreraModal({
  open,
  onClose,
  carrera,
  carrerasDisponibles,
  onSave,
  modo = "editar",
  closeOnBackdrop = false,
  carrerasYaAgregadas = [],
  carreraActualIndex = null,
}: Props) {
  const [localCarrera, setLocalCarrera] = useState<CursoCarrera | null>(
    carrera ? clonarCursoCarrera(carrera) : null
  );
  const [portalReady, setPortalReady] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open || !carrera) return;

    setLocalCarrera(clonarCursoCarrera(carrera));
    setValidationMessage("");
  }, [open, carrera]);

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

  const actualizarCarrera = (patch: Partial<CursoCarrera>) => {
    setLocalCarrera((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handlePeriodoChange = (index: number, patch: Partial<Periodo>) => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: prev.periodos.map((periodo, periodoIndex) =>
          periodoIndex === index ? { ...periodo, ...patch } : periodo
        ),
      };
    });
  };

  const addPeriodo = () => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: [
          ...prev.periodos,
          {
            nombre: "Primavera",
            anio: new Date().getFullYear(),
            secciones: [],
          },
        ],
      };
    });
  };

  const removePeriodo = (index: number) => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: prev.periodos.filter((_, periodoIndex) => periodoIndex !== index),
      };
    });
  };

  const addSeccion = (periodoIndex: number) => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: prev.periodos.map((periodo, index) =>
          index === periodoIndex
            ? {
                ...periodo,
                secciones: [...periodo.secciones, { nombre: "" }],
              }
            : periodo
        ),
      };
    });
  };

  const updateSeccion = (
    periodoIndex: number,
    seccionIndex: number,
    nombre: string
  ) => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: prev.periodos.map((periodo, index) =>
          index === periodoIndex
            ? {
                ...periodo,
                secciones: periodo.secciones.map((seccion, sectionIndex) =>
                  sectionIndex === seccionIndex
                    ? { ...seccion, nombre }
                    : seccion
                ),
              }
            : periodo
        ),
      };
    });
  };

  const removeSeccion = (periodoIndex: number, seccionIndex: number) => {
    setLocalCarrera((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        periodos: prev.periodos.map((periodo, index) =>
          index === periodoIndex
            ? {
                ...periodo,
                secciones: periodo.secciones.filter(
                  (_, sectionIndex) => sectionIndex !== seccionIndex
                ),
              }
            : periodo
        ),
      };
    });
  };

  const handleSave = async () => {
    if (!localCarrera) return;

    const error = validarCursoCarrera(localCarrera, {
      carrerasExistentes: carrerasYaAgregadas,
      ignorarIndex: carreraActualIndex,
    });

    if (error) {
      setValidationMessage(error);
      return;
    }

    setValidationMessage("");
    setGuardando(true);

    try {
      const carreraNormalizada = normalizarCursoCarrera(localCarrera);
      const resultado = await onSave(carreraNormalizada);

      if (resultado === false) return;

      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = () => {
    if (guardando) return;
    onClose();
  };

  return createPortal(
    <div
      className="editar-carrera-overlay"
      onClick={() => {
        if (closeOnBackdrop) cerrar();
      }}
    >
      <style>{`
        .editar-carrera-overlay {
          --carrera-accent: var(--fcc-premium-accent, var(--color-accent));
          --carrera-accent-hover: var(--fcc-premium-accent-hover, var(--fcc-premium-accent, var(--color-accent)));
          --carrera-cyan: var(--fcc-premium-cyan, var(--color-accent));
          --carrera-surface: var(--fcc-premium-surface, var(--color-card));
          --carrera-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --carrera-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
          --carrera-text: var(--fcc-premium-text, var(--color-text));
          --carrera-text-soft: var(--fcc-premium-text-soft, var(--color-text));
          --carrera-muted: var(--fcc-premium-muted, var(--color-muted));
          --carrera-border: var(--fcc-premium-border, var(--color-border));
          --carrera-border-strong: var(--fcc-premium-border-strong, var(--color-border));
          --carrera-shadow: var(--fcc-premium-shadow, 0 24px 70px rgba(2, 8, 23, 0.2));
          --carrera-button: var(--fcc-premium-button, var(--fcc-premium-accent, var(--color-accent)));
          --carrera-danger: var(--color-danger, #ef4444);

          position: fixed;
          inset: 0;
          z-index: 24000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(8px);
        }

        .editar-carrera-modal {
          position: relative;
          width: min(94vw, 760px);
          max-height: 90dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 30px;
          clip-path: inset(0 round 30px);
          padding: 0;
          color: var(--carrera-text);
          background:
            radial-gradient(
              circle at 50% 0%,
              color-mix(in srgb, var(--carrera-accent) 7%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--carrera-surface),
              var(--carrera-surface-soft)
            );
          border: 1px solid color-mix(in srgb, var(--carrera-accent) 16%, var(--carrera-border));
          box-shadow:
            var(--carrera-shadow),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--carrera-surface-strong) 68%,
              transparent
            );
         }

        .editar-carrera-scroll::-webkit-scrollbar {
          width: 10px;
        }

        .editar-carrera-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 18px 0;
        }

        .editar-carrera-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--carrera-accent) 42%,
            transparent
          );
          border: 3px solid transparent;
          background-clip: padding-box;
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
          opacity: 0.22;
        }

        .editar-carrera-scroll {
          position: relative;
          z-index: 2;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: clamp(18px, 3vw, 28px);
          scrollbar-width: thin;
          scrollbar-color: color-mix(
            in srgb,
            var(--carrera-accent) 42%,
            transparent
          ) transparent;
        }

        .editar-carrera-content {
          position: relative;
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .editar-carrera-header {
          display: grid;
          justify-items: center;
          gap: 8px;
          padding-right: 0;
          padding-left: 0;
          text-align: center;
        }

        .editar-carrera-title {
          margin: 0;
          color: var(--carrera-text);
          font-size: clamp(1.6rem, 3vw, 2.4rem);
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .editar-carrera-subtitle {
          margin: 0;
          max-width: 560px;
          color: var(--carrera-muted);
          font-size: 0.94rem;
          font-weight: 750;
          line-height: 1.45;
        }

        .editar-carrera-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .editar-carrera-field.carrera-field {
          grid-column: 1 / -1;
        }

        .editar-carrera-field {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .editar-carrera-label {
          color: var(--carrera-text-soft);
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .editar-carrera-input,
        .editar-carrera-select {
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
          padding: 0 13px;
          color: var(--carrera-text);
          background: color-mix(in srgb, var(--carrera-surface-strong) 74%, transparent);
          border: 1px solid var(--carrera-border);
          outline: none;
          font-size: 0.92rem;
          font-weight: 800;
          transition:
            border-color 170ms ease,
            background 170ms ease,
            box-shadow 170ms ease;
        }

        .editar-carrera-input::placeholder {
          color: var(--carrera-muted);
          opacity: 0.8;
        }

        .editar-carrera-input:focus,
        .editar-carrera-select:focus {
          border-color: color-mix(in srgb, var(--carrera-accent) 56%, var(--carrera-border));
          background: color-mix(in srgb, var(--carrera-surface-strong) 90%, transparent);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--carrera-accent) 10%, transparent);
        }

        .editar-carrera-periods-head {
          display: grid;
          justify-items: start;
          gap: 10px;
          margin-top: 2px;
        }

        .editar-carrera-period-add-bottom {
          display: flex;
          justify-content: flex-start;
        }

        .editar-carrera-section-title {
          margin: 0;
          color: var(--carrera-text);
          font-size: 1rem;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .editar-carrera-periods {
          display: grid;
          gap: 10px;
        }

        .editar-carrera-period-card {
          display: grid;
          gap: 10px;
          border-radius: 18px;
          padding: 14px;
          background: color-mix(in srgb, var(--carrera-surface-strong) 68%, transparent);
          border: 1px solid var(--carrera-border);
        }

        .editar-carrera-period-row,
        .editar-carrera-section-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 110px auto;
          gap: 8px;
          align-items: center;
        }

        .editar-carrera-section-row {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .editar-carrera-sections {
          display: grid;
          gap: 8px;
          padding-left: 12px;
          border-left: 2px solid color-mix(in srgb, var(--carrera-accent) 16%, var(--carrera-border));
        }

        .editar-carrera-empty {
          margin: 0;
          border-radius: 16px;
          padding: 12px 14px;
          color: var(--carrera-muted);
          background: color-mix(in srgb, var(--carrera-surface-strong) 58%, transparent);
          border: 1px dashed color-mix(in srgb, var(--carrera-accent) 20%, var(--carrera-border));
          font-size: 0.86rem;
          font-weight: 750;
          text-align: center;
        }

        .editar-carrera-warning {
          border-radius: 18px;
          padding: 12px 14px;
          color: var(--carrera-danger);
          background: color-mix(in srgb, var(--carrera-danger) 8%, var(--carrera-surface));
          border: 1px solid color-mix(in srgb, var(--carrera-danger) 26%, var(--carrera-border));
          font-size: 0.88rem;
          font-weight: 850;
          line-height: 1.4;
          text-align: center;
        }

        .editar-carrera-actions,
        .editar-carrera-inline-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 4px;
        }

        .editar-carrera-footer-actions {
          position: relative;
          z-index: 3;
          flex: 0 0 auto;
          margin: 0;
          padding: 14px clamp(18px, 3vw, 28px) calc(18px + env(safe-area-inset-bottom));
          background: var(--carrera-surface);
          border-top: 1px solid color-mix(in srgb, var(--carrera-accent) 12%, var(--carrera-border));
          box-shadow:
            0 -14px 34px rgba(15, 23, 42, 0.1),
            inset 0 1px 0 color-mix(in srgb, var(--carrera-surface-strong) 80%, transparent);
        }

        .editar-carrera-inline-actions {
          justify-content: flex-start;
          padding-top: 0;
        }

        .editar-carrera-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          padding: 0 14px;
          color: var(--carrera-text);
          background: color-mix(in srgb, var(--carrera-surface-strong) 82%, transparent);
          border: 1px solid var(--carrera-border);
          font-size: 0.84rem;
          font-weight: 950;
          white-space: nowrap;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease,
            opacity 170ms ease;
        }

        .editar-carrera-button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: var(--carrera-border-strong);
        }

        .editar-carrera-button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
          transform: none;
        }

        .editar-carrera-button.primary {
          color: #ffffff;
          background: var(--carrera-button);
          border-color: transparent;
        }

        .theme-oscuro .editar-carrera-button.primary {
          color: #050505;
        }

        .editar-carrera-button.soft {
          color: var(--carrera-accent);
          background: color-mix(in srgb, var(--carrera-accent) 8%, transparent);
          border-color: color-mix(in srgb, var(--carrera-accent) 22%, var(--carrera-border));
        }

        .editar-carrera-button.danger {
          color: #ffffff;
          background: var(--carrera-danger);
          border-color: color-mix(in srgb, var(--carrera-danger) 70%, white);
        }

        .editar-carrera-icon-button {
          min-width: 38px;
          width: 38px;
          padding: 0;
        }

        @media (max-width: 760px) {
          .editar-carrera-overlay {
            padding: 12px;
          }

          .editar-carrera-modal {
            width: min(100%, 760px);
            max-height: 92dvh;
            border-radius: 26px;
            clip-path: inset(0 round 26px);
          }

          .editar-carrera-scroll {
            padding: 18px 16px;
          }

          .editar-carrera-footer-actions {
            padding: 12px 16px calc(18px + env(safe-area-inset-bottom));
          }

          .editar-carrera-header {
            padding-right: 0;
            padding-left: 0;
          }

          .editar-carrera-grid,
          .editar-carrera-period-row,
          .editar-carrera-section-row {
            grid-template-columns: 1fr;
          }

          .editar-carrera-periods-head,
          .editar-carrera-period-add-bottom,
          .editar-carrera-actions,
          .editar-carrera-inline-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .editar-carrera-sections {
            padding-left: 0;
            border-left: 0;
          }

          .editar-carrera-button,
          .editar-carrera-icon-button {
            width: 100%;
          }
        }
      `}</style>

      <div
        className="editar-carrera-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="editar-carrera-scroll">
          <div className="editar-carrera-content">
          <div className="editar-carrera-header">
            <h2 className="editar-carrera-title">
              {modo === "agregar" ? "Agregar carrera" : "Editar carrera"}
            </h2>

            <p className="editar-carrera-subtitle">
              {modo === "agregar"
                ? "Define la carrera, semestre, área, períodos y secciones disponibles para este curso."
                : "Ajusta la carrera, semestre, área, períodos y secciones ligadas a este curso."}
            </p>
          </div>

          <div className="editar-carrera-grid">
            <div className="editar-carrera-field carrera-field">
              <label className="editar-carrera-label">Carrera</label>

              <select
                value={localCarrera.carrera_id || ""}
                onChange={(e) =>
                  actualizarCarrera({
                    carrera_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="editar-carrera-select"
              >
                <option value="">Seleccione carrera</option>

                {carrerasDisponibles.map((carreraDisponible) => (
                  <option key={carreraDisponible.id} value={carreraDisponible.id}>
                    {carreraDisponible.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="editar-carrera-field">
              <label className="editar-carrera-label">Semestre</label>

              <select
                value={localCarrera.semestre || ""}
                onChange={(e) =>
                  actualizarCarrera({
                    semestre: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="editar-carrera-select"
              >
                <option value="">Seleccione semestre</option>

                {Array.from({ length: 10 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Semestre {index + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="editar-carrera-field">
              <label className="editar-carrera-label">Área</label>

              <select
                value={localCarrera.area}
                onChange={(e) =>
                  actualizarCarrera({
                    area: e.target.value,
                  })
                }
                className="editar-carrera-select"
              >
                <option value="Ciencias Básicas">Ciencias Básicas</option>
                <option value="Computación">Computación</option>
              </select>
            </div>
          </div>

          <div className="editar-carrera-periods-head">
            <h3 className="editar-carrera-section-title">Períodos</h3>
          </div>

          <div className="editar-carrera-periods">
            {localCarrera.periodos.length === 0 && (
              <p className="editar-carrera-empty">
                Aún no hay períodos configurados.
              </p>
            )}

            {localCarrera.periodos.map((periodo, periodoIndex) => (
              <div key={periodo.id ?? periodoIndex} className="editar-carrera-period-card">
                <div className="editar-carrera-period-row">
                  <select
                    value={periodo.nombre}
                    onChange={(e) =>
                      handlePeriodoChange(periodoIndex, {
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
                    value={periodo.anio}
                    onChange={(e) =>
                      handlePeriodoChange(periodoIndex, {
                        anio: Number(e.target.value),
                      })
                    }
                    className="editar-carrera-input"
                    placeholder="Año"
                  />

                  <button
                    type="button"
                    onClick={() => removePeriodo(periodoIndex)}
                    className="editar-carrera-button danger editar-carrera-icon-button"
                    aria-label="Eliminar período"
                    title="Eliminar período"
                  >
                    <Trash2 size={16} strokeWidth={2.6} />
                  </button>
                </div>

                <div className="editar-carrera-sections">
                  {periodo.secciones.length === 0 && (
                    <p className="editar-carrera-empty">
                      Sin secciones agregadas.
                    </p>
                  )}

                  {periodo.secciones.map((seccion, seccionIndex) => (
                    <div
                      key={seccion.id ?? seccionIndex}
                      className="editar-carrera-section-row"
                    >
                      <input
                        type="text"
                        value={seccion.nombre}
                        onChange={(e) =>
                          updateSeccion(
                            periodoIndex,
                            seccionIndex,
                            e.target.value
                          )
                        }
                        className="editar-carrera-input"
                        placeholder="Nombre sección"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeSeccion(periodoIndex, seccionIndex)
                        }
                        className="editar-carrera-button danger editar-carrera-icon-button"
                        aria-label="Eliminar sección"
                        title="Eliminar sección"
                      >
                        <Trash2 size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  ))}

                  <div className="editar-carrera-inline-actions">
                    <button
                      type="button"
                      onClick={() => addSeccion(periodoIndex)}
                      className="editar-carrera-button soft"
                    >
                      <Plus size={16} strokeWidth={2.6} />
                      Agregar sección
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="editar-carrera-period-add-bottom">
            <button
              type="button"
              onClick={addPeriodo}
              className="editar-carrera-button soft"
            >
              <Plus size={16} strokeWidth={2.6} />
              Agregar período
            </button>
          </div>

          {validationMessage && (
            <div className="editar-carrera-warning">{validationMessage}</div>
          )}

        </div>
        </div>

        <div className="editar-carrera-actions editar-carrera-footer-actions">
          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className="editar-carrera-button"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={guardando}
            className="editar-carrera-button primary"
          >
            <Save size={16} strokeWidth={2.6} />
            {modo === "agregar" ? "Guardar carrera" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
