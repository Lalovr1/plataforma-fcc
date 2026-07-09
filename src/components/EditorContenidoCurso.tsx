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
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";

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
  const [unidadGestionId, setUnidadGestionId] = useState("");
  const [unidadAbiertaId, setUnidadAbiertaId] = useState<string | null>(null);
  const [unidadAEliminarId, setUnidadAEliminarId] = useState<string | null>(null);
  const [eliminandoUnidad, setEliminandoUnidad] = useState(false);
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
      showFormulaPanel ||
      Boolean(unidadAEliminarId);

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

    const unidadAEliminar = useMemo(
      () => unidades.find((u) => u.id === unidadAEliminarId) || null,
      [unidadAEliminarId, unidades]
    );

    const bloquesUnidadAEliminar = unidadAEliminarId
      ? bloquesPorUnidad[unidadAEliminarId] || []
      : [];

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
    setUnidadGestionId((prev) => prev || data[0].id);
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
    setUnidadGestionId(nuevaUnidad.id);
    setUnidad("");
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

    if (!unidad) {
      setToast({
        message: "Antes de continuar tienes que seleccionar una unidad.",
        type: "error",
      });
      return;
    }

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

      setUnidad("");

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

  const handleDeleteUnidad = (unidadId: string) => {
    if (unidades.length <= 1) {
      setToast({
        message: "No puedes eliminar la única unidad del curso.",
        type: "error",
      });
      return;
    }

    setUnidadAEliminarId(unidadId);
  };

  const confirmarEliminarUnidad = async () => {
    if (!unidadAEliminarId || eliminandoUnidad) return;

    setEliminandoUnidad(true);

    try {
      const bloquesLocales = bloquesPorUnidad[unidadAEliminarId] || [];

      if (bloquesLocales.length > 0) {
        const { error: bloquesError } = await supabase
          .from("curso_contenido_bloques")
          .delete()
          .eq("materia_id", materiaId)
          .eq("unidad_id", unidadAEliminarId);

        if (bloquesError) {
          console.error(bloquesError);
          setToast({
            message: "No se pudieron eliminar los bloques de la unidad.",
            type: "error",
          });
          return;
        }
      }

      const { error } = await supabase
        .from("curso_unidades")
        .delete()
        .eq("id", unidadAEliminarId)
        .eq("materia_id", materiaId);

      if (error) {
        console.error(error);
        setToast({
          message: "No se pudo eliminar la unidad.",
          type: "error",
        });
        return;
      }

      const unidadesRestantes = unidades.filter(
        (u) => u.id !== unidadAEliminarId
      );

      setUnidades(unidadesRestantes);

      if (unidad === unidadAEliminarId) {
        setUnidad("");
      }

      if (unidadGestionId === unidadAEliminarId) {
        setUnidadGestionId(unidadesRestantes[0]?.id || "");
      }

      if (unidadAbiertaId === unidadAEliminarId) {
        setUnidadAbiertaId(null);
      }

      setUnidadAEliminarId(null);
      await fetchBlocks();

      setToast({
        message:
          bloquesLocales.length > 0
            ? "Unidad y bloques eliminados correctamente"
            : "Unidad eliminada correctamente",
        type: "success",
      });

      if (onBloquesChange) onBloquesChange();
    } finally {
      setEliminandoUnidad(false);
    }
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

  const estilos = (
    <style>{`
      .contenido-editor,
      .contenido-editor-overlay,
      .contenido-edit-overlay {
        --contenido-accent: var(--fcc-premium-accent);
        --contenido-cyan: var(--fcc-premium-cyan);
        --contenido-surface: var(--fcc-premium-surface);
        --contenido-surface-soft: var(--fcc-premium-surface-soft);
        --contenido-surface-strong: var(--fcc-premium-surface-strong);
        --contenido-text: var(--fcc-premium-text);
        --contenido-text-soft: var(--fcc-premium-text-soft);
        --contenido-muted: var(--fcc-premium-muted);
        --contenido-border: var(--fcc-premium-border);
        --contenido-border-strong: var(--fcc-premium-border-strong);
        --contenido-shadow: var(--fcc-premium-shadow);
        --contenido-shadow-soft: var(--fcc-premium-shadow-soft);
        --contenido-button: var(--fcc-premium-button);
      }

      .contenido-editor {
        display: grid;
        gap: 16px;
        min-width: 0;
        color: var(--contenido-text);
      }

      .contenido-editor-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.28fr) minmax(360px, 0.72fr);
        gap: 16px;
        align-items: start;
        min-width: 0;
        width: 100%;
      }

      .contenido-side-column {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .contenido-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        color: var(--contenido-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-surface) 96%, transparent),
            color-mix(in srgb, var(--contenido-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 14%, var(--contenido-border));
        box-shadow:
          var(--contenido-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--contenido-surface-strong) 65%, transparent);
      }

      .contenido-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--contenido-accent) 6%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 24%,
            color-mix(in srgb, var(--contenido-accent) 4%, transparent) 24% 24.35%,
            transparent 24.35% 100%
          );
        opacity: 0.62;
      }

      .contenido-card.no-line::before,
      .contenido-block-row::before,
      .contenido-unit-card::before {
        content: none;
      }

      .contenido-card-content {
        position: relative;
        z-index: 2;
        min-width: 0;
      }

      .contenido-form-card,
      .contenido-list-card,
      .contenido-units-card {
        padding: clamp(16px, 2.8vw, 22px);
      }

      .contenido-section-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 2px 0 16px;
        color: var(--contenido-text);
        font-size: 1.04rem;
        font-weight: 950;
        letter-spacing: -0.02em;
        text-align: center;
      }

      .contenido-section-title::before,
      .contenido-section-title::after {
        content: "";
        width: 42px;
        height: 1px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--contenido-accent) 55%, transparent)
        );
      }

      .contenido-section-title::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--contenido-accent) 55%, transparent),
          transparent
        );
      }

      .contenido-form {
        display: grid;
        gap: 14px;
      }

      .contenido-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: end;
      }

      .contenido-units-form {
        display: grid;
        gap: 12px;
      }

      .contenido-units-actions {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
      }

      .contenido-unit-open-name {
        border-radius: 16px;
        padding: 9px 12px;
        color: var(--contenido-muted);
        background: color-mix(in srgb, var(--contenido-accent) 4%, var(--contenido-surface-strong));
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 12%, var(--contenido-border));
        font-size: 0.78rem;
        font-weight: 850;
        line-height: 1.32;
        text-align: center;
        overflow-wrap: anywhere;
      }

      .contenido-editor-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(2, 8, 23, 0.58);
        backdrop-filter: blur(8px);
      }

      .contenido-editor-modal {
        position: relative;
        width: min(94vw, 560px);
        overflow: hidden;
        border-radius: 28px;
        color: var(--contenido-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-surface) 98%, transparent),
            color-mix(in srgb, var(--contenido-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 16%, var(--contenido-border));
        box-shadow: var(--contenido-shadow);
      }

      .contenido-editor-modal-content {
        padding: 28px;
      }

      .contenido-editor-modal-close {
        position: absolute;
        right: 16px;
        top: 16px;
        z-index: 3;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 82%, transparent);
        border: 1px solid var(--contenido-border);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          color 170ms ease;
      }

      .contenido-editor-modal-close:hover {
        transform: translateY(-1px);
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 34%, var(--contenido-border));
      }

      .contenido-editor-modal-title {
        color: var(--contenido-text);
        font-size: clamp(1.45rem, 3vw, 2rem);
        font-weight: 950;
        letter-spacing: -0.055em;
        line-height: 1;
        text-align: center;
      }

      .contenido-editor-modal-description {
        max-width: 460px;
        margin: 8px auto 18px;
        color: var(--contenido-muted);
        text-align: center;
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.42;
      }

      .contenido-editor-warning {
        border-radius: 18px;
        padding: 14px 16px;
        color: var(--contenido-text);
        background: color-mix(in srgb, #ef4444 8%, var(--contenido-surface));
        border: 1px solid color-mix(in srgb, #ef4444 28%, var(--contenido-border));
        text-align: center;
        font-size: 0.94rem;
        font-weight: 850;
        line-height: 1.45;
      }

      .contenido-editor-modal-actions {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        padding-top: 18px;
      }

      .contenido-edit-overlay {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(2, 8, 23, 0.58);
        backdrop-filter: blur(8px);
      }

      .contenido-edit-shell {
        width: min(94vw, 920px);
        max-height: 92dvh;
        display: flex;
        align-items: stretch;
        justify-content: center;
        gap: 8px;
        min-width: 0;
      }

      .contenido-edit-shell.with-panel {
        width: min(94vw, 920px);
      }

      .contenido-edit-modal {
        width: min(94vw, 920px);
        max-height: 92dvh;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 14px;
        overflow: hidden;
        border-radius: 26px;
        padding: clamp(16px, 2.3vw, 24px);
        color: var(--contenido-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-surface) 98%, transparent),
            color-mix(in srgb, var(--contenido-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 16%, var(--contenido-border));
        box-shadow: var(--contenido-shadow);
        min-width: 0;
      }

      .contenido-edit-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(170px, 220px);
        gap: 12px;
        align-items: center;
        min-width: 0;
      }

      .contenido-edit-title-input,
      .contenido-edit-select,
      .contenido-edit-intro,
      .contenido-modal-input,
      .contenido-modal-textarea,
      .contenido-panel-input,
      .contenido-panel-textarea {
        width: 100%;
        border-radius: 14px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 74%, transparent);
        border: 1px solid var(--contenido-border);
        outline: none;
        transition:
          border-color 170ms ease,
          background 170ms ease;
      }

      .contenido-edit-title-input {
        min-height: 44px;
        padding: 0 14px;
        font-size: clamp(1rem, 1.6vw, 1.18rem);
        font-weight: 950;
        line-height: 1.1;
        text-align: center;
      }

      .contenido-edit-select {
        min-height: 44px;
        padding: 0 12px;
        font-size: 0.92rem;
        font-weight: 850;
        text-align: center;
        text-align-last: center;
      }

      .contenido-edit-intro {
        min-height: 58px;
        max-height: 152px;
        padding: 12px 14px;
        resize: none;
        color: var(--contenido-muted);
        font-size: 0.92rem;
        font-style: italic;
        line-height: 1.45;
        text-align: center;
      }

      .contenido-edit-title-input:focus,
      .contenido-edit-select:focus,
      .contenido-edit-intro:focus,
      .contenido-modal-input:focus,
      .contenido-modal-textarea:focus,
      .contenido-panel-input:focus,
      .contenido-panel-textarea:focus {
        border-color: color-mix(in srgb, var(--contenido-accent) 56%, var(--contenido-border));
        background: color-mix(in srgb, var(--contenido-surface-strong) 90%, transparent);
      }

      .contenido-edit-editor-box {
        min-height: 0;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 18%, var(--contenido-border));
      }

      .contenido-edit-actions {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 10px;
      }

      .contenido-formula-panel {
        position: fixed;
        top: 50%;
        left: calc(50% + min(47vw, 460px) + 10px);
        z-index: 86;
        width: 340px;
        max-width: 340px;
        height: 92dvh;
        max-height: 92dvh;
        overflow-y: auto;
        transform: translateY(-50%);
        border-radius: 22px;
        padding: 14px;
        color: var(--contenido-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-surface) 98%, transparent),
            color-mix(in srgb, var(--contenido-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 18%, var(--contenido-border));
        box-shadow: var(--contenido-shadow-soft);
      }

      .contenido-formula-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .contenido-formula-panel-title {
        color: var(--contenido-text);
        font-size: 0.95rem;
        font-weight: 950;
      }

      .contenido-formula-card {
        display: grid;
        gap: 10px;
        border-radius: 18px;
        padding: 12px;
        background: color-mix(in srgb, var(--contenido-surface-strong) 70%, transparent);
        border: 1px solid var(--contenido-border);
      }

      .contenido-formula-card + .contenido-formula-card {
        margin-top: 10px;
      }

      .contenido-formula-add-button {
        width: max-content;
        margin: 14px auto 0;
      }

      .contenido-panel-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        align-items: start;
      }

      .contenido-panel-input,
      .contenido-panel-textarea {
        min-height: 36px;
        padding: 8px 10px;
        font-size: 0.78rem;
        font-weight: 780;
        line-height: 1.28;
        resize: none;
      }

      .contenido-panel-input {
        max-height: 58px;
      }

      .contenido-panel-textarea {
        min-height: 38px;
        max-height: 86px;
      }

      .contenido-panel-checkbox {
        width: max-content;
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 999px;
        padding: 0 10px;
        color: var(--contenido-muted);
        background: color-mix(in srgb, var(--contenido-accent) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 16%, var(--contenido-border));
        font-size: 0.74rem;
        font-weight: 850;
        white-space: nowrap;
      }

      .contenido-panel-checkbox input {
        accent-color: var(--contenido-accent);
      }

      .contenido-formula-preview {
        color: var(--contenido-accent);
        text-align: center;
        font-size: 0.86rem;
        line-height: 1.16;
        overflow-x: auto;
      }

      .contenido-formula-preview .katex {
        font-size: 1em;
      }

      .contenido-formula-preview .katex-display {
        margin: 0.18em 0;
      }

      .contenido-formula-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .contenido-formula-card-actions {
        display: grid;
        grid-template-columns: auto auto auto;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .contenido-mini-button {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        padding: 0 9px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 82%, transparent);
        border: 1px solid var(--contenido-border);
        font-size: 0.75rem;
        font-weight: 900;
      }

      .contenido-mini-button.icon {
        width: 32px;
        padding: 0;
      }

      .contenido-mini-button.warning {
        color: #ffffff;
        background: #f59e0b;
        border-color: color-mix(in srgb, #f59e0b 70%, white);
      }

      .contenido-mini-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .contenido-resource-modal {
        width: min(94vw, 560px);
      }

      .contenido-resource-modal .contenido-editor-modal-title {
        margin: 0 0 16px;
        font-size: clamp(1.35rem, 3vw, 1.75rem);
      }

      .contenido-resource-modal .contenido-modal-input,
      .contenido-resource-modal .contenido-modal-textarea,
      .contenido-resource-modal .contenido-formula-preview-box {
        margin-top: 12px;
        box-sizing: border-box;
      }

      .contenido-resource-modal .contenido-resource-tabs + .contenido-modal-input,
      .contenido-resource-modal .contenido-resource-tabs + .contenido-modal-textarea {
        margin-top: 0;
      }

      .contenido-resource-modal .contenido-modal-input:focus,
      .contenido-resource-modal .contenido-modal-textarea:focus {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--contenido-accent) 18%, transparent);
      }

      .contenido-file-picker {
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 16px;
        padding: 0 14px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 74%, transparent);
        border: 1px solid var(--contenido-border);
        font-size: 0.92rem;
        font-weight: 900;
        text-align: center;
        cursor: pointer;
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .contenido-file-picker:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--contenido-accent) 42%, var(--contenido-border));
        background: color-mix(in srgb, var(--contenido-accent) 8%, var(--contenido-surface-strong));
      }

      .contenido-file-picker input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .contenido-resource-tabs {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin: 16px 0 14px;
      }

      .contenido-resource-tab {
        min-height: 36px;
        border-radius: 12px;
        padding: 0 14px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 76%, transparent);
        border: 1px solid var(--contenido-border);
        font-size: 0.9rem;
        font-weight: 900;
      }

      .contenido-resource-tab.active {
        color: #ffffff;
        background: var(--contenido-button);
        border-color: transparent;
      }

      .theme-oscuro .contenido-resource-tab.active {
        color: #050505;
      }

      .contenido-modal-stack {
        display: grid;
        gap: 12px;
      }

      .contenido-modal-input,
      .contenido-modal-textarea {
        min-height: 44px;
        padding: 0 13px;
        font-size: 0.92rem;
        font-weight: 750;
      }

      .contenido-modal-textarea {
        min-height: 92px;
        padding: 12px 13px;
        resize: vertical;
        line-height: 1.45;
      }

      .contenido-modal-check {
        width: max-content;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        margin: 12px auto 0;
        border-radius: 999px;
        padding: 0 14px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-accent) 7%, transparent);
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 20%, var(--contenido-border));
        font-size: 0.88rem;
        font-weight: 900;
      }

      .contenido-modal-check input {
        accent-color: var(--contenido-accent);
      }

      .contenido-formula-preview-box {
        border-radius: 18px;
        padding: 14px;
        text-align: center;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 66%, transparent);
        border: 1px solid var(--contenido-border);
        overflow-x: auto;
      }

      .contenido-field {
        display: grid;
        gap: 8px;
        min-width: 0;
      }

      .contenido-label {
        color: var(--contenido-text-soft);
        font-size: 0.78rem;
        font-weight: 950;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .contenido-input,
      .contenido-select,
      .contenido-textarea {
        min-height: 44px;
        width: 100%;
        border-radius: 14px;
        padding: 0 13px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 74%, transparent);
        border: 1px solid var(--contenido-border);
        outline: none;
        font-size: 0.92rem;
        font-weight: 750;
        transition:
          border-color 170ms ease,
          background 170ms ease;
      }

      .contenido-textarea {
        min-height: 72px;
        padding: 12px 13px;
        resize: vertical;
        color: var(--contenido-muted);
        text-align: center;
        font-style: italic;
      }

      .contenido-input:focus,
      .contenido-select:focus,
      .contenido-textarea:focus {
        border-color: color-mix(in srgb, var(--contenido-accent) 56%, var(--contenido-border));
        background: color-mix(in srgb, var(--contenido-surface-strong) 90%, transparent);
      }

      .contenido-form .contenido-input,
      .contenido-form .contenido-select,
      .contenido-units-form .contenido-input,
      .contenido-units-form .contenido-select {
        text-align: center;
        text-align-last: center;
      }

      .contenido-editor-box {
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid var(--contenido-border);
        background: color-mix(in srgb, var(--contenido-surface-strong) 62%, transparent);
      }

      .contenido-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 4px;
      }

      .contenido-button {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 14px;
        padding: 0 15px;
        color: #ffffff;
        background: var(--contenido-button);
        border: 1px solid transparent;
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          opacity 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .theme-oscuro .contenido-button {
        color: #050505;
      }

      .contenido-button:hover {
        transform: translateY(-1px);
      }

      .contenido-button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
        transform: none;
      }

      .contenido-button.secondary {
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 82%, transparent);
        border-color: var(--contenido-border);
      }

      .contenido-button.danger,
      .contenido-icon-button.danger {
        color: #ffffff;
        background: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 70%, white);
      }

      .contenido-icon-button {
        width: 38px;
        height: 38px;
        display: inline-grid;
        place-items: center;
        flex: 0 0 auto;
        border-radius: 13px;
        color: var(--contenido-text);
        background: color-mix(in srgb, var(--contenido-surface-strong) 82%, transparent);
        border: 1px solid var(--contenido-border);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          background 170ms ease;
      }

      .contenido-icon-button:hover {
        transform: translateY(-1px);
        border-color: var(--contenido-border-strong);
      }

      .contenido-list {
        display: grid;
        gap: 10px;
      }

      .contenido-empty {
        border-radius: 18px;
        padding: 16px;
        color: var(--contenido-muted);
        background: color-mix(in srgb, var(--contenido-surface-strong) 58%, transparent);
        border: 1px dashed color-mix(in srgb, var(--contenido-accent) 20%, var(--contenido-border));
        font-size: 0.92rem;
        font-weight: 750;
        text-align: center;
      }

      .contenido-unit-card {
        overflow: hidden;
        border-radius: 22px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-accent) 5%, var(--contenido-surface-strong)),
            color-mix(in srgb, var(--contenido-surface-soft) 92%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--contenido-accent) 12%, var(--contenido-border));
      }

      .contenido-unit-button {
        width: 100%;
        min-height: 64px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 13px 14px;
        color: var(--contenido-text);
        text-align: left;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--contenido-accent) 6%, transparent),
            color-mix(in srgb, var(--contenido-surface-strong) 72%, transparent)
          );
      }

      .contenido-unit-title {
        display: block;
        color: var(--contenido-text);
        font-size: 0.96rem;
        font-weight: 950;
        line-height: 1.18;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .contenido-unit-meta {
        display: block;
        margin-top: 3px;
        color: var(--contenido-muted);
        font-size: 0.76rem;
        font-weight: 800;
        text-align: center;
      }

      .contenido-unit-body {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-top: 1px solid color-mix(in srgb, var(--contenido-accent) 12%, var(--contenido-border));
      }

      .contenido-unit-empty {
        display: grid;
        gap: 10px;
      }

      .contenido-block-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        min-width: 0;
        border-radius: 17px;
        padding: 11px 12px;
        color: var(--contenido-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, #8b5cf6 4%, var(--contenido-surface)),
            color-mix(in srgb, var(--contenido-surface-strong) 72%, transparent)
          );
        border: 1px solid color-mix(in srgb, #8b5cf6 12%, var(--contenido-border));
        box-shadow: inset 4px 0 0 color-mix(in srgb, #8b5cf6 26%, var(--contenido-accent));
        cursor: pointer;
        transition:
          transform 170ms ease,
          border-color 170ms ease;
      }

      .contenido-block-row:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, #8b5cf6 24%, var(--contenido-border));
      }

      .contenido-block-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        justify-items: center;
        min-width: 0;
      }

      .contenido-kind-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: max-content;
        margin: 0 auto 5px;
        border-radius: 999px;
        padding: 3px 9px;
        color: color-mix(in srgb, #8b5cf6 60%, var(--contenido-accent));
        background: color-mix(in srgb, #8b5cf6 4%, transparent);
        border: 1px solid color-mix(in srgb, #8b5cf6 12%, var(--contenido-border));
        font-size: 0.62rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .contenido-block-title {
        color: var(--contenido-text);
        font-size: 0.8rem;
        font-weight: 950;
        line-height: 1.12;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .contenido-block-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      @media (max-width: 1640px) {
        .contenido-formula-panel {
          display: none !important;
        }
      }

      @media (max-width: 980px) {
        .contenido-editor-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .contenido-form-card,
        .contenido-list-card,
        .contenido-units-card {
          padding: 16px;
        }

        .contenido-grid {
          grid-template-columns: 1fr;
        }

        .contenido-button {
          width: 100%;
        }

        .contenido-units-actions {
          grid-template-columns: 1fr;
        }

        .contenido-block-row {
          grid-template-columns: 1fr;
        }

        .contenido-block-actions {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .contenido-edit-header {
          grid-template-columns: 1fr;
        }

        .contenido-edit-actions {
          justify-content: stretch;
        }
      }
    `}</style>
  );

  return (
    <div className="contenido-editor">
      {estilos}

      <div className="contenido-editor-layout">
        <section className="contenido-card contenido-form-card no-line">
          <div className="contenido-card-content">
            <h2 className="contenido-section-title">Crear contenido</h2>

            <form onSubmit={handleAddBlock} className="contenido-form">
              <div className="contenido-field">
                <label className="contenido-label">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="contenido-input"
                  placeholder=""
                />
              </div>

              <div className="contenido-field">
                <label className="contenido-label">Unidad</label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="contenido-select"
                >
                  <option value="">— Selecciona una unidad —</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unidad {u.numero}
                      {u.nombre?.trim() ? ` - ${u.nombre.trim()}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="contenido-field">
                <label className="contenido-label">Introducción (opcional)</label>
                <textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  className="contenido-textarea"
                />
              </div>

              <div className="contenido-field">
                <label className="contenido-label">Contenido principal</label>
                <div className="contenido-editor-box">
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
                      const { url, originalName } = await uploadToStorage(
                        file,
                        "imagenes"
                      );

                      setFileMap((prev) => ({
                        ...prev,
                        [originalName]: JSON.stringify({
                          name: originalName,
                          url,
                        }),
                      }));

                      return {
                        url,
                        name: originalName,
                      };
                    }}
                  />
                </div>
              </div>

              <div className="contenido-actions">
                <button
                  type="submit"
                  disabled={loading}
                  className="contenido-button"
                >
                  <Save size={17} strokeWidth={2.6} />
                  {loading ? "Guardando..." : "Agregar bloque"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <div className="contenido-side-column">
          <section className="contenido-card contenido-units-card no-line">
            <div className="contenido-card-content">
              <h2 className="contenido-section-title">Unidades</h2>

              <div className="contenido-units-form">
                <div className="contenido-field">
                  <label className="contenido-label">Unidad</label>
                  <select
                    value={unidadGestionId}
                    onChange={(e) => setUnidadGestionId(e.target.value)}
                    className="contenido-select"
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.numero}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="contenido-field">
                  <label className="contenido-label">Nombre de unidad</label>
                  <input
                    type="text"
                    value={unidades.find((u) => u.id === unidadGestionId)?.nombre || ""}
                    onChange={async (e) => {
                      const nuevoNombre = e.target.value;

                      setUnidades((prev) =>
                        prev.map((u) =>
                          u.id === unidadGestionId ? { ...u, nombre: nuevoNombre } : u
                        )
                      );

                      const { error } = await supabase
                        .from("curso_unidades")
                        .update({ nombre: nuevoNombre })
                        .eq("id", unidadGestionId);

                      if (error) {
                        console.error(error);
                      }
                    }}
                    className="contenido-input"
                    placeholder="Nombre opcional"
                  />
                </div>

                <div className="contenido-units-actions">
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
                        setToast({
                          message: "No se pudo crear la unidad.",
                          type: "error",
                        });
                        return;
                      }

                      setUnidades((prev) => [...prev, data as UnidadItem]);
                      setUnidadGestionId(data.id);
                    }}
                    className="contenido-button secondary"
                  >
                    <Plus size={17} strokeWidth={2.7} />
                    Agregar unidad
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteUnidad(unidadGestionId)}
                    className="contenido-button danger"
                    disabled={!unidadGestionId || unidades.length <= 1}
                  >
                    <Trash2 size={17} strokeWidth={2.5} />
                    Eliminar unidad
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="contenido-card contenido-list-card no-line">
            <div className="contenido-card-content">
              <h2 className="contenido-section-title">Contenido creado</h2>

              <div className="contenido-list">
              {blocks.length === 0 && (
                <p className="contenido-empty">Aún no hay contenido.</p>
              )}

              {unidades.map((u) => {
                const bloquesUnidad = bloquesPorUnidad[u.id] || [];
                const abierta = unidadAbiertaId === u.id;

                return (
                  <article key={u.id} className="contenido-unit-card">
                    <button
                      type="button"
                      onClick={() =>
                        setUnidadAbiertaId((prev) =>
                          prev === u.id ? null : u.id
                        )
                      }
                      className="contenido-unit-button"
                    >
                      <span className="min-w-0">
                        <span
                          className="contenido-unit-title"
                          title={`Unidad ${u.numero}${
                            u.nombre?.trim() ? ` - ${u.nombre.trim()}` : ""
                          }`}
                        >
                          Unidad {u.numero}
                        </span>
                        <span className="contenido-unit-meta">
                          {bloquesUnidad.length} bloque
                          {bloquesUnidad.length === 1 ? "" : "s"}
                        </span>
                      </span>

                      {abierta ? (
                        <ChevronUp size={19} strokeWidth={2.7} />
                      ) : (
                        <ChevronDown size={19} strokeWidth={2.7} />
                      )}
                    </button>

                    {abierta && (
                      <div className="contenido-unit-body">
                        {u.nombre?.trim() && (
                          <p className="contenido-unit-open-name">
                            {u.nombre.trim()}
                          </p>
                        )}

                        {bloquesUnidad.length === 0 ? (
                          <div className="contenido-unit-empty">
                            <p className="contenido-empty">
                              Esta unidad aún no tiene bloques.
                            </p>

                            {unidades.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUnidad(u.id);
                                }}
                                className="contenido-button danger"
                              >
                                <Trash2 size={17} strokeWidth={2.5} />
                                Eliminar unidad
                              </button>
                            )}
                          </div>
                        ) : (
                          bloquesUnidad.map((b) => (
                            <article
                              key={b.id}
                              className="contenido-block-row"
                              onClick={() => handleOpenEdit(b)}
                              title="Haz clic para editar este bloque"
                            >
                              <div className="contenido-block-main">
                                <span className="contenido-kind-label">
                                  Tema
                                </span>
                                <span
                                  className="contenido-block-title"
                                  title={b.titulo || "(Sin título)"}
                                >
                                  {b.titulo || "(Sin título)"}
                                </span>
                              </div>

                              <div className="contenido-block-actions">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    move(b.id, "up");
                                  }}
                                  className="contenido-icon-button"
                                  aria-label="Subir bloque"
                                  title="Subir"
                                >
                                  <ArrowUp size={16} strokeWidth={2.7} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    move(b.id, "down");
                                  }}
                                  className="contenido-icon-button"
                                  aria-label="Bajar bloque"
                                  title="Bajar"
                                >
                                  <ArrowDown size={16} strokeWidth={2.7} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(b.id);
                                  }}
                                  className="contenido-icon-button danger"
                                  aria-label="Eliminar bloque"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} strokeWidth={2.5} />
                                </button>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {bloquesPorUnidad["__sin_unidad__"]?.length > 0 && (
                <article className="contenido-unit-card">
                  <button
                    type="button"
                    onClick={() =>
                      setUnidadAbiertaId((prev) =>
                        prev === "__sin_unidad__" ? null : "__sin_unidad__"
                      )
                    }
                    className="contenido-unit-button"
                  >
                    <span className="min-w-0">
                      <span className="contenido-unit-title">Sin unidad</span>
                      <span className="contenido-unit-meta">
                        {bloquesPorUnidad["__sin_unidad__"].length} bloques
                      </span>
                    </span>

                    {unidadAbiertaId === "__sin_unidad__" ? (
                      <ChevronUp size={19} strokeWidth={2.7} />
                    ) : (
                      <ChevronDown size={19} strokeWidth={2.7} />
                    )}
                  </button>

                  {unidadAbiertaId === "__sin_unidad__" && (
                    <div className="contenido-unit-body">
                      {bloquesPorUnidad["__sin_unidad__"].map((b) => (
                        <article
                          key={b.id}
                          className="contenido-block-row"
                          onClick={() => handleOpenEdit(b)}
                          title="Haz clic para editar este bloque"
                        >
                          <div className="contenido-block-main">
                            <span className="contenido-kind-label">
                              Tema
                            </span>
                            <span
                              className="contenido-block-title"
                              title={b.titulo || "(Sin título)"}
                            >
                              {b.titulo || "(Sin título)"}
                            </span>
                          </div>

                          <div className="contenido-block-actions">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                move(b.id, "up");
                              }}
                              className="contenido-icon-button"
                              aria-label="Subir bloque"
                              title="Subir"
                            >
                              <ArrowUp size={16} strokeWidth={2.7} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                move(b.id, "down");
                              }}
                              className="contenido-icon-button"
                              aria-label="Bajar bloque"
                              title="Bajar"
                            >
                              <ArrowDown size={16} strokeWidth={2.7} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(b.id);
                              }}
                              className="contenido-icon-button danger"
                              aria-label="Eliminar bloque"
                              title="Eliminar"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {unidadAEliminar &&
        renderPortal(
          <div
            className="contenido-editor-overlay"
            onClick={() => setUnidadAEliminarId(null)}
          >
            <div
              className="contenido-editor-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setUnidadAEliminarId(null)}
                className="contenido-editor-modal-close"
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="contenido-editor-modal-content">
                <h3 className="contenido-editor-modal-title">
                  Eliminar unidad
                </h3>

                <p className="contenido-editor-modal-description">
                  ¿Seguro que quieres eliminar Unidad {unidadAEliminar.numero}?
                </p>

                <div className="contenido-editor-warning">
                  {bloquesUnidadAEliminar.length > 0
                    ? `Esta unidad tiene ${bloquesUnidadAEliminar.length} bloque${
                        bloquesUnidadAEliminar.length === 1 ? "" : "s"
                      }. Si confirmas, también se eliminará ese contenido.`
                    : "Esta unidad no tiene bloques asociados."}
                </div>

                <div className="contenido-editor-modal-actions">
                  <button
                    type="button"
                    onClick={() => setUnidadAEliminarId(null)}
                    className="contenido-button secondary"
                    disabled={eliminandoUnidad}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => void confirmarEliminarUnidad()}
                    className="contenido-button danger"
                    disabled={eliminandoUnidad}
                  >
                    <Trash2 size={17} strokeWidth={2.5} />
                    {eliminandoUnidad
                      ? "Eliminando..."
                      : "Confirmar eliminación"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {editBlock && renderPortal(
        <div className="contenido-edit-overlay">
          <div
            className={`contenido-edit-shell ${
              showFormulaPanel ? "with-panel" : ""
            }`}
          >
            <section className="contenido-edit-modal">
              <div className="contenido-edit-header">
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="contenido-edit-title-input"
                />

                <select
                  value={editUnidad}
                  onChange={(e) => setEditUnidad(e.target.value)}
                  className="contenido-edit-select"
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unidad {u.numero}
                    </option>
                  ))}
                </select>
              </div>

              <TextareaAutosize
                minRows={2}
                maxRows={6}
                value={editIntro}
                onChange={(e) => setEditIntro(e.target.value)}
                className="contenido-edit-intro"
              />

              <div className="contenido-edit-editor-box">
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
                  formulaPanelOpen={showFormulaPanel}
                  onCloseFormulaPanel={() => setShowFormulaPanel(false)}
                  onRequestFormulaPanel={() =>
                    setShowFormulaPanel((prev) => !prev)
                  }
                  onPasteImage={async (file) => {
                    const { url, originalName } = await uploadToStorage(
                      file,
                      "imagenes"
                    );

                    setFileMap((prev) => ({
                      ...prev,
                      [originalName]: JSON.stringify({
                        name: originalName,
                        url,
                      }),
                    }));

                    return {
                      url,
                      name: originalName,
                    };
                  }}
                />
              </div>

              <div className="contenido-edit-actions">
                <button
                  type="button"
                  onClick={() => setEditBlock(null)}
                  className="contenido-button secondary"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="contenido-button"
                >
                  Guardar cambios
                </button>
              </div>
            </section>

            {showFormulaPanel && (
              <aside className="hidden 2xl:block contenido-formula-panel">
                <div className="contenido-formula-panel-head">
                  <h3 className="contenido-formula-panel-title">
                    Fórmulas del bloque
                  </h3>

                  <button
                    type="button"
                    onClick={() => setShowFormulaPanel(false)}
                    className="contenido-mini-button"
                  >
                    ×
                  </button>
                </div>

                {editFormulas.length === 0 ? (
                  <p className="contenido-empty">
                    Este bloque no tiene fórmulas.
                  </p>
                ) : (
                  editFormulas.map((f, index) => (
                    <div key={f.id} className="contenido-formula-card">
                      <div className="contenido-formula-preview">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {`$$${f.ecuacion}$$`}
                        </ReactMarkdown>
                      </div>

                      <div className="contenido-formula-card-actions">
                        <label className="contenido-panel-checkbox">
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

                        <div className="contenido-formula-actions">
                          {editFormulas.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => moveFormula(index, "up")}
                                className="contenido-mini-button icon"
                                aria-label="Subir fórmula"
                                title="Subir"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                onClick={() => moveFormula(index, "down")}
                                className="contenido-mini-button icon"
                                aria-label="Bajar fórmula"
                                title="Bajar"
                              >
                                ↓
                              </button>
                            </>
                          )}
                        </div>

                        <div className="contenido-formula-actions">
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
                            className="contenido-mini-button warning icon"
                            aria-label="Editar fórmula"
                            title="Editar"
                          >
                            <Pencil size={14} strokeWidth={2.7} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeletedFormulas((prev) => [...prev, f.id]);
                              setEditFormulas((prev) =>
                                prev.filter((item) => item.id !== f.id)
                              );
                            }}
                            className="contenido-mini-button danger icon"
                            aria-label="Eliminar fórmula"
                            title="Eliminar"
                          >
                            <Trash2 size={14} strokeWidth={2.6} />
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
                  className="contenido-button contenido-formula-add-button"
                >
                  Agregar fórmula
                </button>
              </aside>
            )}
          </div>
        </div>,
        document.body
      )}

      {showFormulaModal && renderPortal(
        <div className="contenido-editor-overlay">
          <div className="contenido-editor-modal contenido-resource-modal">
            <div className="contenido-editor-modal-content">
              <h2 className="contenido-editor-modal-title">
                Insertar fórmula
              </h2>

              <div className="contenido-resource-tabs">
              <button
                className={`contenido-resource-tab ${formulaMode === "latex" ? "active" : ""}`}
                onClick={() => setFormulaMode("latex")}
              >
                LaTeX
              </button>
              <button
                className={`contenido-resource-tab ${formulaMode === "image" ? "active" : ""}`}
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
                  className="contenido-modal-input"
                />

                <TextareaAutosize
                  minRows={3}
                  value={formulaEcuacion}
                  onChange={(e) => setFormulaEcuacion(e.target.value)}
                  placeholder="Escribe LaTeX aquí"
                  className="contenido-modal-textarea"
                />

                <TextareaAutosize
                  minRows={2}
                  value={formulaDescripcion}
                  onChange={(e) => setFormulaDescripcion(e.target.value)}
                  placeholder="Descripción de la fórmula (opcional)"
                  className="contenido-modal-textarea"
                />

                <label
                  className="contenido-modal-check"
                >
                  <input
                    type="checkbox"
                    checked={formulaPublica}
                    onChange={(e) => setFormulaPublica(e.target.checked)}
                  />
                  Visible para estudiantes
                </label>

                <div
                  className="contenido-formula-preview-box"
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

            <div className="contenido-editor-modal-actions">
              <button
                className="contenido-button secondary"
                onClick={() => setShowFormulaModal(false)}
              >
                Cancelar
              </button>
              <button
                className="contenido-button"
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
        </div>
      )}
      {/* Modal Imagen */}
      {showImageModal && renderPortal(
        <div className="contenido-editor-overlay">
          <div className="contenido-editor-modal contenido-resource-modal">
            <div className="contenido-editor-modal-content">
              <h2 className="contenido-editor-modal-title">Insertar imagen</h2>
              <label className="contenido-file-picker">
                <span>{file?.name || "Seleccionar imagen"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            <div className="contenido-editor-modal-actions">
              <button
                className="contenido-button secondary"
                onClick={() => setShowImageModal(false)}
              >
                Cancelar
              </button>
              <button
                className="contenido-button"
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
        </div>
      )}

      {/* Modal Video */}
      {showVideoModal && renderPortal(
        <div className="contenido-editor-overlay">
          <div className="contenido-editor-modal contenido-resource-modal">
            <div className="contenido-editor-modal-content">
              <h2 className="contenido-editor-modal-title">Insertar video</h2>
              <label className="contenido-file-picker">
                <span>{file?.name || "Seleccionar video"}</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            <div className="contenido-editor-modal-actions">
              <button
                className="contenido-button secondary"
                onClick={() => setShowVideoModal(false)}
              >
                Cancelar
              </button>
              <button
                className="contenido-button"
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
        </div>
      )}

      {/* Modal Documento */}
      {showDocModal && renderPortal(
        <div className="contenido-editor-overlay">
          <div className="contenido-editor-modal contenido-resource-modal">
            <div className="contenido-editor-modal-content">
              <h2 className="contenido-editor-modal-title">Insertar documento</h2>
              <label className="contenido-file-picker">
                <span>{file?.name || "Seleccionar documento"}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            <div className="contenido-editor-modal-actions">
              <button
                className="contenido-button secondary"
                onClick={() => setShowDocModal(false)}
              >
                Cancelar
              </button>
              <button
                className="contenido-button"
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
        </div>
      )}

      {/* Modal Enlace */}
      {showLinkModal && renderPortal(
        <div className="contenido-editor-overlay">
          <div className="contenido-editor-modal contenido-resource-modal">
            <div className="contenido-editor-modal-content">
              <h2 className="contenido-editor-modal-title">Insertar enlace</h2>
            <input
              type="text"
              placeholder="Texto a mostrar"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="contenido-modal-input"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <input
              type="url"
              placeholder="URL destino"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="contenido-modal-input"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
            <div className="contenido-editor-modal-actions">
              <button
                className="contenido-button secondary"
                onClick={() => setShowLinkModal(false)}
              >
                Cancelar
              </button>
              <button
                className="contenido-button"
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
