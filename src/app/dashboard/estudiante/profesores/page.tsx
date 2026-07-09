/**
 * Profesores
 * - Listado alfabético por defecto
 * - Buscador por nombre.
 * - Al hacer click: modal con avatar grande, nombre y cursos creados.
 * - Desde el modal: inscripción a curso con lógica de inscripción/oculto/reactivar.
 */

"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";
import { CheckCircle2, RotateCcw, Search, UserPlus, X } from "lucide-react";

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
const CURSOS_PROFESOR_CACHE_KEY_BASE =
  "fcc_academy_profesor_cursos_estudiante_v1";

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

function normalizarUsuario(value: any): Usuario | null {
  if (!value) return null;

  return {
    id: value.id,
    nombre: value.nombre,
    rol: value.rol,
    avatar_config: parseAvatarConfig(value.avatar_config),
  };
}

function AvatarProfesores({
  config,
  size,
}: {
  config: AvatarConfig | null;
  size: number;
}) {
  return (
    <div
      className="profesores-avatar-stage"
      style={{ "--profesores-avatar-size": `${size}px` } as CSSProperties}
    >
      <span className="profesores-avatar-orbit" />

      <div className="profesores-avatar-render">
        <RenderizadorAvatar config={config ?? defaultAvatar} size={size} />
      </div>
    </div>
  );
}

export default function ProfesoresPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedProfesor, setSelectedProfesor] = useState<Usuario | null>(
    null
  );
  const [cursos, setCursos] = useState<Materia[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  const [selectedCurso, setSelectedCurso] = useState<Materia | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoConCarrera[]>([]);
  const [secciones, setSecciones] = useState<{ id: string; nombre: string }[]>(
    []
  );
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
      const raw = sessionStorage.getItem(
        getCursosProfesorCacheKey(usuarioId, profesorId)
      );
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

    const parsed = ((data as any[]) ?? [])
      .map((p) => normalizarUsuario(p))
      .filter(Boolean) as Usuario[];

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

    const [
      { data: materiasData, error: materiasError },
      { data: progresoRows },
    ] = await Promise.all([cursosPromise, progresoPromise]);

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

  const periodosFiltrados = useMemo(() => {
    if (!selectedCarrera) return [];
    return periodos.filter((p) => p.carrera_id === selectedCarrera);
  }, [selectedCarrera, periodos]);

  const renderCursoEstado = (m: Materia) => {
    if (m.progresoEstado?.exists && m.progresoEstado.visible) {
      return (
        <span className="profesores-status-badge is-active">
          Inscrito
        </span>
      );
    }

    if (m.progresoEstado?.exists) {
      return (
        <button
          type="button"
          className="profesores-warning-button"
          onClick={() => reactivarCurso(m)}
        >
          <RotateCcw size={16} strokeWidth={2.4} />
          <span>Reactivar</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        className="profesores-primary-button"
        onClick={() =>
          selectedCurso?.id === m.id ? inscribirse() : pickCurso(m)
        }
        disabled={saving}
      >
        {selectedCurso?.id === m.id ? (
          <>
            <CheckCircle2 size={16} strokeWidth={2.4} />
            <span>{saving ? "Guardando..." : "Confirmar"}</span>
          </>
        ) : (
          <>
            <UserPlus size={16} strokeWidth={2.4} />
            <span>Inscribirme</span>
          </>
        )}
      </button>
    );
  };

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .profesores-page,
        .profesores-modal-overlay {
          --profesores-text: var(--fcc-premium-text, var(--color-text));
          --profesores-heading: var(--fcc-premium-heading, var(--color-heading));
          --profesores-muted: var(--fcc-premium-muted, var(--color-muted));
          --profesores-accent: var(--fcc-premium-accent);
          --profesores-cyan: var(--fcc-premium-cyan);
          --profesores-border: var(--fcc-premium-border, var(--color-border));

          --profesores-avatar-core: color-mix(in srgb, var(--profesores-cyan) 18%, transparent);
          --profesores-avatar-a: color-mix(in srgb, var(--profesores-accent) 34%, transparent);
          --profesores-avatar-b: color-mix(in srgb, var(--profesores-cyan) 28%, transparent);
          --profesores-avatar-c: color-mix(in srgb, var(--profesores-accent) 26%, transparent);
          --profesores-avatar-border: color-mix(in srgb, var(--profesores-accent) 28%, transparent);
          --profesores-avatar-shadow-a: color-mix(in srgb, var(--profesores-accent) 4%, transparent);
          --profesores-avatar-shadow-b: color-mix(in srgb, var(--profesores-accent) 18%, transparent);
          --profesores-orbit-a: color-mix(in srgb, var(--profesores-accent) 20%, transparent);
          --profesores-orbit-b: color-mix(in srgb, var(--profesores-cyan) 22%, transparent);

          color: var(--profesores-text);
        }

        .profesores-page {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .profesores-hero,
        .profesores-search-panel,
        .profesores-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesores-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .profesores-hero {
          border-radius: 22px;
          padding: 16px 22px;
        }

        .profesores-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .profesores-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--profesores-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .profesores-kicker::before,
        .profesores-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--profesores-accent);
        }

        .profesores-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--profesores-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .profesores-search-panel,
        .profesores-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .profesores-search-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .profesores-search-input {
          min-height: 46px;
          width: 100%;
          border-radius: 16px;
          padding: 0 16px;
          color: var(--profesores-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--profesores-accent) 18%,
            var(--profesores-border)
          );
          outline: none;
          font-size: 0.94rem;
          font-weight: 750;
        }

        .profesores-search-input::placeholder {
          color: var(--profesores-muted);
          opacity: 0.78;
        }

        .profesores-search-input:focus {
          border-color: color-mix(
            in srgb,
            var(--profesores-accent) 58%,
            var(--profesores-border)
          );
          box-shadow: 0 0 0 4px color-mix(
            in srgb,
            var(--profesores-accent) 13%,
            transparent
          );
        }

        .profesores-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        @media (min-width: 640px) {
          .profesores-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .profesores-search-form {
            flex-direction: row;
          }

          .profesores-search-button {
            min-width: 128px;
          }
        }

        @media (min-width: 1180px) {
          .profesores-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .profesores-card {
          position: relative;
          width: 100%;
          min-width: 0;
          overflow: hidden;
          border-radius: 24px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesores-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--profesores-text);
          transition:
            transform 170ms ease,
            box-shadow 170ms ease,
            border-color 170ms ease;
        }

        .profesores-card:hover {
          transform: translateY(-1px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .profesores-card-info {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .profesores-card-name {
          display: block;
          min-width: 0;
          color: var(--profesores-heading);
          font-size: clamp(1rem, 1.45vw, 1.22rem);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.035em;
          word-break: break-word;
        }

        .profesores-card-meta {
          display: block;
          color: var(--profesores-muted);
          font-size: 0.86rem;
          font-weight: 800;
        }

        .profesores-primary-button,
        .profesores-warning-button,
        .profesores-muted-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 15px;
          font-size: 0.88rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            opacity 170ms ease;
        }

        .profesores-primary-button {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--profesores-accent),
            color-mix(in srgb, var(--profesores-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--profesores-accent) 24%, transparent);
        }

        .theme-oscuro .profesores-primary-button {
          color: #050505;
        }

        .profesores-warning-button {
          color: #ffffff;
          background: linear-gradient(135deg, #d97706, #f59e0b);
        }

        .profesores-muted-button {
          color: var(--profesores-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--profesores-border);
        }

        .profesores-primary-button:hover:not(:disabled),
        .profesores-warning-button:hover:not(:disabled),
        .profesores-muted-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .profesores-primary-button:disabled,
        .profesores-warning-button:disabled,
        .profesores-muted-button:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          transform: none;
        }

        .profesores-empty {
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 24px 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px dashed color-mix(
            in srgb,
            var(--profesores-accent) 34%,
            transparent
          );
        }

        .profesores-empty-text {
          max-width: 460px;
          color: var(--profesores-muted);
          font-size: 0.94rem;
          line-height: 1.5;
          font-weight: 750;
        }

        .profesores-avatar-stage {
          position: relative;
          flex: 0 0 auto;
          width: var(--profesores-avatar-size);
          height: var(--profesores-avatar-size);
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .profesores-avatar-stage::before {
          content: "";
          position: absolute;
          width: 82%;
          height: 82%;
          border-radius: 999px;
          background:
            radial-gradient(circle, var(--profesores-avatar-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--profesores-avatar-a) 42deg,
              transparent 84deg,
              var(--profesores-avatar-b) 145deg,
              transparent 210deg,
              var(--profesores-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .profesores-avatar-stage::after {
          content: "";
          position: absolute;
          width: 70%;
          height: 70%;
          border-radius: 999px;
          border: 1px solid var(--profesores-avatar-border);
          box-shadow:
            0 0 0 14px var(--profesores-avatar-shadow-a),
            0 0 42px var(--profesores-avatar-shadow-b);
          z-index: -2;
        }

        .profesores-avatar-orbit {
          position: absolute;
          inset: 17%;
          z-index: -1;
          border-radius: 999px;
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--profesores-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--profesores-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          transform: rotate(-18deg);
          opacity: 0.95;
        }

        .profesores-avatar-render {
          position: relative;
          z-index: 2;
        }

        .profesores-skeleton-panel {
          padding: clamp(14px, 2.4vw, 20px);
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesores-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .profesores-skeleton-line {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--profesores-accent) 16%,
            var(--fcc-premium-surface-strong)
          );
        }

        .profesores-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(8px);
        }

        .profesores-modal {
          position: relative;
          width: min(94vw, 820px);
          max-height: 90dvh;
          overflow-y: auto;
          overflow-x: hidden;
          border-radius: 30px;
          padding: clamp(18px, 3vw, 28px);
          clip-path: inset(0 round 30px);
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--profesores-accent) 42%, transparent) transparent;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesores-border);
          box-shadow:
            var(--fcc-premium-shadow-hover),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--profesores-text);
        }
        
        .profesores-modal::-webkit-scrollbar {
          width: 10px;
        }

        .profesores-modal::-webkit-scrollbar-track {
          background: transparent;
          margin: 18px 0;
        }

        .profesores-modal::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--profesores-accent) 42%,
            transparent
          );
          border: 3px solid transparent;
          background-clip: padding-box;
        }

        .profesores-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--profesores-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--profesores-border);
          transition:
            transform 170ms ease,
            color 170ms ease,
            border-color 170ms ease;
        }

        .profesores-modal-close:hover {
          transform: translateY(-1px);
          color: #ef4444;
          border-color: color-mix(
            in srgb,
            #ef4444 34%,
            var(--profesores-border)
          );
        }

        .profesores-modal-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: clamp(16px, 3vw, 26px);
          padding-right: 34px;
        }

        .profesores-modal-title {
          color: var(--profesores-heading);
          font-size: clamp(1.75rem, 4vw, 3rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.055em;
          word-break: break-word;
        }

        .profesores-modal-subtitle {
          margin-top: 10px;
          color: var(--profesores-muted);
          font-size: clamp(1rem, 1.7vw, 1.15rem);
          font-weight: 800;
        }

        .profesores-modal-section {
          margin-top: 24px;
        }

        .profesores-section-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 14px;
          color: var(--profesores-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.8vw, 1.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .profesores-section-title::before,
        .profesores-section-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--profesores-accent) 55%, transparent)
          );
        }

        .profesores-section-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--profesores-accent) 55%, transparent),
            transparent
          );
        }

        .profesores-course-list {
          display: grid;
          gap: 12px;
        }

        .profesores-course-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 16px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--profesores-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .profesores-course-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 14px;
        }

        .profesores-course-title {
          color: var(--profesores-heading);
          font-size: clamp(1rem, 1.5vw, 1.22rem);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.035em;
          word-break: break-word;
        }

        .profesores-course-meta {
          margin-top: 7px;
          display: grid;
          gap: 4px;
          color: var(--profesores-muted);
          font-size: 0.84rem;
          font-weight: 800;
        }

        .profesores-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 32px;
          border-radius: 999px;
          padding: 0 12px;
          font-size: 0.78rem;
          font-weight: 950;
          line-height: 1;
        }

        .profesores-status-badge.is-active {
          color: #ffffff;
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .profesores-course-form {
          margin-top: 14px;
          display: grid;
          gap: 12px;
          border-radius: 20px;
          padding: 14px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 70%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--profesores-accent) 18%,
            var(--profesores-border)
          );
        }

        .profesores-field {
          display: grid;
          gap: 6px;
        }

        .profesores-field label {
          color: var(--profesores-muted);
          font-size: 0.82rem;
          font-weight: 850;
        }

        .profesores-select {
          min-height: 42px;
          width: 100%;
          border-radius: 14px;
          padding: 0 12px;
          color: var(--profesores-text);
          background: var(--fcc-premium-surface);
          border: 1px solid var(--profesores-border);
          outline: none;
          font-size: 0.9rem;
          font-weight: 750;
        }

        .profesores-select:focus {
          border-color: color-mix(
            in srgb,
            var(--profesores-accent) 56%,
            var(--profesores-border)
          );
          box-shadow: 0 0 0 4px color-mix(
            in srgb,
            var(--profesores-accent) 12%,
            transparent
          );
        }

        .profesores-visitante {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--profesores-muted);
          font-size: 0.88rem;
          font-weight: 800;
        }

        .profesores-visitante input {
          width: 16px;
          height: 16px;
          accent-color: var(--profesores-accent);
        }

        @media (max-width: 640px) {
          .profesores-hero {
            padding: 14px 16px;
          }

          .profesores-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .profesores-description {
            font-size: 0.86rem;
          }

          .profesores-card {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
          }

          .profesores-modal-header {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            padding-right: 0;
            padding-top: 18px;
          }

          .profesores-course-main {
            grid-template-columns: 1fr;
          }

          .profesores-course-main > div:last-child {
            justify-self: stretch;
          }

          .profesores-primary-button,
          .profesores-warning-button,
          .profesores-muted-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="profesores-page">
        <section className="profesores-hero">
          <div className="profesores-hero-inner">
            <p className="profesores-kicker">Profesores</p>

            <p className="profesores-description">
              Consulta profesores y sus cursos en FCC Academy.
            </p>
          </div>
        </section>

        <section className="profesores-search-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            className="profesores-search-form"
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar profesor por nombre"
              className="profesores-search-input"
            />

            <button
              type="submit"
              className="profesores-primary-button profesores-search-button"
            >
              <Search size={17} strokeWidth={2.4} />
              <span>Buscar</span>
            </button>
          </form>
        </section>

        {loading ? (
          <section className="profesores-skeleton-panel animate-pulse">
            <div className="profesores-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="profesores-card">
                  <div className="profesores-skeleton-line h-24 w-24 rounded-full" />

                  <div className="space-y-3 w-full">
                    <div className="profesores-skeleton-line h-5 w-2/3" />
                    <div className="profesores-skeleton-line h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="profesores-panel">
            {profesores.length === 0 ? (
              <div className="profesores-empty">
                <p className="profesores-empty-text">
                  No hay profesores para mostrar.
                </p>
              </div>
            ) : (
              <div className="profesores-grid">
                {profesores.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="profesores-card"
                    onClick={() => openProfesor(p)}
                  >
                    <AvatarProfesores config={p.avatar_config} size={112} />

                    <span className="profesores-card-info">
                      <span className="profesores-card-name">{p.nombre}</span>

                      <span className="profesores-card-meta">Profesor</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {selectedProfesor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="profesores-modal-overlay"
            onClick={cerrarModalProfesor}
          >
            <div
              className="profesores-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="profesores-modal-close"
                onClick={cerrarModalProfesor}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <div className="profesores-modal-header">
                <AvatarProfesores
                  config={selectedProfesor.avatar_config}
                  size={230}
                />

                <div>
                  <h3 className="profesores-modal-title">
                    {selectedProfesor.nombre}
                  </h3>

                  <p className="profesores-modal-subtitle">Cursos creados</p>
                </div>
              </div>

              <div className="profesores-modal-section">
                <h4 className="profesores-section-title">Cursos</h4>

                {loadingCursos ? (
                  <div className="profesores-course-list animate-pulse">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="profesores-course-card">
                        <div className="profesores-skeleton-line h-5 w-2/3 mb-3" />
                        <div className="profesores-skeleton-line h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : cursos.length === 0 ? (
                  <div className="profesores-empty">
                    <p className="profesores-empty-text">
                      Este profesor aún no tiene cursos.
                    </p>
                  </div>
                ) : (
                  <div className="profesores-course-list">
                    {cursos.map((m) => (
                      <article key={m.id} className="profesores-course-card">
                        <div className="profesores-course-main">
                          <div>
                            <h5 className="profesores-course-title">
                              {m.nombre}
                            </h5>

                            <div className="profesores-course-meta">
                              {(m.curso_carreras ?? []).length === 0 ? (
                                <span>Sin carreras ligadas</span>
                              ) : (
                                (m.curso_carreras ?? []).map((cc) => (
                                  <span key={cc.id}>
                                    {cc.carrera?.nombre ?? "Carrera"} • Semestre{" "}
                                    {cc.semestre ?? "N/A"}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          <div>{renderCursoEstado(m)}</div>
                        </div>

                        {selectedCurso?.id === m.id &&
                          !m.progresoEstado?.exists && (
                            <div className="profesores-course-form">
                              <div className="profesores-field">
                                <label>Selecciona carrera</label>

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
                                  className="profesores-select"
                                >
                                  <option value="">-- Seleccionar --</option>

                                  {(selectedCurso?.curso_carreras ?? []).map(
                                    (cc) => (
                                      <option
                                        key={cc.id}
                                        value={cc.carrera?.id ?? ""}
                                      >
                                        {cc.carrera?.nombre ?? "Carrera"}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              {selectedCarrera && (
                                <div className="profesores-field">
                                  <label>Selecciona período</label>

                                  <select
                                    value={selectedPeriodo ?? ""}
                                    onChange={(e) =>
                                      setSelectedPeriodo(e.target.value || null)
                                    }
                                    disabled={visitante}
                                    className="profesores-select"
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
                                <div className="profesores-field">
                                  <label>Selecciona sección</label>

                                  <select
                                    value={selectedSeccion ?? ""}
                                    onChange={(e) =>
                                      setSelectedSeccion(e.target.value || null)
                                    }
                                    disabled={visitante}
                                    className="profesores-select"
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

                              <label className="profesores-visitante">
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

                                <span>Tomar curso como visitante</span>
                              </label>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </LayoutGeneral>
  );
}