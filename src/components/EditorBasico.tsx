"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageBase from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { Video } from "@/components/extensions/Video";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Link2,
  Sigma,
  Maximize2,
  X,
  ChevronRight,
} from "lucide-react";
import { createPortal } from "react-dom";

export type EditorBasicoRef = {
  insertFormula: (latex: string) => void;
  insertLink: (text: string, url: string) => void;
  insertImage: (url: string, alt?: string) => void;
  insertVideoLink: (url: string, name: string) => void;
  insertDocumentLink: (url: string, name: string) => void;
  getHTML: () => string;
  setContent: (html: string) => void;
};

const escaparHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizarTextoPegado = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ ]{2,}/g, " ").trim())
    .join("\n");

const normalizarTextoInlinePegado = (text: string) =>
  text
    .replace(/\r\n?/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ");

const convertirTextoPlanoAHtml = (text: string) => {
  const limpio = normalizarTextoPegado(text);

  if (!limpio.trim()) return "<p><br></p>";

  return limpio
    .split("\n")
    .map((line) =>
      line.trim() === "" ? "<p><br></p>" : `<p>${escaparHtml(line)}</p>`
    )
    .join("");
};

const compactarEspaciadoHtmlPegado = (html: string) =>
  html
    .replace(
      /(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi,
      "<p><br></p>"
    )
    .replace(/^(?:\s*<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+/i, "")
    .replace(/(?:\s*<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>)+\s*$/i, "");

const mapearFontSize = (
  value: string | null
): "12px" | "16px" | "22px" | "30px" | null => {
  if (!value) return null;

  const raw = value.trim().toLowerCase();
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;

  let px = num;

  if (raw.endsWith("pt")) px = num * 1.333;
  if (raw.endsWith("em") || raw.endsWith("rem")) px = num * 16;
  if (raw.endsWith("%")) px = (num / 100) * 16;

  if (px <= 14) return "12px";
  if (px <= 19) return "16px";
  if (px <= 26) return "22px";
  return "30px";
};

const sanitizarUrl = (url: string | null) => {
  if (!url) return "";

  const value = url.trim();

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("/")
  ) {
    return value;
  }

  return "";
};

const sanitizarHtmlPegado = (html: string, fallbackText: string) => {
  if (typeof window === "undefined" || !html.trim()) {
    return convertirTextoPlanoAHtml(fallbackText);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const blockTags = new Set([
    "P",
    "DIV",
    "SECTION",
    "ARTICLE",
    "HEADER",
    "FOOTER",
    "BLOCKQUOTE",
    "PRE",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
  ]);

  const ignoredTags = new Set([
    "SCRIPT",
    "STYLE",
    "META",
    "LINK",
    "TITLE",
    "HEAD",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "BUTTON",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
  ]);

  const getFontSizeFromElement = (el: HTMLElement) => {
    const tag = el.tagName;

    if (tag === "H1") return "30px";
    if (tag === "H2" || tag === "H3") return "22px";
    if (tag === "H4" || tag === "H5" || tag === "H6") return "16px";

    return mapearFontSize(el.style.fontSize || el.getAttribute("size"));
  };

  const aplicarFormatoInline = (el: HTMLElement, content: string) => {
    if (!content) return "";

    const tag = el.tagName;
    const fontWeight = el.style.fontWeight || "";
    const fontStyle = el.style.fontStyle || "";
    const textDecoration = `${el.style.textDecoration || ""} ${
      el.style.textDecorationLine || ""
    }`;
    const fontSize = getFontSizeFromElement(el);

    const isHeading = /^H[1-6]$/.test(tag);
    const isBold =
      tag === "B" ||
      tag === "STRONG" ||
      isHeading ||
      fontWeight === "bold" ||
      Number(fontWeight) >= 600;

    const isItalic = tag === "I" || tag === "EM" || fontStyle === "italic";
    const isUnderline = tag === "U" || textDecoration.includes("underline");

    let output = content;

    if (fontSize) {
      output = `<span style="font-size: ${fontSize}">${output}</span>`;
    }

    if (isUnderline) output = `<u>${output}</u>`;
    if (isItalic) output = `<em>${output}</em>`;
    if (isBold) output = `<strong>${output}</strong>`;

    if (tag === "A") {
      const href = sanitizarUrl(el.getAttribute("href"));
      if (href) {
        output = `<a href="${escaparHtml(
          href
        )}" target="_blank" rel="noopener noreferrer">${output}</a>`;
      }
    }

    return output;
  };

  const tieneHijoBloque = (el: HTMLElement) =>
    Array.from(el.childNodes).some(
      (child) =>
        child.nodeType === Node.ELEMENT_NODE &&
        blockTags.has((child as HTMLElement).tagName)
    );

  const limpiarNodo = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const texto = normalizarTextoInlinePegado(node.textContent || "");
      if (!texto.trim()) return "";
      return escaparHtml(texto);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName;

    if (ignoredTags.has(tag)) return "";
    if (tag === "BR") return "<br>";

    const children = Array.from(el.childNodes).map(limpiarNodo).join("");

    if (blockTags.has(tag)) {
      if (tieneHijoBloque(el) && !/^H[1-6]$/.test(tag) && tag !== "LI") {
        return children;
      }

      let content = aplicarFormatoInline(el, children);

      if (tag === "LI" && content.trim()) {
        content = `• ${content}`;
      }

      const align = (el.style.textAlign || el.getAttribute("align") || "")
        .trim()
        .toLowerCase();

      const alignValido = ["left", "center", "right", "justify"].includes(align)
        ? align
        : "";

      const style = alignValido ? ` style="text-align: ${alignValido}"` : "";

      const contentSinBr = content.replace(/<br\s*\/?>/gi, "").trim();

      return contentSinBr === ""
        ? `<p${style}><br></p>`
        : `<p${style}>${content}</p>`;
    }

    return aplicarFormatoInline(el, children);
  };

  let result = Array.from(doc.body.childNodes).map(limpiarNodo).join("");

  if (!result.trim()) {
    return convertirTextoPlanoAHtml(fallbackText);
  }

  if (!/<p[\s>]/i.test(result)) {
    result = `<p>${result}</p>`;
  }

  return compactarEspaciadoHtmlPegado(result);
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRequestFormula?: () => void;
  onRequestImage?: () => void;
  onRequestVideo?: () => void;
  onRequestDocument?: () => void;
  onRequestLink?: () => void;
  onRequestFormulaPanel?: () => void;
  onCloseFormulaPanel?: () => void;
  formulaPanelOpen?: boolean;
  showFormulaPanelButton?: boolean;
  onPasteImage?: (file: File) => Promise<{ url: string; name: string }>;
  fillHeight?: boolean;
}

const CustomImage = ImageBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const align = HTMLAttributes.align || "center";

    const margin =
      align === "left"
        ? "10px auto 10px 0"
        : align === "right"
          ? "10px 0 10px auto"
          : "10px auto";

    return [
      "img",
      {
        ...HTMLAttributes,
        "data-align": align,
        style: `
          max-height:220px;
          max-width:100%;
          height:auto;
          border-radius:12px;
          margin:${margin};
          display:block;
          border:1px solid var(--fcc-premium-border);
          cursor:zoom-in;
        `,
      },
    ];
  },
});

const EditorBasico = forwardRef<EditorBasicoRef, Props>(function EditorBasico(
  {
    value,
    onChange,
    onRequestFormula,
    onRequestImage,
    onRequestVideo,
    onRequestDocument,
    onRequestLink,
    onRequestFormulaPanel,
    onCloseFormulaPanel,
    formulaPanelOpen,
    showFormulaPanelButton,
    onPasteImage,
    fillHeight,
  },
  ref
) {
  const [editorVersion, setEditorVersion] = useState(0);

  const [isExpanded, setIsExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [preview, setPreview] = useState<{
    type: "image" | "video";
    src: string;
  } | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isExpanded && !preview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded, preview]);

  const renderPortal = (content: React.ReactNode) => {
    if (!portalReady || typeof document === "undefined") return null;
    return createPortal(content, document.body);
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      Underline,
      CustomImage.configure({
        inline: false,
        allowBase64: false,
      }),
      Video,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          style:
            "color:var(--fcc-premium-accent);text-decoration:underline;cursor:pointer;",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "editor-basico-content prose prose-sm max-w-none outline-none break-words",
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;

        if (items && onPasteImage) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (!file) continue;

              event.preventDefault();

              onPasteImage(file).then(({ url, name }) => {
                editor
                  ?.chain()
                  .focus()
                  .insertContent({
                    type: "image",
                    attrs: {
                      src: url,
                      alt: name,
                      align: "center",
                    },
                  })
                  .run();
              });

              return true;
            }
          }
        }

        const text = event.clipboardData?.getData("text/plain") || "";
        const html = event.clipboardData?.getData("text/html") || "";

        if (!text && !html) return false;

        event.preventDefault();

        const htmlLimpio = html
          ? sanitizarHtmlPegado(html, text)
          : convertirTextoPlanoAHtml(text);

        editor
          ?.chain()
          .focus()
          .insertContent(htmlLimpio, {
            parseOptions: {
              preserveWhitespace: "full",
            },
          })
          .run();

        return true;
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      setEditorVersion((n) => n + 1);
    },
    onSelectionUpdate() {
      setEditorVersion((n) => n + 1);
    },
    onTransaction() {
      setEditorVersion((n) => n + 1);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      insertFormula(latex: string) {
        if (!editor || !latex.trim()) return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "inlineMath",
            attrs: {
              latex: latex.trim(),
            },
          })
          .run();
        setEditorVersion((n) => n + 1);
      },
      insertLink(text: string, url: string) {
        if (!editor || !url.trim()) return;
        const finalText = text.trim() || url.trim();
        editor
          .chain()
          .focus()
          .insertContent(
            `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" style="color:var(--fcc-premium-accent);text-decoration:underline;cursor:pointer;">${finalText}</a>`
          )
          .run();
        setEditorVersion((n) => n + 1);
      },
      insertImage(url: string, alt?: string) {
        if (!editor || !url.trim()) return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: {
              src: url.trim(),
              alt: alt || "",
              align: "center",
            },
          })
          .run();
        setEditorVersion((n) => n + 1);
      },
      insertVideoLink(url: string, name: string) {
        if (!editor || !url.trim()) return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "video",
            attrs: {
              src: url.trim(),
              height: "200px",
              align: "center",
            },
          })
          .run();
        setEditorVersion((n) => n + 1);
      },
      insertDocumentLink(url: string, name: string) {
        if (!editor || !url.trim()) return;
        const label = name.trim() || "Documento";
        editor
          .chain()
          .focus()
          .insertContent(
            `<p><a href="${url.trim()}" target="_blank" rel="noopener noreferrer" style="color:var(--fcc-premium-accent);text-decoration:underline;cursor:pointer;">${label}</a></p>`
          )
          .run();
        setEditorVersion((n) => n + 1);
      },
      getHTML() {
        return editor?.getHTML() || "";
      },
      setContent(html: string) {
        editor?.commands.setContent(html || "");
        setEditorVersion((n) => n + 1);
      },
    }),
    [editor]
  );

  const currentFontSize = useMemo(() => {
    if (!editor) return "16px";
    const attrs = editor.getAttributes("textStyle");
    return attrs.fontSize || "16px";
  }, [editor, editorVersion]);

  if (!editor) return null;

  const toolButtonClass = (active = false) =>
    `editor-basico-tool-button ${active ? "active" : ""}`;

  const estilos = (
    <style>{`
      .editor-basico,
      .editor-basico-overlay,
      .editor-basico-preview-overlay {
        --editor-accent: var(--fcc-premium-accent);
        --editor-accent-hover: var(--fcc-premium-accent-hover);
        --editor-surface: var(--fcc-premium-surface);
        --editor-surface-soft: var(--fcc-premium-surface-soft);
        --editor-surface-strong: var(--fcc-premium-surface-strong);
        --editor-text: var(--fcc-premium-text);
        --editor-muted: var(--fcc-premium-muted);
        --editor-border: var(--fcc-premium-border);
        --editor-border-strong: var(--fcc-premium-border-strong);
        --editor-shadow: var(--fcc-premium-shadow);
        --editor-shadow-soft: var(--fcc-premium-shadow-soft);
        --editor-button: var(--fcc-premium-button);
      }

      .editor-basico {
        overflow: hidden;
        border-radius: 18px;
        color: var(--editor-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editor-surface) 96%, transparent),
            color-mix(in srgb, var(--editor-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--editor-accent) 14%, var(--editor-border));
      }

      .editor-basico.expanded {
        position: fixed;
        z-index: 125;
        left: 50%;
        top: 50%;
        width: min(94vw, 980px);
        height: 92dvh;
        display: flex;
        flex-direction: column;
        transform: translate(-50%, -50%);
        box-shadow: var(--editor-shadow);
      }

      .editor-basico-toolbar {
        display: grid;
        gap: 8px;
        padding: 10px;
        background: color-mix(in srgb, var(--editor-surface-strong) 70%, transparent);
        border-bottom: 1px solid var(--editor-border);
      }

      .editor-basico-toolbar-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .editor-basico-tool-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 16px;
        padding: 5px;
        background: color-mix(in srgb, var(--editor-surface) 72%, transparent);
        border: 1px solid var(--editor-border);
      }

      .editor-basico-tool-button {
        min-width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border-radius: 12px;
        padding: 0 10px;
        color: var(--editor-text);
        background: transparent;
        border: 1px solid transparent;
        font-size: 0.78rem;
        font-weight: 900;
        transition:
          transform 170ms ease,
          background 170ms ease,
          border-color 170ms ease,
          color 170ms ease;
      }

      .editor-basico-tool-button:hover {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--editor-accent) 7%, transparent);
        border-color: color-mix(in srgb, var(--editor-accent) 18%, var(--editor-border));
      }

      .editor-basico-tool-button.active {
        color: #ffffff;
        background: var(--editor-button);
        border-color: transparent;
      }

      .theme-oscuro .editor-basico-tool-button.active {
        color: #050505;
      }

      .editor-basico-tool-button.media {
        --media-color: var(--editor-accent);
        color: color-mix(in srgb, var(--media-color) 78%, var(--editor-text));
        background: color-mix(in srgb, var(--media-color) 10%, transparent);
        border-color: color-mix(in srgb, var(--media-color) 25%, var(--editor-border));
      }

      .editor-basico-tool-button.media:hover {
        background: color-mix(in srgb, var(--media-color) 16%, transparent);
        border-color: color-mix(in srgb, var(--media-color) 38%, var(--editor-border));
      }

      .editor-basico-tool-button.media.formula {
        --media-color: #3b82f6;
      }

      .editor-basico-tool-button.media.image {
        --media-color: #10b981;
      }

      .editor-basico-tool-button.media.video {
        --media-color: #8b5cf6;
      }

      .editor-basico-tool-button.media.document {
        --media-color: #f59e0b;
      }

      .editor-basico-tool-button.media.link {
        --media-color: #ec4899;
      }

      .editor-basico-tool-button.expand {
        margin-left: auto;
        background: color-mix(in srgb, var(--editor-surface) 86%, transparent);
        border-color: var(--editor-border);
      }

      .editor-basico-tool-button.expand:hover {
        color: #ffffff;
        background: var(--editor-button);
        border-color: transparent;
      }

      .theme-oscuro .editor-basico-tool-button.expand:hover {
        color: #050505;
      }

      .editor-basico-tool-button.formula-panel {
        margin-left: auto;
        color: var(--editor-text);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editor-accent) 8%, var(--editor-surface)),
            color-mix(in srgb, var(--editor-surface-strong) 82%, transparent)
          );
        border-color: color-mix(in srgb, var(--editor-accent) 24%, var(--editor-border));
      }

      .editor-basico-tool-button.formula-panel:hover {
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--editor-accent) 12%, var(--editor-surface)),
            color-mix(in srgb, var(--editor-surface-strong) 90%, transparent)
          );
        border-color: color-mix(in srgb, var(--editor-accent) 38%, var(--editor-border));
      }

      .editor-basico-select {
        height: 36px;
        border-radius: 12px;
        padding: 0 10px;
        color: var(--editor-text);
        background: color-mix(in srgb, var(--editor-surface) 86%, transparent);
        border: 1px solid var(--editor-border);
        outline: none;
        font-size: 0.78rem;
        font-weight: 850;
      }

      .editor-basico-body {
        flex: 1;
        min-height: 220px;
        overflow-y: auto;
        padding: 8px 14px 14px;
        background: color-mix(in srgb, var(--editor-surface) 82%, transparent);
      }

      .editor-basico-content {
        min-height: 220px;
        color: var(--editor-text);
      }

      .editor-basico-content p {
        min-height: 1.5em;
        margin: 0.5rem 0;
      }

      .editor-basico-content > *:first-child {
        margin-top: 0;
      }

      .editor-basico-content img,
      .editor-basico-content video {
        cursor: zoom-in;
      }

      .editor-basico-content a {
        color: var(--editor-accent);
        text-decoration: underline;
      }

      .editor-basico-overlay,
      .editor-basico-preview-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        background: rgba(2, 8, 23, 0.58);
        backdrop-filter: blur(8px);
      }

      .editor-basico-preview-overlay {
        z-index: 135;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }

      .editor-basico-preview-content {
        position: relative;
        max-width: 92vw;
        max-height: 90dvh;
      }

      .editor-basico-preview-content img,
      .editor-basico-preview-content video {
        max-width: 100%;
        max-height: 90dvh;
        display: block;
        border-radius: 18px;
        border: 1px solid var(--editor-border);
        background: var(--editor-surface);
      }

      .editor-basico-preview-close {
        position: absolute;
        right: -12px;
        top: -12px;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: #ffffff;
        background: var(--color-danger);
        border: 1px solid color-mix(in srgb, var(--color-danger) 70%, white);
        font-weight: 950;
        transition: transform 170ms ease;
      }

      .editor-basico-preview-close:hover {
        transform: translateY(-1px);
      }

      @media (max-width: 1640px) {
        .editor-basico-tool-button.formula-panel {
          display: none;
        }
      }

      @media (max-width: 640px) {
        .editor-basico-toolbar {
          padding: 8px;
        }

        .editor-basico-tool-button {
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
        }

        .editor-basico-tool-button.expand {
          margin-left: 0;
        }

        .editor-basico-body {
          padding: 10px;
        }
      }
    `}</style>
  );

  const editorShell = (
    <div
      className={`editor-basico ${isExpanded ? "expanded" : ""}`}
      onClick={(e) => {
        if (isExpanded) e.stopPropagation();
      }}
    >
      {estilos}

      <div className="editor-basico-toolbar">
        <div className="editor-basico-toolbar-row">
          <div className="editor-basico-tool-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={toolButtonClass(editor.isActive("bold"))}
              title="Negrita"
            >
              <Bold size={16} strokeWidth={2.8} />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={toolButtonClass(editor.isActive("italic"))}
              title="Cursiva"
            >
              <Italic size={16} strokeWidth={2.8} />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={toolButtonClass(editor.isActive("underline"))}
              title="Subrayado"
            >
              <UnderlineIcon size={16} strokeWidth={2.8} />
            </button>
          </div>

          <div className="editor-basico-tool-group">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={toolButtonClass(editor.isActive({ textAlign: "left" }))}
              title="Alinear a la izquierda"
            >
              <AlignLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className={toolButtonClass(editor.isActive({ textAlign: "center" }))}
              title="Centrar"
            >
              <AlignCenter size={16} />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className={toolButtonClass(editor.isActive({ textAlign: "right" }))}
              title="Alinear a la derecha"
            >
              <AlignRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              className={toolButtonClass(editor.isActive({ textAlign: "justify" }))}
              title="Justificar"
            >
              <AlignJustify size={16} />
            </button>
          </div>

          <select
            value={currentFontSize}
            onChange={(e) => {
              editor.chain().focus().setFontSize(e.target.value).run();
              setEditorVersion((n) => n + 1);
            }}
            className="editor-basico-select"
            title="Tamaño de letra"
          >
            <option value="12px">Pequeña</option>
            <option value="16px">Normal</option>
            <option value="22px">Grande</option>
            <option value="30px">Muy grande</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (!isExpanded && formulaPanelOpen) {
                onCloseFormulaPanel?.();
              }

              setIsExpanded((prev) => !prev);
            }}
            className="editor-basico-tool-button expand"
            title={isExpanded ? "Cerrar editor expandido" : "Expandir editor"}
          >
            {isExpanded ? (
              <X size={17} strokeWidth={2.7} />
            ) : (
              <Maximize2 size={17} strokeWidth={2.7} />
            )}
          </button>
        </div>

        <div className="editor-basico-toolbar-row">
          <button
            type="button"
            onClick={onRequestFormula}
            className="editor-basico-tool-button media formula"
          >
            <Sigma size={15} strokeWidth={2.7} />
            Fórmula
          </button>

          <button
            type="button"
            onClick={onRequestImage}
            className="editor-basico-tool-button media image"
          >
            <ImageIcon size={15} strokeWidth={2.7} />
            Imagen
          </button>

          <button
            type="button"
            onClick={onRequestVideo}
            className="editor-basico-tool-button media video"
          >
            <VideoIcon size={15} strokeWidth={2.7} />
            Video
          </button>

          <button
            type="button"
            onClick={onRequestDocument}
            className="editor-basico-tool-button media document"
          >
            <FileText size={15} strokeWidth={2.7} />
            Documento
          </button>

          <button
            type="button"
            onClick={onRequestLink}
            className="editor-basico-tool-button media link"
          >
            <Link2 size={15} strokeWidth={2.7} />
            Enlace
          </button>

          {showFormulaPanelButton && !isExpanded && (
            <button
              type="button"
              onClick={onRequestFormulaPanel}
              className="editor-basico-tool-button formula-panel"
              title="Abrir fórmulas guardadas del bloque"
            >
              Fórmulas guardadas
              <ChevronRight size={15} strokeWidth={2.9} />
            </button>
          )}
        </div>
      </div>

      <div
        className="editor-basico-body"
        style={{
          height: isExpanded
            ? "calc(92dvh - 126px)"
            : fillHeight
              ? "calc(100dvh - 430px)"
              : undefined,
          maxHeight: isExpanded
            ? "calc(92dvh - 126px)"
            : fillHeight
              ? "calc(100dvh - 430px)"
              : "min(72dvh, 760px)",
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;

          if (target.tagName === "IMG") {
            const src = target.getAttribute("src");
            if (src) setPreview({ type: "image", src });
          }

          if (target.tagName === "VIDEO") {
            const src = target.getAttribute("src");
            if (src) setPreview({ type: "video", src });
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );

  return (
    <>
      {isExpanded &&
        renderPortal(
          <div
            className="editor-basico-overlay"
            onClick={() => setIsExpanded(false)}
          />
        )}

      {isExpanded ? renderPortal(editorShell) : editorShell}

      {preview &&
        renderPortal(
          <div
            className="editor-basico-preview-overlay"
            onClick={() => setPreview(null)}
          >
            {estilos}

            <div
              className="editor-basico-preview-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="editor-basico-preview-close"
                onClick={() => setPreview(null)}
                aria-label="Cerrar vista previa"
              >
                <X size={20} strokeWidth={2.7} />
              </button>

              {preview.type === "image" && (
                <img src={preview.src} alt="Vista previa" />
              )}

              {preview.type === "video" && (
                <video src={preview.src} controls autoPlay />
              )}
            </div>
          </div>
        )}
    </>
  );
});

export default EditorBasico;
