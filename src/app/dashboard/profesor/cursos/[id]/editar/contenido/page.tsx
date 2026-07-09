/**
 * Página de contenido del curso (profesor):
 * - Verifica que el profesor sea dueño del curso.
 * - Muestra el editor de contenido visible para estudiantes.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import LayoutGeneral from "@/components/LayoutGeneral";
import EditorContenidoCurso from "@/components/EditorContenidoCurso";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";


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


export default function EditarContenidoCursoPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    if (!id) return;

    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerEditarCursoCache(usuarioLocal, id);
    if (!cache) return;

    setNombre(cache.nombre);
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

        setNombre(curso.nombre);

        guardarEditarCursoCache(user.id, id, {
          profesorId: user.id,
          nombre: curso.nombre,
          visible: Boolean(curso.visible),
        });
      } catch (err) {
        console.error("Error cargando contenido del curso:", err);
        toast.error("No se pudo cargar el curso");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

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
        --editar-button: var(--fcc-premium-button);

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
        max-width: 900px;
        color: var(--editar-text);
        font-size: clamp(1.75rem, 3.4vw, 2.75rem);
        font-weight: 950;
        line-height: 0.98;
        letter-spacing: -0.06em;
        text-wrap: balance;
      }

      .editar-curso-description {
        margin-top: 8px;
        color: var(--editar-muted);
        font-size: 0.92rem;
        font-weight: 650;
        line-height: 1.48;
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

      .editar-curso-section {
        padding: 22px;
      }

      .editar-curso-editor-box {
        min-width: 0;
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

      @media (max-width: 640px) {
        .editar-curso-view-header {
          padding: 18px 16px;
        }

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

        .editar-curso-section {
          border-radius: 24px;
          padding: 16px;
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
                style={{ width: "min(760px, 82%)", height: "44px" }}
              />
              <div
                className="editar-curso-skeleton-block"
                style={{ width: "min(540px, 72%)", height: "18px" }}
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
              <Link
                href={`/dashboard/profesor/cursos/${id}/editar`}
                className="editar-curso-back-button"
              >
                <ArrowLeft size={17} strokeWidth={2.8} aria-hidden="true" />
                <span>Volver al menú</span>
              </Link>

              <p className="editar-curso-eyebrow">Contenido del curso</p>
              <h1 className="editar-curso-title">{nombre || "Contenido del curso"}</h1>
              <p className="editar-curso-description">
                Crea y actualiza el contenido visible para tus estudiantes.
              </p>

              <div className="editar-curso-view-icon content" aria-hidden="true">
                <BookOpen size={34} strokeWidth={2.35} />
              </div>
            </div>
          </section>

          <div className="editar-curso-module-shell content-shell">
            <EditorContenidoCurso
              materiaId={id}
              onBloquesChange={() => {
                if (id) limpiarCachesRelacionados(id);
              }}
            />
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
