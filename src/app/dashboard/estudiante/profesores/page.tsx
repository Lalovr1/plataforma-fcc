/**
 * Profesores
 * - Listado alfabético por defecto
 * - Buscador por nombre 
 * - Al hacer click: modal con avatar grande, nombre y cursos creados.
 * - Desde el modal: inscripción a curso con lógica de inscripción/oculto/reactivar.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";

type Usuario = {
  id: string;
  nombre: string;
  rol: "estudiante" | "profesor";
  avatar_config: AvatarConfig | null;
  frame_url: string | null;
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
  progresoEstado?: { exists: boolean; visible: boolean };
};

export default function ProfesoresPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedProfesor, setSelectedProfesor] = useState<Usuario | null>(null);
  const [cursos, setCursos] = useState<Materia[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  const [selectedCurso, setSelectedCurso] = useState<Materia | null>(null);
  const [periodos, setPeriodos] = useState<{ id: string; nombre: string; anio: number }[]>([]);
  const [secciones, setSecciones] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState<number | null>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null);
  const [selectedSeccion, setSelectedSeccion] = useState<string | null>(null);
  const [visitante, setVisitante] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setMeId(user.id);
      await loadProfesores("");
      setLoading(false);
    };
    init();
  }, []);

  const loadProfesores = async (term: string) => {
    let q = supabase
      .from("usuarios")
      .select("id,nombre,rol,avatar_config,frame_url")
      .eq("rol", "profesor");

    if (term.trim()) {
      q = q.ilike("nombre", `%${term.trim()}%`);
    }

    const { data } = await q.order("nombre", { ascending: true });
    setProfesores((data as any[]) ?? []);
  };

  const doSearch = async () => {
    await loadProfesores(search);
  };

  const openProfesor = async (p: Usuario) => {
    setSelectedProfesor(p);
    setLoadingCursos(true);
    setCursos([]);

    const { data } = await supabase
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

    let inscritos: Record<string, { exists: boolean; visible: boolean }> = {};
    if (meId) {
      const { data: progresoRows } = await supabase
        .from("progreso")
        .select("materia_id, visible")
        .eq("usuario_id", meId);

      progresoRows?.forEach((r) => {
        inscritos[r.materia_id] = { exists: true, visible: r.visible };
      });
    }

    setCursos(
      ((data as any[]) ?? []).map((m) => ({
        ...m,
        progresoEstado: inscritos[m.id] ?? { exists: false, visible: false },
      }))
    );

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

    setCursos((prev) =>
      prev.map((c) =>
        c.id === m.id ? { ...c, progresoEstado: { exists: true, visible: true } } : c
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

    setCursos((prev) =>
      prev.map((c) =>
        c.id === selectedCurso.id
          ? { ...c, progresoEstado: { exists: true, visible: true } }
          : c
      )
    );
  };

  const defaultAvatar: AvatarConfig = {
    skin: "Piel1.png",
    eyes: "Ojos1.png",
    hair: "none",
    mouth: "Boca1.png",
    nose: "Nariz1.png",
    glasses: "none",
    clothes: "none",
    accessory: "none",
  };

  const periodosFiltrados = useMemo(() => {
    if (!selectedCarrera) return [];
    return periodos.filter((p: any) => p.carrera_id === selectedCarrera);
  }, [selectedCarrera, periodos]);

  if (loading) {
    return <div className="p-6">Cargando…</div>;
  }

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-heading)" }}>
          Profesores
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
          className="flex gap-2"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profesores.map((p) => (
            <button
              key={p.id}
              className="p-2 rounded-lg text-left flex items-center gap-4 shadow"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
              onClick={() => openProfesor(p)}
            >
              <RenderizadorAvatar
                config={p.avatar_config ?? defaultAvatar}
                frameUrl={p.frame_url}
                size={150}
              />
              <div className="overflow-hidden">
                <div className="text-2xl font-semibold truncate" style={{ color: "var(--color-heading)" }}>
                  {p.nombre}
                </div>
                <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Profesor
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Modal profesor */}
        {selectedProfesor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
              className="p-6 rounded-2xl w-[720px] shadow-lg relative"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
            >
              <button
                className="absolute top-3 right-3 hover:opacity-80"
                onClick={() => {
                  setSelectedProfesor(null);
                  setCursos([]);
                  setSelectedCurso(null);
                  setSelectedPeriodo(null);
                  setSelectedSeccion(null);
                  setSecciones([]);
                  setVisitante(false);
                }}
                aria-label="Cerrar"
                style={{ color: "var(--color-muted)" }}
              >
                ✕
              </button>

              <div className="flex items-center gap-4">
                <RenderizadorAvatar
                  config={selectedProfesor.avatar_config ?? defaultAvatar}
                  frameUrl={selectedProfesor.frame_url}
                  size={250}
                />
                <div>
                  <h3 className="text-4xl font-bold" style={{ color: "var(--color-heading)" }}>
                    {selectedProfesor.nombre}
                  </h3>
                  <div style={{ color: "var(--color-muted)" }}>Cursos creados</div>
                </div>
              </div>

              <div className="mt-4">
                {loadingCursos ? (
                  <p style={{ color: "var(--color-muted)" }}>Cargando cursos…</p>
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
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div
                              className="font-semibold text-lg"
                              style={{ color: "var(--color-heading)" }}
                            >
                              {m.nombre}
                            </div>
                            <div className="text-sm space-y-1" style={{ color: "var(--color-muted)" }}>
                              {(m.curso_carreras ?? []).map((cc) => (
                                <div key={cc.id}>
                                  {cc.carrera?.nombre ?? "Carrera"} • Sem{" "}
                                  {cc.semestre ?? "N/A"}
                                </div>
                              ))}
                            </div>
                          </div>

                          {m.progresoEstado?.exists && m.progresoEstado.visible ? (
                            <span className="px-3 py-1 rounded bg-green-600 text-white text-sm font-semibold">
                              Inscrito
                            </span>
                          ) : m.progresoEstado?.exists ? (
                            <button
                              className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white"
                              onClick={() => reactivarCurso(m)}
                            >
                              Reactivar curso
                            </button>
                          ) : (
                            <button
                              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white"
                              onClick={() =>
                                selectedCurso?.id === m.id ? inscribirse() : pickCurso(m)
                              }
                            >
                              {selectedCurso?.id === m.id ? "Confirmar inscripción" : "Inscribirme"}
                            </button>
                          )}
                        </div>

                        {selectedCurso?.id === m.id && !m.progresoEstado?.exists && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="block text-sm mb-1" style={{ color: "var(--color-muted)" }}>
                                Selecciona carrera:
                              </label>
                              <select
                                value={selectedCarrera ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
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
                                <label className="block text-sm mb-1" style={{ color: "var(--color-muted)" }}>
                                  Selecciona período:
                                </label>
                                <select
                                  value={selectedPeriodo ?? ""}
                                  onChange={(e) => setSelectedPeriodo(e.target.value || null)}
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
                                <label className="block text-sm mb-1" style={{ color: "var(--color-muted)" }}>
                                  Selecciona sección:
                                </label>
                                <select
                                  value={selectedSeccion ?? ""}
                                  onChange={(e) => setSelectedSeccion(e.target.value || null)}
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
                              <label className="text-sm" style={{ color: "var(--color-muted)" }}>
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
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}
