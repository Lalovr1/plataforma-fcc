"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import EditorContenidoCurso from "@/components/EditorContenidoCurso";
import ConstructorQuiz from "@/components/ConstructorQuiz";
import EditarCarreraModal from "@/components/EditarCarreraModal";
import Link from "next/link";
import { createPortal } from "react-dom";

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

type CursoCache = {
  timestamp: number;
  profesorId: string;
  nombre: string;
  visible: boolean;
  carreras: Carrera[];
  cursoCarreras: CursoCarrera[];
};

const CACHE_KEY_BASE = "fcc_academy_editar_curso_profesor_v1";

function getEditarCursoCacheKey(usuarioId: string, cursoId: string) {
  return `${CACHE_KEY_BASE}_${usuarioId}_${cursoId}`;
}

function leerEditarCursoCache(usuarioId: string, cursoId: string): CursoCache | null {
  try {
    const raw = sessionStorage.getItem(getEditarCursoCacheKey(usuarioId, cursoId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.nombre) return null;
    if (!Array.isArray(parsed?.carreras)) return null;
    if (!Array.isArray(parsed?.cursoCarreras)) return null;

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      profesorId: parsed.profesorId,
      nombre: parsed.nombre,
      visible: Boolean(parsed.visible),
      carreras: parsed.carreras,
      cursoCarreras: parsed.cursoCarreras,
    };
  } catch {
    return null;
  }
}

function guardarEditarCursoCache(
  usuarioId: string,
  cursoId: string,
  data: Omit<CursoCache, "timestamp">
) {
  try {
    sessionStorage.setItem(
      getEditarCursoCacheKey(usuarioId, cursoId),
      JSON.stringify({
        timestamp: Date.now(),
        ...data,
      })
    );
  } catch {}
}

function limpiarCachesRelacionados(cursoId: string) {
  try {
    const prefixes = [
      "fcc_academy_cursos_profesor_v1",
      "fcc_academy_cursos_estudiante_v2_",
      "fcc_academy_profesores_estudiante_v1",
      "fcc_academy_profesor_cursos_estudiante_v1_",
      "fcc_academy_widget_ranking_top5_v1",
      "fcc_academy_visualizador_curso",
    ];

    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;

      const esCacheEditorActual = key.startsWith(CACHE_KEY_BASE);

      if (
        prefixes.some((prefix) => key.startsWith(prefix)) ||
        (key.includes(cursoId) && !esCacheEditorActual)
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

function mapCursoCarreras(rows: any[] | null | undefined): CursoCarrera[] {
  return ((rows as any[]) ?? []).map((cc) => ({
    id: cc.id,
    carrera_id: cc.carrera_id ?? null,
    semestre: cc.semestre ?? null,
    area: cc.area ?? "Ciencias Básicas",
    periodos: ((cc.curso_periodos as any[]) ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      anio: p.anio,
      secciones: ((p.curso_secciones as any[]) ?? []).map((s) => ({
        id: s.id,
        nombre: s.nombre,
      })),
    })),
  }));
}

export default function EditarCursoPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cursoCarreras, setCursoCarreras] = useState<CursoCarrera[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState<CursoCarrera | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [carreraEditando, setCarreraEditando] = useState<CursoCarrera | null>(null);
  const [bloquesVersion, setBloquesVersion] = useState(0);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!nuevaCarrera) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [nuevaCarrera]);

  const renderPortal = (content: ReactNode) => {
    if (!portalReady || typeof document === "undefined") return null;
    return createPortal(content, document.body);
  };

  const guardarCacheActual = (override?: Partial<Omit<CursoCache, "timestamp">>) => {
    const usuarioId = profesorId ?? localStorage.getItem("user_id");
    if (!usuarioId || !id) return;

    guardarEditarCursoCache(usuarioId, id, {
      profesorId: usuarioId,
      nombre,
      visible,
      carreras,
      cursoCarreras,
      ...override,
    });
  };

  const aplicarCache = (cache: CursoCache) => {
    setProfesorId(cache.profesorId);
    setNombre(cache.nombre);
    setVisible(cache.visible);
    setCarreras(cache.carreras);
    setCursoCarreras(cache.cursoCarreras);
    setLoading(false);
  };

  useLayoutEffect(() => {
    if (!id) return;

    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerEditarCursoCache(usuarioLocal, id);
    if (!cache) return;

    aplicarCache(cache);
  }, [id]);

  const fetchData = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (!id) return;

    if (showLoading) setLoading(true);

    try {
      const [userResult, cursoResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("materias")
          .select("id, nombre, visible, profesor_id")
          .eq("id", id)
          .single(),
      ]);

      const user = userResult.data.user;
      const curso = cursoResult.data;
      const errorCurso = cursoResult.error;

      if (errorCurso || !curso) {
        toast.error("No se pudo cargar el curso");
        router.push("/dashboard/profesor");
        return;
      }

      if (!user || curso.profesor_id !== user.id) {
        toast.error("No tienes permiso para editar este curso");
        router.push("/dashboard/profesor");
        return;
      }

      setProfesorId(user.id);
      setNombre(curso.nombre);
      setVisible(Boolean(curso.visible));

      const [{ data: carrerasData }, { data: cursoCarrerasData }] = await Promise.all([
        supabase.from("carreras").select("id, nombre").order("nombre", { ascending: true }),
        supabase
          .from("curso_carreras")
          .select(
            `
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
          `
          )
          .eq("curso_id", id),
      ]);

      const carrerasParsed = (carrerasData as Carrera[]) ?? [];
      const cursoCarrerasParsed = mapCursoCarreras(cursoCarrerasData);

      setCarreras(carrerasParsed);
      setCursoCarreras(cursoCarrerasParsed);

      guardarEditarCursoCache(user.id, id, {
        profesorId: user.id,
        nombre: curso.nombre,
        visible: Boolean(curso.visible),
        carreras: carrerasParsed,
        cursoCarreras: cursoCarrerasParsed,
      });
    } catch (err) {
      console.error("Error inicializando edición de curso:", err);
      toast.error("No se pudo cargar el curso");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      toast.error("El nombre del curso no puede estar vacío");
      return;
    }

    setGuardando(true);

    try {
      const { error: cursoError } = await supabase
        .from("materias")
        .update({
          nombre: nombreLimpio,
          visible,
        })
        .eq("id", id);

      if (cursoError) {
        toast.error("Error al actualizar curso");
        return;
      }

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

      toast.success("Curso actualizado");
      limpiarCachesRelacionados(id);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar curso");
    } finally {
      setGuardando(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("¿Estás seguro de eliminar este curso?")) return;

    setGuardando(true);

    const { error } = await supabase.from("materias").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar curso");
      setGuardando(false);
      return;
    }

    limpiarCachesRelacionados(id);
    toast.success("Curso eliminado 🗑️");
    router.push("/dashboard/profesor");
  };

  const moveCarrera = (index: number, dir: "up" | "down") => {
    const newArr = [...cursoCarreras];
    const targetIndex = dir === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newArr.length) return;
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;
    setCursoCarreras(newArr);
    guardarCacheActual({ cursoCarreras: newArr });
  };

  const resumenPeriodos = (cc: CursoCarrera) => {
    if (!cc.periodos.length) return "Sin períodos";
    return cc.periodos
      .map((p) => `${p.nombre} ${p.anio} (${p.secciones.length} secc.)`)
      .join(", ");
  };

  const agregarCarreraEnSupabase = async () => {
    if (!nuevaCarrera || !id) return;

    if (
      !nuevaCarrera.carrera_id ||
      !nuevaCarrera.semestre ||
      nuevaCarrera.periodos.length === 0 ||
      nuevaCarrera.periodos.some(
        (p) => p.secciones.length === 0 || p.secciones.some((s) => !s.nombre.trim())
      )
    ) {
      toast.error(
        "Completa carrera, semestre y asegúrate de que cada período tenga al menos una sección"
      );
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

      const periodosGuardados: Periodo[] = [];

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

        const seccionesGuardadas: Seccion[] = [];

        for (const s of p.secciones) {
          const { data: insertedSeccion } = await supabase
            .from("curso_secciones")
            .insert({
              periodo_id: insertedPeriodo.id,
              nombre: s.nombre.trim(),
            })
            .select("id, nombre")
            .single();

          if (insertedSeccion) {
            seccionesGuardadas.push({
              id: insertedSeccion.id,
              nombre: insertedSeccion.nombre,
            });
          }
        }

        periodosGuardados.push({
          id: insertedPeriodo.id,
          nombre: p.nombre,
          anio: p.anio,
          secciones: seccionesGuardadas,
        });
      }

      const carreraGuardada: CursoCarrera = {
        ...nuevaCarrera,
        id: insertedCarrera.id,
        periodos: periodosGuardados,
      };

      setCursoCarreras((prev) => {
        const next = [...prev, carreraGuardada];
        guardarCacheActual({ cursoCarreras: next });
        return next;
      });

      setNuevaCarrera(null);
      limpiarCachesRelacionados(id);
      toast.success("Carrera guardada ✅");
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado al guardar carrera");
    }
  };

  if (loading) {
    return (
      <LayoutGeneral rol="profesor">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col gap-6 w-full">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="p-6 rounded-xl shadow w-full animate-pulse"
                style={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="h-7 rounded w-48 mb-4"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-32 rounded"
                  style={{ backgroundColor: "var(--color-bg)" }}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6 w-full">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="p-6 rounded-xl shadow w-full animate-pulse"
                style={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="h-7 rounded w-52 mb-4"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-10 rounded mb-3"
                  style={{ backgroundColor: "var(--color-bg)" }}
                />
                <div
                  className="h-24 rounded"
                  style={{ backgroundColor: "var(--color-bg)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
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
            <EditorContenidoCurso
              materiaId={id}
              onBloquesChange={() => {
                setBloquesVersion((v) => v + 1);
                if (id) limpiarCachesRelacionados(id);
              }}
            />
          </div>

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

        <div className="flex flex-col gap-6 w-full">
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

            <div>
              <label className="block text-sm mb-1">Nombre del curso</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  guardarCacheActual({ nombre: e.target.value });
                }}
                className="w-full p-2 rounded"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                required
              />
            </div>

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
                    carreras.find((c) => c.id === cc.carrera_id)?.nombre || "Sin carrera";

                  return (
                    <div
                      key={cc.id ?? idx}
                      className="rounded-lg p-3 flex flex-col gap-2"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: "var(--color-heading)" }}>
                            {carreraNombre}
                          </p>
                          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                            Semestre {cc.semestre || "-"}
                          </p>
                        </div>

                        <div className="flex gap-2 flex-wrap justify-end">
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
                            className="px-2 py-1 rounded text-xs"
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
                            onClick={() => {
                              setCursoCarreras((prev) => {
                                const next = prev.filter((_, i) => i !== idx);
                                guardarCacheActual({ cursoCarreras: next });
                                return next;
                              });
                              if (id) limpiarCachesRelacionados(id);
                            }}
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

              {nuevaCarrera &&
                renderPortal(
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
                    <div
                      className="rounded-xl p-4 sm:p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      <h2 className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>
                        Agregar carrera
                      </h2>

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

                      <select
                        value={nuevaCarrera.area}
                        onChange={(e) =>
                          setNuevaCarrera({ ...nuevaCarrera, area: e.target.value })
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

                      <div>
                        <label className="block text-sm mb-2">Períodos</label>

                        {nuevaCarrera.periodos.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded space-y-2 mb-2"
                            style={{
                              backgroundColor: "var(--color-bg)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                              <select
                                value={p.nombre}
                                onChange={(e) =>
                                  setNuevaCarrera({
                                    ...nuevaCarrera,
                                    periodos: nuevaCarrera.periodos.map((x, i) =>
                                      i === idx
                                        ? { ...x, nombre: e.target.value as Periodo["nombre"] }
                                        : x
                                    ),
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
                                  setNuevaCarrera({
                                    ...nuevaCarrera,
                                    periodos: nuevaCarrera.periodos.map((x, i) =>
                                      i === idx ? { ...x, anio: Number(e.target.value) } : x
                                    ),
                                  })
                                }
                                className="w-full sm:w-24 p-1 rounded"
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
                                    periodos: nuevaCarrera.periodos.filter((_, i) => i !== idx),
                                  })
                                }
                                className="bg-red-600 px-2 py-1 rounded text-white"
                              >
                                ❌
                              </button>
                            </div>

                            <div className="sm:ml-4 space-y-1">
                              {p.secciones.map((s, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex flex-col sm:flex-row gap-2 sm:items-center"
                                >
                                  <input
                                    type="text"
                                    value={s.nombre}
                                    onChange={(e) =>
                                      setNuevaCarrera({
                                        ...nuevaCarrera,
                                        periodos: nuevaCarrera.periodos.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                secciones: x.secciones.map((sec, j) =>
                                                  j === sIdx
                                                    ? { ...sec, nombre: e.target.value }
                                                    : sec
                                                ),
                                              }
                                            : x
                                        ),
                                      })
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
                                    onClick={() =>
                                      setNuevaCarrera({
                                        ...nuevaCarrera,
                                        periodos: nuevaCarrera.periodos.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                secciones: x.secciones.filter((_, j) => j !== sIdx),
                                              }
                                            : x
                                        ),
                                      })
                                    }
                                    className="bg-red-600 px-2 py-1 rounded text-white"
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
                                        ? { ...x, secciones: [...x.secciones, { nombre: "" }] }
                                        : x
                                    ),
                                  })
                                }
                                className="mt-1 bg-blue-600 px-2 py-1 rounded text-xs text-white"
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

                      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setNuevaCarrera(null)}
                          className="px-4 py-2 bg-gray-600 rounded text-white"
                        >
                          Cancelar
                        </button>

                        <button
                          type="button"
                          onClick={agregarCarreraEnSupabase}
                          className="px-4 py-2 bg-green-600 rounded text-white"
                        >
                          Guardar carrera
                        </button>
                      </div>
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

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => {
                    setVisible(e.target.checked);
                    guardarCacheActual({ visible: e.target.checked });
                  }}
                  className="w-4 h-4"
                />
                Hacer público (visible para todos)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-bold disabled:opacity-50 text-white"
              >
                {guardando ? "Actualizando..." : "Actualizar curso"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={guardando}
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
          setCursoCarreras((prev) => {
            const next = prev.map((c) =>
              c.id === carreraActualizada.id ? carreraActualizada : c
            );
            guardarCacheActual({ cursoCarreras: next });
            return next;
          });
          if (id) limpiarCachesRelacionados(id);
        }}
      />
    </LayoutGeneral>
  );
}
