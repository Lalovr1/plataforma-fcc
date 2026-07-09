/**
 * Menú principal para editar un curso:
 * - Verifica que el profesor sea dueño del curso.
 * - Permite publicar/ocultar el curso.
 * - Enlaza a Contenido, Quizzes, Información y Ranking como rutas separadas.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";

type CursoCache = {
  timestamp: number;
  profesorId: string;
  nombre: string;
  visible: boolean;
  carreras?: unknown[];
  cursoCarreras?: unknown[];
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

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      profesorId: parsed.profesorId,
      nombre: parsed.nombre,
      visible: Boolean(parsed.visible),
      carreras: Array.isArray(parsed.carreras) ? parsed.carreras : [],
      cursoCarreras: Array.isArray(parsed.cursoCarreras) ? parsed.cursoCarreras : [],
    };
  } catch {
    return null;
  }
}

function guardarEditarCursoCache(
  usuarioId: string,
  cursoId: string,
  data: Partial<Omit<CursoCache, "timestamp">>
) {
  try {
    const previous = leerEditarCursoCache(usuarioId, cursoId);

    sessionStorage.setItem(
      getEditarCursoCacheKey(usuarioId, cursoId),
      JSON.stringify({
        timestamp: Date.now(),
        ...(previous ?? {}),
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

export default function EditarCursoPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicando, setPublicando] = useState(false);

  useLayoutEffect(() => {
    if (!id) return;

    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerEditarCursoCache(usuarioLocal, id);
    if (!cache) return;

    setProfesorId(cache.profesorId);
    setNombre(cache.nombre);
    setVisible(cache.visible);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

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

        guardarEditarCursoCache(user.id, id, {
          profesorId: user.id,
          nombre: curso.nombre,
          visible: Boolean(curso.visible),
        });
      } catch (err) {
        console.error("Error inicializando edición de curso:", err);
        toast.error("No se pudo cargar el curso");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

  const guardarCacheActual = (override?: Partial<Omit<CursoCache, "timestamp">>) => {
    const usuarioId = profesorId ?? localStorage.getItem("user_id");
    if (!usuarioId || !id) return;

    guardarEditarCursoCache(usuarioId, id, {
      profesorId: usuarioId,
      nombre,
      visible,
      ...override,
    });
  };

  const actualizarVisibilidadCurso = async (nuevoVisible: boolean) => {
    if (!id || publicando) return;

    const visibleAnterior = visible;

    setVisible(nuevoVisible);
    guardarCacheActual({ visible: nuevoVisible });
    setPublicando(true);

    try {
      const { error } = await supabase
        .from("materias")
        .update({ visible: nuevoVisible })
        .eq("id", id);

      if (error) {
        setVisible(visibleAnterior);
        guardarCacheActual({ visible: visibleAnterior });
        toast.error("No se pudo actualizar la visibilidad del curso");
        return;
      }

      limpiarCachesRelacionados(id);
      toast.success(
        nuevoVisible
          ? "Curso visible para estudiantes"
          : "Curso oculto para estudiantes"
      );
    } catch (err) {
      console.error("Error actualizando visibilidad:", err);
      setVisible(visibleAnterior);
      guardarCacheActual({ visible: visibleAnterior });
      toast.error("No se pudo actualizar la visibilidad del curso");
    } finally {
      setPublicando(false);
    }
  };

  const estilos = (
    <style>{`
      .editar-curso-page {
        --editar-accent: var(--fcc-premium-accent);
        --editar-cyan: var(--fcc-premium-cyan);
        --editar-surface: var(--fcc-premium-surface);
        --editar-surface-soft: var(--fcc-premium-surface-soft);
        --editar-surface-strong: var(--fcc-premium-surface-strong);
        --editar-text: var(--fcc-premium-text);
        --editar-muted: var(--fcc-premium-muted);
        --editar-border: var(--fcc-premium-border);
        --editar-border-strong: var(--fcc-premium-border-strong);
        --editar-shadow-soft: var(--fcc-premium-shadow-soft);

        display: grid;
        gap: 16px;
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

      .editar-curso-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
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

      .editar-curso-eyebrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--editar-accent);
        font-size: 0.82rem;
        font-weight: 950;
        letter-spacing: 0.24em;
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

      @media (max-width: 1100px) {
        .editar-curso-menu-grid {
          width: min(100%, 520px);
          grid-template-columns: repeat(2, minmax(0, 220px));
        }
      }

      @media (max-width: 440px) {
        .editar-curso-menu-grid {
          width: min(100%, 230px);
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .editar-curso-hero {
          padding: 18px 16px;
        }

        .editar-curso-hero-copy {
          padding-top: 42px;
        }

        .editar-curso-hero-back {
          left: 0;
          top: 0;
          min-height: 36px;
          padding: 0 13px;
          font-size: 0.84rem;
        }

        .editar-curso-publish-card {
          grid-template-columns: auto minmax(0, 1fr);
          width: 100%;
        }

        .editar-curso-switch {
          grid-column: 1 / -1;
          justify-self: start;
        }

        .editar-curso-menu-grid {
          width: min(100%, 420px);
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
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
      }
    `}</style>
  );

  if (loading) {
    return (
      <LayoutGeneral rol="profesor">
        {estilos}

        <div className="editar-curso-page">
          <section className="editar-curso-card editar-curso-hero editar-curso-skeleton">
            <div className="editar-curso-card-content">
              <div
                className="editar-curso-skeleton-block"
                style={{ width: "180px", height: "16px", marginBottom: 14 }}
              />
              <div
                className="editar-curso-skeleton-block"
                style={{ width: "min(720px, 82%)", height: "44px", marginBottom: 16 }}
              />
              <div
                className="editar-curso-skeleton-block"
                style={{ width: "min(560px, 74%)", height: "18px" }}
              />
            </div>
          </section>

          <div className="editar-curso-menu-grid">
            {[1, 2, 3, 4].map((item) => (
              <section
                key={item}
                className="editar-curso-option-card tone-content editar-curso-skeleton"
              >
                <div className="editar-curso-option-visual" />
                <div className="editar-curso-option-body">
                  <div
                    className="editar-curso-skeleton-block"
                    style={{ width: "72%", height: "22px" }}
                  />
                  <div
                    className="editar-curso-skeleton-block"
                    style={{ width: "86px", height: "34px" }}
                  />
                </div>
              </section>
            ))}
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="profesor">
      {estilos}

      <div className="editar-curso-page">
        <section className="editar-curso-card editar-curso-hero">
          <div className="editar-curso-card-content editar-curso-hero-copy">
            <Link href="/dashboard/profesor" className="editar-curso-hero-back">
              <ArrowLeft size={17} strokeWidth={2.8} aria-hidden="true" />
              <span>Volver a inicio</span>
            </Link>

            <p className="editar-curso-eyebrow">Editar curso</p>
            <h1 className="editar-curso-hero-title">
              {nombre || "Curso"}
            </h1>
            <p className="editar-curso-hero-description">
              Elige la sección que quieres trabajar.
            </p>
          </div>
        </section>

        <section
          className={`editar-curso-publish-card ${
            visible ? "published" : "draft"
          }`}
        >
          <div className="editar-curso-publish-icon" aria-hidden="true">
            {visible ? (
              <Eye size={24} strokeWidth={2.55} />
            ) : (
              <EyeOff size={24} strokeWidth={2.55} />
            )}
          </div>

          <div className="editar-curso-publish-copy">
            <p className="editar-curso-publish-title">
              {visible ? "Curso publicado" : "Curso no publicado"}
            </p>
            <p className="editar-curso-publish-text">
              {visible
                ? "Los estudiantes ya pueden encontrarlo."
                : "Activa esta opción cuando quieras que tus estudiantes lo vean."}
            </p>
          </div>

          <label className="editar-curso-switch">
            <input
              type="checkbox"
              checked={visible}
              disabled={publicando}
              onChange={(e) => actualizarVisibilidadCurso(e.target.checked)}
              aria-label="Hacer visible para estudiantes"
            />
            <span className="editar-curso-switch-track" />
          </label>
        </section>

        <div className="editar-curso-menu-grid">
          <Link
            href={`/dashboard/profesor/cursos/${id}/editar/contenido`}
            className="editar-curso-option-card tone-content"
            aria-label="Abrir contenido del curso"
          >
            <span className="editar-curso-option-visual">
              <span className="editar-curso-visual-icon">
                <BookOpen className="editar-curso-icon-svg" aria-hidden="true" />
              </span>
            </span>
            <span className="editar-curso-option-body">
              <span className="editar-curso-option-title">Contenido</span>
              <span className="editar-curso-option-action">Abrir</span>
            </span>
          </Link>

          <Link
            href={`/dashboard/profesor/cursos/${id}/editar/quizzes`}
            className="editar-curso-option-card tone-quiz"
            aria-label="Abrir quizzes del curso"
          >
            <span className="editar-curso-option-visual">
              <span className="editar-curso-visual-icon">
                <ClipboardCheck className="editar-curso-icon-svg" aria-hidden="true" />
              </span>
            </span>
            <span className="editar-curso-option-body">
              <span className="editar-curso-option-title">Quizzes</span>
              <span className="editar-curso-option-action">Abrir</span>
            </span>
          </Link>

          <Link
            href={`/dashboard/profesor/cursos/${id}/editar/informacion`}
            className="editar-curso-option-card tone-info"
            aria-label="Abrir información del curso"
          >
            <span className="editar-curso-option-visual">
              <span className="editar-curso-visual-icon">
                <SlidersHorizontal className="editar-curso-icon-svg" aria-hidden="true" />
              </span>
            </span>
            <span className="editar-curso-option-body">
              <span className="editar-curso-option-title">Información</span>
              <span className="editar-curso-option-action">Abrir</span>
            </span>
          </Link>

          <Link
            href={`/dashboard/profesor/cursos/${id}/editar/ranking`}
            className="editar-curso-option-card tone-ranking"
            aria-label="Abrir ranking del curso"
          >
            <span className="editar-curso-option-visual">
              <span className="editar-curso-visual-icon">
                <BarChart3 className="editar-curso-icon-svg" aria-hidden="true" />
              </span>
            </span>
            <span className="editar-curso-option-body">
              <span className="editar-curso-option-title">Ranking</span>
              <span className="editar-curso-option-action">Abrir</span>
            </span>
          </Link>
        </div>
      </div>
    </LayoutGeneral>
  );
}
