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
import { useRef } from "react"; 
import OcrFormula from "@/components/OcrFormula";
import EditorBasico, { type EditorBasicoRef } from "@/components/EditorBasico";
import { createPortal } from "react-dom";

type BlockType = "texto" | "imagen" | "video" | "documento";

type Block = {
  id: string;
  materia_id: string;
  unidad_id?: string | null;
  tipo: BlockType;
  titulo?: string;
  contenido: string;
  orden: number;
  created_at: string;
};

type FormulaItem = {
  id: string;
  titulo: string;
  ecuacion: string;
};

type UnidadItem = {
  id: string;
  materia_id: string;
  numero: number;
  nombre: string;
  orden: number;
};

declare global {
  interface Window {
    MathJax?: any;
  }
}

const uid = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

const FORMULA_IMAGEN_SOLO_LOCAL = process.env.NODE_ENV === "development";

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
  const results: string[] = [];

  const dollarRegex = /\$\$([\s\S]*?)\$\$/g;
  let dollarMatch;
  while ((dollarMatch = dollarRegex.exec(text)) !== null) {
    const formula = dollarMatch[1].trim();
    if (formula) results.push(formula);
  }

  const tiptapRegex =
    /<span[^>]*data-latex=["']([^"']+)["'][^>]*data-type=["']inline-math["'][^>]*><\/span>/g;

  let tiptapMatch;
  while ((tiptapMatch = tiptapRegex.exec(text)) !== null) {
    const formula = tiptapMatch[1].trim();
    if (formula) results.push(formula);
  }

  return Array.from(new Set(results));
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

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const introRef = useRef<HTMLTextAreaElement | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const contenidoPrincipalEditorRef = useRef<EditorBasicoRef | null>(null);

  const [tipo, setTipo] = useState<BlockType>("texto");
  const [unidades, setUnidades] = useState<UnidadItem[]>([]);
  const [unidad, setUnidad] = useState("");
  const [unidadAbiertaId, setUnidadAbiertaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [intro, setIntro] = useState("");
  const [contenidoPrincipal, setContenidoPrincipal] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [editUnidad, setEditUnidad] = useState("1");
  const [editIntro, setEditIntro] = useState("");
  const editContenidoEditorRef = useRef<EditorBasicoRef | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [editFormulas, setEditFormulas] = useState<
    { id: string; titulo: string; ecuacion: string; descripcion: string; publica: boolean }[]
  >([]);
  const [deletedFormulas, setDeletedFormulas] = useState<string[]>([]);
  const [targetFormulaId, setTargetFormulaId] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState<{id:string, titulo:string, ecuacion:string, publica:boolean} | null>(null);

  const [portalReady, setPortalReady] = useState(false);

  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [formulaMode, setFormulaMode] = useState<"latex" | "image">("latex");
  const [formulaEcuacion, setFormulaEcuacion] = useState("");
  const [formulaTitulo, setFormulaTitulo] = useState("");
  const [formulaDescripcion, setFormulaDescripcion] = useState("");
  const [formulaPublica, setFormulaPublica] = useState(false);
  const [targetTextarea, setTargetTextarea] = useState<HTMLTextAreaElement | null>(null);

  const [inlineFormulaTitles, setInlineFormulaTitles] = useState<
    {
      scope: "intro" | string;
      ecuacion: string;
      titulo: string;
      descripcion: string;
      publica: boolean;
    }[]
  >([]);


    useEffect(() => {
      setPortalReady(true);
    }, []);

    const modalActivo =
      Boolean(editBlock) ||
      showFormulaModal ||
      showImageModal ||
      showVideoModal ||
      showDocModal ||
      showLinkModal ||
      showFormulaPanel;

    useEffect(() => {
      if (!modalActivo) return;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [modalActivo]);

    const renderPortal = (content: React.ReactNode) => {
      if (!portalReady || typeof document === "undefined") return null;
      return createPortal(content, document.body);
    };

      const bloquesPorUnidad = useMemo(() => {
      const agrupados: Record<string, Block[]> = {};

      blocks.forEach((b) => {
        const unidadId = b.unidad_id || "__sin_unidad__";

        if (!agrupados[unidadId]) {
          agrupados[unidadId] = [];
        }

        agrupados[unidadId].push(b);
      });

      return agrupados;
    }, [blocks]);

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

  const fetchUnidades = async () => {
  const { data, error } = await supabase
    .from("curso_unidades")
    .select("*")
    .eq("materia_id", materiaId)
    .order("orden", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    setUnidades(data as UnidadItem[]);
    setUnidad((prev) => prev || data[0].id);
    return;
  }

  const { data: nuevaUnidad, error: insertError } = await supabase
    .from("curso_unidades")
    .upsert(
      {
        materia_id: materiaId,
        numero: 1,
        nombre: "",
        orden: 0,
      },
      { onConflict: "materia_id,numero" }
    )
    .select("*")
    .single();

    if (insertError) {
      console.error(insertError);
      return;
    }

    setUnidades([nuevaUnidad as UnidadItem]);
    setUnidad(nuevaUnidad.id);
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
    fetchUnidades();
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

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
  if (carpeta === "videos" && f.size > 50 * 1024 * 1024) {
    alert("El video es demasiado pesado. Máximo permitido: 50 MB.");
    throw new Error("Video demasiado pesado");
  }

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

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let contenido = "";
      let archivoSubido: { nombre: string; url: string; tipo: "imagen" | "video" | "documento" } | null = null;

      if (tipo === "texto") {
        if (
          !titulo.trim() &&
          !intro.trim() &&
          !contenidoPrincipal.trim()
        ) {
          alert("Completa algún contenido antes de guardar.");
          setLoading(false);
          return;
        }

        contenido = convertMarkersToCustomfile(contenidoPrincipal.trim(), fileMap);
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
          introduccion: intro.trim() || null,
          contenido,
          unidad_id: unidad || null,
          orden: nextOrden,
        })
        .select("id")
        .single();

        if (blockError) throw blockError;
        if (!insertedBlock) throw new Error("No se pudo insertar el bloque.");

        const titlesSnapshot = [...inlineFormulaTitles];
        const popFormulaMeta = (scope: "intro" | string, ecuacion: string) => {
        const i = titlesSnapshot.findIndex(
          (t) => t.scope === scope && t.ecuacion.trim() === ecuacion.trim()
        );

        if (i >= 0) {
          const t = titlesSnapshot[i];
          titlesSnapshot.splice(i, 1);

          return {
            titulo: t.titulo?.trim() || null,
            descripcion: t.descripcion?.trim() || null,
            publica: Boolean(t.publica),
          };
        }

        return {
          titulo: null,
          descripcion: null,
          publica: false,
        };
      };

        let ordenFormula = 0;

        const introFormulas = extractLatexFormulas(intro);
        for (const ecuacion of introFormulas) {
          if (!ecuacion.trim()) continue;
          const meta = popFormulaMeta("intro", ecuacion);

          await supabase.from("curso_formulas").insert({
            bloque_id: insertedBlock.id,
            titulo: meta.titulo,
            ecuacion,
            descripcion: meta.descripcion,
            publica: meta.publica,
            orden: ordenFormula++,
          });
        }
        const contenidoPrincipalFormulas = extractLatexFormulas(contenidoPrincipal);
        for (const ecuacion of contenidoPrincipalFormulas) {
          if (!ecuacion.trim()) continue;
          const meta = popFormulaMeta("contenido-principal", ecuacion);

          await supabase.from("curso_formulas").insert({
            bloque_id: insertedBlock.id,
            titulo: meta.titulo,
            ecuacion,
            descripcion: meta.descripcion,
            publica: meta.publica,
            orden: ordenFormula++,
          });
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
      setContenidoPrincipal("");
      contenidoPrincipalEditorRef.current?.setContent("");

      if (unidades.length > 0) {
        setUnidad(unidades[0].id);
      }

      setFile(null);
      setTipo("texto");
      setFileMap({});

      setToast({ message: "Bloque agregado correctamente", type: "success" });

      await fetchBlocks();
      if (onBloquesChange) onBloquesChange();
    } catch (err: any) {
      console.error(err);
      setToast({ message: "Error al agregar bloque", type: "error" });
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

  const handleDeleteUnidad = async (unidadId: string) => {
    if (unidades.length <= 1) {
      alert("No puedes eliminar la única unidad del curso.");
      return;
    }

    const bloquesLocales = bloquesPorUnidad[unidadId] || [];

    if (bloquesLocales.length > 0) {
      alert("Solo puedes eliminar unidades vacías.");
      return;
    }

    const { count, error: countError } = await supabase
      .from("curso_contenido_bloques")
      .select("id", { count: "exact", head: true })
      .eq("materia_id", materiaId)
      .eq("unidad_id", unidadId);

    if (countError) {
      console.error(countError);
      alert("No se pudo verificar si la unidad está vacía.");
      return;
    }

    if ((count || 0) > 0) {
      alert("Solo puedes eliminar unidades vacías.");
      await fetchBlocks();
      return;
    }

    if (!confirm("¿Eliminar esta unidad vacía?")) return;

    const { error } = await supabase
      .from("curso_unidades")
      .delete()
      .eq("id", unidadId)
      .eq("materia_id", materiaId);

    if (error) {
      console.error(error);
      alert("No se pudo eliminar la unidad.");
      return;
    }

    const unidadesRestantes = unidades.filter((u) => u.id !== unidadId);

    setUnidades(unidadesRestantes);

    if (unidad === unidadId) {
      setUnidad(unidadesRestantes[0]?.id || "");
    }

    if (unidadAbiertaId === unidadId) {
      setUnidadAbiertaId(null);
    }

    setToast({ message: "Unidad eliminada correctamente", type: "success" });
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

    setEditUnidad((block as any).unidad_id || unidad || unidades[0]?.id || "");
    setEditTitulo(block.titulo || "");
    setEditIntro((block as any).introduccion || "");
    setEditContenido(convertFromCustomfile(block.contenido || ""));
    setEditorKey((prev) => prev + 1);

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
      .select("id, titulo, ecuacion, descripcion, publica, orden")
      .eq("bloque_id", block.id)
      .order("orden", { ascending: true });

    if (formulas) {
      setEditFormulas(
        formulas.map((f: any) => ({
          id: f.id,
          titulo: f.titulo || "",
          ecuacion: f.ecuacion || "",
          descripcion: f.descripcion || "",
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
        introduccion: editIntro.trim() || null,
        contenido: contenidoFinal,
        unidad_id: editUnidad || null,
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
          descripcion: f.descripcion.trim() || null,
          publica: f.publica,
          orden: i,
        });
      } else {
        await supabase.from("curso_formulas").update({
          titulo: f.titulo.trim() || null,
          ecuacion: f.ecuacion.trim(),
          descripcion: f.descripcion.trim() || null,
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
      className="rounded-xl p-4 sm:p-5 shadow space-y-5 min-w-0 overflow-hidden"
      style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
    >
      {/* Formulario para agregar bloque */}
      <form onSubmit={handleAddBlock} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Unidad</label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full rounded-lg px-3 py-2"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unidad {u.numero}
                    {u.nombre?.trim() ? ` - ${u.nombre.trim()}` : ""}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={unidades.find((u) => u.id === unidad)?.nombre || ""}
                onChange={async (e) => {
                  const nuevoNombre = e.target.value;

                  setUnidades((prev) =>
                    prev.map((u) =>
                      u.id === unidad ? { ...u, nombre: nuevoNombre } : u
                    )
                  );

                  const { error } = await supabase
                    .from("curso_unidades")
                    .update({ nombre: nuevoNombre })
                    .eq("id", unidad);

                  if (error) {
                    console.error(error);
                  }
                }}
                className="w-full rounded-lg px-3 py-2"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
                placeholder="Título de la unidad (opcional)"
              />
              <button
                type="button"
                onClick={async () => {
                  const nextNumero =
                    unidades.length > 0
                      ? Math.max(...unidades.map((u) => u.numero)) + 1
                      : 1;

                  const { data, error } = await supabase
                    .from("curso_unidades")
                    .insert({
                      materia_id: materiaId,
                      numero: nextNumero,
                      nombre: "",
                      orden: nextNumero - 1,
                    })
                    .select("*")
                    .single();

                  if (error) {
                    console.error(error);
                    alert("No se pudo crear la unidad.");
                    return;
                  }

                  setUnidades((prev) => [...prev, data as UnidadItem]);
                  setUnidad(data.id);
                }}
                className="rounded-lg px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 whitespace-nowrap w-full md:w-auto"
              >
                ➕ Agregar unidad
              </button>
            </div>
          </div>

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
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="w-full rounded-lg px-3 py-2 resize-none"
                style={{
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-muted)",
                  border: "1px solid var(--color-border)",
                  textAlign: "center",
                  fontStyle: "italic",
                  fontSize: "0.95rem",
                }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Contenido principal</label>
            <div className="relative">
              <EditorBasico
                ref={contenidoPrincipalEditorRef}
                value={contenidoPrincipal}
                onChange={setContenidoPrincipal}
                onRequestFormula={() => {
                  setTargetTextarea(null);
                  setShowFormulaModal(true);
                }}
                onRequestImage={() => {
                  setTargetTextarea(null);
                  setShowImageModal(true);
                }}
                onRequestVideo={() => {
                  setTargetTextarea(null);
                  setShowVideoModal(true);
                }}
                onRequestDocument={() => {
                  setTargetTextarea(null);
                  setShowDocModal(true);
                }}
                onRequestLink={() => {
                  setTargetTextarea(null);
                  setShowLinkModal(true);
                }}
                onPasteImage={async (file) => {
                  const { url, originalName } = await uploadToStorage(file, "imagenes");

                  setFileMap((prev) => ({
                    ...prev,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  }));

                  return {
                    url,
                    name: originalName,
                  };
                }}
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white w-full sm:w-auto"
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

        {unidades.map((u) => {
          const bloquesUnidad = bloquesPorUnidad[u.id] || [];
          const abierta = unidadAbiertaId === u.id;

          return (
            <div
              key={u.id}
              className="rounded-lg border overflow-hidden"
              style={{
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setUnidadAbiertaId((prev) => (prev === u.id ? null : u.id))
                }
                className="w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-3 text-left"
                style={{
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-text)",
                }}
              >
                <div className="min-w-0">
                  <p className="font-semibold break-words">
                    Unidad {u.numero}
                    {u.nombre?.trim() ? ` - ${u.nombre.trim()}` : ""}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {bloquesUnidad.length} bloque{bloquesUnidad.length === 1 ? "" : "s"}
                  </p>
                </div>

                <span className="text-lg shrink-0">
                  {abierta ? "▲" : "▼"}
                </span>
              </button>

              {abierta && (
                <div className="p-3 space-y-3">
                  {bloquesUnidad.length === 0 ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                        Esta unidad aún no tiene bloques.
                      </p>

                      {unidades.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUnidad(u.id);
                          }}
                          className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm w-full sm:w-auto"
                        >
                          Eliminar unidad
                        </button>
                      )}
                    </div>
                  ) : (
                    bloquesUnidad.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-lg p-3 sm:p-4 cursor-pointer border min-w-0"
                        style={{
                          backgroundColor: "var(--color-card)",
                          color: "var(--color-text)",
                          borderColor: "var(--color-border)",
                        }}
                        onClick={() => handleOpenEdit(b)}
                        title="Haz clic para editar este bloque"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
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
                              className="font-semibold break-words min-w-0"
                              style={{ color: "var(--color-heading)" }}
                              title={b.titulo || "(Sin título)"}
                            >
                              {b.titulo || "(Sin título)"}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 shrink-0">
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
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {bloquesPorUnidad["__sin_unidad__"]?.length > 0 && (
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setUnidadAbiertaId((prev) =>
                  prev === "__sin_unidad__" ? null : "__sin_unidad__"
                )
              }
              className="w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-3 text-left"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            >
              <div className="min-w-0">
                <p className="font-semibold break-words">Sin unidad</p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {bloquesPorUnidad["__sin_unidad__"].length} bloques
                </p>
              </div>

              <span className="text-lg shrink-0">
                {unidadAbiertaId === "__sin_unidad__" ? "▲" : "▼"}
              </span>
            </button>

            {unidadAbiertaId === "__sin_unidad__" && (
              <div className="p-3 space-y-3">
                {bloquesPorUnidad["__sin_unidad__"].map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg p-3 sm:p-4 cursor-pointer border min-w-0"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                      borderColor: "var(--color-border)",
                    }}
                    onClick={() => handleOpenEdit(b)}
                    title="Haz clic para editar este bloque"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
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
                          className="font-semibold break-words min-w-0"
                          style={{ color: "var(--color-heading)" }}
                          title={b.titulo || "(Sin título)"}
                        >
                          {b.titulo || "(Sin título)"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
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
            )}
          </div>
        )}
      </div>
      
      {editBlock && renderPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-3 sm:p-4"
        >
        <div
          className="relative rounded-xl shadow-lg w-[94vw] max-w-[920px] p-4 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
          style={{
            backgroundColor: "var(--color-card)",
            color: "var(--color-text)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_220px] gap-3 items-center">
            <h2 className="text-xl font-bold whitespace-nowrap">
              Editando bloque:
            </h2>

            <input
              type="text"
              value={editTitulo}
              onChange={(e) => setEditTitulo(e.target.value)}
              className="w-full rounded-lg px-3 py-2 font-bold text-xl text-center"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            />

            <select
              value={editUnidad}
              onChange={(e) => setEditUnidad(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  Unidad {u.numero}
                  {u.nombre?.trim() ? ` - ${u.nombre.trim()}` : ""}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={editIntro}
            onChange={(e) => setEditIntro(e.target.value)}
            className="w-full rounded-lg px-3 py-2 resize-none"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-muted)",
              border: "1px solid var(--color-border)",
              textAlign: "center",
              fontStyle: "italic",
              fontSize: "0.95rem",
            }}
          />

          <div>
            <EditorBasico
              key={editorKey}
              ref={editContenidoEditorRef}
              value={editContenido}
              onChange={setEditContenido}
              fillHeight
              onRequestFormula={() => {
                setTargetTextarea(null);
                setShowFormulaModal(true);
              }}
              onRequestImage={() => {
                setTargetTextarea(null);
                setShowImageModal(true);
              }}
              onRequestVideo={() => {
                setTargetTextarea(null);
                setShowVideoModal(true);
              }}
              onRequestDocument={() => {
                setTargetTextarea(null);
                setShowDocModal(true);
              }}
              onRequestLink={() => {
                setTargetTextarea(null);
                setShowLinkModal(true);
              }}
              showFormulaPanelButton={true}
              onRequestFormulaPanel={() => setShowFormulaPanel((prev) => !prev)}
              onPasteImage={async (file) => {
                const { url, originalName } = await uploadToStorage(file, "imagenes");

                setFileMap((prev) => ({
                  ...prev,
                  [originalName]: JSON.stringify({ name: originalName, url }),
                }));

                return {
                  url,
                  name: originalName,
                };
              }}
            />

            {showFormulaPanel && renderPortal(
            <aside
              className="hidden 2xl:block rounded-lg border p-3 text-sm space-y-3 z-[100] overflow-y-auto shadow-lg"
              style={{
                position: "fixed",
                top: "50%",
                left: "calc(50% + min(94vw, 920px) / 2 + 32px)",
                transform: "translateY(-50%)",
                width: "min(340px, calc(50vw - min(94vw, 920px) / 2 - 24px))",
                height: "92dvh",
                maxHeight: "92dvh",
                backgroundColor: "var(--color-border)",
                borderColor: "var(--color-border)",
              }}
            >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Fórmulas del bloque</h3>

                  <button
                    type="button"
                    onClick={() => setShowFormulaPanel(false)}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                    }}
                  >
                    ×
                  </button>
                </div>

                {editFormulas.length === 0 ? (
                  <p className="text-xs opacity-70">Este bloque no tiene fórmulas.</p>
                ) : (
                  editFormulas.map((f, index) => (
                    <div
                      key={f.id}
                      className="rounded-md p-3 space-y-2"
                      style={{
                        backgroundColor: "var(--color-card)",
                        color: "var(--color-text)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={f.titulo}
                          onChange={(e) =>
                            setEditFormulas((prev) =>
                              prev.map((item) =>
                                item.id === f.id ? { ...item, titulo: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                          }}
                          placeholder="Título"
                        />

                        <textarea
                          value={f.descripcion}
                          onChange={(e) =>
                            setEditFormulas((prev) =>
                              prev.map((item) =>
                                item.id === f.id
                                  ? { ...item, descripcion: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full rounded px-2 py-1 text-xs resize-none"
                          rows={2}
                          style={{
                            backgroundColor: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                          }}
                          placeholder="Descripción (opcional)"
                        />

                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={f.publica}
                            onChange={(e) =>
                              setEditFormulas((prev) =>
                                prev.map((item) =>
                                  item.id === f.id
                                    ? { ...item, publica: e.target.checked }
                                    : item
                                )
                              )
                            }
                          />
                          Visible
                        </label>
                      </div>

                      <div className="text-center text-sky-500">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {`$$${f.ecuacion}$$`}
                        </ReactMarkdown>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => moveFormula(index, "up")}>
                            ↑
                          </button>
                          <button type="button" onClick={() => moveFormula(index, "down")}>
                            ↓
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetFormulaId(f.id);
                              setFormulaTitulo(f.titulo);
                              setFormulaEcuacion(f.ecuacion);
                              setFormulaDescripcion(f.descripcion || "");
                              setFormulaPublica(Boolean(f.publica));
                              setShowFormulaModal(true);
                            }}
                            className="px-2 py-1 rounded bg-yellow-500 text-white text-xs"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeletedFormulas((prev) => [...prev, f.id]);
                              setEditFormulas((prev) => prev.filter((item) => item.id !== f.id));
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTargetFormulaId(uid());
                    setFormulaTitulo("");
                    setFormulaEcuacion("");
                    setFormulaDescripcion("");
                    setFormulaPublica(false);
                    setShowFormulaModal(true);
                  }}
                  className="w-full rounded bg-blue-600 text-white py-2 text-sm font-semibold"
                >
                  ＋ Agregar fórmula
                </button>
              </aside>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
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

      {showFormulaModal && renderPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
          <div
            className="rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
                title={
                  FORMULA_IMAGEN_SOLO_LOCAL
                    ? "Convertir imagen a LaTeX"
                    : "Esta herramienta solo está disponible en entorno local."
                }
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

                <TextareaAutosize
                  minRows={2}
                  value={formulaDescripcion}
                  onChange={(e) => setFormulaDescripcion(e.target.value)}
                  placeholder="Descripción de la fórmula (opcional)"
                  className="w-full rounded px-3 py-2 mb-3 resize-none"
                  style={{
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                  }}
                />

                <label
                  className="flex items-center gap-2 text-sm mb-3"
                  style={{ color: "var(--color-text)" }}
                >
                  <input
                    type="checkbox"
                    checked={formulaPublica}
                    onChange={(e) => setFormulaPublica(e.target.checked)}
                  />
                  Visible para estudiantes
                </label>

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
              FORMULA_IMAGEN_SOLO_LOCAL ? (
                <OcrFormula
                  onResult={(titulo, ecuacion) => {
                    setFormulaTitulo(titulo);
                    setFormulaEcuacion(ecuacion);
                  }}
                />
              ) : (
                <div
                  className="rounded-lg p-4 text-sm"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p className="font-semibold mb-1">
                    Herramienta disponible solo en entorno local.
                  </p>
                  <p style={{ color: "var(--color-muted)" }}>
                    Por ahora, la conversión de imagen a fórmula requiere el servidor local de OCR.
                    Usa la pestaña LaTeX para insertar fórmulas manualmente.
                  </p>
                </div>
              )
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
                className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formulaMode === "image" && !FORMULA_IMAGEN_SOLO_LOCAL}
                onClick={() => {
                  if (targetTextarea) {
                    insertAtCursor(targetTextarea, `$$${formulaEcuacion}$$`);
                    const value = targetTextarea.value;

                    if (targetTextarea.placeholder?.includes("Texto introductorio")) {
                      setIntro(value);
                      if (
                        formulaTitulo.trim() ||
                        formulaDescripcion.trim() ||
                        formulaPublica
                      ) {
                        setInlineFormulaTitles(prev => [
                          ...prev,
                          {
                            scope: "intro",
                            ecuacion: formulaEcuacion.trim(),
                            titulo: formulaTitulo.trim(),
                            descripcion: formulaDescripcion.trim(),
                            publica: formulaPublica,
                          }
                        ]);
                      }
                    } else if (
                      targetTextarea.placeholder?.includes("Contenido del bloque") ||
                      targetTextarea.placeholder?.includes("contenido principal del bloque")
                    ) {
                      if (targetTextarea === editRef.current) {
                        setEditContenido(value);
                        setEditFormulas(prev => [
                          ...prev,
                          {
                            id: uid(),
                            titulo: formulaTitulo,
                            ecuacion: formulaEcuacion,
                            descripcion: formulaDescripcion,
                            publica: formulaPublica,
                          }
                        ]);
                      } else {
                        setContenidoPrincipal(value);
                        if (
                          formulaTitulo.trim() ||
                          formulaDescripcion.trim() ||
                          formulaPublica
                        ) {
                          setInlineFormulaTitles(prev => [
                            ...prev,
                            {
                              scope: "contenido-principal",
                              ecuacion: formulaEcuacion.trim(),
                              titulo: formulaTitulo.trim(),
                              descripcion: formulaDescripcion.trim(),
                              publica: formulaPublica,
                            }
                          ]);
                        }
                      }
                    }
                  } else if (!targetTextarea && !targetFormulaId && !editBlock) {
                      contenidoPrincipalEditorRef.current?.insertFormula(formulaEcuacion);
                      setContenidoPrincipal(contenidoPrincipalEditorRef.current?.getHTML() || "");
                      if (
                        formulaTitulo.trim() ||
                        formulaDescripcion.trim() ||
                        formulaPublica
                      ) {
                        setInlineFormulaTitles(prev => [
                          ...prev,
                          {
                            scope: "contenido-principal",
                            ecuacion: formulaEcuacion.trim(),
                            titulo: formulaTitulo.trim(),
                            descripcion: formulaDescripcion.trim(),
                            publica: formulaPublica,
                          },
                        ]);
                      }
                    } else if (!targetTextarea && !targetFormulaId && editBlock) {
                      editContenidoEditorRef.current?.insertFormula(formulaEcuacion);
                      setEditContenido(editContenidoEditorRef.current?.getHTML() || "");

                      setEditFormulas(prev => [
                        ...prev,
                        {
                          id: uid(),
                          titulo: formulaTitulo,
                          ecuacion: formulaEcuacion,
                          descripcion: formulaDescripcion,
                          publica: formulaPublica,
                        },
                      ]);
                    } else if (targetFormulaId) {
                    setEditFormulas((prev) => {
                      const exists = prev.some((f) => f.id === targetFormulaId);
                      if (exists) {
                        return prev.map((f) =>
                          f.id === targetFormulaId
                            ? {
                              ...f,
                              titulo: formulaTitulo,
                              ecuacion: formulaEcuacion,
                              descripcion: formulaDescripcion,
                              publica: formulaPublica,
                            }
                            : f
                        );
                      }
                      return [
                        ...prev,
                        {
                          id: targetFormulaId,
                          titulo: formulaTitulo,
                          ecuacion: formulaEcuacion,
                          descripcion: formulaDescripcion,
                          publica: formulaPublica,
                        }
                      ];
                    });
                    setTimeout(() => setTargetFormulaId(null), 0);
                  }

                  setFormulaEcuacion("");
                  setFormulaTitulo("");
                  setFormulaDescripcion("");
                  setFormulaPublica(false);
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
      {showImageModal && renderPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
          <div
            className="rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
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
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "imagenes");

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  if (!targetTextarea && !editBlock) {
                    contenidoPrincipalEditorRef.current?.insertImage(url, originalName);
                    setContenidoPrincipal(contenidoPrincipalEditorRef.current?.getHTML() || "");
                  } else if (!targetTextarea && editBlock) {
                    editContenidoEditorRef.current?.insertImage(url, originalName);
                    setEditContenido(editContenidoEditorRef.current?.getHTML() || "");
                  } else if (targetTextarea) {
                    const placeholder = `[📷 ${originalName}]`;
                    insertAtCursor(targetTextarea, placeholder);
                  }

                  const value = targetTextarea?.value || "";
                  if (editBlock) {
                    if (targetTextarea && targetTextarea === editRef.current) {
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
                  } else if (targetTextarea) {
                      if (targetTextarea === introRef.current) {
                        setIntro(value);
                      } else {
                        setContenidoPrincipal(value);
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
      {showVideoModal && renderPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
          <div
            className="rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
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
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "videos");

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  if (!targetTextarea && !editBlock) {
                    contenidoPrincipalEditorRef.current?.insertVideoLink(url, originalName);
                    setContenidoPrincipal(contenidoPrincipalEditorRef.current?.getHTML() || "");
                  } else if (!targetTextarea && editBlock) {
                    editContenidoEditorRef.current?.insertVideoLink(url, originalName);
                    setEditContenido(editContenidoEditorRef.current?.getHTML() || "");
                  } else if (targetTextarea) {
                    const placeholder = `[🎥 ${originalName}]`;
                    insertAtCursor(targetTextarea, placeholder);
                  }

                  const value = targetTextarea?.value || "";
                  if (editBlock) {
                    if (targetTextarea && targetTextarea === editRef.current) {
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
                  } else if (targetTextarea) {
                      if (targetTextarea === introRef.current) {
                        setIntro(value);
                      } else {
                        setContenidoPrincipal(value);
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
      {showDocModal && renderPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
          <div
            className="rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
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
                  if (!file) return;

                  const { url, originalName } = await uploadToStorage(file, "documentos");

                  const nextMap = {
                    ...fileMap,
                    [originalName]: JSON.stringify({ name: originalName, url }),
                  };
                  setFileMap(nextMap);

                  if (!targetTextarea && !editBlock) {
                    contenidoPrincipalEditorRef.current?.insertDocumentLink(url, originalName);
                    setContenidoPrincipal(contenidoPrincipalEditorRef.current?.getHTML() || "");
                  } else if (!targetTextarea && editBlock) {
                    editContenidoEditorRef.current?.insertDocumentLink(url, originalName);
                    setEditContenido(editContenidoEditorRef.current?.getHTML() || "");
                  } else if (targetTextarea) {
                    const placeholder = `[📄 ${originalName}]`;
                    insertAtCursor(targetTextarea, placeholder);
                  }

                  const value = targetTextarea?.value || "";
                  if (editBlock) {
                    if (targetTextarea && targetTextarea === editRef.current) {
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
                  } else if (targetTextarea) {
                      if (targetTextarea === introRef.current) {
                        setIntro(value);
                      } else {
                        setContenidoPrincipal(value);
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
      {showLinkModal && renderPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-3 sm:p-4">
          <div
            className="rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
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
                  if (!linkUrl) return;

                  if (!targetTextarea && !editBlock) {
                    contenidoPrincipalEditorRef.current?.insertLink(linkText, linkUrl);
                    setContenidoPrincipal(contenidoPrincipalEditorRef.current?.getHTML() || "");
                  } else if (!targetTextarea && editBlock) {
                    editContenidoEditorRef.current?.insertLink(linkText, linkUrl);
                    setEditContenido(editContenidoEditorRef.current?.getHTML() || "");
                  } else if (targetTextarea) {
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
                    } else if (textarea === editRef.current) {
                      setEditContenido(newValue);
                    }
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
      {toast && (
        <div className="fixed bottom-4 right-4 z-[140] flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-lg border border-gray-100 text-gray-800 font-medium">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-sm
              ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}
          >
            {toast.type === "success" ? "✓" : "!"}
          </span>

          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
