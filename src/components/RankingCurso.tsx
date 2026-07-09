/**
 * RankingCurso.tsx
 * - Ranking por curso con filtros de período, sección y quiz
 * - "Todos" en quiz = suma de mejores puntajes en todos los quizzes del curso
 * - Quiz específico = mejor puntaje + menor nº intentos
 * - Solo estudiantes aparecen en el ranking (rol = estudiante)
 */

"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

type PeriodoOpt = { id: string; etiqueta: string; carrera_id: number };
type SeccionOpt = { id: string; nombre: string; periodo_id: string };

type Inscrito = {
  usuario_id: string;
  nombre: string;
  avatar_config: AvatarConfig | null;
  carrera_id: number | null;
  periodo_id: string | null;
  seccion_id: string | null;
  rol: string;
  matricula?: string | null;
};

type Quiz = { id: string; titulo: string; xp: number };
type IntentoStats = { best: number; total: number; tries: number };

type RankingCursoCache = {
  timestamp: number;
  periodos: PeriodoOpt[];
  secciones: SeccionOpt[];
  inscritos: Inscrito[];
  quizzes: Quiz[];
  intentosMap: Record<string, Record<string, IntentoStats>>;
};

const CACHE_KEY_BASE = "fcc_academy_ranking_curso_component_v1";

function getCacheKey(materiaId: string) {
  return `${CACHE_KEY_BASE}_${materiaId}`;
}

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

function guardarCache(materiaId: string, data: RankingCursoCache) {
  try {
    sessionStorage.setItem(
      getCacheKey(materiaId),
      JSON.stringify({
        ...data,
        timestamp: Date.now(),
      })
    );
  } catch {}
}

function leerCache(materiaId: string): RankingCursoCache | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(materiaId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed?.periodos)) return null;
    if (!Array.isArray(parsed?.secciones)) return null;
    if (!Array.isArray(parsed?.inscritos)) return null;
    if (!Array.isArray(parsed?.quizzes)) return null;

    return {
      timestamp: Number(parsed.timestamp) || Date.now(),
      periodos: parsed.periodos,
      secciones: parsed.secciones,
      inscritos: parsed.inscritos,
      quizzes: parsed.quizzes,
      intentosMap: parsed.intentosMap ?? {},
    };
  } catch {
    return null;
  }
}

export default function RankingCurso({
  materiaId,
  filtroMatricula,
}: {
  materiaId: string;
  filtroMatricula?: string | null;
}) {
  const [cargando, setCargando] = useState(true);

  const [periodos, setPeriodos] = useState<PeriodoOpt[]>([]);
  const [secciones, setSecciones] = useState<SeccionOpt[]>([]);
  const [carreraSel, setCarreraSel] = useState<number | null>(null);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const [seccionSel, setSeccionSel] = useState<string | null>(null);

  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizSel, setQuizSel] = useState<string>("");

  const [intentosMap, setIntentosMap] = useState<
    Record<string, Record<string, IntentoStats>>
  >({});

  const aplicarDatos = (data: RankingCursoCache) => {
    setPeriodos(data.periodos);
    setSecciones(data.secciones);
    setInscritos(data.inscritos);
    setQuizzes(data.quizzes);
    setIntentosMap(data.intentosMap);
  };

  useLayoutEffect(() => {
    if (!materiaId) return;

    const cache = leerCache(materiaId);
    if (!cache) return;

    aplicarDatos(cache);
    setCargando(false);
  }, [materiaId]);

  const cargarDatosRanking = async (): Promise<RankingCursoCache> => {
    const [
      { data: cursoCarreras },
      { data: progresoRows },
      { data: quizzesRows },
    ] = await Promise.all([
      supabase
        .from("curso_carreras")
        .select(
          `
          id,
          carrera_id,
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
        .eq("curso_id", materiaId),

      supabase
        .from("progreso")
        .select("usuario_id, periodo_id, seccion_id, carrera_id")
        .eq("materia_id", materiaId),

      supabase
        .from("quizzes")
        .select("id, titulo, xp, created_at")
        .eq("materia_id", materiaId)
        .order("created_at", { ascending: true }),
    ]);

    const periodosData: PeriodoOpt[] = [];
    const seccionesData: SeccionOpt[] = [];

    (cursoCarreras ?? []).forEach((c: any) => {
      (c.curso_periodos ?? []).forEach((p0: any) => {
        const etiqueta = `${p0.nombre} ${p0.anio}`;

        periodosData.push({
          id: p0.id,
          etiqueta,
          carrera_id: c.carrera_id,
        });

        (p0.curso_secciones ?? []).forEach((sec: any) => {
          seccionesData.push({
            id: sec.id,
            nombre: sec.nombre,
            periodo_id: p0.id,
          });
        });
      });
    });

    const quizzesData: Quiz[] = ((quizzesRows as any[]) ?? []).map((q) => ({
      id: q.id,
      titulo: q.titulo || "Quiz",
      xp: Number(q.xp ?? 0),
    }));

    const quizXpMap = new Map<string, number>();
    quizzesData.forEach((q) => {
      quizXpMap.set(q.id, q.xp);
    });

    const userIds = Array.from(
      new Set(
        ((progresoRows as any[]) ?? [])
          .map((r) => r.usuario_id)
          .filter(Boolean)
      )
    );

    const quizIds = quizzesData.map((q) => q.id);

    const [{ data: usuariosRows }, { data: intentosRows }] = await Promise.all([
      userIds.length > 0
        ? supabase
            .from("usuarios")
            .select("id, nombre, avatar_config, rol, carrera_id, matricula")
            .in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),

      quizIds.length > 0
        ? supabase
            .from("intentos_quiz")
            .select("quiz_id, usuario_id, puntaje")
            .in("quiz_id", quizIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const usersById: Record<
      string,
      {
        nombre: string;
        avatar_config: AvatarConfig | null;
        rol: string;
        carrera_id: number | null;
        matricula: string | null;
      }
    > = {};

    ((usuariosRows as any[]) ?? []).forEach((u) => {
      usersById[u.id] = {
        nombre: u.nombre ?? "Sin nombre",
        avatar_config: parseAvatarConfig(u.avatar_config),
        rol: u.rol ?? "estudiante",
        carrera_id: u.carrera_id ?? null,
        matricula: u.matricula ?? null,
      };
    });

    const inscritosData: Inscrito[] = ((progresoRows as any[]) ?? [])
      .map((r) => ({
        usuario_id: r.usuario_id,
        carrera_id: r.carrera_id ?? usersById[r.usuario_id]?.carrera_id ?? null,
        periodo_id: r.periodo_id ?? null,
        seccion_id: r.seccion_id ?? null,
        nombre: usersById[r.usuario_id]?.nombre ?? "Sin nombre",
        avatar_config: usersById[r.usuario_id]?.avatar_config ?? null,
        rol: usersById[r.usuario_id]?.rol ?? "estudiante",
        matricula: usersById[r.usuario_id]?.matricula ?? null,
      }))
      .filter((r) => r.rol === "estudiante");

    const intentosData: Record<string, Record<string, IntentoStats>> = {};

    ((intentosRows as any[]) ?? []).forEach((row) => {
      const qid = row.quiz_id as string;
      const uid = row.usuario_id as string;
      const score = Number(row.puntaje ?? 0);
      const xpQuiz = quizXpMap.get(qid) ?? 0;
      const puntos = Math.round((xpQuiz * score) / 100);

      if (!intentosData[qid]) intentosData[qid] = {};

      if (!intentosData[qid][uid]) {
        intentosData[qid][uid] = {
          best: puntos,
          total: puntos,
          tries: 1,
        };
      } else {
        intentosData[qid][uid].tries += 1;
        intentosData[qid][uid].total += puntos;

        if (puntos > intentosData[qid][uid].best) {
          intentosData[qid][uid].best = puntos;
        }
      }
    });

    return {
      timestamp: Date.now(),
      periodos: periodosData,
      secciones: seccionesData,
      inscritos: inscritosData,
      quizzes: quizzesData,
      intentosMap: intentosData,
    };
  };

  useEffect(() => {
    const run = async () => {
      try {
        const cache = leerCache(materiaId);

        if (cache) {
          aplicarDatos(cache);
          setCargando(false);
        } else {
          setCargando(true);
        }

        const data = await cargarDatosRanking();

        aplicarDatos(data);
        guardarCache(materiaId, data);
      } catch (e) {
        console.error("Error cargando ranking del curso:", e);
      } finally {
        setCargando(false);
      }
    };

    run();
  }, [materiaId]);

  const periodosFiltrados = useMemo(() => {
    if (!carreraSel) return [];
    return periodos.filter((p) => p.carrera_id === carreraSel);
  }, [carreraSel, periodos]);

  const seccionesFiltradas = useMemo(() => {
    if (!periodoSel) return [];
    return secciones.filter((s) => s.periodo_id === periodoSel);
  }, [periodoSel, secciones]);

  const inscritosFiltrados = useMemo(() => {
    return inscritos.filter((i) => {
      const passCarrera = !carreraSel || i.carrera_id === carreraSel;
      const passPeriodo = !periodoSel || i.periodo_id === periodoSel;
      const passSeccion = !seccionSel || i.seccion_id === seccionSel;
      return passCarrera && passPeriodo && passSeccion;
    });
  }, [inscritos, carreraSel, periodoSel, seccionSel]);

  const ranking = useMemo(() => {
    if (quizSel === "") {
      const acc: Record<string, number> = {};

      Object.keys(intentosMap).forEach((qid) => {
        Object.entries(intentosMap[qid]).forEach(([uid, st]) => {
          acc[uid] = (acc[uid] || 0) + st.best;
        });
      });

      return inscritosFiltrados
        .map((i) => ({
          ...i,
          total: acc[i.usuario_id] || 0,
        }))
        .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
    }

    const rows = inscritosFiltrados.map((i) => {
      const st = intentosMap[quizSel]?.[i.usuario_id] || {
        best: 0,
        total: 0,
        tries: 0,
      };

      return {
        ...i,
        best: st.best,
        tries: st.tries,
      };
    });

    return rows.sort((a, b) => {
      if (b.best !== a.best) return b.best - a.best;
      if (a.tries !== b.tries) return a.tries - b.tries;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [inscritosFiltrados, intentosMap, quizSel]);

  const rankingFiltrado = useMemo(() => {
    if (!filtroMatricula) return ranking;
    return ranking.filter((r: any) => r.matricula === filtroMatricula);
  }, [ranking, filtroMatricula]);

  const quizSeleccionado = useMemo(() => {
    if (!quizSel) return null;
    return quizzes.find((q) => q.id === quizSel) ?? null;
  }, [quizSel, quizzes]);

  const estilos = (
    <style>{`
      .ranking-detalle {
        --ranking-detalle-accent: var(--fcc-premium-accent);
        --ranking-detalle-cyan: var(--fcc-premium-cyan);
        --ranking-detalle-surface: var(--fcc-premium-surface);
        --ranking-detalle-surface-soft: var(--fcc-premium-surface-soft);
        --ranking-detalle-surface-strong: var(--fcc-premium-surface-strong);
        --ranking-detalle-text: var(--fcc-premium-text);
        --ranking-detalle-text-soft: var(--fcc-premium-text-soft);
        --ranking-detalle-muted: var(--fcc-premium-muted);
        --ranking-detalle-border: var(--fcc-premium-border);
        --ranking-detalle-border-strong: var(--fcc-premium-border-strong);
        --ranking-detalle-shadow-soft: var(--fcc-premium-shadow-soft);
        --ranking-detalle-button: var(--fcc-premium-button);

        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .ranking-detalle-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--ranking-detalle-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--ranking-detalle-surface) 96%, transparent),
            color-mix(in srgb, var(--ranking-detalle-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--ranking-detalle-accent) 14%, var(--ranking-detalle-border));
        box-shadow:
          var(--ranking-detalle-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--ranking-detalle-surface-strong) 65%, transparent);
      }

      .ranking-detalle-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--ranking-detalle-accent) 6%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 24%,
            color-mix(in srgb, var(--ranking-detalle-accent) 4%, transparent) 24% 24.35%,
            transparent 24.35% 100%
          );
        opacity: 0.62;
      }

      .ranking-detalle-card.no-line::before,
      .ranking-detalle-row::before {
        content: none;
      }

      .ranking-detalle-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
      }

      .ranking-detalle-filters {
        padding: 18px;
      }

      .ranking-detalle-filter-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        align-items: end;
      }

      .ranking-detalle-field {
        display: grid;
        gap: 8px;
        min-width: 0;
      }

      .ranking-detalle-label {
        color: var(--ranking-detalle-text-soft);
        font-size: 0.76rem;
        font-weight: 950;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .ranking-detalle-select {
        min-height: 44px;
        width: 100%;
        border-radius: 14px;
        padding: 0 13px;
        color: var(--ranking-detalle-text);
        background: color-mix(in srgb, var(--ranking-detalle-surface-strong) 74%, transparent);
        border: 1px solid var(--ranking-detalle-border);
        outline: none;
        font-size: 0.9rem;
        font-weight: 750;
        transition:
          border-color 170ms ease,
          background 170ms ease,
          opacity 170ms ease;
      }

      .ranking-detalle-select:focus {
        border-color: color-mix(in srgb, var(--ranking-detalle-accent) 56%, var(--ranking-detalle-border));
        background: color-mix(in srgb, var(--ranking-detalle-surface-strong) 90%, transparent);
      }

      .ranking-detalle-select:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }

      .ranking-detalle-list-card {
        padding: 20px;
      }

      .ranking-detalle-list-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
      }

      .ranking-detalle-title-block {
        min-width: 0;
      }

      .ranking-detalle-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--ranking-detalle-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .ranking-detalle-eyebrow::before {
        content: "";
        width: 28px;
        height: 1px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--ranking-detalle-accent) 58%, transparent);
      }

      .ranking-detalle-title {
        color: var(--ranking-detalle-text);
        font-size: clamp(1.18rem, 2.2vw, 1.6rem);
        font-weight: 950;
        line-height: 1.06;
        letter-spacing: -0.04em;
      }

      .ranking-detalle-count {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 12px;
        color: var(--ranking-detalle-accent);
        background: color-mix(in srgb, var(--ranking-detalle-accent) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--ranking-detalle-accent) 20%, var(--ranking-detalle-border));
        font-size: 0.82rem;
        font-weight: 950;
        white-space: nowrap;
      }

      .ranking-detalle-empty {
        border-radius: 18px;
        padding: 16px;
        color: var(--ranking-detalle-muted);
        background: color-mix(in srgb, var(--ranking-detalle-surface-strong) 58%, transparent);
        border: 1px dashed color-mix(in srgb, var(--ranking-detalle-accent) 20%, var(--ranking-detalle-border));
        font-size: 0.92rem;
        font-weight: 750;
      }

      .ranking-detalle-list {
        display: grid;
        gap: 10px;
      }

      .ranking-detalle-row {
        --row-accent: var(--ranking-detalle-accent);
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        min-width: 0;
        border-radius: 20px;
        padding: 13px 14px;
        color: var(--ranking-detalle-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--ranking-detalle-surface-strong) 72%, transparent),
            color-mix(in srgb, var(--ranking-detalle-surface-soft) 88%, transparent)
          );
        border: 1px solid var(--ranking-detalle-border);
      }

      .ranking-detalle-row.top-1 {
        --row-accent: #f59e0b;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #f59e0b 14%, var(--ranking-detalle-surface-strong)),
            color-mix(in srgb, var(--ranking-detalle-surface-soft) 90%, transparent)
          );
        border-color: color-mix(in srgb, #f59e0b 38%, var(--ranking-detalle-border));
      }

      .ranking-detalle-row.top-2 {
        --row-accent: #94a3b8;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #94a3b8 16%, var(--ranking-detalle-surface-strong)),
            color-mix(in srgb, var(--ranking-detalle-surface-soft) 90%, transparent)
          );
        border-color: color-mix(in srgb, #94a3b8 40%, var(--ranking-detalle-border));
      }

      .ranking-detalle-row.top-3 {
        --row-accent: #c08457;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #c08457 14%, var(--ranking-detalle-surface-strong)),
            color-mix(in srgb, var(--ranking-detalle-surface-soft) 90%, transparent)
          );
        border-color: color-mix(in srgb, #c08457 38%, var(--ranking-detalle-border));
      }

      .ranking-detalle-user {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .ranking-detalle-rank {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--row-accent);
        background: color-mix(in srgb, var(--row-accent) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--row-accent) 30%, var(--ranking-detalle-border));
        font-size: 0.95rem;
        font-weight: 950;
        white-space: nowrap;
      }

      .ranking-detalle-rank.top {
        width: 46px;
        height: 46px;
        font-size: 1.05rem;
      }

      .ranking-detalle-avatar-stage {
        --ranking-avatar-core: color-mix(in srgb, var(--ranking-detalle-cyan) 18%, transparent);
        --ranking-avatar-a: color-mix(in srgb, var(--ranking-detalle-accent) 34%, transparent);
        --ranking-avatar-b: color-mix(in srgb, var(--ranking-detalle-cyan) 28%, transparent);
        --ranking-avatar-c: color-mix(in srgb, var(--ranking-detalle-accent) 26%, transparent);
        --ranking-avatar-border: color-mix(in srgb, var(--ranking-detalle-accent) 28%, transparent);
        --ranking-avatar-shadow-a: color-mix(in srgb, var(--ranking-detalle-accent) 4%, transparent);
        --ranking-avatar-shadow-b: color-mix(in srgb, var(--ranking-detalle-accent) 18%, transparent);
        --ranking-orbit-a: color-mix(in srgb, var(--ranking-detalle-accent) 20%, transparent);
        --ranking-orbit-b: color-mix(in srgb, var(--ranking-detalle-cyan) 22%, transparent);

        position: relative;
        z-index: 1;
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        isolation: isolate;
        flex: 0 0 auto;
      }

      .ranking-detalle-avatar-stage.large {
        width: 66px;
        height: 66px;
      }

      .ranking-detalle-avatar-stage::before {
        content: "";
        position: absolute;
        z-index: -3;
        width: 82%;
        height: 82%;
        border-radius: 999px;
        background:
          radial-gradient(
            circle,
            var(--ranking-avatar-core),
            transparent 62%
          ),
          conic-gradient(
            from 210deg,
            transparent 0deg,
            var(--ranking-avatar-a) 42deg,
            transparent 84deg,
            var(--ranking-avatar-b) 145deg,
            transparent 210deg,
            var(--ranking-avatar-c) 285deg,
            transparent 360deg
          );
        filter: blur(0.2px);
        opacity: 0.95;
      }

      .ranking-detalle-avatar-stage::after {
        content: "";
        position: absolute;
        z-index: -2;
        width: 70%;
        height: 70%;
        border-radius: 999px;
        border: 1px solid var(--ranking-avatar-border);
        box-shadow:
          0 0 0 10px var(--ranking-avatar-shadow-a),
          0 0 32px var(--ranking-avatar-shadow-b);
      }

      .ranking-detalle-avatar-orbit {
        position: absolute;
        inset: 17%;
        z-index: -1;
        border-radius: 999px;
        background:
          linear-gradient(
            100deg,
            transparent 0 21%,
            var(--ranking-orbit-a) 22% 30%,
            transparent 31% 100%
          ),
          linear-gradient(
            168deg,
            transparent 0 58%,
            var(--ranking-orbit-b) 59% 66%,
            transparent 67% 100%
          );
        opacity: 0.95;
        transform: rotate(-18deg);
      }

      .ranking-detalle-name-block {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .ranking-detalle-name {
        color: var(--ranking-detalle-text);
        font-size: 1rem;
        font-weight: 950;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }

      .ranking-detalle-row.top-1 .ranking-detalle-name,
      .ranking-detalle-row.top-2 .ranking-detalle-name,
      .ranking-detalle-row.top-3 .ranking-detalle-name {
        font-size: 1.08rem;
      }

      .ranking-detalle-subtext {
        color: var(--ranking-detalle-muted);
        font-size: 0.78rem;
        font-weight: 750;
      }

      .ranking-detalle-points {
        display: grid;
        justify-items: end;
        gap: 2px;
        color: var(--ranking-detalle-accent);
        font-size: 1.02rem;
        font-weight: 950;
        white-space: nowrap;
      }

      .ranking-detalle-points-label {
        color: var(--ranking-detalle-muted);
        font-size: 0.7rem;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .ranking-detalle-skeleton {
        animation: rankingDetallePulse 1.35s ease-in-out infinite;
      }

      .ranking-detalle-skeleton-row {
        height: 72px;
        border-radius: 20px;
        background: color-mix(in srgb, var(--ranking-detalle-border-strong) 24%, transparent);
      }

      @keyframes rankingDetallePulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }

      @media (max-width: 900px) {
        .ranking-detalle-filter-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        .ranking-detalle-filters,
        .ranking-detalle-list-card {
          border-radius: 24px;
          padding: 16px;
        }

        .ranking-detalle-filter-grid {
          grid-template-columns: 1fr;
        }

        .ranking-detalle-list-header {
          flex-direction: column;
        }

        .ranking-detalle-row {
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        .ranking-detalle-user {
          grid-template-columns: auto minmax(0, 1fr);
        }

        .ranking-detalle-rank {
          grid-row: span 2;
        }

        .ranking-detalle-avatar-stage {
          width: 52px;
          height: 52px;
        }

        .ranking-detalle-avatar-stage.large {
          width: 58px;
          height: 58px;
        }

        .ranking-detalle-points {
          justify-items: start;
          padding-left: 54px;
        }
      }
    `}</style>
  );

  return (
    <div className="ranking-detalle">
      {estilos}

      <section className="ranking-detalle-card ranking-detalle-filters no-line">
        <div className="ranking-detalle-card-content ranking-detalle-filter-grid">
          <div className="ranking-detalle-field">
            <label className="ranking-detalle-label">Carrera</label>

            <select
              value={carreraSel || ""}
              onChange={(e) => {
                setCarreraSel(e.target.value ? Number(e.target.value) : null);
                setPeriodoSel(null);
                setSeccionSel(null);
              }}
              className="ranking-detalle-select"
            >
              <option value="">Todas</option>
              <option value={1}>Licenciatura en Ciencias de la Computación</option>
              <option value={2}>Ingeniería en Ciencias de la Computación</option>
              <option value={3}>Ingeniería en Ciencia de Datos</option>
              <option value={4}>Ingeniería en Ciberseguridad</option>
              <option value={5}>Ingeniería en Tecnologías de la Información</option>
            </select>
          </div>

          <div className="ranking-detalle-field">
            <label className="ranking-detalle-label">Período</label>

            <select
              value={periodoSel || ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setPeriodoSel(val);
                setSeccionSel(null);
              }}
              disabled={!carreraSel}
              className="ranking-detalle-select"
            >
              <option value="">Todos</option>
              {periodosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="ranking-detalle-field">
            <label className="ranking-detalle-label">Sección</label>

            <select
              value={seccionSel || ""}
              onChange={(e) => setSeccionSel(e.target.value || null)}
              className="ranking-detalle-select"
              disabled={!periodoSel}
            >
              <option value="">Todas</option>
              {seccionesFiltradas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="ranking-detalle-field">
            <label className="ranking-detalle-label">Quiz</label>

            <select
              value={quizSel}
              onChange={(e) => setQuizSel(e.target.value)}
              className="ranking-detalle-select"
            >
              <option value="">Todos</option>
              {quizzes.length === 0 ? (
                <option disabled>Sin quizzes</option>
              ) : (
                quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.titulo}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="ranking-detalle-card ranking-detalle-list-card">
        <div className="ranking-detalle-card-content">
          <div className="ranking-detalle-list-header">
            <div className="ranking-detalle-title-block">
              <p className="ranking-detalle-eyebrow">
                {quizSel === "" ? "General" : "Quiz"}
              </p>

              <h2 className="ranking-detalle-title">
                {quizSel === ""
                  ? "Puntos acumulados"
                  : quizSeleccionado?.titulo || "Quiz seleccionado"}
              </h2>
            </div>

            <span className="ranking-detalle-count">
              {rankingFiltrado.length} estudiantes
            </span>
          </div>

          {cargando ? (
            <div className="ranking-detalle-list ranking-detalle-skeleton">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="ranking-detalle-skeleton-row" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <p className="ranking-detalle-empty">
              No hay datos para estos filtros.
            </p>
          ) : rankingFiltrado.length === 0 && filtroMatricula ? (
            <p className="ranking-detalle-empty">
              No se encontró ningún alumno con la matrícula{" "}
              <b>{filtroMatricula}</b>.
            </p>
          ) : (
            <div className="ranking-detalle-list">
              {rankingFiltrado.map((user: any, index: number) => {
                const posicion = index + 1;
                const esTop = index < 3;
                const puntos = quizSel === "" ? user.total : user.best;

                return (
                  <div
                    key={user.usuario_id}
                    className={`ranking-detalle-row ${
                      index === 0
                        ? "top-1"
                        : index === 1
                          ? "top-2"
                          : index === 2
                            ? "top-3"
                            : ""
                    }`}
                  >
                    <div className="ranking-detalle-user">
                      <span
                        className={`ranking-detalle-rank ${
                          esTop ? "top" : ""
                        }`}
                      >
                        {posicion}°
                      </span>

                      <div
                        className={`ranking-detalle-avatar-stage ${
                          esTop ? "large" : ""
                        }`}
                      >
                        <span className="ranking-detalle-avatar-orbit" />
                        <RenderizadorAvatar
                          config={user.avatar_config}
                          size={esTop ? 48 : 36}
                        />
                      </div>

                      <div className="ranking-detalle-name-block">
                        <span className="ranking-detalle-name">
                          {user.nombre}
                        </span>

                        {quizSel !== "" && (
                          <span className="ranking-detalle-subtext">
                            {user.tries}{" "}
                            {user.tries === 1 ? "intento" : "intentos"}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="ranking-detalle-points">
                      <span>{puntos} pts</span>
                      <span className="ranking-detalle-points-label">
                        {quizSel === "" ? "total" : "mejor"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
