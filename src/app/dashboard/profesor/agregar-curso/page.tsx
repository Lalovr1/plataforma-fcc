"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import LayoutGeneral from "@/components/LayoutGeneral";

interface Carrera {
  id: number;
  nombre: string;
}
interface Seccion {
  nombre: string;
}
interface Periodo {
  nombre: "Primavera" | "Verano" | "Otoño";
  anio: number;
  secciones: Seccion[];
}
interface CursoCarrera {
  carrera_id: number | null;
  semestre: number | null;
  area: string;
  periodos: Periodo[];
}

export default function AgregarCursoPage() {
  const [nombre, setNombre] = useState("");
  const [cursoCarreras, setCursoCarreras] = useState<CursoCarrera[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState<CursoCarrera | null>(null);
  const [carrerasDisponibles, setCarrerasDisponibles] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchCarreras = async () => {
      const { data } = await supabase.from("carreras").select("*");
      setCarrerasDisponibles(data || []);
    };
    fetchCarreras();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No se pudo obtener el usuario");
        return;
      }

      if (cursoCarreras.length === 0) {
        toast.error("Debes agregar al menos una carrera ligada");
        return;
      }

      const {
        data: materia,
        error: materiaError,
      } = await supabase
        .from("materias")
        .insert({
          nombre,
          profesor_id: user.id,
          visible: false,
        })
        .select("id")
        .single();

      if (materiaError || !materia) {
        toast.error("Error al crear curso");
        return;
      }

      const cursoId = materia.id;

      for (const cc of cursoCarreras) {
        if (
          !cc.carrera_id ||
          !cc.semestre ||
          cc.periodos.length === 0 ||
          cc.periodos.some((p) => p.secciones.length === 0)
        ) {
          continue;
        }

        const { data: insertedCarrera } = await supabase
          .from("curso_carreras")
          .insert({
            curso_id: cursoId,
            carrera_id: cc.carrera_id,
            semestre: cc.semestre,
            area: cc.area,
          })
          .select("id")
          .single();

        if (!insertedCarrera) continue;

        for (const p of cc.periodos) {
          const { data: insertedPeriodo } = await supabase
            .from("curso_periodos")
            .insert({
              curso_carrera_id: insertedCarrera.id,
              nombre: p.nombre,
              anio: p.anio,
            })
            .select("id")
            .single();

          if (!insertedPeriodo) continue;

          for (const s of p.secciones) {
            await supabase.from("curso_secciones").insert({
              periodo_id: insertedPeriodo.id,
              nombre: s.nombre,
            });
          }
        }
      }

      toast.success("Curso creado con éxito 🎉");
      router.push(`/dashboard/profesor/cursos/${cursoId}/editar`);
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado al crear curso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutGeneral rol="profesor">
      <div className="flex justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl shadow-lg w-full max-w-2xl space-y-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <h2
            className="text-xl font-bold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-heading)" }}
          >
            ➕ Agregar Curso
          </h2>

          {/* Nombre */}
          <div>
            <label className="block text-sm mb-1">Nombre del curso</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2 rounded"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              required
            />
          </div>

          {/* Carreras ligadas */}
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <label className="block text-sm mb-2">Carreras ligadas</label>

            {cursoCarreras.length === 0 && (
              <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                No hay carreras agregadas.
              </p>
            )}

            <div className="space-y-2">
              {cursoCarreras.map((cc, idx) => {
                const carreraNombre =
                  carrerasDisponibles.find((c) => c.id === cc.carrera_id)?.nombre ||
                  "Sin carrera";
                return (
                  <div
                    key={idx}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{carreraNombre}</p>
                        <p
                          className="text-sm"
                          style={{ color: "var(--color-muted)" }}
                        >
                          Semestre {cc.semestre || "-"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCursoCarreras((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="px-2 py-1 rounded text-xs text-white"
                        style={{ backgroundColor: "#dc2626" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulario de nueva carrera */}
            {nuevaCarrera && (
              <div
                className="rounded-lg p-3 mt-2 space-y-2"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <select
                  value={nuevaCarrera.carrera_id || ""}
                  onChange={(e) =>
                    setNuevaCarrera({
                      ...nuevaCarrera,
                      carrera_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full p-2 rounded"
                  style={{
                    backgroundColor: "var(--color-card)",
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

                <select
                  value={nuevaCarrera.semestre || ""}
                  onChange={(e) =>
                    setNuevaCarrera({
                      ...nuevaCarrera,
                      semestre: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full p-2 rounded"
                  style={{
                    backgroundColor: "var(--color-card)",
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

                <select
                  value={nuevaCarrera.area}
                  onChange={(e) =>
                    setNuevaCarrera({
                      ...nuevaCarrera,
                      area: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded"
                  style={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <option value="Ciencias Básicas">Ciencias Básicas</option>
                  <option value="Computación">Computación</option>
                </select>

                {/* Períodos */}
                <div className="space-y-2">
                  <label className="block text-sm">Períodos</label>
                  {nuevaCarrera.periodos.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded space-y-1"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex gap-2">
                        <select
                          value={p.nombre}
                          onChange={(e) => {
                            const val = e.target.value as Periodo["nombre"];
                            setNuevaCarrera({
                              ...nuevaCarrera,
                              periodos: nuevaCarrera.periodos.map((x, i) =>
                                i === idx ? { ...x, nombre: val } : x
                              ),
                            });
                          }}
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
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setNuevaCarrera({
                              ...nuevaCarrera,
                              periodos: nuevaCarrera.periodos.map((x, i) =>
                                i === idx ? { ...x, anio: val } : x
                              ),
                            });
                          }}
                          className="w-24 p-1 rounded"
                          style={{
                            backgroundColor: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text)",
                          }}
                          placeholder="Año"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNuevaCarrera({
                              ...nuevaCarrera,
                              periodos: nuevaCarrera.periodos.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                          className="px-2 rounded text-white"
                          style={{ backgroundColor: "#dc2626" }}
                        >
                          ❌
                        </button>
                      </div>

                      {/* Secciones */}
                      <div className="ml-4 space-y-1">
                        {p.secciones.map((s, sidx) => (
                          <div key={sidx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={s.nombre}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNuevaCarrera({
                                  ...nuevaCarrera,
                                  periodos: nuevaCarrera.periodos.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          secciones: x.secciones.map((y, j) =>
                                            j === sidx
                                              ? { ...y, nombre: val }
                                              : y
                                          ),
                                        }
                                      : x
                                  ),
                                });
                              }}
                              className="flex-1 p-1 rounded"
                              style={{
                                backgroundColor: "var(--color-bg)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text)",
                              }}
                              placeholder="Nombre sección"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setNuevaCarrera({
                                  ...nuevaCarrera,
                                  periodos: nuevaCarrera.periodos.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          secciones: x.secciones.filter(
                                            (_, j) => j !== sidx
                                          ),
                                        }
                                      : x
                                  ),
                                })
                              }
                              className="px-2 rounded text-white"
                              style={{ backgroundColor: "#dc2626" }}
                            >
                              ❌
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setNuevaCarrera({
                              ...nuevaCarrera,
                              periodos: nuevaCarrera.periodos.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      secciones: [...x.secciones, { nombre: "" }],
                                    }
                                  : x
                              ),
                            })
                          }
                          className="mt-1 px-2 rounded text-xs text-white"
                          style={{ backgroundColor: "#2563eb" }}
                        >
                          ➕ Agregar sección
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setNuevaCarrera({
                        ...nuevaCarrera,
                        periodos: [
                          ...nuevaCarrera.periodos,
                          {
                            nombre: "Primavera",
                            anio: new Date().getFullYear(),
                            secciones: [],
                          },
                        ],
                      })
                    }
                    className="mt-2 px-3 py-1 rounded text-xs text-white"
                    style={{ backgroundColor: "#2563eb" }}
                  >
                    ➕ Agregar período
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !nuevaCarrera.carrera_id ||
                        !nuevaCarrera.semestre ||
                        nuevaCarrera.periodos.length === 0 ||
                        nuevaCarrera.periodos.some(
                          (p) => p.secciones.length === 0
                        )
                      ) {
                        toast.error(
                          "Completa carrera, semestre y al menos un período con secciones"
                        );
                        return;
                      }
                      setCursoCarreras((prev) => [...prev, nuevaCarrera]);
                      setNuevaCarrera(null);
                    }}
                    className="flex-1 py-1 rounded text-white"
                    style={{ backgroundColor: "#16a34a" }}
                  >
                    Guardar carrera
                  </button>
                  <button
                    type="button"
                    onClick={() => setNuevaCarrera(null)}
                    className="flex-1 py-1 rounded text-white"
                    style={{ backgroundColor: "#dc2626" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {!nuevaCarrera && (
              <button
                type="button"
                onClick={() =>
                  setNuevaCarrera({
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
                  })
                }
                className="mt-2 px-3 py-1 rounded text-white"
                style={{ backgroundColor: "#2563eb" }}
              >
                ➕ Agregar carrera
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "#2563eb" }}
          >
            {loading ? "Agregando..." : "Agregar curso"}
          </button>
        </form>
      </div>
    </LayoutGeneral>
  );
}
