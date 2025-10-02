"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
    setLocalCarrera(carrera);
  }, [carrera]);

  if (!open || !localCarrera) return null;

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
      alert("Debes seleccionar una carrera y un semestre");
      return;
    }
    onSave(localCarrera);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-xl p-6 w-full max-w-2xl space-y-4"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>
          Editar carrera
        </h2>

        {/* Carrera */}
        <div>
          <label className="block text-sm mb-1">Carrera</label>
          <select
            value={localCarrera.carrera_id || ""}
            onChange={(e) =>
              setLocalCarrera({
                ...localCarrera,
                carrera_id: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
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
        <div>
          <label className="block text-sm mb-1">Semestre</label>
          <select
            value={localCarrera.semestre || ""}
            onChange={(e) =>
              setLocalCarrera({
                ...localCarrera,
                semestre: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
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
        <div>
          <label className="block text-sm mb-1">Área</label>
          <select
            value={localCarrera.area}
            onChange={(e) =>
              setLocalCarrera({ ...localCarrera, area: e.target.value })
            }
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <option value="Ciencias Básicas">Ciencias Básicas</option>
            <option value="Computación">Computación</option>
          </select>
        </div>

        {/* Períodos */}
        <div>
          <label className="block text-sm">Períodos</label>
          {localCarrera.periodos.map((p, pIdx) => (
            <div
              key={pIdx}
              className="p-3 rounded space-y-2 mb-2"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex gap-2 items-center">
                <select
                  value={p.nombre}
                  onChange={(e) =>
                    handlePeriodoChange(pIdx, {
                      nombre: e.target.value as Periodo["nombre"],
                    })
                  }
                  className="flex-1 p-1 rounded"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <option value="Primavera">Primavera</option>
                  <option value="Verano">Verano</option>
                  <option value="Otoño">Otoño</option>
                </select>
                <input
                  type="number"
                  value={p.anio}
                  onChange={(e) =>
                    handlePeriodoChange(pIdx, { anio: Number(e.target.value) })
                  }
                  className="w-24 p-1 rounded"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removePeriodo(pIdx)}
                  className="bg-red-600 px-2 rounded text-white"
                >
                  ❌
                </button>
              </div>

              {/* Secciones */}
              <div className="ml-4 space-y-1">
                {p.secciones.map((s, sIdx) => (
                  <div key={sIdx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={s.nombre}
                      onChange={(e) =>
                        handleSeccionChange(pIdx, sIdx, e.target.value)
                      }
                      className="flex-1 p-1 rounded"
                      placeholder="Nombre sección"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeSeccion(pIdx, sIdx)}
                      className="bg-red-600 px-2 rounded text-white"
                    >
                      ❌
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSeccion(pIdx)}
                  className="mt-1 bg-blue-600 px-2 rounded text-xs text-white"
                >
                  ➕ Agregar sección
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addPeriodo}
            className="mt-2 bg-blue-600 px-3 py-1 rounded text-xs text-white"
          >
            ➕ Agregar período
          </button>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 rounded text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 rounded text-white"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
