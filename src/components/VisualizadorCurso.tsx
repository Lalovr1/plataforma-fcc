/**
 * Visualizador de curso para estudiantes y profesores
 * - Evita scroll excesivo: índice de bloques + vista de un solo bloque.
 * - Estudiante: muestra progreso y botón "Resolver".
 * - Profesor: oculta progreso y solo permite previsualizar quizzes.
 */

"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import CirculoProgreso from "@/components/CirculoProgreso";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import "katex/dist/katex.min.css";
import katex from "katex";
import { createPortal } from "react-dom";

type Rol = "estudiante" | "profesor";

type Bloque = {
  id: string;
  materia_id: string;
  tipo: "texto" | "imagen" | "video" | "documento";
  titulo?: string | null;
  introduccion?: string | null;
  contenido: string;
  orden?: number | null;
  unidad_id?: string | null;
  quizzes?: {
    id: string;
    titulo: string;
    descripcion?: string | null;
    xp?: number | null;
    orden?: number | null;
  }[];
};

type Unidad = {
  id: string;
  materia_id: string;
  numero?: number | null;
  nombre: string;
  orden?: number | null;
};

type Formula = {
  id: string;
  titulo: string | null;
  ecuacion: string;
  descripcion?: string | null;
  bloque_id: string;
  publica: boolean;
  created_at: string;
  orden: number;
};

type RankingCursoUsuario = {
  usuario_id: string;
  nombre: string;
  puntos: number;
};

type ContextoRankingCurso = {
  esVisitante: boolean;
  tieneInscripcion: boolean;
  carreraNombre: string | null;
  semestre: number | null;
  periodoNombre: string | null;
  seccionNombre: string | null;
};
type VisualizadorCursoCache = {
  timestamp: number;
  materia: any;
  progreso: number;
  bloques: Bloque[];
  unidades: Unidad[];
  formulas: Formula[];
  fileMaps: Record<string, Record<string, { name: string; url: string }>>;
  rankingTopCurso: RankingCursoUsuario[];
  contextoRankingCurso: ContextoRankingCurso;
};

const CURSO_CACHE_KEY_BASE = "fcc_academy_visualizador_curso_v1";

const getCursoCacheKey = (materiaId: string, userId: string, rol: Rol) =>
  `${CURSO_CACHE_KEY_BASE}_${rol}_${userId}_${materiaId}`;

const parseAvatarConfig = (value: any): AvatarConfig | null => {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
};

const normalizarMateriaCache = (materia: any) => {
  if (!materia) return materia;

  const profesor = Array.isArray(materia.profesor)
    ? materia.profesor[0]
    : materia.profesor;

  return {
    ...materia,
    profesor: profesor
      ? {
          ...profesor,
          avatar_config: parseAvatarConfig(profesor.avatar_config),
        }
      : profesor,
  };
};

const guardarCursoCache = (
  materiaId: string,
  userId: string,
  rol: Rol,
  data: Omit<VisualizadorCursoCache, "timestamp">
) => {
  try {
    sessionStorage.setItem(
      getCursoCacheKey(materiaId, userId, rol),
      JSON.stringify({
        timestamp: Date.now(),
        ...data,
      })
    );
  } catch {}
};

const leerCursoCache = (
  materiaId: string,
  userId: string,
  rol: Rol
): VisualizadorCursoCache | null => {
  try {
    const raw = sessionStorage.getItem(getCursoCacheKey(materiaId, userId, rol));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.materia) return null;
    if (!Array.isArray(parsed?.bloques)) return null;
    if (!Array.isArray(parsed?.unidades)) return null;
    if (!Array.isArray(parsed?.formulas)) return null;

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      materia: normalizarMateriaCache(parsed.materia),
      progreso: Number(parsed.progreso ?? 0),
      bloques: parsed.bloques,
      unidades: parsed.unidades,
      formulas: parsed.formulas,
      fileMaps: parsed.fileMaps ?? {},
      rankingTopCurso: Array.isArray(parsed.rankingTopCurso)
        ? parsed.rankingTopCurso
        : [],
      contextoRankingCurso: parsed.contextoRankingCurso ?? {
        esVisitante: false,
        tieneInscripcion: false,
        carreraNombre: null,
        semestre: null,
        periodoNombre: null,
        seccionNombre: null,
      },
    };
  } catch {
    return null;
  }
};


const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
const isVideo = (name: string) => /\.(mp4|webm|ogg|mov|mkv)$/i.test(name);
const isDoc   = (name: string) => /\.(pdf|docx?|pptx?|xlsx)$/i.test(name);

const renderFormulaHTML = (latex: string) => {
  try {
    // 🔥 limpiar duplicados por salto de línea
    const cleanLatex = Array.from(
      new Set(
        (latex || "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      )
    ).join(" ");

    return katex.renderToString(cleanLatex, {
      throwOnError: false,
      displayMode: true,
    });
  } catch {
    return latex || "";
  }
};

const renderContenidoHTML = (html: string) => {
  return (html || "").replace(
    /<span[^>]*data-latex=["']([^"']+)["'][^>]*data-type=["']inline-math["'][^>]*><\/span>/g,
    (_match, latex) => {
      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        return latex;
      }
    }
  );
};

const ContenidoTextoMemo = memo(function ContenidoTextoMemo({
  contenido,
  setPreviewMedia,
}: {
  contenido: string;
  setPreviewMedia: React.Dispatch<
    React.SetStateAction<{ type: "image" | "video"; src: string } | null>
  >;
}) {
  return (
    <div
      className="w-full max-w-none break-words overflow-x-auto text-base sm:text-lg leading-relaxed
      [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:rounded-lg
      [&_video]:max-w-full [&_video]:h-auto [&_video]:mx-auto [&_video]:rounded-lg
      [&_table]:min-w-max [&_table]:w-full
      [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
      onClick={(e) => {
        const target = e.target as HTMLElement;

        if (target.tagName === "IMG") {
          const src = (target as HTMLImageElement).src;
          setPreviewMedia({ type: "image", src });
          return;
        }

        if (target.tagName === "VIDEO") {
          e.preventDefault();
          e.stopPropagation();

          const video = target as HTMLVideoElement;
          const src = video.currentSrc || video.src;

          video.pause();
          setPreviewMedia({ type: "video", src });
          return;
        }
      }}
      dangerouslySetInnerHTML={{
        __html: renderContenidoHTML(contenido),
      }}
    />
  );
});

export default function VisualizadorCurso({
  materiaId,
  userId,
  rol = "estudiante",
}: {
  materiaId: string;
  userId: string;
  rol?: Rol;
}) {
  const [materia, setMateria] = useState<any>(null);
  const [progreso, setProgreso] = useState<number>(0);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadesAbiertasIds, setUnidadesAbiertasIds] = useState<string[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [flippedFormulas, setFlippedFormulas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [previewMedia, setPreviewMedia] = useState<{
    type: "image" | "video";
    src: string;
  } | null>(null);

  const closePreviewMedia = () => {
    setPreviewMedia(null);
  };

  const [fileMaps, setFileMaps] = useState<Record<string, Record<string, { name: string; url: string }>>>({});

  const [bloquesAbiertosIds, setBloquesAbiertosIds] = useState<string[]>([]);

  const [rankingTopCurso, setRankingTopCurso] = useState<RankingCursoUsuario[]>([]);
  const [contextoRankingCurso, setContextoRankingCurso] = useState<ContextoRankingCurso>({
    esVisitante: false,
    tieneInscripcion: false,
    carreraNombre: null,
    semestre: null,
    periodoNombre: null,
    seccionNombre: null,
  });
  const cacheAplicadoRef = useRef(false);

  useLayoutEffect(() => {
    const cache = leerCursoCache(materiaId, userId, rol);

    if (!cache) return;

    cacheAplicadoRef.current = true;

    setMateria(cache.materia);
    setProgreso(cache.progreso);
    setBloques(cache.bloques);
    setUnidades(cache.unidades);
    setFormulas(cache.formulas);
    setFileMaps(cache.fileMaps);
    setRankingTopCurso(cache.rankingTopCurso);
    setContextoRankingCurso(cache.contextoRankingCurso);
    setLoading(false);
  }, [materiaId, userId, rol]);

  useEffect(() => {
    if (loading || !materia) return;

    guardarCursoCache(materiaId, userId, rol, {
      materia,
      progreso,
      bloques,
      unidades,
      formulas,
      fileMaps,
      rankingTopCurso,
      contextoRankingCurso,
    });
  }, [
    materiaId,
    userId,
    rol,
    loading,
    materia,
    progreso,
    bloques,
    unidades,
    formulas,
    fileMaps,
    rankingTopCurso,
    contextoRankingCurso,
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!cacheAplicadoRef.current) {
        setLoading(true);
      }

      const { data: mat } = await supabase
        .from("materias")
        .select(`
          id,
          nombre,
          profesor:usuarios (id, nombre, avatar_config),
          curso_carreras (
            id,
            semestre,
            carrera:carreras (id, nombre)
          )
        `)
        .eq("id", materiaId)
        .single();
      setMateria(normalizarMateriaCache(mat));

            if (rol === "estudiante") {
              const { data: quizzesMateria } = await supabase
                .from("quizzes")
                .select("id")
                .eq("materia_id", materiaId);

              const totalQuizzes = (quizzesMateria || []).length;

              const { data: intentosUsuario } = await supabase
                .from("intentos_quiz")
                .select("quiz_id")
                .eq("usuario_id", userId)
                .eq("completado", true)
                .in(
                  "quiz_id",
                  (quizzesMateria || []).map((q: any) => q.id)
                );

              const completadosUnicos = new Set(
                (intentosUsuario || []).map((i: any) => i.quiz_id)
              ).size;

              setProgreso(
                totalQuizzes > 0
                  ? Math.min(100, Math.round((completadosUnicos / totalQuizzes) * 100))
                  : 0
              );

              const { data: inscripcionActual } = await supabase
                .from("progreso")
                .select("usuario_id, carrera_id, periodo_id, seccion_id, es_visitante")
                .eq("materia_id", materiaId)
                .eq("usuario_id", userId)
                .maybeSingle();

                      if (inscripcionActual && !inscripcionActual.es_visitante) {
          const [
            { data: carreraActual },
            { data: periodoActual },
            { data: seccionActual },
            { data: cursoCarreraActual },
          ] = await Promise.all([
            supabase
              .from("carreras")
              .select("nombre")
              .eq("id", inscripcionActual.carrera_id)
              .maybeSingle(),

            supabase
              .from("curso_periodos")
              .select("nombre, anio")
              .eq("id", inscripcionActual.periodo_id)
              .maybeSingle(),

            supabase
              .from("curso_secciones")
              .select("nombre")
              .eq("id", inscripcionActual.seccion_id)
              .maybeSingle(),

            supabase
              .from("curso_carreras")
              .select("semestre")
              .eq("curso_id", materiaId)
              .eq("carrera_id", inscripcionActual.carrera_id)
              .maybeSingle(),
          ]);

          setContextoRankingCurso({
            esVisitante: false,
            tieneInscripcion: true,
            carreraNombre: carreraActual?.nombre ?? null,
            semestre: cursoCarreraActual?.semestre ?? null,
            periodoNombre: periodoActual
              ? `${periodoActual.nombre} ${periodoActual.anio ?? ""}`.trim()
              : null,
            seccionNombre: seccionActual?.nombre ?? null,
          });
        } else {
          setContextoRankingCurso({
            esVisitante: Boolean(inscripcionActual?.es_visitante),
            tieneInscripcion: Boolean(inscripcionActual),
            carreraNombre: null,
            semestre: null,
            periodoNombre: null,
            seccionNombre: null,
          });
        }

              let progresoQuery = supabase
                .from("progreso")
                .select("usuario_id, carrera_id, periodo_id, seccion_id, es_visitante")
                .eq("materia_id", materiaId);

              if (inscripcionActual && !inscripcionActual.es_visitante) {
                progresoQuery = progresoQuery
                  .eq("carrera_id", inscripcionActual.carrera_id)
                  .eq("periodo_id", inscripcionActual.periodo_id)
                  .eq("seccion_id", inscripcionActual.seccion_id)
                  .eq("es_visitante", false);
              }

              const { data: progresoRanking } = await progresoQuery;

              const usuariosRankingIds = Array.from(
                new Set((progresoRanking || []).map((p: any) => p.usuario_id))
              );

              if (usuariosRankingIds.length === 0) {
                setRankingTopCurso([]);
              } else {
                const { data: usuariosRanking } = await supabase
                  .from("usuarios")
                  .select("id, nombre, rol")
                  .in("id", usuariosRankingIds)
                  .eq("rol", "estudiante");

                const estudiantesIds = (usuariosRanking || []).map((u: any) => u.id);

                const { data: quizzesRanking } = await supabase
                  .from("quizzes")
                  .select("id, xp")
                  .eq("materia_id", materiaId);

                const quizIds = (quizzesRanking || []).map((q: any) => q.id);
                const xpPorQuiz = Object.fromEntries(
                  (quizzesRanking || []).map((q: any) => [q.id, Number(q.xp ?? 0)])
                );

                if (estudiantesIds.length === 0 || quizIds.length === 0) {
                  setRankingTopCurso(
                    (usuariosRanking || [])
                      .map((u: any) => ({
                        usuario_id: u.id,
                        nombre: u.nombre ?? "Sin nombre",
                        puntos: 0,
                      }))
                      .slice(0, 3)
                  );
                } else {
                  const { data: intentosRanking } = await supabase
                    .from("intentos_quiz")
                    .select("quiz_id, usuario_id, puntaje")
                    .in("usuario_id", estudiantesIds)
                    .in("quiz_id", quizIds);

                  const mejoresPorUsuarioQuiz: Record<string, Record<string, number>> = {};

                  (intentosRanking || []).forEach((intento: any) => {
                    const uid = intento.usuario_id;
                    const qid = intento.quiz_id;
                    const puntaje = Number(intento.puntaje ?? 0);
                    const xpQuiz = xpPorQuiz[qid] ?? 0;
                    const puntos = Math.round((xpQuiz * puntaje) / 100);

                    if (!mejoresPorUsuarioQuiz[uid]) mejoresPorUsuarioQuiz[uid] = {};
                    mejoresPorUsuarioQuiz[uid][qid] = Math.max(
                      mejoresPorUsuarioQuiz[uid][qid] ?? 0,
                      puntos
                    );
                  });

                  const top = (usuariosRanking || [])
                    .map((u: any) => ({
                      usuario_id: u.id,
                      nombre: u.nombre ?? "Sin nombre",
                      puntos: Object.values(mejoresPorUsuarioQuiz[u.id] || {}).reduce(
                        (acc, puntos) => acc + puntos,
                        0
                      ),
                    }))
                    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
                    .slice(0, 3);

                  setRankingTopCurso(top);
                }
              }
            } else {
              setProgreso(0);

              let progresoQuery = supabase
                .from("progreso")
                .select("usuario_id, carrera_id, periodo_id, seccion_id, es_visitante")
                .eq("materia_id", materiaId);

              const { data: progresoRanking } = await progresoQuery;

              const usuariosRankingIds = Array.from(
                new Set((progresoRanking || []).map((p: any) => p.usuario_id))
              );

              setContextoRankingCurso({
                esVisitante: true,
                tieneInscripcion: false,
                carreraNombre: null,
                semestre: null,
                periodoNombre: null,
                seccionNombre: null,
              });

              if (usuariosRankingIds.length === 0) {
                setRankingTopCurso([]);
              } else {
                const { data: usuariosRanking } = await supabase
                  .from("usuarios")
                  .select("id, nombre, rol")
                  .in("id", usuariosRankingIds)
                  .eq("rol", "estudiante");

                const estudiantesIds = (usuariosRanking || []).map((u: any) => u.id);

                const { data: quizzesRanking } = await supabase
                  .from("quizzes")
                  .select("id, xp")
                  .eq("materia_id", materiaId);

                const quizIds = (quizzesRanking || []).map((q: any) => q.id);
                const xpPorQuiz = Object.fromEntries(
                  (quizzesRanking || []).map((q: any) => [q.id, Number(q.xp ?? 0)])
                );

                if (estudiantesIds.length === 0 || quizIds.length === 0) {
                  setRankingTopCurso(
                    (usuariosRanking || [])
                      .map((u: any) => ({
                        usuario_id: u.id,
                        nombre: u.nombre ?? "Sin nombre",
                        puntos: 0,
                      }))
                      .slice(0, 3)
                  );
                } else {
                  const { data: intentosRanking } = await supabase
                    .from("intentos_quiz")
                    .select("quiz_id, usuario_id, puntaje")
                    .in("usuario_id", estudiantesIds)
                    .in("quiz_id", quizIds);

                  const mejoresPorUsuarioQuiz: Record<string, Record<string, number>> = {};

                  (intentosRanking || []).forEach((intento: any) => {
                    const uid = intento.usuario_id;
                    const qid = intento.quiz_id;
                    const puntaje = Number(intento.puntaje ?? 0);
                    const xpQuiz = xpPorQuiz[qid] ?? 0;
                    const puntos = Math.round((xpQuiz * puntaje) / 100);

                    if (!mejoresPorUsuarioQuiz[uid]) mejoresPorUsuarioQuiz[uid] = {};
                    mejoresPorUsuarioQuiz[uid][qid] = Math.max(
                      mejoresPorUsuarioQuiz[uid][qid] ?? 0,
                      puntos
                    );
                  });

                  const top = (usuariosRanking || [])
                    .map((u: any) => ({
                      usuario_id: u.id,
                      nombre: u.nombre ?? "Sin nombre",
                      puntos: Object.values(mejoresPorUsuarioQuiz[u.id] || {}).reduce(
                        (acc, puntos) => acc + puntos,
                        0
                      ),
                    }))
                    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
                    .slice(0, 3);

                  setRankingTopCurso(top);
                }
              }
            }

      const { data: unidadesData } = await supabase
        .from("curso_unidades")
        .select("id, materia_id, numero, nombre, orden")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      setUnidades((unidadesData || []) as Unidad[]);

      const { data: bl } = await supabase
        .from("curso_contenido_bloques")
        .select("*")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      const bloqueIds = (bl || []).map((b: any) => b.id);

      let quizzesPorBloque: Record<string, Bloque["quizzes"]> = {};

      if (bloqueIds.length > 0) {
        const { data: quizzesBloques } = await supabase
          .from("quizzes")
          .select("id, titulo, descripcion, xp, orden, bloque_id")
          .in("bloque_id", bloqueIds)
          .order("orden", { ascending: true });

        (quizzesBloques || []).forEach((q: any) => {
          if (!quizzesPorBloque[q.bloque_id]) {
            quizzesPorBloque[q.bloque_id] = [];
          }

          quizzesPorBloque[q.bloque_id]?.push({
            id: q.id,
            titulo: q.titulo,
            descripcion: q.descripcion,
            xp: q.xp,
            orden: q.orden,
          });
        });
      }

      const bloquesConQuizzes: Bloque[] = ((bl || []) as Bloque[]).map((b) => ({
        ...b,
        quizzes: quizzesPorBloque[b.id] ?? [],
      }));

      setBloques(bloquesConQuizzes);
      const { data: fm } = await supabase
        .from("curso_formulas")
        .select("id, titulo, ecuacion, descripcion, bloque_id, publica, created_at, orden")
        .eq("publica", true)
        .in(
          "bloque_id",
          bloqueIds.length
            ? bloqueIds
            : ["00000000-0000-0000-0000-000000000000"]
        )
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });
      setFormulas((fm || []) as Formula[]);

      if (bloqueIds.length) {
        const { data: files } = await supabase
          .from("curso_archivos")
          .select("bloque_id, nombre, url")
          .in("bloque_id", bloqueIds);

        const map: Record<string, Record<string, { name: string; url: string }>> = {};
        (files || []).forEach((f: any) => {
          if (!map[f.bloque_id]) map[f.bloque_id] = {};
          map[f.bloque_id][f.nombre] = { name: f.nombre, url: f.url };
        });
        setFileMaps(map);
      } else {
        setFileMaps({});
      }

      setLoading(false);
    };

    fetchData();
  }, [materiaId, userId, rol]);

  const estilos = (
    <style>{`
      .visualizador-curso-shell {
        --curso-accent: var(--fcc-premium-accent);
        --curso-accent-hover: var(--fcc-premium-accent-hover);
        --curso-cyan: var(--fcc-premium-cyan);
        --curso-surface: var(--fcc-premium-surface);
        --curso-surface-soft: var(--fcc-premium-surface-soft);
        --curso-surface-strong: var(--fcc-premium-surface-strong);
        --curso-border: var(--fcc-premium-border);
        --curso-border-strong: var(--fcc-premium-border-strong);
        --curso-text: var(--fcc-premium-text);
        --curso-muted: var(--fcc-premium-muted);
        --curso-grid: var(--fcc-premium-grid);
        --curso-line: var(--fcc-premium-line);

        --curso-avatar-core: color-mix(in srgb, var(--curso-cyan) 18%, transparent);
        --curso-avatar-a: color-mix(in srgb, var(--curso-accent) 34%, transparent);
        --curso-avatar-b: color-mix(in srgb, var(--curso-cyan) 28%, transparent);
        --curso-avatar-c: color-mix(in srgb, var(--curso-accent) 26%, transparent);
        --curso-avatar-border: color-mix(in srgb, var(--curso-accent) 28%, transparent);
        --curso-avatar-shadow-a: color-mix(in srgb, var(--curso-accent) 4%, transparent);
        --curso-avatar-shadow-b: color-mix(in srgb, var(--curso-accent) 18%, transparent);
        --curso-avatar-orbit-a: color-mix(in srgb, var(--curso-accent) 20%, transparent);
        --curso-avatar-orbit-b: color-mix(in srgb, var(--curso-cyan) 22%, transparent);
        color: var(--curso-text);
      }

      .curso-premium-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        background:
          radial-gradient(
            circle at 12% 10%,
            color-mix(in srgb, var(--curso-cyan) 9%, transparent),
            transparent 30%
          ),
          linear-gradient(
            135deg,
            var(--curso-surface),
            var(--curso-surface-soft)
          );
        border: 1px solid var(--curso-border);
        box-shadow:
          var(--fcc-premium-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--curso-surface-strong) 70%, transparent);
        color: var(--curso-text);
      }

      .theme-oscuro .curso-premium-card {
        box-shadow:
          var(--fcc-premium-shadow-soft),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .curso-premium-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(var(--curso-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--curso-grid) 1px, transparent 1px),
          linear-gradient(
            135deg,
            transparent 0 22%,
            var(--curso-line) 22.2% 22.55%,
            transparent 22.75% 100%
          );
        background-size: 28px 28px, 28px 28px, auto;
        mask-image: radial-gradient(circle at 80% 14%, black, transparent 70%);
        opacity: 0.62;
      }

      .curso-content-card::before {
        background:
          linear-gradient(var(--curso-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--curso-grid) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: radial-gradient(circle at 50% 14%, black, transparent 76%);
        opacity: 0.34;
      }

      .curso-card-content,
      .curso-premium-card > * {
        position: relative;
        z-index: 2;
      }

      .curso-hero-card {
        min-height: 190px;
        background:
          linear-gradient(
            135deg,
            var(--curso-surface),
            var(--curso-surface-soft)
          );
      }

      .curso-hero-card::before {
        background: radial-gradient(
          circle at -8% 50%,
          color-mix(in srgb, var(--curso-cyan) 8%, transparent),
          transparent 34%
        );
        background-size: auto;
        mask-image: none;
        opacity: 0.42;
      }

      .curso-hero-title {
        color: var(--curso-text);
        font-weight: 950;
        letter-spacing: -0.05em;
        line-height: 1;
      }

      .curso-kicker {
        color: var(--curso-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .curso-muted {
        color: var(--curso-muted);
      }

      .curso-profesor-avatar-stage {
        position: relative;
        width: 116px;
        height: 116px;
        display: grid;
        place-items: center;
        overflow: visible;
        isolation: isolate;
      }

      .curso-profesor-avatar-stage::before {
        content: "";
        position: absolute;
        width: 82%;
        height: 82%;
        border-radius: 999px;
        background:
          radial-gradient(circle, var(--curso-avatar-core), transparent 62%),
          conic-gradient(
            from 210deg,
            transparent 0deg,
            var(--curso-avatar-a) 42deg,
            transparent 84deg,
            var(--curso-avatar-b) 145deg,
            transparent 210deg,
            var(--curso-avatar-c) 285deg,
            transparent 360deg
          );
        filter: blur(0.2px);
        opacity: 0.95;
        z-index: -3;
      }

      .curso-profesor-avatar-stage::after {
        content: "";
        position: absolute;
        width: 70%;
        height: 70%;
        border-radius: 999px;
        border: 1px solid var(--curso-avatar-border);
        box-shadow:
          0 0 0 7px var(--curso-avatar-shadow-a),
          0 0 24px var(--curso-avatar-shadow-b);
        z-index: -2;
      }

      .curso-profesor-avatar-orbit {
        position: absolute;
        inset: 17%;
        z-index: -1;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,
            transparent 0 12%,
            var(--curso-avatar-orbit-a) 12% 18%,
            transparent 18% 100%
          ),
          linear-gradient(
            180deg,
            transparent 0 60%,
            var(--curso-avatar-orbit-b) 60% 64%,
            transparent 64% 100%
          );
        transform: rotate(-18deg);
        opacity: 0.95;
      }

      .curso-ranking-item,
      .curso-quiz-card,
      .curso-document-card {
        border: 1px solid var(--curso-border);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--curso-surface-strong) 84%, transparent),
            color-mix(in srgb, var(--curso-surface-soft) 92%, transparent)
          );
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--curso-surface-strong) 66%, transparent);
      }

      .curso-formula-face {
        border: 1px solid var(--curso-border);
        background: var(--curso-surface);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--curso-surface-strong) 60%, transparent);
      }

      .curso-ranking-position {
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: var(--curso-accent);
        background: color-mix(in srgb, var(--curso-accent) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--curso-accent) 24%, transparent);
        font-size: 0.78rem;
        font-weight: 950;
      }

      .curso-unit-button,
      .curso-block-button {
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--curso-surface-strong) 90%, transparent),
            color-mix(in srgb, var(--curso-surface-soft) 96%, transparent)
          );
        border: 1px solid var(--curso-border);
        color: var(--curso-text);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--curso-surface-strong) 70%, transparent);
      }

      .curso-unit-button.is-active,
      .curso-block-button.is-active {
        border-color: var(--curso-accent);
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--curso-accent) 12%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--curso-surface-strong) 74%, transparent);
      }

      .curso-unit-button:hover,
      .curso-block-button:hover {
        transform: translateY(-1px);
        border-color: var(--curso-border-strong);
      }

      .curso-action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        border-radius: 13px;
        padding: 0 14px;
        color: white;
        font-weight: 900;
        background: var(--fcc-premium-button);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
      }

      .theme-oscuro .curso-action-button {
        color: #050505;
      }

      .curso-action-button:hover {
        transform: translateY(-1px);
      }

      .curso-secondary-button {
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--curso-muted) 52%, transparent),
            color-mix(in srgb, var(--curso-accent) 42%, var(--curso-muted))
          );
      }

      .curso-formula-card {
        perspective: 1000px;
      }

      .curso-formula-card:hover {
        transform: translateY(-2px);
      }

      .curso-preview-overlay {
        background:
          radial-gradient(
            circle at 18% 16%,
            color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent),
            transparent 34%
          ),
          rgba(0, 0, 0, 0.82);
        backdrop-filter: blur(8px);
      }

      .curso-preview-close {
        color: var(--curso-text);
        background: var(--curso-surface-strong);
        border: 1px solid var(--curso-border);
        box-shadow: var(--fcc-premium-shadow-soft);
      }

      @media (max-width: 640px) {
        .curso-hero-card {
          min-height: unset;
        }

        .curso-profesor-avatar-stage {
          width: 104px;
          height: 104px;
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <>
        {estilos}

        <div className="visualizador-curso-shell min-h-[60dvh] flex flex-col items-center justify-center gap-3 text-center">
          <div className="curso-premium-card px-8 py-7">
            <div className="curso-card-content flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--fcc-premium-accent)",
                  borderTopColor: "transparent",
                }}
              />

              <p className="font-bold" style={{ color: "var(--fcc-premium-muted)" }}>
                Cargando curso...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!materia) {
    return (
      <>
        {estilos}

        <p style={{ color: "var(--color-danger)" }}>Curso no encontrado</p>
      </>
    );
  }

  const tituloBloque = (b: Bloque, idx: number) =>
    b.titulo?.trim() ? b.titulo : `Bloque ${idx + 1} (${b.tipo})`;

  const unidadesConBloques = unidades
    .map((unidad) => ({
      ...unidad,
      bloques: bloques.filter((b) => b.unidad_id === unidad.id),
    }))
    .filter((unidad) => unidad.bloques.length > 0);

    const cardStyle: React.CSSProperties = {
      background:
        "linear-gradient(135deg, var(--fcc-premium-surface), var(--fcc-premium-surface-soft))",
      border: "1px solid var(--fcc-premium-border)",
      boxShadow:
        "var(--fcc-premium-shadow-soft), inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 68%, transparent)",
      color: "var(--fcc-premium-text)",
    };

    const nombreCorto = (nombre?: string | null) =>
      (nombre || "Sin nombre").trim().split(/\s+/).slice(0, 2).join(" ");

    const defaultAvatarConfig: AvatarConfig = {
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

    const cursoCarreraPrincipal = materia.curso_carreras?.[0];

    const mostrarDatosGrupo =
      rol === "estudiante" &&
      contextoRankingCurso.tieneInscripcion &&
      !contextoRankingCurso.esVisitante;

    const carreraInfoCurso = mostrarDatosGrupo
      ? contextoRankingCurso.carreraNombre
      : cursoCarreraPrincipal?.carrera?.nombre;

    const semestreInfoCurso = mostrarDatosGrupo
      ? contextoRankingCurso.semestre
      : cursoCarreraPrincipal?.semestre;

  return (
    <div className="visualizador-curso-shell -mt-3 md:-mt-5 space-y-4 md:space-y-6 min-w-0">
      {estilos}
      {/* Cabecera curso */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px_360px] gap-4 md:gap-6 min-w-0">
        <div
          className="curso-premium-card curso-hero-card p-4 sm:p-6 gap-3 sm:gap-5 items-center justify-center flex flex-col sm:flex-row min-w-0"
          style={cardStyle}
        >
          {rol === "estudiante" && (
            <div className="flex items-center justify-center shrink-0 scale-75 sm:scale-100">
              <CirculoProgreso progress={progreso} size={140} />
            </div>
          )}

          <div className={`space-y-2 min-w-0 ${rol === "estudiante" ? "text-left" : "text-center"}`}>
            <h1 className="curso-hero-title text-2xl sm:text-3xl md:text-4xl break-words" style={{ color: "var(--color-heading)" }}>
              {materia.nombre}
            </h1>

            {carreraInfoCurso ? (
              <div className="text-sm space-y-1" style={{ color: "var(--color-text)" }}>
                <p>{carreraInfoCurso}</p>

                {semestreInfoCurso && (
                  <p>Semestre: {semestreInfoCurso}</p>
                )}

                {mostrarDatosGrupo && contextoRankingCurso.periodoNombre && (
                  <p>Período: {contextoRankingCurso.periodoNombre}</p>
                )}

                {mostrarDatosGrupo && contextoRankingCurso.seccionNombre && (
                  <p>Sección: {contextoRankingCurso.seccionNombre}</p>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--color-muted)" }}>
                Este curso aún no tiene carreras asignadas
              </p>
            )}
          </div>
        </div>

        <div className="curso-premium-card p-4 sm:p-6 min-w-0 flex flex-col items-center justify-center text-center" style={cardStyle}>
          <p className="curso-kicker mb-3">Profesor</p>

          {materia.profesor ? (
            <>
              <div className="curso-profesor-avatar-stage">
                <span className="curso-profesor-avatar-orbit" />

                <RenderizadorAvatar
                  size={95}
                  config={materia.profesor.avatar_config ?? defaultAvatarConfig}
                />
              </div>

              <p className="mt-2 font-semibold truncate max-w-full" style={{ color: "var(--fcc-premium-text)" }}>
                {nombreCorto(materia.profesor.nombre)}
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--fcc-premium-muted)" }}>
              Aún no hay profesor asignado
            </p>
          )}
        </div>

        {(rol === "estudiante" || rol === "profesor") && (
          <div className="curso-premium-card p-4 sm:p-6 min-w-0" style={cardStyle}>
            <div className="mb-4 text-center">
              <h2 className="text-lg sm:text-xl font-black tracking-[-0.04em]" style={{ color: "var(--fcc-premium-text)" }}>
                {rol === "profesor" || contextoRankingCurso.esVisitante
                  ? "Mejores puntajes"
                  : "Top 3 del grupo"}
              </h2>
            </div>

            {rankingTopCurso.length === 0 ? (
              <p className="text-sm text-center" style={{ color: "var(--color-muted)" }}>
                Aún no hay datos para mostrar.
              </p>
            ) : (
              <div className="space-y-2">
                {rankingTopCurso.map((user, index) => (
                  <div
                    key={user.usuario_id}
                    className="curso-ranking-item flex items-center justify-between gap-3 rounded-[16px] px-3 py-2 min-w-0"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "rgba(234,179,8,0.18)"
                          : index === 1
                          ? "rgba(148,163,184,0.18)"
                          : "rgba(251,146,60,0.18)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="curso-ranking-position shrink-0">
                        {index + 1}°
                      </span>
                      <p className="font-semibold truncate" style={{ color: "var(--color-text)" }}>
                        {nombreCorto(user.nombre)}
                      </p>
                    </div>

                    <span className="font-bold text-sm whitespace-nowrap" style={{ color: "var(--color-primary)" }}>
                      {user.puntos} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Índice de bloques */}
      <div className="curso-premium-card p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden" style={cardStyle}>
        <h2 className="text-lg sm:text-xl font-black tracking-[-0.04em]" style={{ color: "var(--fcc-premium-text)" }}>
          Contenido del curso
        </h2>
        {bloques.length === 0 && (
          <p style={{ color: "var(--color-muted)" }}>Aún no hay contenido.</p>
        )}

        <div className="space-y-4">
          {unidadesConBloques.map((unidad) => {
            const unidadActiva = unidadesAbiertasIds.includes(unidad.id);

            return (
              <div key={unidad.id} className="space-y-2">
                <button
                  onClick={() =>
                    setUnidadesAbiertasIds((prev) =>
                      unidadActiva
                        ? prev.filter((id) => id !== unidad.id)
                        : [...prev, unidad.id]
                    )
                  }
                  className={`curso-unit-button w-full text-left px-3 sm:px-5 py-3 sm:py-4 transition min-w-0 ${unidadActiva ? "is-active" : ""}`}
                  style={{
                    color: "var(--fcc-premium-text)",
                  }}
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-w-0">
                      <div />
                      <p className="font-bold text-base sm:text-lg break-words min-w-0 text-center">
                        {`Unidad ${unidad.numero ?? ""} - ${unidad.nombre}`}
                      </p>
                      <span className="justify-self-end shrink-0 text-sm">
                        {unidadActiva ? "Ocultar" : "Ver"}
                      </span>
                    </div>
                </button>

                {unidadActiva && (
                  <div className="space-y-2 pl-0 sm:pl-4">
                    {unidad.bloques.map((b, i) => {
                      const activo = bloquesAbiertosIds.includes(b.id);
                      const blockFileMap = fileMaps[b.id] || {};

                      const headerStyle: React.CSSProperties = {
                        color: "var(--fcc-premium-text)",
                      };

                      return (
                        <div key={b.id} className="space-y-2">
                          <button
                            onClick={() =>
                              setBloquesAbiertosIds((prev) =>
                                activo ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                              )
                            }
                            className={`curso-block-button w-full text-left px-4 py-3 transition ${activo ? "is-active" : ""}`}
                            style={headerStyle}
                          >
                            <div className="flex items-center justify-between gap-3 min-w-0">
                              <div className="min-w-0">
                                <p className="font-semibold break-words" style={{ color: "var(--color-heading)" }}>
                                  {tituloBloque(b, i)}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                                  {b.quizzes && b.quizzes.length > 0
                                    ? `${b.quizzes.length} quiz${b.quizzes.length > 1 ? "zes" : ""}`
                                    : "Sin quizzes"}
                                </p>
                              </div>
                              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                                {activo ? "Ocultar" : "Ver"}
                              </span>
                            </div>
                          </button>

                          {activo && (
                            <div className="curso-premium-card curso-content-card rounded-[24px] p-3 sm:p-6 space-y-4 min-w-0 overflow-hidden" style={cardStyle}>
                              {b.tipo === "texto" && (
                                <div className="w-full pt-6 sm:pt-12 pb-6 sm:pb-10 px-3 sm:px-12 md:px-16 min-w-0">
                                  {b.titulo && (
                                    <h2
                                      className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-4 break-words"
                                      style={{ color: "var(--color-heading)" }}
                                    >
                                      {b.titulo}
                                    </h2>
                                  )}

                                  {b.introduccion?.trim() && (
                                    <p
                                      className="text-center italic text-sm sm:text-base leading-relaxed mb-8 sm:mb-12"
                                      style={{ color: "var(--color-muted)" }}
                                    >
                                      {b.introduccion}
                                    </p>
                                  )}

                                  <ContenidoTextoMemo
                                    contenido={b.contenido}
                                    setPreviewMedia={setPreviewMedia}
                                  />
                                </div>
                              )}

                              {b.tipo !== "texto" && (() => {
                                try {
                                  const json = b.contenido.replace(/<\/?customfile[^>]*>/g, "").trim();
                                  const parsed = JSON.parse(json) as { name: string; url: string };

                                  if (isImage(parsed.name)) {
                                    return (
                                      <div className="text-center">
                                        <img
                                          src={parsed.url}
                                          alt={parsed.name}
                                          className="max-h-64 sm:max-h-80 w-full max-w-xl mx-auto rounded-[20px] cursor-zoom-in object-contain"
                                          onClick={() => setPreviewMedia({ type: "image", src: parsed.url })}
                                        />
                                        <p className="mt-2 underline" style={{ color: "var(--color-primary)" }}>
                                          <a href={parsed.url} target="_blank" rel="noopener noreferrer">{parsed.name}</a>
                                        </p>
                                      </div>
                                    );
                                  }
                                  if (isVideo(parsed.name)) {
                                    return (
                                      <div className="text-center">
                                        <video
                                          src={parsed.url}
                                          controls
                                          className="max-h-64 sm:max-h-80 w-full max-w-xl mx-auto rounded-[20px] cursor-zoom-in object-contain"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const video = e.currentTarget as HTMLVideoElement;
                                            video.pause();

                                            setPreviewMedia({ type: "video", src: parsed.url });
                                          }}
                                        />
                                        <p className="mt-2 underline" style={{ color: "var(--color-primary)" }}>
                                          <a href={parsed.url} target="_blank" rel="noopener noreferrer">{parsed.name}</a>
                                        </p>
                                      </div>
                                    );
                                  }
                                  if (isDoc(parsed.name)) {
                                    return (
                                      <div className="curso-document-card rounded-[20px] p-4 text-center" style={cardStyle}>
                                        <p className="mb-2 font-medium" style={{ color: "var(--color-heading)" }}>
                                          {b.titulo || parsed.name}
                                        </p>
                                        <a
                                          href={parsed.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="curso-action-button inline-flex px-4 py-2 text-center"
                                          style={{ backgroundColor: "var(--color-primary)" }}
                                        >
                                          📄 Ver documento
                                        </a>
                                      </div>
                                    );
                                  }
                                  return (
                                    <a
                                      href={parsed.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:opacity-90"
                                      style={{ color: "var(--color-primary)" }}
                                    >
                                      {parsed.name}
                                    </a>
                                  );
                                } catch {
                                  return <p style={{ color: "var(--color-danger)" }}>No se pudo interpretar el recurso.</p>;
                                }
                              })()}

                              {b.quizzes && b.quizzes.length > 0 && (
                                <div className="space-y-2">
                                  <h3 className="font-semibold" style={{ color: "var(--color-heading)" }}>Quizzes</h3>
                                  {b.quizzes.map((q) => (
                                    <div
                                      key={q.id}
                                      className="curso-quiz-card rounded-[18px] px-3 py-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 min-w-0"
                                      style={cardStyle}
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium truncate" style={{ color: "var(--color-text)" }}>
                                          {q.titulo}
                                        </p>
                                        {q.descripcion && (
                                          <p className="text-xs line-clamp-2" style={{ color: "var(--color-muted)" }}>
                                            {q.descripcion}
                                          </p>
                                        )}
                                      </div>

                                      {rol === "estudiante" ? (
                                        <a
                                          href={`/curso/${materiaId}/quiz/${q.id}`}
                                          className="curso-action-button px-3 py-2 sm:py-1 text-center shrink-0"
                                          style={{ backgroundColor: "var(--color-primary)" }}
                                        >
                                          Resolver
                                        </a>
                                      ) : (
                                        <a
                                          href={`/curso/${materiaId}/quiz/${q.id}?preview=1`}
                                          className="curso-action-button curso-secondary-button px-3 py-2 sm:py-1 text-center shrink-0"
                                          style={{ backgroundColor: "var(--color-secondary)" }}
                                        >
                                          Previsualizar
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulario */}
      <div className="curso-premium-card p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden" style={cardStyle}>
        <h2 className="text-lg sm:text-xl font-black tracking-[-0.04em]" style={{ color: "var(--fcc-premium-text)" }}>
          Formulario
        </h2>
        {formulas.length === 0 && (
          <p style={{ color: "var(--color-muted)" }}>Aún no hay fórmulas públicas.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formulas.map((f) => {
            const hasDescription = Boolean(f.descripcion?.trim());
            const isFlipped = flippedFormulas.includes(f.id);

            return (
              <button
                key={f.id}
                type="button"
                disabled={!hasDescription}
                onClick={() => {
                  if (!hasDescription) return;

                  setFlippedFormulas((prev) =>
                    prev.includes(f.id)
                      ? prev.filter((id) => id !== f.id)
                      : [...prev, f.id]
                  );
                }}
                className={`curso-formula-card relative min-h-[130px] rounded-[20px] text-center transition-transform duration-300 ${
                  hasDescription ? "cursor-pointer hover:-translate-y-1" : "cursor-default"
                }`}
                title={
                  hasDescription
                    ? "Clic para ver descripción"
                    : f.titulo || undefined
                }
                style={{
                  perspective: "1000px",
                }}
              >
                {hasDescription && (
                  <span
                    className="absolute right-3 top-3 z-20 text-[11px] px-2 py-[2px] rounded-md"
                    style={{
                      backgroundColor: "var(--color-border)",
                      color: "var(--color-muted)",
                    }}
                  >
                     ↻ Info
                  </span>
                )}

                <div
                  className="relative w-full min-h-[130px] transition-transform duration-500"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  <div
                    className="curso-formula-face absolute inset-0 p-4 sm:p-6 rounded-[20px] flex flex-col items-center justify-center overflow-hidden"
                    style={{
                      background: "var(--fcc-premium-surface)",
                      border: "1px solid var(--fcc-premium-border)",
                      boxShadow:
                        "inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 60%, transparent)",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {f.titulo && (
                      <h3
                        className="font-semibold mb-3"
                        style={{ color: "var(--color-heading)" }}
                      >
                        {f.titulo}
                      </h3>
                    )}

                    <div
                      className="max-w-full overflow-hidden text-sm sm:text-base [&_.katex-display]:my-1 [&_.katex-display]:overflow-visible [&_.katex]:text-[0.95em] [&_.katex-html]:whitespace-normal"
                      dangerouslySetInnerHTML={{
                        __html: renderFormulaHTML(f.ecuacion),
                      }}
                    />
                  </div>

                  <div
                    className="curso-formula-face absolute inset-0 p-4 sm:p-6 rounded-[20px] flex items-center justify-center text-xs sm:text-sm leading-relaxed overflow-hidden"
                    style={{
                      background: "var(--fcc-premium-surface)",
                      border: "1px solid var(--fcc-premium-border)",
                      boxShadow:
                        "inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 60%, transparent)",
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                      color: "var(--color-text)",
                    }}
                  >
                    {f.descripcion}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {previewMedia &&
        createPortal(
          <div
            className="curso-preview-overlay fixed inset-0 flex justify-center items-center z-[9999]"
            onClick={closePreviewMedia}
          >
            <div
              className="relative max-w-[92vw] max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closePreviewMedia}
                className="curso-preview-close absolute top-2 right-2 rounded-full w-9 h-9 flex items-center justify-center text-sm z-10"
              >
                ✕
              </button>

              {previewMedia.type === "image" && (
                <img
                  src={previewMedia.src}
                  alt="Vista ampliada"
                  className="max-w-[92vw] max-h-[85vh] rounded-[24px] object-contain"
                />
              )}

              {previewMedia.type === "video" && (
                <video
                  key={previewMedia.src}
                  src={previewMedia.src}
                  controls
                  autoPlay
                  className="max-w-[92vw] max-h-[85vh] rounded-[24px] bg-black"
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
