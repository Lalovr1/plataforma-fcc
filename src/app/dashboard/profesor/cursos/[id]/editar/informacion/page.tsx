"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import EditarCarreraModal, {
  clonarCursoCarrera,
  crearCarreraInicial,
  normalizarCursoCarrera,
  validarCursoCarrera,
  type Carrera,
  type CursoCarrera,
} from "@/components/EditarCarreraModal";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

type ConfirmacionCurso =
  | { tipo: "eliminarCurso" }
  | { tipo: "eliminarCarrera"; index: number };

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



export default function EditarInformacionCursoPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionCurso | null>(null);

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cursoCarreras, setCursoCarreras] = useState<CursoCarrera[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState<CursoCarrera | null>(null);
  const [carreraModalIndex, setCarreraModalIndex] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [infoDirty, setInfoDirty] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!confirmacion) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmacion]);

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

      setInfoDirty(false);
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

  const guardarInformacionCurso = async ({
    mostrarToast = true,
  }: { mostrarToast?: boolean } = {}) => {
    if (!id) return false;

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      toast.error("El nombre del curso no puede estar vacío");
      return false;
    }

    const errorCarrera = cursoCarreras
      .map((cc, index) =>
        validarCursoCarrera(cc, {
          carrerasExistentes: cursoCarreras,
          ignorarIndex: index,
        })
      )
      .find(Boolean);

    if (errorCarrera) {
      toast.error(errorCarrera);
      return false;
    }

    const cursoCarrerasNormalizadas = cursoCarreras.map(normalizarCursoCarrera);

    setNombre(nombreLimpio);
    setCursoCarreras(cursoCarrerasNormalizadas);
    guardarCacheActual({
      nombre: nombreLimpio,
      cursoCarreras: cursoCarrerasNormalizadas,
    });

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
        return false;
      }

      await supabase.from("curso_carreras").delete().eq("curso_id", id);

      for (const cc of cursoCarrerasNormalizadas) {
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

      limpiarCachesRelacionados(id);
      await fetchData();

      setInfoDirty(false);

      if (mostrarToast) {
        toast.success("Información actualizada");
      }

      return true;
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar curso");
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const handleDelete = () => {
    setConfirmacion({ tipo: "eliminarCurso" });
  };

  const eliminarCursoConfirmado = async () => {
    if (!id) return;

    setGuardando(true);

    const { error } = await supabase.from("materias").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar curso");
      setGuardando(false);
      return;
    }

    limpiarCachesRelacionados(id);
    toast.success("Curso eliminado");
    router.push("/dashboard/profesor");
  };

  const eliminarCarreraConfirmada = (index: number) => {
    setCursoCarreras((prev) => {
      const next = prev.filter((_, i) => i !== index);
      guardarCacheActual({ cursoCarreras: next });
      return next;
    });

    if (id) limpiarCachesRelacionados(id);

    setInfoDirty(true);
    setConfirmacion(null);
    toast.success("Carrera eliminada");
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
    setInfoDirty(true);
  };

  const resumenPeriodos = (cc: CursoCarrera) => {
    if (!cc.periodos.length) return "Sin períodos";
    return cc.periodos
      .map((p) => `${p.nombre} ${p.anio} (${p.secciones.length} secc.)`)
      .join(", ");
  };

  const abrirModalAgregarCarrera = () => {
    setCarreraModalIndex(null);
    setNuevaCarrera(crearCarreraInicial());
  };

  const abrirModalEditarCarrera = (carrera: CursoCarrera, index: number) => {
    setCarreraModalIndex(index);
    setNuevaCarrera(clonarCursoCarrera(carrera));
  };

  const cerrarModalCarrera = () => {
    setNuevaCarrera(null);
    setCarreraModalIndex(null);
  };

  const guardarCarreraDesdeModal = (carreraNormalizada: CursoCarrera) => {
    const indexActual = carreraModalIndex;

    setCursoCarreras((prev) => {
      const next =
        indexActual === null
          ? [...prev, carreraNormalizada]
          : prev.map((carrera, index) =>
              index === indexActual ? carreraNormalizada : carrera
            );

      guardarCacheActual({ cursoCarreras: next });
      return next;
    });

    setInfoDirty(true);
    toast.success(
      indexActual === null ? "Carrera agregada" : "Carrera actualizada"
    );

    return true;
  };


  const volverAlMenu = async () => {
    if (guardando) return;

    if (infoDirty) {
      const guardado = await guardarInformacionCurso();

      if (!guardado) return;
    }

    router.push(`/dashboard/profesor/cursos/${id}/editar`);
  };

  const estilos = (
    <style>{`
      .editar-curso-page,
      .editar-curso-modal-overlay {
        --editar-accent: var(--fcc-premium-accent);
        --editar-accent-hover: var(--fcc-premium-accent-hover);
        --editar-cyan: var(--fcc-premium-cyan);
        --editar-surface: var(--fcc-premium-surface);
        --editar-surface-soft: var(--fcc-premium-surface-soft);
        --editar-surface-strong: var(--fcc-premium-surface-strong);
        --editar-text: var(--fcc-premium-text);
        --editar-text-soft: var(--fcc-premium-text-soft);
        --editar-muted: var(--fcc-premium-muted);
        --editar-border: var(--fcc-premium-border);
        --editar-border-strong: var(--fcc-premium-border-strong);
        --editar-shadow: var(--fcc-premium-shadow);
        --editar-shadow-soft: var(--fcc-premium-shadow-soft);
        --editar-button: var(--fcc-premium-button);
      }

      .editar-curso-page {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .editar-curso-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
        gap: 18px;
        align-items: start;
        min-width: 0;
      }

      .editar-curso-stack {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .editar-curso-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--editar-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editar-surface) 96%, transparent),
            color-mix(in srgb, var(--editar-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--editar-accent) 14%, var(--editar-border));
        box-shadow:
          var(--editar-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--editar-surface-strong) 65%, transparent);
      }

      .editar-curso-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--editar-accent) 7%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 24%,
            color-mix(in srgb, var(--editar-accent) 5%, transparent) 24% 24.35%,
            transparent 24.35% 100%
          );
        opacity: 0.68;
      }

      .editar-curso-card.no-line::before {
        content: none;
      }

      .editar-curso-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
      }

      .editar-curso-section {
        padding: 22px;
      }

      .editar-curso-header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
      }

      .editar-curso-title-group {
        min-width: 0;
      }

      .editar-curso-eyebrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--editar-accent);
        font-size: 0.74rem;
        font-weight: 950;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .editar-curso-eyebrow::before,
      .editar-curso-eyebrow::after {
        content: "";
        width: 36px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--editar-accent) 62%, transparent)
        );
      }

      .editar-curso-eyebrow::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--editar-accent) 62%, transparent),
          transparent
        );
      }

      .editar-curso-title {
        color: var(--editar-text);
        font-size: clamp(1.25rem, 2.4vw, 1.75rem);
        font-weight: 950;
        line-height: 1.04;
        letter-spacing: -0.045em;
        text-wrap: balance;
      }

      .editar-curso-hero .editar-curso-eyebrow {
        font-size: 0.82rem;
        letter-spacing: 0.24em;
      }

      .editar-curso-view-row .editar-curso-title {
        max-width: 900px;
        font-size: clamp(1.75rem, 3.4vw, 2.75rem);
        line-height: 0.98;
        letter-spacing: -0.06em;
      }

      .editar-curso-description {
        margin-top: 8px;
        color: var(--editar-muted);
        font-size: 0.92rem;
        font-weight: 650;
        line-height: 1.48;
      }

      .editar-curso-editor-box {
        min-width: 0;
      }

      .editar-curso-form {
        padding: 22px;
      }

      .editar-curso-form-grid {
        display: grid;
        gap: 18px;
      }

      .editar-curso-info-shell {
        width: min(100%, 1220px);
        margin: 0 auto;
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .editar-curso-info-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.48fr) minmax(300px, 0.52fr);
        gap: 16px;
        align-items: start;
        min-width: 0;
      }

      .editar-curso-info-side {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .editar-curso-panel-title {
        color: var(--editar-text);
        font-size: 1rem;
        font-weight: 950;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      .editar-curso-panel-description {
        margin-top: 8px;
        color: var(--editar-muted);
        font-size: 0.84rem;
        font-weight: 750;
        line-height: 1.38;
      }

      .editar-curso-danger-panel {
        border-color: color-mix(in srgb, var(--color-danger) 24%, var(--editar-border));
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-danger) 6%, var(--editar-surface)),
            color-mix(in srgb, var(--editar-surface-soft) 98%, transparent)
          );
      }

      .editar-curso-danger-title {
        color: var(--editar-text);
        font-size: 1rem;
        font-weight: 950;
        line-height: 1.2;
      }

      .editar-curso-danger-text {
        margin: 8px 0 14px;
        color: var(--editar-muted);
        font-size: 0.84rem;
        font-weight: 750;
        line-height: 1.38;
      }

      .editar-curso-module-shell {
        width: min(100%, 780px);
        margin: 0 auto;
        display: grid;
        min-width: 0;
      }

      .editar-curso-module-shell.quiz-shell {
        width: min(100%, 1220px);
      }

      .editar-curso-module-shell.content-shell {
        width: 100%;
      }

      .editar-curso-info-panel {
        padding: clamp(16px, 2.8vw, 26px);
      }

      .editar-curso-info-intro {
        display: grid;
        gap: 6px;
        place-items: center;
        text-align: center;
        margin-bottom: 16px;
      }

      .editar-curso-info-description {
        max-width: 620px;
        color: var(--editar-muted);
        font-size: 0.9rem;
        line-height: 1.4;
        font-weight: 700;
      }

      .editar-curso-section-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 4px 0 12px;
        color: var(--editar-text);
        font-size: 1rem;
        font-weight: 950;
        letter-spacing: -0.02em;
        text-align: center;
      }

      .editar-curso-section-title::before,
      .editar-curso-section-title::after {
        content: "";
        width: 42px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--editar-accent) 55%, transparent)
        );
      }

      .editar-curso-section-title::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--editar-accent) 55%, transparent),
          transparent
        );
      }

      .editar-curso-field {
        display: grid;
        gap: 8px;
      }

      .editar-curso-label {
        color: var(--editar-text-soft);
        font-size: 0.82rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .editar-curso-input,
      .editar-curso-select {
        min-height: 44px;
        width: 100%;
        border-radius: 14px;
        padding: 0 13px;
        color: var(--editar-text);
        background: color-mix(in srgb, var(--editar-surface-strong) 74%, transparent);
        border: 1px solid var(--editar-border);
        outline: none;
        transition:
          border-color 170ms ease,
          background 170ms ease;
      }

      .editar-curso-title-textarea {
        min-height: 44px;
        max-height: calc(1.4em * 5 + 24px);
        padding: 12px 13px;
        line-height: 1.4;
        resize: none;
        overflow-y: auto;
        field-sizing: content;
      }

      .editar-curso-input:focus,
      .editar-curso-select:focus {
        border-color: color-mix(in srgb, var(--editar-accent) 56%, var(--editar-border));
        background: color-mix(in srgb, var(--editar-surface-strong) 90%, transparent);
      }

      .editar-curso-empty {
        border-radius: 16px;
        padding: 12px 14px;
        color: var(--editar-muted);
        background: color-mix(in srgb, var(--editar-surface-strong) 58%, transparent);
        border: 1px dashed color-mix(in srgb, var(--editar-accent) 20%, var(--editar-border));
        font-size: 0.86rem;
        font-weight: 750;
      }

      .editar-curso-careers-list {
        display: grid;
        gap: 10px;
      }

      .editar-curso-info-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 14px;
      }

      .editar-curso-career-card {
        border-radius: 18px;
        padding: 14px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editar-surface-strong) 74%, transparent),
            color-mix(in srgb, var(--editar-surface-soft) 86%, transparent)
          );
        border: 1px solid var(--editar-border);
      }

      .editar-curso-career-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .editar-curso-career-info {
        min-width: 0;
      }

      .editar-curso-career-name {
        color: var(--editar-text);
        font-size: 0.98rem;
        font-weight: 950;
        line-height: 1.2;
      }

      .editar-curso-career-meta,
      .editar-curso-career-periods {
        color: var(--editar-muted);
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.35;
      }

      .editar-curso-career-periods {
        margin-top: 8px;
      }

      .editar-curso-inline-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 7px;
      }

      .editar-curso-small-button {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 10px;
        padding: 0 10px;
        color: var(--editar-text);
        background: color-mix(in srgb, var(--editar-surface-strong) 84%, transparent);
        border: 1px solid var(--editar-border);
        font-size: 0.78rem;
        font-weight: 900;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease,
          opacity 170ms ease;
      }

      .editar-curso-inline-actions .editar-curso-small-button {
        width: 34px;
        height: 34px;
        min-width: 34px;
        min-height: 34px;
        padding: 0;
        border-radius: 12px;
      }

      .editar-curso-small-button:disabled {
        cursor: not-allowed;
        opacity: 0.42;
        transform: none;
      }

      .editar-curso-small-button:hover {
        transform: translateY(-1px);
        border-color: var(--editar-border-strong);
      }

      .editar-curso-small-button.warning {
        color: var(--editar-text);
        background: color-mix(in srgb, #f59e0b 16%, var(--editar-surface-strong));
        border-color: color-mix(in srgb, #f59e0b 36%, var(--editar-border));
      }

      .editar-curso-small-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .editar-curso-small-button.primary {
        color: #ffffff;
        background: var(--editar-button);
        border-color: transparent;
      }

      .theme-oscuro .editar-curso-small-button.primary {
        color: #050505;
      }

      .editar-curso-button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .editar-curso-button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 14px;
        padding: 0 16px;
        color: #ffffff;
        background: var(--editar-button);
        border: 1px solid transparent;
        font-size: 0.92rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .theme-oscuro .editar-curso-button {
        color: #050505;
      }

      .editar-curso-button:hover {
        transform: translateY(-1px);
      }

      .editar-curso-button:disabled {
        cursor: not-allowed;
        opacity: 0.56;
        transform: none;
      }

      .editar-curso-button.secondary {
        color: var(--editar-text);
        background: color-mix(in srgb, var(--editar-surface-strong) 82%, transparent);
        border-color: var(--editar-border);
      }

      .editar-curso-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .editar-curso-button.flex {
        flex: 1 1 180px;
      }

      .editar-curso-visibility {
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 16px;
        padding: 13px 14px;
        color: var(--editar-text-soft);
        background: color-mix(in srgb, var(--editar-surface-strong) 62%, transparent);
        border: 1px solid var(--editar-border);
        font-size: 0.92rem;
        font-weight: 800;
      }

      .editar-curso-checkbox {
        width: 18px;
        height: 18px;
        accent-color: var(--editar-accent);
      }

      .editar-curso-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.62);
        backdrop-filter: blur(8px);
      }

      .editar-curso-modal {
        position: relative;
        width: min(94vw, 760px);
        max-height: 90dvh;
        overflow-y: auto;
        overflow-x: hidden;
        border-radius: 30px;
        clip-path: inset(0 round 30px);
        padding: clamp(18px, 3vw, 28px);
        color: var(--editar-text);
        background:
          linear-gradient(
            135deg,
            var(--editar-surface),
            var(--editar-surface-soft)
          );
        border: 1px solid var(--editar-border);
        box-shadow:
          var(--editar-shadow),
          inset 0 1px 0 color-mix(
            in srgb,
            var(--editar-surface-strong) 68%,
            transparent
          );
        scrollbar-width: thin;
        scrollbar-color: color-mix(
          in srgb,
          var(--editar-accent) 42%,
          transparent
        ) transparent;
      }

      .editar-curso-modal::-webkit-scrollbar {
        width: 10px;
      }

      .editar-curso-modal::-webkit-scrollbar-track {
        background: transparent;
        margin: 18px 0;
      }

      .editar-curso-modal::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--editar-accent) 42%,
          transparent
        );
        border: 3px solid transparent;
        background-clip: padding-box;
      }

      .editar-curso-modal-content {
        display: grid;
        gap: 14px;
      }

      .editar-curso-modal-close {
        position: absolute;
        right: 14px;
        top: 14px;
        z-index: 3;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: var(--editar-text);
        background: color-mix(
          in srgb,
          var(--editar-surface-strong) 76%,
          transparent
        );
        border: 1px solid var(--editar-border);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          color 170ms ease;
      }

      .editar-curso-modal-close:hover {
        transform: translateY(-1px);
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 34%, var(--editar-border));
      }

      .editar-curso-modal-title {
        padding-right: 42px;
        color: var(--editar-text);
        font-size: clamp(1.6rem, 3vw, 2.4rem);
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.055em;
        text-align: center;
      }

      .editar-curso-modal-description {
        max-width: 520px;
        margin: 0 auto 10px;
        color: var(--editar-muted);
        text-align: center;
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .editar-curso-confirm-modal {
        width: min(94vw, 520px);
      }

      .editar-curso-confirm-copy {
        display: grid;
        gap: 10px;
        text-align: center;
      }

      .editar-curso-confirm-warning {
        border-radius: 18px;
        padding: 13px 14px;
        color: var(--editar-text);
        background: color-mix(in srgb, var(--color-danger) 8%, var(--editar-surface-strong));
        border: 1px solid color-mix(in srgb, var(--color-danger) 24%, var(--editar-border));
        font-size: 0.9rem;
        font-weight: 750;
        line-height: 1.45;
      }

      .editar-curso-periods {
        display: grid;
        gap: 10px;
      }

      .editar-curso-period-card {
        display: grid;
        gap: 10px;
        border-radius: 18px;
        padding: 14px;
        background: color-mix(in srgb, var(--editar-surface-strong) 68%, transparent);
        border: 1px solid var(--editar-border);
      }

      .editar-curso-period-row,
      .editar-curso-section-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 110px auto;
        gap: 8px;
        align-items: center;
      }

      .editar-curso-section-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .editar-curso-sections {
        display: grid;
        gap: 8px;
        padding-left: 12px;
      }

      .editar-curso-modal-actions {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        padding-top: 4px;
      }

      .editar-curso-skeleton {
        animation: editarCursoPulse 1.35s ease-in-out infinite;
      }

      .editar-curso-skeleton-block {
        border-radius: 16px;
        background: color-mix(in srgb, var(--editar-border-strong) 28%, transparent);
      }

      @keyframes editarCursoPulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }


      .editar-curso-hero {
        padding: 24px;
      }

      .editar-curso-hero-copy {
        position: relative;
        min-width: 0;
        text-align: center;
        padding-top: 2px;
      }

      .editar-curso-hero-back {
        position: absolute;
        left: 0;
        top: 0;
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 999px;
        padding: 0 15px;
        color: var(--editar-accent);
        background: color-mix(in srgb, var(--editar-surface-strong) 82%, transparent);
        border: 1px solid color-mix(in srgb, var(--editar-accent) 24%, var(--editar-border));
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .editar-curso-hero-back:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--editar-accent) 42%, var(--editar-border));
        background: color-mix(in srgb, var(--editar-accent) 8%, var(--editar-surface-strong));
      }

      .editar-curso-hero-title {
        color: var(--editar-text);
        font-size: clamp(1.75rem, 3.4vw, 2.75rem);
        font-weight: 950;
        line-height: 0.98;
        letter-spacing: -0.06em;
        text-wrap: balance;
      }

      .editar-curso-hero-description {
        max-width: 620px;
        margin: 8px auto 0;
        color: var(--editar-muted);
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.38;
      }

      .editar-curso-publish-card {
        width: min(100%, 760px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        border-radius: 22px;
        padding: 14px 16px;
        color: var(--editar-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editar-surface) 96%, transparent),
            color-mix(in srgb, var(--editar-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--editar-accent) 18%, var(--editar-border));
        box-shadow:
          var(--editar-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--editar-surface-strong) 62%, transparent);
      }

      .editar-curso-publish-card.published {
        border-color: color-mix(in srgb, #10b981 42%, var(--editar-border));
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #10b981 10%, var(--editar-surface)),
            color-mix(in srgb, var(--editar-surface-soft) 98%, transparent)
          );
      }

      .editar-curso-publish-icon {
        width: 46px;
        height: 46px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        color: var(--editar-accent);
        background: color-mix(in srgb, var(--editar-accent) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--editar-accent) 22%, var(--editar-border));
      }

      .editar-curso-publish-card.published .editar-curso-publish-icon {
        color: #10b981;
        background: color-mix(in srgb, #10b981 10%, transparent);
        border-color: color-mix(in srgb, #10b981 32%, var(--editar-border));
      }

      .editar-curso-publish-copy {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .editar-curso-publish-title {
        color: var(--editar-text);
        font-size: 0.98rem;
        font-weight: 950;
        line-height: 1.18;
      }

      .editar-curso-publish-text {
        color: var(--editar-muted);
        font-size: 0.84rem;
        font-weight: 750;
        line-height: 1.32;
      }

      .editar-curso-switch {
        position: relative;
        width: 58px;
        height: 34px;
        display: inline-flex;
        flex: 0 0 auto;
        cursor: pointer;
      }

      .editar-curso-switch input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .editar-curso-switch-track {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: color-mix(in srgb, var(--editar-surface-strong) 82%, transparent);
        border: 1px solid var(--editar-border);
        transition:
          background 170ms ease,
          border-color 170ms ease;
      }

      .editar-curso-switch-track::before {
        content: "";
        position: absolute;
        top: 4px;
        left: 4px;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: var(--editar-text);
        transition:
          transform 170ms ease,
          background 170ms ease;
      }

      .editar-curso-switch input:checked + .editar-curso-switch-track {
        background: color-mix(in srgb, #10b981 24%, var(--editar-surface-strong));
        border-color: color-mix(in srgb, #10b981 48%, var(--editar-border));
      }

      .editar-curso-switch input:checked + .editar-curso-switch-track::before {
        transform: translateX(24px);
        background: #10b981;
      }

      .editar-curso-switch input:disabled + .editar-curso-switch-track {
        opacity: 0.56;
      }

      .editar-curso-menu-grid {
        width: min(100%, 1030px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(4, minmax(180px, 220px));
        justify-content: center;
        gap: 16px;
      }

      .editar-curso-option-card {
        --option-accent: var(--editar-accent);
        --option-soft: color-mix(in srgb, var(--option-accent) 12%, var(--editar-surface-soft));

        position: relative;
        min-height: 246px;
        display: grid;
        grid-template-rows: 132px auto;
        border-radius: 24px;
        color: var(--editar-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editar-surface) 97%, transparent),
            color-mix(in srgb, var(--editar-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--option-accent) 18%, var(--editar-border));
        box-shadow:
          var(--editar-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--editar-surface-strong) 62%, transparent);
        text-align: center;
        overflow: hidden;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .editar-curso-option-card:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--option-accent) 38%, var(--editar-border));
      }

      .editar-curso-option-card.tone-content {
        --option-accent: color-mix(in srgb, var(--editar-accent) 88%, var(--editar-cyan));
      }

      .editar-curso-option-card.tone-quiz {
        --option-accent: color-mix(in srgb, #10b981 44%, var(--editar-accent));
      }

      .editar-curso-option-card.tone-info {
        --option-accent: color-mix(in srgb, #8b5cf6 42%, var(--editar-accent));
      }

      .editar-curso-option-card.tone-ranking {
        --option-accent: color-mix(in srgb, #f59e0b 54%, var(--editar-accent));
      }

      .editar-curso-option-visual {
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--option-accent) 20%, transparent),
            transparent 56%
          ),
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--option-accent) 12%, var(--editar-surface-strong)),
            color-mix(in srgb, var(--editar-cyan) 7%, var(--editar-surface-soft))
          );
        border-bottom: 1px solid color-mix(in srgb, var(--option-accent) 18%, var(--editar-border));
      }

      .editar-curso-option-visual::before {
        content: "";
        position: absolute;
        inset: 14px;
        border-radius: 22px;
        border: 1px solid color-mix(in srgb, var(--option-accent) 20%, transparent);
      }

      .editar-curso-option-visual::after {
        content: "";
        position: absolute;
        width: 130px;
        height: 130px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--option-accent) 8%, transparent);
        filter: blur(1px);
      }

      .editar-curso-visual-icon {
        position: relative;
        z-index: 2;
        width: 76px;
        height: 76px;
        display: grid;
        place-items: center;
        border-radius: 24px;
        color: var(--option-accent);
        background: color-mix(in srgb, var(--editar-surface-strong) 86%, transparent);
        border: 1px solid color-mix(in srgb, var(--option-accent) 28%, var(--editar-border));
      }

      .editar-curso-icon-svg {
        width: 42px;
        height: 42px;
        stroke-width: 2.35;
      }

      .editar-curso-option-body {
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 14px;
        padding: 18px 16px 18px;
      }

      .editar-curso-option-title {
        color: var(--editar-text);
        font-size: 1.03rem;
        font-weight: 950;
        line-height: 1.14;
        letter-spacing: -0.025em;
      }

      .editar-curso-option-action {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 14px;
        color: var(--option-accent);
        background: color-mix(in srgb, var(--option-accent) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--option-accent) 22%, var(--editar-border));
        font-size: 0.84rem;
        font-weight: 950;
      }

      .editar-curso-view-layout {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .editar-curso-view-header {
        padding: 24px;
      }

      .editar-curso-view-row {
        position: relative;
        display: grid;
        justify-items: center;
        gap: 8px;
        text-align: center;
        padding-top: 0;
      }

      .editar-curso-back-button {
        position: absolute;
        left: 0;
        top: 0;
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 999px;
        padding: 0 15px;
        color: var(--editar-accent);
        background: color-mix(in srgb, var(--editar-surface-strong) 82%, transparent);
        border: 1px solid color-mix(in srgb, var(--editar-accent) 24%, var(--editar-border));
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .editar-curso-back-button:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--editar-accent) 42%, var(--editar-border));
        background: color-mix(in srgb, var(--editar-accent) 8%, var(--editar-surface-strong));
      }

      .editar-curso-view-icon {
        position: absolute;
        right: 0;
        top: 50%;
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        border-radius: 20px;
        color: var(--editar-accent);
        background:
          radial-gradient(
            circle,
            color-mix(in srgb, var(--editar-accent) 13%, var(--editar-surface-strong)),
            color-mix(in srgb, var(--editar-surface-strong) 84%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--editar-accent) 28%, var(--editar-border));
        transform: translateY(-50%);
      }

      .editar-curso-view-icon.info {
        color: color-mix(in srgb, #8b5cf6 42%, var(--editar-accent));
        border-color: color-mix(in srgb, #8b5cf6 28%, var(--editar-border));
        background:
          radial-gradient(
            circle,
            color-mix(in srgb, #8b5cf6 11%, var(--editar-surface-strong)),
            color-mix(in srgb, var(--editar-surface-strong) 84%, transparent)
          );
      }

      .editar-curso-view-icon.content {
        color: color-mix(in srgb, var(--editar-accent) 88%, var(--editar-cyan));
        border-color: color-mix(in srgb, var(--editar-accent) 30%, var(--editar-border));
        background:
          radial-gradient(
            circle,
            color-mix(in srgb, var(--editar-accent) 12%, var(--editar-surface-strong)),
            color-mix(in srgb, var(--editar-surface-strong) 84%, transparent)
          );
      }

      .editar-curso-view-icon.quiz {
        color: color-mix(in srgb, #10b981 44%, var(--editar-accent));
        border-color: color-mix(in srgb, #10b981 30%, var(--editar-border));
        background:
          radial-gradient(
            circle,
            color-mix(in srgb, #10b981 11%, var(--editar-surface-strong)),
            color-mix(in srgb, var(--editar-surface-strong) 84%, transparent)
          );
      }

      @media (max-width: 1100px) {
        .editar-curso-grid {
          grid-template-columns: 1fr;
        }

        .editar-curso-menu-grid {
          width: min(100%, 520px);
          grid-template-columns: repeat(2, minmax(0, 220px));
        }
      }

      @media (max-width: 440px) {
        .editar-curso-menu-grid {
          width: min(100%, 230px);
          grid-template-columns: 1fr;
          margin-top: 0;
        }
      }

      @media (max-width: 640px) {
        .editar-curso-section,
        .editar-curso-form,
        .editar-curso-modal {
          border-radius: 24px;
          padding: 16px;
        }

        .editar-curso-header-row {
          flex-direction: column;
        }

        .editar-curso-career-card {
          text-align: center;
        }

        .editar-curso-career-top {
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .editar-curso-career-info {
          width: 100%;
          display: grid;
          justify-items: center;
        }

        .editar-curso-career-periods {
          margin-top: 8px;
        }

        .editar-curso-inline-actions {
          width: 100%;
          justify-content: center;
        }

        .editar-curso-button-row {
          flex-direction: column;
        }

        .editar-curso-button.flex {
          flex: 1 1 auto;
          width: 100%;
        }


        .editar-curso-menu-grid {
          width: min(100%, 420px);
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 0;
        }

        .editar-curso-publish-card {
          grid-template-columns: auto minmax(0, 1fr);
          width: 100%;
          margin-top: 0;
        }

        .editar-curso-switch {
          grid-column: 1 / -1;
          justify-self: start;
        }

        .editar-curso-info-shell,
        .editar-curso-module-shell {
          width: 100%;
        }

        .editar-curso-info-layout {
          grid-template-columns: 1fr;
        }

        .editar-curso-hero {
          padding: 18px 16px;
        }

        .editar-curso-hero-copy {
          padding-top: 42px;
        }

        .editar-curso-view-header {
          padding: 18px 16px;
        }

        .editar-curso-hero-back,
        .editar-curso-back-button {
          left: 0;
          top: 0;
          min-height: 36px;
          padding: 0 13px;
          font-size: 0.84rem;
        }

        .editar-curso-view-icon {
          position: static;
          transform: none;
          order: -1;
          margin-top: 0;
        }

        .editar-curso-info-actions {
          justify-content: stretch;
        }

        .editar-curso-option-card {
          min-height: 206px;
          grid-template-rows: 104px auto;
          border-radius: 22px;
        }

        .editar-curso-visual-icon {
          width: 62px;
          height: 62px;
          border-radius: 20px;
        }

        .editar-curso-icon-svg {
          width: 34px;
          height: 34px;
        }

        .editar-curso-period-row,
        .editar-curso-section-row {
          grid-template-columns: 1fr;
        }

        .editar-curso-sections {
          padding-left: 0;
        }

        .editar-curso-button {
          width: 100%;
        }

        .editar-curso-inline-actions .editar-curso-small-button {
          width: 38px;
          height: 38px;
          min-width: 38px;
          min-height: 38px;
          padding: 0;
        }
      }
    `}</style>
  );


  if (loading) {
    return (
      <LayoutGeneral rol="profesor">
        {estilos}

        <div className="editar-curso-page">
          <section className="editar-curso-card editar-curso-view-header editar-curso-skeleton">
            <div className="editar-curso-card-content editar-curso-view-row">
              <div
                className="editar-curso-skeleton-block"
                style={{ width: "150px", height: "16px", marginBottom: 8 }}
              />

              <div
                className="editar-curso-skeleton-block"
                style={{
                  width: "min(760px, 82%)",
                  height: "44px",
                }}
              />

              <div
                className="editar-curso-skeleton-block"
                style={{
                  width: "min(540px, 72%)",
                  height: "18px",
                }}
              />
            </div>
          </section>
        </div>
      </LayoutGeneral>
    );
  }


  return (
    <LayoutGeneral rol="profesor">
      {estilos}

      <div className="editar-curso-page">
        <div className="editar-curso-view-layout">
          <section className="editar-curso-card editar-curso-view-header">
            <div className="editar-curso-card-content editar-curso-view-row">
              <button
                type="button"
                onClick={() => void volverAlMenu()}
                disabled={guardando}
                className="editar-curso-back-button"
              >
                <ArrowLeft size={17} strokeWidth={2.8} aria-hidden="true" />
                <span>Volver al menú</span>
              </button>

              <p className="editar-curso-eyebrow">Información del curso</p>
              <h1 className="editar-curso-title">
                {nombre || "Información del curso"}
              </h1>
              <p className="editar-curso-description">
                Actualiza el nombre del curso y las carreras, períodos y secciones ligadas.
              </p>

              <div className="editar-curso-view-icon info" aria-hidden="true">
                <SlidersHorizontal size={34} strokeWidth={2.35} />
              </div>
            </div>
          </section>

              <div className="editar-curso-info-shell">
                <div className="editar-curso-info-layout">
                  <section className="editar-curso-card editar-curso-info-panel no-line">
                    <div className="editar-curso-card-content">
                      <h2 className="editar-curso-section-title">
                        Carreras ligadas
                      </h2>

                      {cursoCarreras.length === 0 ? (
                        <div className="editar-curso-empty">
                          No hay carreras agregadas.
                        </div>
                      ) : (
                        <div className="editar-curso-careers-list">
                          {cursoCarreras.map((cc, idx) => {
                            const carreraNombre =
                              carreras.find((c) => c.id === cc.carrera_id)
                                ?.nombre || "Sin carrera";

                            return (
                              <article
                                key={cc.id ?? idx}
                                className="editar-curso-career-card"
                              >
                                <div className="editar-curso-career-top">
                                  <div className="editar-curso-career-info">
                                    <p className="editar-curso-career-name">
                                      {carreraNombre}
                                    </p>
                                    <p className="editar-curso-career-meta">
                                      Semestre {cc.semestre || "-"} · {cc.area}
                                    </p>
                                    <p className="editar-curso-career-periods">
                                      {resumenPeriodos(cc)}
                                    </p>
                                  </div>

                                  <div className="editar-curso-inline-actions">
                                    {cursoCarreras.length > 1 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => moveCarrera(idx, "up")}
                                          disabled={idx === 0}
                                          className="editar-curso-small-button"
                                          aria-label="Subir carrera"
                                          title="Subir"
                                        >
                                          <ArrowUp size={16} strokeWidth={2.8} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => moveCarrera(idx, "down")}
                                          disabled={idx === cursoCarreras.length - 1}
                                          className="editar-curso-small-button"
                                          aria-label="Bajar carrera"
                                          title="Bajar"
                                        >
                                          <ArrowDown size={16} strokeWidth={2.8} />
                                        </button>
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => abrirModalEditarCarrera(cc, idx)}
                                      className="editar-curso-small-button warning"
                                      aria-label="Editar carrera"
                                      title="Editar"
                                    >
                                      <Pencil size={15} strokeWidth={2.6} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmacion({
                                          tipo: "eliminarCarrera",
                                          index: idx,
                                        })
                                      }
                                      className="editar-curso-small-button danger"
                                      aria-label="Eliminar carrera"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={15} strokeWidth={2.6} />
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}

                      <div className="editar-curso-info-actions">
                        <button
                          type="button"
                          onClick={abrirModalAgregarCarrera}
                          className="editar-curso-button"
                        >
                          <Plus size={18} strokeWidth={2.7} />
                          Agregar carrera
                        </button>
                      </div>
                    </div>
                  </section>

                  <aside className="editar-curso-info-side">
                    <section className="editar-curso-card editar-curso-info-panel no-line">
                      <div className="editar-curso-card-content">
                        <p className="editar-curso-panel-title">
                          Nombre del curso
                        </p>

                        <p className="editar-curso-panel-description">
                          Modifica cómo se muestra este curso dentro de FCC Academy.
                        </p>

                        <div className="editar-curso-field" style={{ marginTop: 14 }}>
                          <label className="editar-curso-label">
                            Nombre del curso
                          </label>
                          <textarea
                            value={nombre}
                            rows={1}
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = "auto";
                              el.style.height = `${Math.min(
                                el.scrollHeight,
                                132
                              )}px`;
                            }}
                            onChange={(e) => {
                              setNombre(e.target.value);
                              guardarCacheActual({ nombre: e.target.value });
                              setInfoDirty(true);
                            }}
                            className="editar-curso-input editar-curso-title-textarea"
                            placeholder="Ingresa el nombre del curso"
                            required
                          />
                        </div>

                        {infoDirty && (
                          <p className="editar-curso-panel-description">
                            Se guardará automáticamente al volver al menú.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="editar-curso-card editar-curso-info-panel editar-curso-danger-panel no-line">
                      <div className="editar-curso-card-content">
                        <p className="editar-curso-danger-title">
                          Eliminar curso
                        </p>

                        <p className="editar-curso-danger-text">
                          Esta acción elimina el curso por completo.
                        </p>

                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={guardando}
                          className="editar-curso-button danger"
                        >
                          <Trash2 size={18} strokeWidth={2.7} />
                          Eliminar curso
                        </button>
                      </div>
                    </section>
                  </aside>
                </div>

                <EditarCarreraModal
                  open={Boolean(nuevaCarrera)}
                  onClose={cerrarModalCarrera}
                  carrera={nuevaCarrera}
                  carrerasDisponibles={carreras}
                  modo={carreraModalIndex === null ? "agregar" : "editar"}
                  carrerasYaAgregadas={cursoCarreras}
                  carreraActualIndex={carreraModalIndex}
                  onSave={guardarCarreraDesdeModal}
                />
              </div>
        </div>
      </div>

      {confirmacion &&
        renderPortal(
          <div className="editar-curso-modal-overlay">
            <div className="editar-curso-modal editar-curso-confirm-modal">
              <div className="editar-curso-modal-content">
                <button
                  type="button"
                  onClick={() => setConfirmacion(null)}
                  className="editar-curso-modal-close"
                  aria-label="Cerrar confirmación"
                >
                  <X size={20} strokeWidth={2.8} />
                </button>

                <h2 className="editar-curso-modal-title">
                  {confirmacion.tipo === "eliminarCurso"
                    ? "Eliminar curso"
                    : "Eliminar carrera"}
                </h2>

                <div className="editar-curso-confirm-copy">
                  <p className="editar-curso-modal-description">
                    {confirmacion.tipo === "eliminarCurso"
                      ? "Esta acción eliminará el curso completo."
                      : "Esta acción quitará esta carrera de la configuración del curso."}
                  </p>

                  <p className="editar-curso-confirm-warning">
                    {confirmacion.tipo === "eliminarCurso"
                      ? "Si hay estudiantes inscritos, podrían perder acceso al curso y a sus datos relacionados."
                      : "Si hay estudiantes inscritos en esta carrera, período o sección, este cambio puede afectar su acceso o progreso relacionado."}
                  </p>
                </div>

                <div className="editar-curso-modal-actions">
                  <button
                    type="button"
                    onClick={() => setConfirmacion(null)}
                    className="editar-curso-button secondary"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirmacion.tipo === "eliminarCurso") {
                        void eliminarCursoConfirmado();
                        return;
                      }

                      eliminarCarreraConfirmada(confirmacion.index);
                    }}
                    disabled={guardando}
                    className="editar-curso-button danger"
                  >
                    <Trash2 size={16} strokeWidth={2.6} />
                    Confirmar eliminación
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

    </LayoutGeneral>
  );
}
