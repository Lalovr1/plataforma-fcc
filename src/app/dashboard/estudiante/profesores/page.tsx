/**
 * Profesores
 * - Listado alfabético por defecto
 * - Buscador por nombre.
 * - Al hacer click: modal con avatar grande, nombre y cursos creados.
 * - Desde el modal: inscripción a curso con lógica de inscripción/oculto/reactivar.
 */

"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";

type Usuario = {
  id: string;
  nombre: string;
  rol: "estudiante" | "profesor";
  avatar_config: AvatarConfig | null;
};

type ProgresoEstado = {
  exists: boolean;
  visible: boolean;
};

type PeriodoConCarrera = {
  id: string;
  nombre: string;
  anio: number;
  carrera_id: number | null;
};

type Materia = {
  id: string;
  nombre: string;
  curso_carreras?: {
    id: string;
    semestre: number | null;
    area: string | null;
    carrera: { id: number; nombre: string } | null;
    curso_periodos: { id: string; nombre: string; anio: number }[];
  }[];
  progresoEstado?: ProgresoEstado;
};

const PROFESORES_CACHE_KEY = "fcc_academy_profesores_estudiante_v1";
const CURSOS_PROFESOR_CACHE_KEY_BASE = "fcc_academy_profesor_cursos_estudiante_v1";

function parseAvatarConfig(value: any): AvatarConfig | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

export default function ProfesoresPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedProfesor, setSelectedProfesor] = useState<Usuario | null>(null);
  const [cursos, setCursos] = useState<Materia[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  const [selectedCurso, setSelectedCurso] = useState<Materia | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoConCarrera[]>([]);
  const [secciones, setSecciones] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState<number | null>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null);
  const [selectedSeccion, setSelectedSeccion] = useState<string | null>(null);
  const [visitante, setVisitante] = useState(false);
  const [saving, setSaving] = useState(false);

  const getCursosProfesorCacheKey = (usuarioId: string, profesorId: string) =>
    `${CURSOS_PROFESOR_CACHE_KEY_BASE}_${usuarioId}_${profesorId}`;

  const guardarProfesoresCache = (profesoresData: Usuario[]) => {
    try {
      sessionStorage.setItem(
        PROFESORES_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          profesores: profesoresData,
        })
      );
    } catch {}
  };

  const leerProfesoresCache = (): Usuario[] | null => {
    try {
      const raw = sessionStorage.getItem(PROFESORES_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.profesores)) return null;

      return parsed.profesores;
    } catch {
      return null;
    }
  };

  const guardarCursosProfesorCache = (
    usuarioId: string,
    profesorId: string,
    cursosData: Materia[]
  ) => {
    try {
      sessionStorage.setItem(
        getCursosProfesorCacheKey(usuarioId, profesorId),
        JSON.stringify({
          timestamp: Date.now(),
          cursos: cursosData,
        })
      );
    } catch {}
  };

  const leerCursosProfesorCache = (
    usuarioId: string,
    profesorId: string
  ): Materia[] | null => {
    try {
      const raw = sessionStorage.getItem(getCursosProfesorCacheKey(usuarioId, profesorId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.cursos)) return null;

      return parsed.cursos;
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    const cache = leerProfesoresCache();

    if (!cache) return;

    setProfesores(cache);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) setMeId(user.id);

        const cache = leerProfesoresCache();

        if (cache) {
          setProfesores(cache);
          setLoading(false);
        }

        await loadProfesores("");
      } catch (e) {
        console.error("Error inicializando profesores:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const loadProfesores = async (term: string) => {
    let q = supabase
      .from("usuarios")
      .select("id,nombre,rol,avatar_config")
      .eq("rol", "profesor");

    if (term.trim()) {
      q = q.ilike("nombre", `%${term.trim()}%`);
    }

    const { data, error } = await q.order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando profesores:", error);
      return;
    }

    const parsed = ((data as any[]) ?? []).map((p) => ({
      ...p,
      avatar_config: parseAvatarConfig(p.avatar_config),
    }));

    setProfesores(parsed);

    if (!term.trim()) {
      guardarProfesoresCache(parsed);
    }
  };

  const doSearch = async () => {
    await loadProfesores(search);
  };

  const cerrarModalProfesor = () => {
    setSelectedProfesor(null);
    setCursos([]);
    setSelectedCurso(null);
    setSelectedCarrera(null);
    setSelectedPeriodo(null);
    setSelectedSeccion(null);
    setSecciones([]);
    setVisitante(false);
  };

  const actualizarCursosActuales = (updater: (prev: Materia[]) => Materia[]) => {
    setCursos((prev) => {
      const next = updater(prev);

      if (meId && selectedProfesor) {
        guardarCursosProfesorCache(meId, selectedProfesor.id, next);
      }

      return next;
    });
  };

  const openProfesor = async (p: Usuario) => {
    setSelectedProfesor(p);
    setSelectedCurso(null);
    setSelectedCarrera(null);
    setSelectedPeriodo(null);
    setSelectedSeccion(null);
    setVisitante(false);
    setSecciones([]);

    const cache = meId ? leerCursosProfesorCache(meId, p.id) : null;

    if (cache) {
      setCursos(cache);
      setLoadingCursos(false);
    } else {
      setCursos([]);
      setLoadingCursos(true);
    }

    const cursosPromise = supabase
      .from("materias")
      .select(
        `
        id,nombre,
        curso_carreras(
          id, semestre, area,
          carrera:carreras (id, nombre),
          curso_periodos (id, nombre, anio)
        )
      `
      )
      .eq("profesor_id", p.id)
      .eq("visible", true)
      .order("nombre", { ascending: true });

    const progresoPromise = meId
      ? supabase
          .from("progreso")
          .select("materia_id, visible")
          .eq("usuario_id", meId)
      : Promise.resolve({ data: [] as any[], error: null });

    const [{ data: materiasData, error: materiasError }, { data: progresoRows }] =
      await Promise.all([cursosPromise, progresoPromise]);

    if (materiasError) {
      console.error("Error cargando cursos del profesor:", materiasError);
      setLoadingCursos(false);
      return;
    }

    const inscritos: Record<string, ProgresoEstado> = {};

    progresoRows?.forEach((r: any) => {
      inscritos[r.materia_id] = {
        exists: true,
        visible: Boolean(r.visible),
      };
    });

    const cursosConEstado = ((materiasData as any[]) ?? []).map((m) => ({
      ...m,
      progresoEstado: inscritos[m.id] ?? { exists: false, visible: false },
    }));

    setCursos(cursosConEstado);

    if (meId) {
      guardarCursosProfesorCache(meId, p.id, cursosConEstado);
    }

    setLoadingCursos(false);
  };

  const pickCurso = (m: Materia) => {
    setSelectedCurso(m);

    const allPeriodos =
      m.curso_carreras?.flatMap((cc) =>
        cc.curso_periodos.map((p) => ({
          ...p,
          carrera_id: cc.carrera?.id ?? null,
        }))
      ) ?? [];

    setPeriodos(allPeriodos);
    setSelectedCarrera(null);
    setSelectedPeriodo(null);
    setSelectedSeccion(null);
    setVisitante(false);
    setSecciones([]);
  };

  const reactivarCurso = async (m: Materia) => {
    if (!meId) return;

    await supabase
      .from("progreso")
      .update({ visible: true })
      .eq("usuario_id", meId)
      .eq("materia_id", m.id);

    toast.success(`${m.nombre} movido a inicio`);

    actualizarCursosActuales((prev) =>
      prev.map((c) =>
        c.id === m.id
          ? { ...c, progresoEstado: { exists: true, visible: true } }
          : c
      )
    );
  };

  useEffect(() => {
    const fetchSecciones = async () => {
      if (!selectedPeriodo) {
        setSecciones([]);
        return;
      }

      const { data } = await supabase
        .from("curso_secciones")
        .select("id,nombre")
        .eq("periodo_id", selectedPeriodo);

      setSecciones((data as any[]) ?? []);
    };

    fetchSecciones();
  }, [selectedPeriodo]);

  const inscribirse = async () => {
    if (!meId || !selectedCurso) return;

    if (!visitante && (!selectedPeriodo || !selectedSeccion)) {
      toast.error("Selecciona período y sección o marca visitante.");
      return;
    }

    if (visitante) {
      const ok = window.confirm(
        "El profesor no podrá ver tu progreso si entras como visitante. ¿Continuar?"
      );
      if (!ok) return;
    }

    setSaving(true);

    const { data: exists } = await supabase
      .from("progreso")
      .select("id, visible")
      .eq("usuario_id", meId)
      .eq("materia_id", selectedCurso.id)
      .maybeSingle();

    if (!exists) {
      const { error } = await supabase.from("progreso").insert([
        {
          usuario_id: meId,
          materia_id: selectedCurso.id,
          progreso: 0,
          visible: true,
          carrera_id: visitante ? null : selectedCarrera,
          periodo_id: visitante ? null : selectedPeriodo,
          seccion_id: visitante ? null : selectedSeccion,
          es_visitante: visitante,
        },
      ]);

      if (error) {
        toast.error("Error al inscribirse.");
        setSaving(false);
        return;
      }
    } else if (exists.visible === false) {
      await supabase
        .from("progreso")
        .update({
          visible: true,
          carrera_id: visitante ? null : selectedCarrera,
          periodo_id: visitante ? null : selectedPeriodo,
          seccion_id: visitante ? null : selectedSeccion,
          es_visitante: visitante,
        })
        .eq("id", exists.id);
    }

    toast.success(`${selectedCurso.nombre} inscrito correctamente`);
    setSaving(false);
    setSelectedCurso(null);
    setSelectedPeriodo(null);
    setSelectedSeccion(null);
    setVisitante(false);
    setSecciones([]);

    actualizarCursosActuales((prev) =>
      prev.map((c) =>
        c.id === selectedCurso.id
          ? { ...c, progresoEstado: { exists: true, visible: true } }
          : c
      )
    );
  };

  const defaultAvatar: AvatarConfig = {
    gender: "masculino",
    skin: "base/masculino/piel.png",
    skinColor: "#f1c27d",
    eyes: "Ojos1.png",
    mouth: "Boca1.png",
    nose: "Nariz1.png",
    glasses: "none",
    hair: "Cabello1.png",
    playera: "Playera1",
    sueter: "none",
    collar: "none",
    pulsera: "none",
    accessory: "none",
  };

  const periodosFiltrados = useMemo(() => {
    if (!selectedCarrera) return [];
    return periodos.filter((p) => p.carrera_id === selectedCarrera);
  }, [selectedCarrera, periodos]);

  if (loading) {
    return (
      <LayoutGeneral rol="estudiante">
        <div className="space-y-6">
          <h1
            className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
            style={{ color: "var(--color-heading)" }}
          >
            Profesores
          </h1>

          <div className="flex flex-col sm:flex-row gap-2">
            <div
              className="h-10 rounded flex-1 animate-pulse"
              style={{ backgroundColor: "var(--color-card)" }}
            />
            <div
              className="h-10 rounded-lg w-full sm:w-24 animate-pulse"
              style={{ backgroundColor: "var(--color-card)" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="p-3 sm:p-2 rounded-lg shadow animate-pulse flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
                style={{ backgroundColor: "var(--color-card)" }}
              >
                <div
                  className="w-28 h-28 rounded-full"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div className="space-y-3 w-full">
                  <div
                    className="h-6 rounded w-3/4"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                  <div
                    className="h-4 rounded w-1/3"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          Profesores
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar profesor por nombre"
            className="flex-1 p-2 rounded"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
          >
            Buscar
          </button>
        </form>

        {profesores.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>
            No hay profesores para mostrar.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profesores.map((p) => (
              <button
                key={p.id}
                className="p-3 sm:p-2 rounded-lg text-center sm:text-left flex flex-col sm:flex-row items-center gap-3 sm:gap-4 shadow min-w-0"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                }}
                onClick={() => openProfesor(p)}
              >
                <RenderizadorAvatar
                  config={p.avatar_config ?? defaultAvatar}
                  size={150}
                />

                <div className="min-w-0">
                  <div
                    className="text-lg sm:text-2xl font-semibold break-words"
                    style={{ color: "var(--color-heading)" }}
                  >
                    {p.nombre}
                  </div>

                  <div
                    className="text-sm"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Profesor
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedProfesor &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
              onClick={cerrarModalProfesor}
            >
              <div
                className="p-4 sm:p-6 rounded-2xl w-[92vw] max-w-[720px] max-h-[90dvh] overflow-y-auto shadow-lg relative"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute top-3 right-3 hover:opacity-80"
                  onClick={cerrarModalProfesor}
                  aria-label="Cerrar"
                  style={{ color: "var(--color-muted)" }}
                >
                  ✕
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="scale-[0.75] sm:scale-100 -my-8 sm:my-0">
                    <RenderizadorAvatar
                      config={selectedProfesor.avatar_config ?? defaultAvatar}
                      size={250}
                    />
                  </div>

                  <div>
                    <h3
                      className="text-2xl sm:text-4xl font-bold break-words"
                      style={{ color: "var(--color-heading)" }}
                    >
                      {selectedProfesor.nombre}
                    </h3>

                    <div style={{ color: "var(--color-muted)" }}>
                      Cursos creados
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {loadingCursos ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div
                          key={item}
                          className="rounded-lg p-4 animate-pulse"
                          style={{ backgroundColor: "var(--color-bg)" }}
                        >
                          <div
                            className="h-5 rounded w-2/3 mb-3"
                            style={{ backgroundColor: "var(--color-border)" }}
                          />
                          <div
                            className="h-4 rounded w-1/2"
                            style={{ backgroundColor: "var(--color-border)" }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : cursos.length === 0 ? (
                    <p style={{ color: "var(--color-muted)" }}>
                      Este profesor aún no tiene cursos.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cursos.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg p-4"
                          style={{ backgroundColor: "var(--color-bg)" }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 min-w-0">
                            <div>
                              <div
                                className="font-semibold text-base sm:text-lg break-words"
                                style={{ color: "var(--color-heading)" }}
                              >
                                {m.nombre}
                              </div>

                              <div
                                className="text-sm space-y-1"
                                style={{ color: "var(--color-muted)" }}
                              >
                                {(m.curso_carreras ?? []).map((cc) => (
                                  <div key={cc.id}>
                                    {cc.carrera?.nombre ?? "Carrera"} • Sem{" "}
                                    {cc.semestre ?? "N/A"}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {m.progresoEstado?.exists &&
                            m.progresoEstado.visible ? (
                              <span className="px-3 py-1 rounded bg-green-600 text-white text-sm font-semibold">
                                Inscrito
                              </span>
                            ) : m.progresoEstado?.exists ? (
                              <button
                                className="px-3 py-2 sm:py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white w-full sm:w-auto"
                                onClick={() => reactivarCurso(m)}
                              >
                                Reactivar curso
                              </button>
                            ) : (
                              <button
                                className="px-3 py-2 sm:py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white w-full sm:w-auto"
                                onClick={() =>
                                  selectedCurso?.id === m.id
                                    ? inscribirse()
                                    : pickCurso(m)
                                }
                                disabled={saving}
                              >
                                {selectedCurso?.id === m.id
                                  ? saving
                                    ? "Guardando..."
                                    : "Confirmar inscripción"
                                  : "Inscribirme"}
                              </button>
                            )}
                          </div>

                          {selectedCurso?.id === m.id &&
                            !m.progresoEstado?.exists && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label
                                    className="block text-sm mb-1"
                                    style={{ color: "var(--color-muted)" }}
                                  >
                                    Selecciona carrera:
                                  </label>

                                  <select
                                    value={selectedCarrera ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value
                                        ? Number(e.target.value)
                                        : null;
                                      setSelectedCarrera(val);
                                      setSelectedPeriodo(null);
                                      setSelectedSeccion(null);
                                    }}
                                    disabled={visitante}
                                    className="w-full p-2 rounded"
                                    style={{
                                      backgroundColor: "var(--color-card)",
                                      border: "1px solid var(--color-border)",
                                      color: "var(--color-text)",
                                    }}
                                  >
                                    <option value="">-- Seleccionar --</option>
                                    {(selectedCurso?.curso_carreras ?? []).map((cc) => (
                                      <option key={cc.id} value={cc.carrera?.id ?? ""}>
                                        {cc.carrera?.nombre ?? "Carrera"}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {selectedCarrera && (
                                  <div>
                                    <label
                                      className="block text-sm mb-1"
                                      style={{ color: "var(--color-muted)" }}
                                    >
                                      Selecciona período:
                                    </label>

                                    <select
                                      value={selectedPeriodo ?? ""}
                                      onChange={(e) =>
                                        setSelectedPeriodo(e.target.value || null)
                                      }
                                      disabled={visitante}
                                      className="w-full p-2 rounded"
                                      style={{
                                        backgroundColor: "var(--color-card)",
                                        border: "1px solid var(--color-border)",
                                        color: "var(--color-text)",
                                      }}
                                    >
                                      <option value="">-- Seleccionar --</option>
                                      {periodosFiltrados.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre} {p.anio}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {selectedPeriodo && (
                                  <div>
                                    <label
                                      className="block text-sm mb-1"
                                      style={{ color: "var(--color-muted)" }}
                                    >
                                      Selecciona sección:
                                    </label>

                                    <select
                                      value={selectedSeccion ?? ""}
                                      onChange={(e) =>
                                        setSelectedSeccion(e.target.value || null)
                                      }
                                      disabled={visitante}
                                      className="w-full p-2 rounded"
                                      style={{
                                        backgroundColor: "var(--color-card)",
                                        border: "1px solid var(--color-border)",
                                        color: "var(--color-text)",
                                      }}
                                    >
                                      <option value="">-- Seleccionar --</option>
                                      {secciones.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 mt-3">
                                  <input
                                    type="checkbox"
                                    checked={visitante}
                                    onChange={(e) => {
                                      setVisitante(e.target.checked);

                                      if (e.target.checked) {
                                        setSelectedCarrera(null);
                                        setSelectedPeriodo(null);
                                        setSelectedSeccion(null);
                                      }
                                    }}
                                  />

                                  <label
                                    className="text-sm"
                                    style={{ color: "var(--color-muted)" }}
                                  >
                                    Tomar curso como visitante
                                  </label>
                                </div>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </LayoutGeneral>
  );
}