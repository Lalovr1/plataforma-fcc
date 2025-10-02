"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import EditorContenidoCurso from "@/components/EditorContenidoCurso";
import ConstructorQuiz from "@/components/ConstructorQuiz";
import EditarCarreraModal from "@/components/EditarCarreraModal";
import Link from "next/link";

interface Carrera {
  id: number;
  nombre: string;
}

interface Seccion {
  id?: string;
  nombre: string;
}

interface Periodo {
  id?: string;
  nombre: "Primavera" | "Verano" | "Otoño";
  anio: number;
  secciones: Seccion[];
}

interface CursoCarrera {
  id?: string;
  carrera_id: number | null;
  semestre: number | null;
  area: string;
  periodos: Periodo[];
}

export default function EditarCursoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [nombre, setNombre] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cursoCarreras, setCursoCarreras] = useState<CursoCarrera[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState<CursoCarrera | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [carreraEditando, setCarreraEditando] = useState<CursoCarrera | null>(null);
  const [bloquesVersion, setBloquesVersion] = useState(0);

  useEffect(() => {
  const fetchData = async () => {
    const { data: curso, error: errorCurso } = await supabase
      .from("materias")
      .select("id, nombre, visible, profesor_id")
      .eq("id", id)
      .single();

    if (errorCurso || !curso) {
      toast.error("No se pudo cargar el curso");
      router.push("/dashboard/profesor");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || curso.profesor_id !== user.id) {
      toast.error("No tienes permiso para editar este curso");
      router.push("/dashboard/profesor");
      return;
    }

    setNombre(curso.nombre);
    setVisible(curso.visible ?? false);

    const { data: carrerasData } = await supabase.from("carreras").select("*");
    setCarreras(carrerasData || []);

    const { data: cursoCarrerasData } = await supabase
      .from("curso_carreras")
      .select(`
        id,
        carrera_id,
        semestre,
        area,
        curso_periodos (
          id,
          nombre,
          anio,
          curso_secciones (
            id,
            nombre
          )
        )
      `)
      .eq("curso_id", id);

    setCursoCarreras(
      (cursoCarrerasData || []).map((cc) => ({
        ...cc,
        periodos: (cc.curso_periodos || []).map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          anio: p.anio,
          secciones: (p.curso_secciones || []).map((s: any) => ({
            id: s.id,
            nombre: s.nombre,
          })),
        })),
      }))
    );

    setLoading(false);
  };

  fetchData();
}, [id, router]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from("materias").update({
        nombre,
        visible,
      }).eq("id", id);

      await supabase.from("curso_carreras").delete().eq("curso_id", id);

      for (const cc of cursoCarreras) {
        if (!cc.carrera_id || !cc.semestre) continue;

        const { data: insertedCarrera, error: carreraError } = await supabase
          .from("curso_carreras")
          .insert({
            curso_id: id,
            carrera_id: cc.carrera_id,
            semestre: cc.semestre,
            area: cc.area,
          })
          .select("id")
          .single();

        if (carreraError || !insertedCarrera) continue;

        for (const p of cc.periodos) {
          const { data: insertedPeriodo, error: periodoError } = await supabase
            .from("curso_periodos")
            .insert({
              curso_carrera_id: insertedCarrera.id,
              nombre: p.nombre,
              anio: p.anio,
            })
            .select("id")
            .single();

          if (periodoError || !insertedPeriodo) continue;

          for (const s of p.secciones) {
            await supabase.from("curso_secciones").insert({
              periodo_id: insertedPeriodo.id,
              nombre: s.nombre,
            });
          }
        }
      }

      toast.success("Curso actualizado ✅");
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar curso");
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este curso?")) return;
    setLoading(true);
    const { error } = await supabase.from("materias").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar curso");
    } else {
      toast.success("Curso eliminado 🗑️");
      router.push("/dashboard/profesor");
    }

    setLoading(false);
  };

  const moveCarrera = (index: number, dir: "up" | "down") => {
    const newArr = [...cursoCarreras];
    const targetIndex = dir === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newArr.length) return;
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;
    setCursoCarreras(newArr);
  };

  const resumenPeriodos = (cc: CursoCarrera) => {
    if (!cc.periodos.length) return "Sin períodos";
    return cc.periodos
      .map((p) => `${p.nombre} ${p.anio} (${p.secciones.length} secc.)`)
      .join(", ");
  };

  if (loading) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-center" style={{ color: "var(--color-muted)" }}>Cargando curso...</p>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Columna IZQUIERDA: Contenido + Quizzes */}
        <div className="flex flex-col gap-6 w-full">
          <div
            className="p-6 rounded-xl shadow w-full"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <h2 className="text-xl font-bold mb-4">📘 Contenido del curso</h2>
            <EditorContenidoCurso materiaId={id} onBloquesChange={() => setBloquesVersion(v => v + 1)} />
          </div>

          {/*  Quizzes */}
          <div
            className="p-6 rounded-xl shadow w-full"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <h2 className="text-xl font-bold mb-4">🧩 Quizzes del curso</h2>
            <ConstructorQuiz key={bloquesVersion} materiaId={id} />
          </div>
        </div>

        {/* Columna DERECHA: Editar información + acceso a ranking */}
        <div className="flex flex-col gap-6 w-full">
            {/* Acceso a ranking del curso */}
          <div
            className="p-6 rounded-xl shadow w-full"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <h2 className="text-xl font-bold mb-3">📊 Analíticas y ranking</h2>
            <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>
              Consulta el desempeño de tus estudiantes por período y sección, y el ranking por quiz.
            </p>
            <Link
              href={`/dashboard/profesor/cursos/${id}/ranking`}
              className="inline-block bg-indigo-600 hover:bg-indigo-700 transition-colors px-4 py-2 rounded-lg font-semibold text-white"
            >
              Ver ranking del curso
            </Link>
          </div>
          <form
            onSubmit={handleSubmit}
            className="p-6 rounded-xl shadow-lg w-full space-y-4"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <h2 className="text-xl font-bold mb-4">✏️ Editar información</h2>

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

            {/* Lista de carreras ligadas */}
            <div>
              <label className="block text-sm mb-2">Carreras ligadas</label>

              {cursoCarreras.length === 0 && (
                <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                  No hay carreras agregadas.
                </p>
              )}

              <div className="space-y-2">
                {cursoCarreras.map((cc, idx) => {
                  const carreraNombre =
                    carreras.find((c) => c.id === cc.carrera_id)?.nombre ||
                    "Sin carrera";
                  return (
                    <div
                      key={idx}
                      className="rounded-lg p-3 flex flex-col gap-2"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold" style={{ color: "var(--color-heading)" }}>{carreraNombre}</p>
                          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Semestre {cc.semestre || "-"}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => moveCarrera(idx, "up")}
                            className="px-2 py-1 rounded text-xs"
                            style={{
                              backgroundColor: "var(--color-border)",
                              color: "var(--color-text)",
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCarrera(idx, "down")}
                            className="px-2 py-1 rounded text-xs text-white"
                            style={{
                              backgroundColor: "var(--color-border)",
                              color: "var(--color-text)",
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCarreraEditando(cc);
                              setModalOpen(true);
                            }}
                            className="px-2 py-1 bg-yellow-600 rounded text-xs text-white"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCursoCarreras((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="px-2 py-1 bg-red-600 rounded text-xs text-white"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {resumenPeriodos(cc)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Formulario para nueva carrera */}
              {nuevaCarrera && (
                <div
                  className="rounded-lg p-3 mt-2 space-y-2"
                  style={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {/* Carrera */}
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
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    <option value="">Seleccione carrera</option>
                    {carreras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>

                  {/* Semestre */}
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

                  {/* Área */}
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
                      backgroundColor: "var(--color-bg)",
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
                          backgroundColor: "var(--color-bg)",
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
                            placeholder="Año"
                            style={{
                              backgroundColor: "var(--color-bg)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text)",
                            }}
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
                            className="bg-red-600 px-2 rounded text-white"
                          >
                            ❌
                          </button>
                        </div>

                        {/* Secciones */}
                        <div className="ml-4 space-y-1">
                          {p.secciones.map((s, sidx) => (
                            <div
                              key={sidx}
                              className="flex gap-2 items-center"
                            >
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
                                              j === sidx ? { ...y, nombre: val } : y
                                            ),
                                          }
                                        : x
                                    ),
                                  });
                                }}
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
                                className="bg-red-600 px-2 rounded text-white"
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
                                        secciones: [
                                          ...x.secciones,
                                          { nombre: "" },
                                        ],
                                      }
                                    : x
                                ),
                              })
                            }
                            className="mt-1 bg-blue-600 px-2 rounded text-xs text-white"
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
                      className="mt-2 bg-blue-600 px-3 py-1 rounded text-xs text-white"
                    >
                      ➕ Agregar período
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !nuevaCarrera?.carrera_id ||
                          !nuevaCarrera.semestre ||
                          nuevaCarrera.periodos.length === 0 ||
                          nuevaCarrera.periodos.some((p) => p.secciones.length === 0 || p.secciones.some(s => !s.nombre.trim()))
                        ) {
                          toast.error("Completa carrera, semestre y asegúrate de que cada período tenga al menos una sección");
                          return;
                        }

                        try {
                          const { data: insertedCarrera, error: carreraError } = await supabase
                            .from("curso_carreras")
                            .insert({
                              curso_id: id,
                              carrera_id: nuevaCarrera.carrera_id,
                              semestre: nuevaCarrera.semestre,
                              area: nuevaCarrera.area,
                            })
                            .select("id")
                            .single();

                          if (carreraError || !insertedCarrera) {
                            toast.error("Error al guardar carrera");
                            return;
                          }

                          for (const p of nuevaCarrera.periodos) {
                            const { data: insertedPeriodo, error: periodoError } = await supabase
                              .from("curso_periodos")
                              .insert({
                                curso_carrera_id: insertedCarrera.id,
                                nombre: p.nombre,
                                anio: p.anio,
                              })
                              .select("id")
                              .single();

                            if (periodoError || !insertedPeriodo) continue;

                            for (const s of p.secciones) {
                              await supabase.from("curso_secciones").insert({
                                periodo_id: insertedPeriodo.id,
                                nombre: s.nombre,
                              });
                            }
                          }

                          setCursoCarreras((prev) => [...prev, { ...nuevaCarrera, id: insertedCarrera.id }]);
                          setNuevaCarrera(null);

                          toast.success("Carrera guardada ✅");
                        } catch (err) {
                          console.error(err);
                          toast.error("Error inesperado al guardar carrera");
                        }
                      }}
                      className="flex-1 bg-green-600 py-1 rounded text-white"
                    >
                      Guardar carrera
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevaCarrera(null)}
                      className="flex-1 bg-red-600 py-1 rounded text-white"
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
                  className="mt-2 bg-blue-600 px-3 py-1 rounded text-white"
                >
                  ➕ Agregar carrera
                </button>
              )}
            </div>

            {/* Visible */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="w-4 h-4"
                />
                Hacer público (visible para todos)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-bold disabled:opacity-50 text-white"
              >
                {loading ? "Actualizando..." : "Actualizar curso"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-bold disabled:opacity-50 text-white"
              >
                Eliminar curso
              </button>
            </div>
          </form>
        </div>
      </div>

      <EditarCarreraModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        carrera={carreraEditando}
        carrerasDisponibles={carreras}
        onSave={(carreraActualizada) => {
          setCursoCarreras((prev) =>
            prev.map((c) => (c.id === carreraActualizada.id ? carreraActualizada : c))
          );
        }}
      />
    </LayoutGeneral>
  );
}
