/**
 * Editor de contenido de curso: permite crear, organizar y editar bloques
 * de texto, imágenes o videos, con soporte para fórmulas en LaTeX.
 */

"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import rehypeRaw from "rehype-raw";
import ConstructorQuiz from "@/components/ConstructorQuiz";
import { useRef } from "react"; 
import OcrFormula from "@/components/OcrFormula";

type BlockType = "texto" | "imagen" | "video" | "documento";

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
  titulo: string;
  ecuacion: string;
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

const convertFromCustomfile = (md: string) => {
  return md.replace(/<customfile data='([^']+)'><\/customfile>/g, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(parsed.name)) {
        return `[📷 ${parsed.name}]`;
      }
      if (/\.(mp4|webm|ogg|mov|mkv)$/i.test(parsed.name)) {
        return `[${parsed.name}]`;
      }
      if (/\.(pdf|docx?|pptx?|xlsx)$/i.test(parsed.name)) {
        return `[${parsed.name}]`;
      }
      return `[${parsed.name}]`;
    } catch {
      return "[archivo]";
    }
  });
};

const extractLatexFormulas = (text: string): string[] => {
  const regex = /\$\$([\s\S]*?)\$\$/g;
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
};

export default function EditorContenidoCurso({
  materiaId,
  onBloquesChange,
}: {
  materiaId: string;
  onBloquesChange?: () => void; 
}) {
  const [fileMap, setFileMap] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  const introRef = useRef<HTMLTextAreaElement | null>(null);
  const subsectionRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  const [tipo, setTipo] = useState<BlockType>("texto");
  const [titulo, setTitulo] = useState("");
  const [intro, setIntro] = useState("");
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [editFormulas, setEditFormulas] = useState<
    { id: string; titulo: string; ecuacion: string; publica: boolean }[]
  >([]);
  const [deletedFormulas, setDeletedFormulas] = useState<string[]>([]);
  const [targetFormulaId, setTargetFormulaId] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState<{id:string, titulo:string, ecuacion:string, publica:boolean} | null>(null);

  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [formulaMode, setFormulaMode] = useState<"latex" | "image">("latex");
  const [formulaEcuacion, setFormulaEcuacion] = useState("");
  const [formulaTitulo, setFormulaTitulo] = useState("");
  const [targetTextarea, setTargetTextarea] = useState<HTMLTextAreaElement | null>(null);
  const [targetSubId, setTargetSubId] = useState<string | null>(null);

  const [inlineFormulaTitles, setInlineFormulaTitles] = useState<
    { scope: "intro" | string; ecuacion: string; titulo: string }[]
  >([]);


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

  const getTipoArchivo = (name: string): "imagen" | "video" | "documento" => {
    const n = name.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return "imagen";
    if (/\.(mp4|webm|ogg|mov|mkv)$/.test(n)) return "video";
    return "documento";
  };

  const convertMarkersToCustomfile = (md: string, fileMap: Record<string,string>) => {
    return md
      .replace(/\[\s*(?:🖼|📷)\s+([^\]]+)\]/g, (_, filename) => {
        const json = fileMap[filename] || JSON.stringify({ name: filename, url: "" });
        return `<customfile data='${json}'></customfile>`;
      })
      .replace(
        /\[([^\]]+\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mov|mkv|pdf|docx?|pptx?|xlsx))\]/gi,
        (_, filename) => {
          const json = fileMap[filename] || JSON.stringify({ name: filename, url: "" });
          return `<customfile data='${json}'></customfile>`;
        }
      );
  };

  useEffect(() => {
    fetchBlocks();
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

  useEffect(() => {
    if (!formulaEcuacion) return;
    const typeset = async () => {
      try {
        await window.MathJax?.typesetPromise?.(["#formula-preview"]);
      } catch {}
    };
    typeset();
  }, [formulaEcuacion]);

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
                { id: uid(), titulo: "", ecuacion: "" },
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

  const insertAtCursor = (textarea: HTMLTextAreaElement, text: string) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const moveFormula = (index: number, direction: "up" | "down") => {
    setEditFormulas((prev) => {
      const newFormulas = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newFormulas.length) return prev;

      const temp = newFormulas[index];
      newFormulas[index] = newFormulas[targetIndex];
      newFormulas[targetIndex] = temp;

      return newFormulas.map((f, i) => ({ ...f, orden: i }));
    });
  };

  const uploadToStorage = async (f: File, carpeta: string) => {
    const ext = f.name.split(".").pop();
    const originalName = f.name;
    const key = `${materiaId}/${carpeta}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("curso-contenido")
      .upload(key, f, { upsert: false });

    if (upErr) throw upErr;

    const { data } = supabase.storage
      .from("curso-contenido")
      .getPublicUrl(key);

    return { url: data.publicUrl, originalName, key };
  };

  const buildMarkdown = () => {
    let md = "";

    if (intro.trim()) {
      md += `## Introducción\n\n${intro.trim()}\n\n`;
    }

    subsections.forEach((s) => {
      if (s.subtitle === "(intro)") return;

      if (s.subtitle.trim()) md += `## ${s.subtitle.trim()}\n\n`;
      if (s.text.trim()) md += `${s.text.trim()}\n\n`;

      if (s.formulas.length > 0) {
        s.formulas.forEach((f) => {
          if (f.titulo.trim()) {
            md += `<p class="text-center font-bold">${f.titulo.trim()}</p>\n\n`;
          }
          if (f.ecuacion.trim()) md += `$$\n${f.ecuacion.trim()}\n$$\n\n`;
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
      let archivoSubido: { nombre: string; url: string; tipo: "imagen" | "video" | "documento" } | null = null;

      if (tipo === "texto") {
        const mdBase = buildMarkdown();
        if (!mdBase) {
          alert("Completa algún contenido antes de guardar.");
          setLoading(false);
          return;
        }
        contenido = convertMarkersToCustomfile(normalizeMarkdownSpacing(mdBase), fileMap);
      } else {
        if (!file) {
          alert("Selecciona un archivo.");
          setLoading(false);
          return;
        }

        const carpeta =
          tipo === "imagen" ? "imagenes" :
          tipo === "video"   ? "videos"   :
          tipo === "documento" ? "documentos" : "otros";

        const { url, originalName } = await uploadToStorage(file, carpeta);

        contenido = `<customfile data='${JSON.stringify({ name: originalName, url })}'></customfile>`;
        archivoSubido = { nombre: originalName, url, tipo: getTipoArchivo(originalName) };
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
        if (!insertedBlock) throw new Error("No se pudo insertar el bloque.");

        // --- Prepara popTitle ---
        const titlesSnapshot = [...inlineFormulaTitles];
        const popTitle = (scope: "intro" | string, ecuacion: string) => {
          const i = titlesSnapshot.findIndex(
            t => t.scope === scope && t.ecuacion.trim() === ecuacion.trim()
          );
          if (i >= 0) {
            const t = titlesSnapshot[i];
            titlesSnapshot.splice(i, 1);
            return t.titulo;
          }
          return null;
        };

        let ordenFormula = 0;

        const introFormulas = extractLatexFormulas(intro);
        for (const ecuacion of introFormulas) {
          if (!ecuacion.trim()) continue;
          await supabase.from("curso_formulas").insert({
            bloque_id: insertedBlock.id,
            titulo: popTitle("intro", ecuacion), 
            ecuacion,
            publica: false,
            orden: ordenFormula++,
          });
        }

        for (const s of subsections) {
          const textFormulas = extractLatexFormulas(s.text);
          for (const ecuacion of textFormulas) {
            if (!ecuacion.trim()) continue;
            await supabase.from("curso_formulas").insert({
              bloque_id: insertedBlock.id,
              titulo: popTitle(s.id, ecuacion),
              ecuacion,
              publica: false,
              orden: ordenFormula++,
            });
          }

          for (const f of s.formulas) {
            if (!f.ecuacion.trim()) continue;
            await supabase.from("curso_formulas").insert({
              bloque_id: insertedBlock.id,
              titulo: f.titulo?.trim() || null,
              ecuacion: f.ecuacion.trim(),
              publica: false,
              orden: ordenFormula++,
            });
          }
        }
        if (blockError) throw blockError;
        if (!insertedBlock) {
          throw new Error("No se pudo insertar el bloque.");
        }

      if (blockError) throw blockError;

      if (archivoSubido) {
        const { error: errCA } = await supabase.from("curso_archivos").insert({
          bloque_id: insertedBlock.id,
          nombre: archivoSubido.nombre,
          url: archivoSubido.url,
          tipo: archivoSubido.tipo,
        });
        if (errCA) console.error("curso_archivos insert (no-texto) ->", errCA);
      }

      if (tipo === "texto" && Object.keys(fileMap).length > 0) {
        const rows = Object.keys(fileMap).map((filename) => {
          try {
            const parsed = JSON.parse(fileMap[filename]);
            return {
              bloque_id: insertedBlock.id,
              nombre: parsed.name,
              url: parsed.url,
              tipo: getTipoArchivo(parsed.name),
            };
          } catch {
            return null;
          }
        }).filter(Boolean) as Array<{bloque_id:string; nombre:string; url:string; tipo:string}>;

        if (rows.length > 0) {
          const { error: errBatch } = await supabase.from("curso_archivos").insert(rows);
          if (errBatch) console.error("curso_archivos insert (texto batch) ->", errBatch);
        }
      }

      setInlineFormulaTitles([]);
      setTitulo("");
      setIntro("");
      setSubsections([]);
      setFile(null);
      setTipo("texto");
      setFileMap({});
      await fetchBlocks();
      if (onBloquesChange) onBloquesChange();
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

  const handleOpenEdit = async (block: Block) => {
    setEditBlock(block);
    setEditTitulo(block.titulo || "");

    const raw = normalizeMarkdownSpacing(block.contenido || "");
    setEditContenido(convertFromCustomfile(raw));

    const { data: archivos } = await supabase
      .from("curso_archivos")
      .select("nombre, url, tipo")
      .eq("bloque_id", block.id);

    if (archivos) {
      const newMap: Record<string, string> = {};
      archivos.forEach((a) => {
        newMap[a.nombre] = JSON.stringify({ name: a.nombre, url: a.url });
      });
      setFileMap(newMap);
    }

    const { data: formulas } = await supabase
      .from("curso_formulas")
      .select("id, titulo, ecuacion, publica, orden")
      .eq("bloque_id", block.id)
      .order("orden", { ascending: true });

    if (formulas) {
      setEditFormulas(
        formulas.map((f: any) => ({
          id: f.id,
          titulo: f.titulo || "",
          ecuacion: f.ecuacion || "",
          publica: f.publica || false,
        }))
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!editBlock) return;
    const convertToCustomfile = (md: string) => {
      return md.replace(/\[\s*(?:📷|🖼)\s+([^\]]+)\]/g, (_, filename) => {
        if (fileMap[filename]) {
          return `<customfile data='${fileMap[filename]}'></customfile>`;
        }
        return `<customfile data='${JSON.stringify({ name: filename, url: "" })}'></customfile>`;
      });
    };

    const contenidoFinal = convertToCustomfile(editContenido);

    const { error } = await supabase
      .from("curso_contenido_bloques")
      .update({
        titulo: editTitulo.trim() || null,
        contenido: contenidoFinal,
      })
      .eq("id", editBlock.id);

    if (error) {
      console.error(error);
      alert("No se pudo guardar los cambios.");
      return;
    }

    for (let i = 0; i < editFormulas.length; i++) {
      const f = editFormulas[i];
      if (!f.ecuacion.trim()) continue;

      if (f.id.startsWith("_") || f.id.length < 36) {
        await supabase.from("curso_formulas").insert({
          bloque_id: editBlock.id,
          titulo: f.titulo.trim() || null,
          ecuacion: f.ecuacion.trim(),
          publica: f.publica,
          orden: i,
        });
      } else {
        await supabase.from("curso_formulas").update({
          titulo: f.titulo.trim() || null,
          ecuacion: f.ecuacion.trim(),
          publica: f.publica,
          orden: i,
        }).eq("id", f.id);
      }
    }

    if (deletedFormulas.length > 0) {
      await supabase
        .from("curso_formulas")
        .delete()
        .in("id", deletedFormulas);
      setDeletedFormulas([]);
    }

    for (const filename of Object.keys(fileMap)) {
      try {
        const parsed = JSON.parse(fileMap[filename]); // { name, url }
        if (parsed.url) {
          const { error: errUp } = await supabase
            .from("curso_archivos")
            .upsert(
              {
                bloque_id: editBlock.id,
                nombre: parsed.name,
                url: parsed.url,
                tipo: getTipoArchivo(parsed.name),
              },
              { onConflict: "bloque_id,nombre" }
            );
          if (errUp) console.error("curso_archivos upsert (edición) ->", errUp);
        }
      } catch (err) {
        console.error("Error guardando en curso_archivos", err);
      }
    }

    setEditBlock(null);
    fetchBlocks();
  };

  const preprocessMarkdown = (md: string) => {
    return md
      .replace(/\[\s*(?:🖼|📷)\s+([^\]]+)\]/g, (_, filename) => {
        return `<customfile nombre="${filename}"></customfile>`;
      })
      .replace(/\[\s*🎥\s+([^\]]+)\]/g, (_, filename) => {
        return `<customfile nombre="${filename}"></customfile>`;
      })
      .replace(/\[\s*📄\s+([^\]]+)\]/g, (_, filename) => {
        return `<customfile nombre="${filename}"></customfile>`;
      })
      .replace(
        /\[([^\]]+\.(png|jpe?g|gif|webp|svg|mp4|pdf|docx?|pptx?|xlsx))\]/gi,
        (_, filename) => `<customfile nombre="${filename}"></customfile>`
      )
      .replace(
        /<customfile data='([^']+)'><\/customfile>/gi,
        (_, json) => `<customfile data='${json}'></customfile>`
      );
  };

  return (
    <div
      className="rounded-xl p-5 shadow space-y-5"
      style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
    >
      {/* Formulario para agregar bloque */}
      <form onSubmit={handleAddBlock} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
              placeholder="Título del bloque (se mostrará grande)"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Introducción (opcional)</label>
            <div className="relative">
              <TextareaAutosize
                ref={introRef}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                minRows={3}
                className="w-full rounded-lg px-3 py-2 resize-none"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
                placeholder="Texto introductorio antes de los subtítulos"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {/* Botones: fórmula, imagen, video, documento, enlace */}
                <button
                  type="button"
                  onClick={(e) => {
                    const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                    setTargetTextarea(textarea);
                    setTargetSubId(null);
                    setShowFormulaModal(true);
                  }}
                  className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                >
                  ➕ Fórmula
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                    setTargetTextarea(textarea);
                    setTargetSubId(null);
                    setShowImageModal(true);
                  }}
                  className="bg-green-600 text-white text-xs px-2 py-1 rounded"
                >
                  ➕ Imagen
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                    setTargetTextarea(textarea);
                    setTargetSubId(null);
                    setShowVideoModal(true);
                  }}
                  className="bg-purple-600 text-white text-xs px-2 py-1 rounded"
                >
                  ➕ Video
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                    setTargetTextarea(introRef.current);
                    setTargetSubId(null);
                    setShowDocModal(true);
                  }}
                  className="bg-yellow-600 text-white text-xs px-2 py-1 rounded"
                >
                  ➕ Documento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetTextarea(introRef.current);
                    setTargetSubId(null);
                    setShowLinkModal(true);
                  }}
                  className="bg-pink-600 text-white text-xs px-2 py-1 rounded"
                >
                  ➕ Enlace
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Subsecciones */}
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm">Subsecciones (Subtítulo + Contenido)</label>
            <button
              type="button"
              onClick={addSubsection}
              className="px-3 py-1 rounded-lg text-sm"
              style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
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
            <div
              key={s.id}
              className="rounded-lg p-3 space-y-2 border"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Subtítulo #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSubsection(s.id)}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-xs text-white"
                >
                  Quitar
                </button>
              </div>

              <input
                type="text"
                value={s.subtitle}
                onChange={(e) => updateSubsection(s.id, { subtitle: e.target.value })}
                className="w-full rounded px-3 py-2"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
                placeholder="Subtítulo"
              />

              <div className="relative">
                <TextareaAutosize
                  ref={(el) => (subsectionRefs.current[s.id] = el)}
                  value={s.text}
                  onChange={(e) => updateSubsection(s.id, { text: e.target.value })}
                  minRows={4}
                  className="w-full rounded px-3 py-2 resize-none"
                  style={{
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                  }}
                  placeholder="Contenido (Markdown)"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                      setTargetTextarea(textarea);
                      setTargetSubId(s.id);
                      setShowFormulaModal(true);
                    }}
                    className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ➕ Fórmula
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                      setTargetTextarea(textarea);
                      setTargetSubId(s.id);
                      setShowImageModal(true);
                    }}
                    className="bg-green-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ➕ Imagen
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                      setTargetTextarea(textarea);
                      setTargetSubId(s.id);
                      setShowVideoModal(true);
                    }}
                    className="bg-purple-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ➕ Video
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                      setTargetTextarea(textarea);
                      setTargetSubId(s.id);
                      setShowDocModal(true);
                    }}
                    className="bg-yellow-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ➕ Documento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetTextarea(subsectionRefs.current[s.id] || null);
                      setTargetSubId(s.id);
                      setShowLinkModal(true);
                    }}
                    className="bg-pink-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ➕ Enlace
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Fórmulas</label>
                  <button
                    type="button"
                    onClick={() => addFormula(s.id)}
                    className="px-3 py-1 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    Agregar fórmula
                  </button>
                </div>

                {s.formulas.map((f: FormulaItem, fIdx: number) => (
                  <div
                    key={f.id}
                    className="rounded-lg p-3 space-y-2 border"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        Fórmula #{fIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFormula(s.id, f.id)}
                        className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-xs text-white"
                      >
                        Quitar
                      </button>
                    </div>

                    <input
                      type="text"
                      value={f.titulo}
                      onChange={(e) => updateFormula(s.id, f.id, { titulo: e.target.value })}
                      className="w-full rounded px-3 py-2 text-center"
                      style={{
                        backgroundColor: "var(--color-card)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                      }}
                      placeholder="Título de la fórmula"
                    />

                    <TextareaAutosize
                      value={f.ecuacion}
                      onChange={(e) => updateFormula(s.id, f.id, { ecuacion: e.target.value })}
                      minRows={2}
                      className="w-full rounded px-3 py-2 resize-none"
                      style={{
                        backgroundColor: "var(--color-card)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                      }}
                      placeholder="Ecuación en LaTeX"
                    />

                    <div
                      className="rounded p-3 text-center"
                      style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                    >
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>Vista previa:</p>
                      <div dangerouslySetInnerHTML={{ __html: `$$${f.ecuacion || ""}$$` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
        >
          {loading ? "Guardando..." : "Agregar bloque"}
        </button>
      </form>

      <div className="space-y-3">
        {blocks.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aún no hay contenido.
          </p>
        )}

        {blocks.map((b) => (
          <div
            key={b.id}
            className="rounded-lg p-4 cursor-pointer border"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
            }}
            onClick={() => handleOpenEdit(b)}
            title="Haz clic para editar este bloque"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs px-2 py-1 rounded shrink-0"
                  style={{
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {b.tipo.toUpperCase()}
                </span>
                <span
                  className="font-semibold truncate"
                  style={{ color: "var(--color-heading)", maxWidth: "40vw" }}
                  title={b.titulo || "(Sin título)"}
                >
                  {b.titulo || "(Sin título)"}
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    move(b.id, "up");
                  }}
                  className="px-2 py-1 rounded"
                  style={{
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  ↑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    move(b.id, "down");
                  }}
                  className="px-2 py-1 rounded"
                  style={{
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  ↓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(b.id);
                  }}
                  className="px-2 py-1 bg-red-600 rounded text-white"
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
          <div
            className="rounded-xl shadow-lg w-full max-w-6xl p-6 flex flex-col h-[85vh]"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-xl font-bold mb-4">
              Editando bloque:{" "}
              <span className="text-blue-400">
                {editTitulo || "(Sin título)"}
              </span>{" "}
              <span className="ml-2 text-xs text-gray-400">
                ({editBlock.tipo})
              </span>
            </h2>

            <div className="flex-1 grid grid-cols-3 gap-4 pr-2 overflow-hidden">
              {/* Columna 1: edición */}
              <div 
                className="flex flex-col space-y-4 overflow-hidden border-r pr-4"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)", 
                }}
              >
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2"
                  style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
                  placeholder="Título del bloque"
                />

                <div className="flex flex-col flex-1">
                  <TextareaAutosize
                    ref={editRef}
                    value={editContenido}
                    onChange={(e) => setEditContenido(e.target.value)}
                    minRows={15}
                    className="flex-1 w-full rounded-lg px-3 py-2 resize-none overflow-y-auto"
                    style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
                    placeholder={
                      editBlock.tipo === "texto"
                        ? "Contenido del bloque (Markdown generado). Puedes ajustarlo aquí si lo prefieres."
                        : "URL del recurso (imagen/video/documento) almacenado."
                    }
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        const textarea = (e.currentTarget.parentNode?.previousSibling as HTMLTextAreaElement);
                        setTargetTextarea(textarea);
                        setShowFormulaModal(true);
                      }}
                      className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                    >
                      ➕ Fórmula
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetTextarea(editRef.current);
                        setTargetSubId(null);
                        setShowImageModal(true);
                      }}
                      className="bg-green-600 text-white text-xs px-2 py-1 rounded"
                    >
                      ➕ Imagen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetTextarea(editRef.current);
                        setTargetSubId(null);
                        setShowVideoModal(true);
                      }}
                      className="bg-purple-600 text-white text-xs px-2 py-1 rounded"
                    >
                      ➕ Video
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetTextarea(editRef.current);
                        setTargetSubId(null);
                        setShowDocModal(true);
                      }}
                      className="bg-yellow-600 text-white text-xs px-2 py-1 rounded"
                    >
                      ➕ Documento
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetTextarea(editRef.current);
                        setTargetSubId(null);
                        setShowLinkModal(true);
                      }}
                      className="bg-pink-600 text-white text-xs px-2 py-1 rounded"
                    >
                      ➕ Enlace
                    </button>
                  </div>
                </div>
              </div>

              {/* Columna 2: vista previa */}
              {editBlock.tipo === "texto" && (
                <div
                  className="rounded-lg p-3 overflow-y-auto h-full border-r"
                  style={{
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                    Vista previa completa:
                  </p>
                  <div className="prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeRaw]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="text-blue-400 underline hover:text-blue-300"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        customfile: ({ node, ...props }: { node?: any; [key: string]: any }) => {
                          if (props.data) {
                            try {
                              const parsed = JSON.parse(props.data as string);

                              if (/\.(png|jpe?g|gif|webp|svg)$/i.test(parsed.name)) {
                                return (
                                  <img
                                    src={parsed.url}
                                    alt={parsed.name}
                                    className="max-h-64 mx-auto rounded shadow"
                                  />
                                );
                              }

                              if (/\.(mp4|webm|ogg|mov|mkv)$/i.test(parsed.name)) {
                                return (
                                  <video
                                    src={parsed.url}
                                    controls
                                    className="max-h-64 mx-auto rounded shadow"
                                  />
                                );
                              }

                              if (/\.(pdf|docx?|pptx?|xlsx)$/i.test(parsed.name)) {
                                return (
                                  <a
                                    href={parsed.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 underline"
                                  >
                                    📄 {parsed.name}
                                  </a>
                                );
                              }

                              return (
                                <a
                                  href={parsed.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 underline"
                                >
                                  {parsed.name}
                                </a>
                              );
                            } catch {
                              return <span>Archivo inválido</span>;
                            }
                          }

                          const filename = props.nombre as string;
                          const json = fileMap[filename];
                          if (json) {
                            try {
                              const parsed = JSON.parse(json);

                              if (/\.(png|jpe?g|gif|webp|svg)$/i.test(parsed.name)) {
                                return (
                                  <img
                                    src={parsed.url}
                                    alt={parsed.name}
                                    className="max-h-64 mx-auto rounded shadow"
                                  />
                                );
                              }

                              if (/\.(mp4|webm|ogg|mov|mkv)$/i.test(parsed.name)) {
                                return (
                                  <video
                                    src={parsed.url}
                                    controls
                                    className="max-h-64 mx-auto rounded shadow"
                                  />
                                );
                              }

                              if (/\.(pdf|docx?|pptx?|xlsx)$/i.test(parsed.name)) {
                                return (
                                  <a
                                    href={parsed.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 underline"
                                  >
                                    {parsed.name}
                                  </a>
                                );
                              }

                              return (
                                <a
                                  href={parsed.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 underline"
                                >
                                  {parsed.name}
                                </a>
                              );
                            } catch {
                              return <span>{filename}</span>;
                            }
                          }

                          return <span>{filename}</span>;
                        },
                      }}
                    >
                      {preprocessMarkdown(editContenido)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {editBlock.tipo === "imagen" && (() => {
                try {
                  const data = JSON.parse(editBlock.contenido);
                  return (
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <img src={data.url} alt={data.name} className="max-h-80 mx-auto rounded" />
                      <p className="mt-2 text-sm text-blue-400 underline">
                        <a href={data.url} target="_blank" rel="noopener noreferrer">{data.name}</a>
                      </p>
                    </div>
                  );
                } catch {
                  return <p className="text-red-400">No se pudo mostrar la imagen.</p>;
                }
              })()}

              {editBlock.tipo === "video" && (() => {
                try {
                  const data = JSON.parse(editBlock.contenido);
                  return (
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <video src={data.url} controls className="max-h-80 mx-auto rounded" />
                      <p className="mt-2 text-sm text-blue-400 underline">
                        <a href={data.url} target="_blank" rel="noopener noreferrer">{data.name}</a>
                      </p>
                    </div>
                  );
                } catch {
                  return <p className="text-red-400">No se pudo mostrar el video.</p>;
                }
              })()}

              {editBlock.tipo === "documento" && (
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <a
                    href={editContenido}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    📄 Abrir documento
                  </a>
                </div>
              )}

              {/* Columna 3: listado de fórmulas */}
              <div
                className="rounded-lg p-3 overflow-y-auto max-h-[70vh] space-y-3 border-l"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  borderColor: "var(--color-border)", 
                }}
              >
                <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                  Fórmulas del bloque
                </p>

                {editFormulas.map((f, idx) => (
                  <div
                    key={f.id}
                    className="p-3 rounded space-y-2"
                    style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-text)" }}>
                        {f.titulo || `Fórmula #${idx + 1}`}
                      </span>
                      <label
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--color-muted)" }}
                      >
                        <input
                          type="checkbox"
                          checked={f.publica}
                          onChange={(e) =>
                            setEditFormulas((prev) =>
                              prev.map((x) =>
                                x.id === f.id ? { ...x, publica: e.target.checked } : x
                              )
                            )
                          }
                        />
                        Hacer visible en formulario
                      </label>
                    </div>

                    <div className="text-center">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$${f.ecuacion}$$`}
                      </ReactMarkdown>
                    </div>

                    <div className="flex justify-between gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveFormula(idx, "up")}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveFormula(idx, "down")}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => {
                            setTargetFormulaId(f.id);
                            setFormulaEcuacion(f.ecuacion);
                            setFormulaTitulo(f.titulo || "");
                            setShowFormulaModal(true);
                          }}
                          className="px-2 py-1 bg-yellow-600 rounded text-xs text-white"
                        >
                          Editar
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setEditFormulas((prev) => prev.filter((x) => x.id !== f.id));
                          if (f.id && !f.id.startsWith("_temp")) {
                            setDeletedFormulas((prev) => [...prev, f.id]);
                          }
                        }}
                        className="px-2 py-1 bg-red-600 rounded text-xs text-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newId = uid();
                    setFormulaDraft({ id: newId, titulo: "", ecuacion: "", publica: false });
                    setTargetFormulaId(newId);
                    setShowFormulaModal(true);
                  }}
                  className="w-full py-2 bg-blue-600 rounded text-sm text-white"
                >
                  ➕ Agregar fórmula
                </button>
              </div>
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

      {showFormulaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-xl p-6 w-full max-w-lg"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-lg font-bold mb-3">Insertar fórmula</h2>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              <button
                className={`px-3 py-1 rounded ${formulaMode === "latex" ? "bg-blue-600 text-white" : ""}`}
                style={formulaMode !== "latex" ? { backgroundColor: "var(--color-border)", color: "var(--color-text)" } : {}}
                onClick={() => setFormulaMode("latex")}
              >
                LaTeX
              </button>
              <button
                className={`px-3 py-1 rounded ${formulaMode === "image" ? "bg-blue-600 text-white" : ""}`}
                style={formulaMode !== "image" ? { backgroundColor: "var(--color-border)", color: "var(--color-text)" } : {}}
                onClick={() => setFormulaMode("image")}
              >
                Imagen
              </button>
            </div>

            {formulaMode === "latex" ? (
              <>
                <input
                  type="text"
                  placeholder="Título (opcional)"
                  value={formulaTitulo}
                  onChange={(e) => setFormulaTitulo(e.target.value)}
                  className="w-full rounded px-3 py-2 mb-3"
                  style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
                />

                <TextareaAutosize
                  minRows={3}
                  value={formulaEcuacion}
                  onChange={(e) => setFormulaEcuacion(e.target.value)}
                  placeholder="Escribe LaTeX aquí"
                  className="w-full rounded px-3 py-2 mb-3 resize-none"
                  style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
                />

                <div
                  className="rounded p-3 text-center"
                  style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                    Vista previa:
                  </p>
                  <div id="formula-preview">
                    {formulaEcuacion ? (
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$${formulaEcuacion}$$`}
                      </ReactMarkdown>
                    ) : (
                      <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                        Escribe LaTeX para previsualizar
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <OcrFormula
                onResult={(titulo, ecuacion) => {
                  setFormulaTitulo(titulo);
                  setFormulaEcuacion(ecuacion);
                }}
              />
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1 rounded"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                onClick={() => setShowFormulaModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={() => {
                  if (targetTextarea) {
                    insertAtCursor(targetTextarea, `$$${formulaEcuacion}$$`);
                    const value = targetTextarea.value;

                    if (targetTextarea.placeholder?.includes("Texto introductorio")) {
                      setIntro(value);
                      if (formulaTitulo.trim()) {
                        setInlineFormulaTitles(prev => [
                          ...prev,
                          { scope: "intro", ecuacion: formulaEcuacion.trim(), titulo: formulaTitulo.trim() }
                        ]);
                      }
                    } else if (targetSubId) {
                      updateSubsection(targetSubId, { text: value });
                      if (formulaTitulo.trim()) {
                        setInlineFormulaTitles(prev => [
                          ...prev,
                          { scope: targetSubId, ecuacion: formulaEcuacion.trim(), titulo: formulaTitulo.trim() }
                        ]);
                      }
                      setTargetSubId(null);
                    } else if (targetTextarea.placeholder?.includes("Contenido del bloque")) {
                      setEditContenido(value);
                      setEditFormulas(prev => [
                        ...prev,
                        { id: uid(), titulo: formulaTitulo, ecuacion: formulaEcuacion, publica: false },
                      ]);
                    }
                  } else if (targetFormulaId) {
                    setEditFormulas((prev) => {
                      const exists = prev.some((f) => f.id === targetFormulaId);
                      if (exists) {
                        return prev.map((f) =>
                          f.id === targetFormulaId
                            ? { ...f, titulo: formulaTitulo, ecuacion: formulaEcuacion }
                            : f
                        );
                      }
                      return [
                        ...prev,
                        { id: targetFormulaId, titulo: formulaTitulo, ecuacion: formulaEcuacion, publica: false },
                      ];
                    });
                    setTimeout(() => setTargetFormulaId(null), 0);
                  }

                  setFormulaEcuacion("");
                  setFormulaTitulo("");
                  setShowFormulaModal(false);
                }}
              >
                {targetFormulaId ? "Actualizar" : "Insertar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Imagen */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-lg font-bold mb-3">Insertar imagen</h2>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-2 rounded mb-3"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                onClick={() => setShowImageModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={async () => {
                  if (!targetTextarea) {
                    alert("Primero da clic en el botón de 'Imagen' del área donde quieres insertarla.");
                    return;
                  }
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "imagenes");

                  const placeholder = `[📷 ${originalName}]`;
                  insertAtCursor(targetTextarea, placeholder);

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  const value = targetTextarea.value;
                  if (editBlock) {
                    if (targetTextarea === editRef.current) {
                      setEditContenido(value);
                    }
                    try {
                      const { error: errUp } = await supabase
                        .from("curso_archivos")
                        .upsert(
                          {
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "imagen",
                          },
                          { onConflict: "bloque_id,nombre" }
                        );

                      if (errUp) {
                        const { data: existente, error: errSel } = await supabase
                          .from("curso_archivos")
                          .select("id")
                          .eq("bloque_id", editBlock.id)
                          .eq("nombre", originalName)
                          .maybeSingle();

                        if (!errSel && existente?.id) {
                          await supabase
                            .from("curso_archivos")
                            .update({ url, tipo: "imagen" })
                            .eq("id", existente.id);
                        } else {
                          await supabase.from("curso_archivos").insert({
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "imagen",
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Persistencia curso_archivos (imagen edición) ->", e);
                    }
                  } else {
                    if (targetTextarea === introRef.current) {
                      setIntro(value);
                    } else if (targetSubId) {
                      updateSubsection(targetSubId, { text: value });
                      setTargetSubId(null);
                    }
                  }

                  setFile(null);
                  setTargetTextarea(null);
                  setShowImageModal(false);
                }}
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Video */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-lg font-bold mb-3">Insertar video</h2>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-2 rounded mb-3"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                onClick={() => setShowVideoModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={async () => {
                  if (!targetTextarea) {
                    alert("Primero da clic en el botón de 'Video' del área donde quieres insertarlo.");
                    return;
                  }
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "videos");

                  const placeholder = `[🎥 ${originalName}]`;
                  insertAtCursor(targetTextarea, placeholder);

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  const value = targetTextarea.value;
                  if (editBlock) {
                    if (targetTextarea === editRef.current) {
                      setEditContenido(value);
                    }
                    try {
                      const { error: errUp } = await supabase
                        .from("curso_archivos")
                        .upsert(
                          {
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "video",
                          },
                          { onConflict: "bloque_id,nombre" }
                        );

                      if (errUp) {
                        const { data: existente, error: errSel } = await supabase
                          .from("curso_archivos")
                          .select("id")
                          .eq("bloque_id", editBlock.id)
                          .eq("nombre", originalName)
                          .maybeSingle();

                        if (!errSel && existente?.id) {
                          await supabase
                            .from("curso_archivos")
                            .update({ url, tipo: "video" })
                            .eq("id", existente.id);
                        } else {
                          await supabase.from("curso_archivos").insert({
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "video",
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Persistencia curso_archivos (video edición) ->", e);
                    }
                  } else {
                    if (targetTextarea === introRef.current) {
                      setIntro(value);
                    } else if (targetSubId) {
                      updateSubsection(targetSubId, { text: value });
                      setTargetSubId(null);
                    }
                  }

                  setFile(null);
                  setTargetTextarea(null);
                  setShowVideoModal(false);
                }}
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Documento */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-lg font-bold mb-3">Insertar documento</h2>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-2 rounded mb-3"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                onClick={() => setShowDocModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={async () => {
                  if (!targetTextarea) {
                    alert("Primero da clic en el botón de 'Documento' del área donde quieres insertarlo.");
                    return;
                  }
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "documentos");

                  const placeholder = `[📄 ${originalName}]`;
                  insertAtCursor(targetTextarea, placeholder);

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  const value = targetTextarea.value;
                  if (editBlock) {
                    if (targetTextarea === editRef.current) {
                      setEditContenido(value);
                    }
                    try {
                      const { error: errUp } = await supabase
                        .from("curso_archivos")
                        .upsert(
                          {
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "documento",
                          },
                          { onConflict: "bloque_id,nombre" }
                        );

                      if (errUp) {
                        const { data: existente, error: errSel } = await supabase
                          .from("curso_archivos")
                          .select("id")
                          .eq("bloque_id", editBlock.id)
                          .eq("nombre", originalName)
                          .maybeSingle();

                        if (!errSel && existente?.id) {
                          await supabase
                            .from("curso_archivos")
                            .update({ url, tipo: "documento" })
                            .eq("id", existente.id);
                        } else {
                          await supabase.from("curso_archivos").insert({
                            bloque_id: editBlock.id,
                            nombre: originalName,
                            url,
                            tipo: "documento",
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Persistencia curso_archivos (documento edición) ->", e);
                    }
                  } else {
                    if (targetTextarea === introRef.current) {
                      setIntro(value);
                    } else if (targetSubId) {
                      updateSubsection(targetSubId, { text: value });
                      setTargetSubId(null);
                    }
                  }

                  setFile(null);
                  setTargetTextarea(null);
                  setShowDocModal(false);
                }}
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enlace */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <h2 className="text-lg font-bold mb-3">Insertar enlace</h2>
            <input
              type="text"
              placeholder="Texto a mostrar"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full rounded px-3 py-2 mb-3"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <input
              type="url"
              placeholder="URL destino"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full rounded px-3 py-2 mb-3"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                onClick={() => setShowLinkModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={() => {
                  if (!targetTextarea || !linkUrl) return;

                  const textarea = targetTextarea;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selected = textarea.value.substring(start, end);

                  const textToShow = linkText || selected || linkUrl;

                  const before = textarea.value.substring(0, start);
                  const after = textarea.value.substring(end);

                  const newValue = `${before}[${textToShow}](${linkUrl})${after}`;

                  if (textarea.placeholder?.includes("Texto introductorio")) {
                    setIntro(newValue);
                  } else if (targetSubId) {
                    updateSubsection(targetSubId, { text: newValue });
                    setTargetSubId(null);
                  } else if (textarea.placeholder?.includes("Contenido del bloque")) {
                    setEditContenido(newValue);
                  }

                  setLinkText("");
                  setLinkUrl("");
                  setTargetTextarea(null);
                  setShowLinkModal(false);
                }}
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
