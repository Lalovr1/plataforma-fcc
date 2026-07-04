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
      new Set(((progresoRows as any[]) ?? []).map((r) => r.usuario_id).filter(Boolean))
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

  return (
    <div className="space-y-6">
      <div
        className="p-4 rounded-xl shadow flex flex-col md:flex-row gap-3 md:items-end"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex-1">
          <label
            className="block text-sm mb-1"
            style={{ color: "var(--color-heading)" }}
          >
            Carrera
          </label>

          <select
            value={carreraSel || ""}
            onChange={(e) => {
              setCarreraSel(e.target.value ? Number(e.target.value) : null);
              setPeriodoSel(null);
              setSeccionSel(null);
            }}
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <option value="">Todas</option>
            <option value={1}>Licenciatura en Ciencias de la Computación</option>
            <option value={2}>Ingeniería en Ciencias de la Computación</option>
            <option value={3}>Ingeniería en Ciencia de Datos</option>
            <option value={4}>Ingeniería en Ciberseguridad</option>
            <option value={5}>Ingeniería en Tecnologías de la Información</option>
          </select>
        </div>

        <div className="flex-1">
          <label
            className="block text-sm mb-1"
            style={{ color: "var(--color-heading)" }}
          >
            Período
          </label>

          <select
            value={periodoSel || ""}
            onChange={(e) => {
              const val = e.target.value || null;
              setPeriodoSel(val);
              setSeccionSel(null);
            }}
            disabled={!carreraSel}
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <option value="">Todos</option>
            {periodosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            className="block text-sm mb-1"
            style={{ color: "var(--color-heading)" }}
          >
            Sección
          </label>

          <select
            value={seccionSel || ""}
            onChange={(e) => setSeccionSel(e.target.value || null)}
            className="w-full p-2 rounded"
            disabled={!periodoSel}
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <option value="">Todas</option>
            {seccionesFiltradas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            className="block text-sm mb-1"
            style={{ color: "var(--color-heading)" }}
          >
            Quiz
          </label>

          <select
            value={quizSel}
            onChange={(e) => setQuizSel(e.target.value)}
            className="w-full p-2 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
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

      <div
        className="p-6 rounded-xl shadow space-y-4"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-heading)" }}
        >
          📝{" "}
          {quizSel === ""
            ? "Puntos acumulados (todos los quizzes)"
            : "Desempeño por quiz"}
        </h2>

        {cargando ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-16 rounded-lg animate-pulse"
                style={{ backgroundColor: "var(--color-bg)" }}
              />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>
            No hay datos para estos filtros.
          </p>
        ) : rankingFiltrado.length === 0 && filtroMatricula ? (
          <p style={{ color: "var(--color-muted)" }}>
            No se encontró ningún alumno con la matrícula{" "}
            <b>{filtroMatricula}</b>.
          </p>
        ) : (
          <div className="space-y-2">
            {rankingFiltrado.map((user: any, index: number) => (
              <div
                key={user.usuario_id}
                className="flex items-center justify-between rounded-lg p-3 gap-3 min-w-0"
                style={{
                  backgroundColor:
                    index === 0
                      ? "rgba(234,179,8,0.2)"
                      : index === 1
                      ? "rgba(148,163,184,0.2)"
                      : index === 2
                      ? "rgba(251,146,60,0.2)"
                      : "var(--color-bg)",
                }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className="font-bold shrink-0"
                    style={{
                      fontSize: index < 3 ? "1.25rem" : "1rem",
                      color: "var(--color-heading)",
                    }}
                  >
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `#${index + 1}`}
                  </span>

                  <div className="shrink-0">
                    <RenderizadorAvatar
                      config={user.avatar_config}
                      size={index < 3 ? 48 : 32}
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-semibold break-words"
                      style={{
                        color: "var(--color-heading)",
                        fontSize: index < 3 ? "1.125rem" : "1rem",
                      }}
                    >
                      {user.nombre}
                    </span>

                    {quizSel !== "" && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {user.tries}{" "}
                        {user.tries === 1 ? "intento" : "intentos"}
                      </span>
                    )}
                  </div>
                </div>

                {quizSel === "" ? (
                  <span
                    className="font-bold whitespace-nowrap shrink-0"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {user.total} pts
                  </span>
                ) : (
                  <span
                    className="font-bold whitespace-nowrap shrink-0"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {user.best} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}