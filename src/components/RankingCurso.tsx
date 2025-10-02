/**
 * RankingCurso.tsx
 * - Ranking por curso con filtros de período, sección y quiz
 * - "Todos" en quiz = suma de mejores puntajes en todos los quizzes del curso
 * - Quiz específico = mejor puntaje + menor nº intentos
 * - Solo estudiantes aparecen en el ranking (rol = estudiante)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

type PeriodoOpt = { id: string; etiqueta: string; carrera_id: number };
type SeccionOpt = { id: string; nombre: string; periodo_id: string };

type Inscrito = {
  usuario_id: string;
  nombre: string;
  avatar_config: AvatarConfig | null;
  frame_url: string | null;
  carrera_id: number | null; 
  periodo_id: string | null;
  seccion_id: string | null;
  rol: string;
};

type Quiz = { id: string; titulo: string };
type IntentoStats = { best: number; total: number; tries: number };

export default function RankingCurso({ materiaId }: { materiaId: string }) {
  const [cargando, setCargando] = useState(true);

  const [periodos, setPeriodos] = useState<PeriodoOpt[]>([]);
  const [secciones, setSecciones] = useState<SeccionOpt[]>([]);
  const [carreraSel, setCarreraSel] = useState<number | null>(null);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const [seccionSel, setSeccionSel] = useState<string | null>(null);

  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizSel, setQuizSel] = useState<string>(""); // "" = Todos

  const [intentosMap, setIntentosMap] = useState<
    Record<string, Record<string, IntentoStats>>
  >({});

  const cargarPeriodoSecciones = async () => {
    const { data: cc } = await supabase
      .from("curso_carreras")
      .select(`
        id,
        carrera_id,
        curso_periodos (
          id, nombre, anio,
          curso_secciones ( id, nombre )
        )
      `)
      .eq("curso_id", materiaId);

    const p: PeriodoOpt[] = [];
    const s: SeccionOpt[] = [];

    (cc || []).forEach((c: any) => {
      (c.curso_periodos || []).forEach((p0: any) => {
        const etiqueta = `${p0.nombre} ${p0.anio}`;
        p.push({ id: p0.id, etiqueta, carrera_id: c.carrera_id }); 
        (p0.curso_secciones || []).forEach((sec: any) => {
          s.push({ id: sec.id, nombre: sec.nombre, periodo_id: p0.id });
        });
      });
    });

    setPeriodos(p);
    setSecciones(s);
  };

  const cargarInscritos = async () => {
    const { data: prog } = await supabase
      .from("progreso")
      .select("usuario_id, periodo_id, seccion_id")
      .eq("materia_id", materiaId);

    const userIds = (prog || []).map((r: any) => r.usuario_id);
    let usersById: Record<
      string,
      {
        nombre: string;
        avatar_config: AvatarConfig | null;
        frame_url: string | null;
        rol: string;
        carrera_id: number | null;
      }
    > = {};

    if (userIds.length) {
      const { data: us } = await supabase
        .from("usuarios")
        .select("id, nombre, avatar_config, frame_url, rol, carrera_id")
        .in("id", userIds);

      if (us) {
        usersById = Object.fromEntries(
          us.map((u: any) => [
            u.id,
            {
              nombre: u.nombre ?? "Sin nombre",
              avatar_config: u.avatar_config ?? null,
              frame_url: u.frame_url ?? null,
              rol: u.rol ?? "estudiante",
              carrera_id: u.carrera_id ?? null,
            },
          ])
        );
      }
    }

    const parsed: Inscrito[] = (prog || [])
      .map((r: any) => ({
        usuario_id: r.usuario_id,
        carrera_id: usersById[r.usuario_id]?.carrera_id ?? null, 
        periodo_id: r.periodo_id ?? null,
        seccion_id: r.seccion_id ?? null,
        nombre: usersById[r.usuario_id]?.nombre ?? "Sin nombre",
        avatar_config: usersById[r.usuario_id]?.avatar_config ?? null,
        frame_url: usersById[r.usuario_id]?.frame_url ?? null,
        rol: usersById[r.usuario_id]?.rol ?? "estudiante",
      }))
      .filter((r) => r.rol === "estudiante");

    setInscritos(parsed);
  };

  const cargarQuizzes = async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("id, titulo")
      .eq("materia_id", materiaId)
      .order("created_at", { ascending: true });

    const qs = (data || []).map((q: any) => ({
      id: q.id,
      titulo: q.titulo || "Quiz",
    }));
    setQuizzes(qs);
    setQuizSel(""); 
  };

  const cargarIntentos = async () => {
    const { data } = await supabase
      .from("intentos_quiz")
      .select("quiz_id, usuario_id, puntaje, quizzes(id, materia_id)")
      .eq("quizzes.materia_id", materiaId);

    const acc: Record<string, Record<string, IntentoStats>> = {};
    (data || []).forEach((row: any) => {
      const qid = row.quiz_id as string;
      const uid = row.usuario_id as string;
      const score = Number(row.puntaje ?? 0);

      if (!acc[qid]) acc[qid] = {};
      if (!acc[qid][uid]) acc[qid][uid] = { best: score, total: score, tries: 1 };
      else {
        acc[qid][uid].tries += 1;
        acc[qid][uid].total += score;
        if (score > acc[qid][uid].best) acc[qid][uid].best = score;
      }
    });

    setIntentosMap(acc);
  };

  useEffect(() => {
    const run = async () => {
      setCargando(true);
      await Promise.all([
        cargarPeriodoSecciones(),
        cargarInscritos(),
        cargarQuizzes(),
        cargarIntentos(),
      ]);
      setCargando(false);
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
    if (quizSel === null) return [];

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
    } else {
      const rows = inscritosFiltrados.map((i) => {
        const st = intentosMap[quizSel || ""]?.[i.usuario_id] || {
          best: 0,
          total: 0,
          tries: 0,
        };
        return { ...i, best: st.best, tries: st.tries };
      });
      return rows.sort((a, b) => {
        if (b.best !== a.best) return b.best - a.best;
        if (a.tries !== b.tries) return a.tries - b.tries;
        return a.nombre.localeCompare(b.nombre);
      });
    }
  }, [inscritosFiltrados, intentosMap, quizSel]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
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
            onChange={(e) => setCarreraSel(e.target.value ? Number(e.target.value) : null)}
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
            {!periodoSel ? (
              <option value="">Todas</option>
            ) : (
              <>
                <option value="">Todas</option>
                {seccionesFiltradas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </>
            )}
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
            value={quizSel || ""}
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

      {/* Ranking */}
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
          <p style={{ color: "var(--color-muted)" }}>Cargando...</p>
        ) : ranking.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>
            No hay datos para estos filtros.
          </p>
        ) : (
          <div className="space-y-2">
            {ranking.map((user: any, index: number) => (
              <div
                key={user.usuario_id}
                className="flex items-center justify-between rounded-lg p-3"
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
                <div className="flex items-center gap-4">
                  <span
                    className="font-bold"
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
                  <RenderizadorAvatar
                    config={user.avatar_config}
                    frameUrl={user.frame_url}
                    size={index < 3 ? 48 : 32}
                  />
                  <div className="flex flex-col">
                    <span
                      className="font-semibold"
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
                    className="font-bold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {user.total} pts
                  </span>
                ) : (
                  <span
                    className="font-bold"
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
