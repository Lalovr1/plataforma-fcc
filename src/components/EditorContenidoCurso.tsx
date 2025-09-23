/**
 * Editor de contenido de curso: permite crear, organizar y editar bloques
 * de texto, imágenes o videos, con soporte para fórmulas en LaTeX.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import rehypeRaw from "rehype-raw";
import ConstructorQuiz from "@/components/ConstructorQuiz";

type BlockType = "texto" | "imagen" | "video";

type Block = {
  id: string;
  materia_id: string;
  tipo: BlockType;
  titulo?: string;
  contenido: string;
  orden: number;
  created_at: string;
};

type Subsection = {
  id: string;
  subtitle: string;
  text: string;
  formulas: FormulaItem[];
};

type FormulaItem = {
  id: string;
  title: string;
  latex: string;
};

declare global {
  interface Window {
    MathJax?: any;
  }
}

const uid = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

const normalizeMarkdownSpacing = (md: string) => {
  return md.replace(/^(#{1,6}[^\n]*?)\n+/gm, "$1\n");
};

export default function EditorContenidoCurso({
  materiaId,
}: {
  materiaId: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  const [tipo, setTipo] = useState<BlockType>("texto");
  const [titulo, setTitulo] = useState("");
  const [intro, setIntro] = useState("");
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");

  const nextOrden = useMemo(
    () => (blocks.length ? Math.max(...blocks.map((b) => b.orden)) + 1 : 0),
    [blocks]
  );

  const fetchBlocks = async () => {
    const { data, error } = await supabase
      .from("curso_contenido_bloques")
      .select("*")
      .eq("materia_id", materiaId)
      .order("orden", { ascending: true });

    if (!error && data) setBlocks(data as Block[]);
  };

  useEffect(() => {
    fetchBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.MathJax || document.getElementById("mathjax-script")) return;

    const script = document.createElement("script");
    script.id = "mathjax-script";
    script.async = true;
    script.src =
      "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const typeset = async () => {
      try {
        await window.MathJax?.typesetPromise?.();
      } catch {}
    };
    typeset();
  }, [subsections]);

  useEffect(() => {
    const typeset = async () => {
      try {
        await window.MathJax?.typesetPromise?.(["#math-preview"]);
      } catch {}
    };
    typeset();
  }, [editContenido]);

  const addSubsection = () => {
    setSubsections((prev) => [
      ...prev,
      { id: uid(), subtitle: "", text: "", formulas: [] },
    ]);
  };
  const removeSubsection = (id: string) => {
    setSubsections((prev) => prev.filter((s) => s.id !== id));
  };
  const updateSubsection = (id: string, patch: Partial<Subsection>) => {
    setSubsections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const addFormula = (subId: string) => {
    setSubsections((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              formulas: [
                ...s.formulas,
                { id: uid(), title: "", latex: "" },
              ],
            }
          : s
      )
    );
  };
  const removeFormula = (subId: string, fId: string) => {
    setSubsections((prev) =>
      prev.map((s) =>
        s.id === subId
          ? { ...s, formulas: s.formulas.filter((f) => f.id !== fId) }
          : s
      )
    );
  };
  const updateFormula = (
    subId: string,
    fId: string,
    patch: Partial<FormulaItem>
  ) => {
    setSubsections((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              formulas: s.formulas.map((f) =>
                f.id === fId ? { ...f, ...patch } : f
              ),
            }
          : s
      )
    );
  };
  const uploadToStorage = async (f: File) => {
    const ext = f.name.split(".").pop();
    const key = `${materiaId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const { error: upErr } = await supabase
      .from("curso-contenido")
      .upload(key, f, { upsert: false });

    if (upErr) throw upErr;

    const { data } = supabase.storage
      .from("curso-contenido")
      .getPublicUrl(key);
    return data.publicUrl;
  };

  const buildMarkdown = () => {
    let md = "";

    if (intro.trim()) {
      md += `## Introducción\n\n${intro.trim()}\n\n`;
    }

    subsections.forEach((s) => {
      if (s.subtitle.trim()) md += `## ${s.subtitle.trim()}\n\n`;
      if (s.text.trim()) md += `${s.text.trim()}\n\n`;

      if (s.formulas.length > 0) {
        s.formulas.forEach((f) => {
          if (f.title.trim()) {
            md += `<p class="text-center font-bold">${f.title.trim()}</p>\n\n`;
          }
          if (f.latex.trim()) md += `$$\n${f.latex.trim()}\n$$\n\n`;
        });
      }
    });

    return normalizeMarkdownSpacing(md.trim());
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let contenido = "";

      if (tipo === "texto") {
        const md = buildMarkdown();
        if (!md) {
          alert(
            "Completa el Título, alguna Subsección o alguna Fórmula para generar contenido."
          );
          setLoading(false);
          return;
        }
        contenido = md;
      } else {
        if (!file) {
          alert("Selecciona un archivo.");
          setLoading(false);
          return;
        }
        contenido = await uploadToStorage(file);
      }

      const { data: insertedBlock, error: blockError } = await supabase
        .from("curso_contenido_bloques")
        .insert({
          materia_id: materiaId,
          tipo,
          titulo: titulo.trim() || null,
          contenido,
          orden: nextOrden,
        })
        .select("id")
        .single();

      if (blockError) throw blockError;

      for (const s of subsections) {
        for (const f of s.formulas) {
          if (!f.latex.trim()) continue;
          await supabase.from("curso_formulas").insert({
            bloque_id: insertedBlock.id,
            titulo: f.title.trim() || null,
            ecuacion: f.latex.trim(),
          });
        }
      }

      setTitulo("");
      setIntro("");
      setSubsections([]);
      setFile(null);
      setTipo("texto");
      await fetchBlocks();
    } catch (err: any) {
      console.error(err);
      alert("No se pudo agregar el bloque.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar bloque?")) return;
    const { error } = await supabase
      .from("curso_contenido_bloques")
      .delete()
      .eq("id", id);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar.");
      return;
    }
    fetchBlocks();
  };

  const move = async (id: string, dir: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= blocks.length) return;

    const a = blocks[idx];
    const b = blocks[swapIdx];

    const { error: e1 } = await supabase
      .from("curso_contenido_bloques")
      .update({ orden: b.orden })
      .eq("id", a.id);
    const { error: e2 } = await supabase
      .from("curso_contenido_bloques")
      .update({ orden: a.orden })
      .eq("id", b.id);

    if (e1 || e2) {
      console.error(e1 || e2);
      alert("No se pudo reordenar.");
      return;
    }
    fetchBlocks();
  };

  const handleOpenEdit = (block: Block) => {
    setEditBlock(block);
    setEditTitulo(block.titulo || "");
    setEditContenido(normalizeMarkdownSpacing(block.contenido || ""));
  };

  const handleSaveEdit = async () => {
    if (!editBlock) return;
    const { error } = await supabase
      .from("curso_contenido_bloques")
      .update({
        titulo: editTitulo.trim() || null,
        contenido: editContenido.trim(),
      })
      .eq("id", editBlock.id);

    if (error) {
      console.error(error);
      alert("No se pudo guardar los cambios.");
      return;
    }
    setEditBlock(null);
    fetchBlocks();
  };

  return (
    <div className="bg-gray-900 rounded-xl p-5 shadow space-y-5">
      {/* Formulario para agregar bloque */}
      <form onSubmit={handleAddBlock} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Tipo de bloque</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as BlockType)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2"
          >
            <option value="texto">Texto</option>
            <option value="imagen">Imagen</option>
            <option value="video">Video</option>
          </select>
        </div>

        {tipo === "texto" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2"
                placeholder="Título del bloque (se mostrará grande)"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Introducción (opcional)
              </label>
              <TextareaAutosize
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                minRows={3}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 resize-none"
                placeholder="Texto introductorio antes de los subtítulos"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  Subsecciones (Subtítulo + Contenido)
                </label>
                <button
                  type="button"
                  onClick={addSubsection}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Agregar subtítulo
                </button>
              </div>

              {subsections.length === 0 && (
                <p className="text-xs text-gray-400">
                  Aún no has agregado subtítulos.
                </p>
              )}

              {subsections.map((s, idx) => (
                <div key={s.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Subtítulo #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubsection(s.id)}
                      className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-xs"
                    >
                      Quitar
                    </button>
                  </div>

                  <input
                    type="text"
                    value={s.subtitle}
                    onChange={(e) =>
                      updateSubsection(s.id, { subtitle: e.target.value })
                    }
                    className="w-full bg-gray-700 rounded px-3 py-2"
                    placeholder="Subtítulo"
                  />

                  <TextareaAutosize
                    value={s.text}
                    onChange={(e) =>
                      updateSubsection(s.id, { text: e.target.value })
                    }
                    minRows={4}
                    className="w-full bg-gray-700 rounded px-3 py-2 resize-none"
                    placeholder="Contenido (Markdown)"
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Fórmulas</label>
                      <button
                        type="button"
                        onClick={() => addFormula(s.id)}
                        className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
                      >
                        Agregar fórmula
                      </button>
                    </div>

                    {s.formulas.map((f: FormulaItem, fIdx: number) => (
                      <div
                        key={f.id}
                        className="bg-gray-700 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            Fórmula #{fIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFormula(s.id, f.id)}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-xs"
                          >
                            Quitar
                          </button>
                        </div>

                        <input
                          type="text"
                          value={f.title}
                          onChange={(e) =>
                            updateFormula(s.id, f.id, {
                              title: e.target.value,
                            })
                          }
                          className="w-full bg-gray-600 rounded px-3 py-2 text-center"
                          placeholder="Título de la fórmula"
                        />

                        <TextareaAutosize
                          value={f.latex}
                          onChange={(e) =>
                            updateFormula(s.id, f.id, {
                              latex: e.target.value,
                            })
                          }
                          minRows={2}
                          className="w-full bg-gray-600 rounded px-3 py-2 resize-none"
                          placeholder="Ecuación en LaTeX"
                        />

                        <div className="bg-gray-900 rounded p-3 text-center">
                          <p className="text-xs text-gray-400 mb-2">
                            Vista previa:
                          </p>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: `$$${f.latex || ""}$$`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm mb-1">
              {tipo === "imagen" ? "Archivo de imagen" : "Archivo de video"}
            </label>
            <input
              type="file"
              accept={tipo === "imagen" ? "image/*" : "video/*"}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Agregar bloque"}
        </button>
      </form>

      <div className="space-y-3">
        {blocks.length === 0 && (
          <p className="text-sm text-gray-400">Aún no hay contenido.</p>
        )}

        {blocks.map((b) => (
          <div
            key={b.id}
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700"
            onClick={() => handleOpenEdit(b)}
            title="Haz clic para editar este bloque"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-gray-700">
                  {b.tipo.toUpperCase()}
                </span>
                <span className="font-semibold text-white">
                  {b.titulo || "(Sin título)"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    move(b.id, "up");
                  }}
                  className="px-2 py-1 bg-gray-700 rounded"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    move(b.id, "down");
                  }}
                  className="px-2 py-1 bg-gray-700 rounded"
                >
                  ↓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(b.id);
                  }}
                  className="px-2 py-1 bg-red-600 rounded"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-lg w-full max-w-6xl p-6 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4">
              Editando bloque:{" "}
              <span className="text-blue-400">
                {editTitulo || "(Sin título)"}
              </span>{" "}
              <span className="ml-2 text-xs text-gray-400">
                ({editBlock.tipo})
              </span>
            </h2>

            <div className="flex-1 grid grid-cols-2 gap-4 pr-2 max-h-[70vh]">
              <div className="space-y-4 overflow-y-auto max-h-[70vh]">
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white"
                  placeholder="Título del bloque"
                />

                <TextareaAutosize
                  value={editContenido}
                  onChange={(e) => setEditContenido(e.target.value)}
                  minRows={15}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white resize-none h-full"
                  placeholder={
                    editBlock.tipo === "texto"
                      ? "Contenido del bloque (Markdown generado). Puedes ajustarlo aquí si lo prefieres."
                      : "URL del recurso (imagen/video) almacenado."
                  }
                />
              </div>

              {editBlock.tipo === "texto" && (
                <div className="bg-gray-800 rounded-lg p-3 overflow-y-auto max-h-[70vh]">
                  <p className="text-xs text-gray-400 mb-2">
                    Vista previa completa:
                  </p>
                  <div className="prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeRaw]}
                      components={{
                        h2: ({ node, ...props }) => (
                          <h2
                            className="mt-2 mb-1 font-bold text-lg text-white"
                            {...props}
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3
                            className="mt-1 mb-1 font-semibold text-base text-gray-200"
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-0 leading-relaxed" {...props} />
                        ),
                      }}
                    >
                      {editContenido}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setEditBlock(null)}
                className="px-4 py-2 bg-gray-600 rounded text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-green-600 rounded text-white"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
