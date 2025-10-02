/**
 * Visualizador de curso para estudiantes y profesores
 * - Evita scroll excesivo: índice de bloques + vista de un solo bloque.
 * - Estudiante: muestra progreso y botón "Resolver".
 * - Profesor: oculta progreso y solo permite previsualizar quizzes.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import CirculoProgreso from "@/components/CirculoProgreso";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

type Rol = "estudiante" | "profesor";

type Bloque = {
  id: string;
  materia_id: string;
  tipo: "texto" | "imagen" | "video" | "documento";
  titulo?: string | null;
  contenido: string;
  orden?: number | null;
  quizzes?: {
    id: string;
    titulo: string;
    descripcion?: string | null;
    xp?: number | null;
    orden?: number | null;
  }[];
};

type Formula = {
  id: string;
  titulo?: string | null;
  ecuacion: string;
  bloque_id: string | null;
  publica: boolean;
};

const preprocessMarkdown = (md: string) => {
  return (md || "")
    .replace(/\[\s*(?:🖼|📷)\s+([^\]]+)\]/g, (_m, filename) => `<customfile nombre="${filename}"></customfile>`)
    .replace(/\[\s*🎥\s+([^\]]+)\]/g, (_m, filename) => `<customfile nombre="${filename}"></customfile>`)
    .replace(/\[\s*📄\s+([^\]]+)\]/g, (_m, filename) => `<customfile nombre="${filename}"></customfile>`)
    .replace(
      /\[([^\]]+\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mov|mkv|pdf|docx?|pptx?|xlsx))\]/gi,
      (_m, filename) => `<customfile nombre="${filename}"></customfile>`
    )
    .replace(/<customfile data='([^']+)'><\/customfile>/gi, (_m, json) => `<customfile data='${json}'></customfile>`);
};

const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
const isVideo = (name: string) => /\.(mp4|webm|ogg|mov|mkv)$/i.test(name);
const isDoc   = (name: string) => /\.(pdf|docx?|pptx?|xlsx)$/i.test(name);

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
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  const [fileMaps, setFileMaps] = useState<Record<string, Record<string, { name: string; url: string }>>>({});

  const [bloquesAbiertosIds, setBloquesAbiertosIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: mat } = await supabase
        .from("materias")
        .select(`
          id,
          nombre,
          profesor:usuarios (id, nombre),
          curso_carreras (
            id,
            semestre,
            carrera:carreras (id, nombre)
          )
        `)
        .eq("id", materiaId)
        .single();
      setMateria(mat);

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
      } else {
        setProgreso(0);
      }

      const { data: bl } = await supabase
        .from("curso_contenido_bloques")
        .select("*")
        .eq("materia_id", materiaId)
        .order("orden", { ascending: true });

      let bloquesConQuizzes: Bloque[] = [];
      if (bl) {
        bloquesConQuizzes = await Promise.all(
          bl.map(async (b: any) => {
            const { data: quizzes } = await supabase
              .from("quizzes")
              .select("id, titulo, descripcion, xp, orden")
              .eq("bloque_id", b.id)
              .order("orden", { ascending: true });

            return { ...b, quizzes: (quizzes || []) as Bloque["quizzes"] };
          })
        );
      }
      setBloques(bloquesConQuizzes);

      const bloqueIds = (bl || []).map((b: any) => b.id);
      const { data: fm } = await supabase
        .from("curso_formulas")
        .select("id, titulo, ecuacion, bloque_id, publica, created_at, orden")
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

  if (loading) return <p style={{ color: "var(--color-muted)" }}>Cargando curso...</p>;
  if (!materia) return <p style={{ color: "var(--color-danger)" }}>Curso no encontrado</p>;

  const tituloBloque = (b: Bloque, idx: number) =>
    b.titulo?.trim() ? b.titulo : `Bloque ${idx + 1} (${b.tipo})`;

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div className="space-y-6">
      {/* Cabecera curso */}
      <div className="p-6 rounded-xl shadow gap-6 items-center flex" style={cardStyle}>
        {rol === "estudiante" && (
          <div className="flex items-center min-w-[140px] justify-center">
            <CirculoProgreso progress={progreso} size={140} />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-heading)" }}>
            {materia.nombre}
          </h1>
          {materia.curso_carreras?.length > 0 ? (
            materia.curso_carreras.map((cc: any) => (
              <div key={cc.id} className="text-sm" style={{ color: "var(--color-text)" }}>
                <p>Carrera: {cc.carrera?.nombre ?? "N/A"}</p>
                <p>Semestre: {cc.semestre ?? "N/A"}</p>
              </div>
            ))
          ) : (
            <p style={{ color: "var(--color-muted)" }}>
              Este curso aún no tiene carreras asignadas
            </p>
          )}

          <div className="mt-6">
            <h2 className="text-xl font-bold" style={{ color: "var(--color-heading)" }}>
              Profesor
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              {materia.profesor
                ? materia.profesor.nombre
                : "Aún no hay profesor asignado"}
            </p>
          </div>
        </div>
      </div>

      {/* Índice de bloques */}
      <div className="p-6 rounded-xl shadow space-y-4" style={cardStyle}>
        <h2 className="text-xl font-bold" style={{ color: "var(--color-heading)" }}>
          Contenido del curso
        </h2>
        {bloques.length === 0 && (
          <p style={{ color: "var(--color-muted)" }}>Aún no hay contenido.</p>
        )}

        <div className="space-y-2">
          {bloques.map((b, i) => {
            const activo = bloquesAbiertosIds.includes(b.id);
            const blockFileMap = fileMaps[b.id] || {};

            const headerStyle: React.CSSProperties = {
              backgroundColor: "var(--color-card)",
              border: activo ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              color: "var(--color-text)",
            };

            return (
              <div key={b.id} className="space-y-2">
                <button
                  onClick={() =>
                    setBloquesAbiertosIds((prev) =>
                      activo ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                    )
                  }
                  className="w-full text-left rounded-lg px-4 py-3 transition hover:shadow"
                  style={headerStyle}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--color-heading)" }}>
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
                  <div className="rounded-lg p-6 space-y-4" style={cardStyle}>
                    {b.tipo === "texto" && (
                      <div className="prose max-w-none">
                        {b.titulo && (
                          <h2 className="text-2xl font-bold text-center mb-6" style={{ color: "var(--color-heading)" }}>
                            {b.titulo}
                          </h2>
                        )}
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex, rehypeRaw]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                className="underline hover:opacity-90"
                                style={{ color: "var(--color-primary)" }}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                            customfile: ({ node, ...props }: { node?: any; [key: string]: any }) => {
                              if (props.data) {
                                try {
                                  const parsed = JSON.parse(props.data as string) as { name: string; url: string };
                                  const fallback = (!parsed.url && blockFileMap[parsed.name]) ? blockFileMap[parsed.name] : parsed;

                                  if (isImage(fallback.name)) {
                                    return (
                                      <img
                                        src={fallback.url}
                                        alt={fallback.name}
                                        className="max-h-64 mx-auto rounded shadow"
                                      />
                                    );
                                  }
                                  if (isVideo(fallback.name)) {
                                    return (
                                      <video
                                        src={fallback.url}
                                        controls
                                        className="max-h-64 mx-auto rounded shadow"
                                      />
                                    );
                                  }
                                  if (isDoc(fallback.name)) {
                                    return (
                                      <a
                                        href={fallback.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                        style={{ color: "var(--color-primary)" }}
                                      >
                                        📄 {fallback.name}
                                      </a>
                                    );
                                  }
                                  return (
                                    <a
                                      href={fallback.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline"
                                      style={{ color: "var(--color-primary)" }}
                                    >
                                      {fallback.name}
                                    </a>
                                  );
                                } catch {
                                  return <span style={{ color: "var(--color-danger)" }}>Archivo inválido</span>;
                                }
                              }

                              if (props.nombre) {
                                const filename = String(props.nombre).replace(/^[\s🖼📷🎥📄]+/, "").trim();
                                const entry = blockFileMap[filename];

                                if (entry) {
                                  if (isImage(entry.name)) {
                                    return (
                                      <img
                                        src={entry.url}
                                        alt={entry.name}
                                        className="max-h-64 mx-auto rounded shadow"
                                      />
                                    );
                                  }
                                  if (isVideo(entry.name)) {
                                    return (
                                      <video
                                        src={entry.url}
                                        controls
                                        className="max-h-64 mx-auto rounded shadow"
                                      />
                                    );
                                  }
                                  if (isDoc(entry.name)) {
                                    return (
                                      <a
                                        href={entry.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                        style={{ color: "var(--color-primary)" }}
                                      >
                                        📄 {entry.name}
                                      </a>
                                    );
                                  }
                                  return (
                                    <a
                                      href={entry.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline"
                                      style={{ color: "var(--color-primary)" }}
                                    >
                                      {entry.name}
                                    </a>
                                  );
                                }
                                return <span>{filename}</span>;
                              }

                              return <span>Archivo</span>;
                            },
                          }}
                        >
                          {preprocessMarkdown(b.contenido)}
                        </ReactMarkdown>
                      </div>
                    )}

                    {b.tipo !== "texto" && (() => {
                      try {
                        const json = b.contenido.replace(/<\/?customfile[^>]*>/g, "").trim();
                        const parsed = JSON.parse(json) as { name: string; url: string };

                        if (isImage(parsed.name)) {
                          return (
                            <div className="text-center">
                              <img src={parsed.url} alt={parsed.name} className="max-h-80 mx-auto rounded shadow" />
                              <p className="mt-2 underline" style={{ color: "var(--color-primary)" }}>
                                <a href={parsed.url} target="_blank" rel="noopener noreferrer">{parsed.name}</a>
                              </p>
                            </div>
                          );
                        }
                        if (isVideo(parsed.name)) {
                          return (
                            <div className="text-center">
                              <video src={parsed.url} controls className="max-h-80 mx-auto rounded shadow" />
                              <p className="mt-2 underline" style={{ color: "var(--color-primary)" }}>
                                <a href={parsed.url} target="_blank" rel="noopener noreferrer">{parsed.name}</a>
                              </p>
                            </div>
                          );
                        }
                        if (isDoc(parsed.name)) {
                          return (
                            <div className="rounded-lg p-4 text-center" style={cardStyle}>
                              <p className="mb-2 font-medium" style={{ color: "var(--color-heading)" }}>
                                {b.titulo || parsed.name}
                              </p>
                              <a
                                href={parsed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-4 py-2 rounded text-white hover:opacity-90"
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
                            className="rounded-lg px-3 py-2 flex justify-between items-center"
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
                                className="px-3 py-1 rounded text-white hover:opacity-90"
                                style={{ backgroundColor: "var(--color-primary)" }}
                              >
                                Resolver
                              </a>
                            ) : (
                              <a
                                href={`/curso/${materiaId}/quiz/${q.id}?preview=1`}
                                className="px-3 py-1 rounded text-white hover:opacity-90"
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
      </div>

      {/* Formulario */}
      <div className="p-6 rounded-xl shadow space-y-4" style={cardStyle}>
        <h2 className="text-xl font-bold" style={{ color: "var(--color-heading)" }}>
          Formulario
        </h2>
        {formulas.length === 0 && (
          <p style={{ color: "var(--color-muted)" }}>Aún no hay fórmulas públicas.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formulas.map((f) => (
            <div
              key={f.id}
              className="p-6 rounded-lg shadow text-center flex flex-col items-center justify-center"
              title={f.titulo || undefined}
              style={cardStyle}
            >
              {f.titulo && (
                <h3 className="font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
                  {f.titulo}
                </h3>
              )}
              <div className="max-w-none prose">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {`$$${f.ecuacion}$$`}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
