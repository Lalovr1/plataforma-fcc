"use client";

import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
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
} from "lucide-react";

export type EditorBasicoRef = {
  insertFormula: (latex: string) => void;
  insertLink: (text: string, url: string) => void;
  insertImage: (url: string, alt?: string) => void;
  insertVideoLink: (url: string, name: string) => void;
  insertDocumentLink: (url: string, name: string) => void;
  getHTML: () => string;
  setContent: (html: string) => void;
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
        ? "8px auto 8px 0"
        : align === "right"
        ? "8px 0 8px auto"
        : "8px auto";

    return [
      "img",
      {
        ...HTMLAttributes,
        "data-align": align,
        style: 
        `
          max-height:220px;
          max-width:100%;
          height:auto;
          border-radius:10px;
          margin:${margin};
          margin:8px auto;
          display:block;
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
    showFormulaPanelButton,
    onPasteImage,
    fillHeight,
  },
  ref
) {
  const [editorVersion, setEditorVersion] = useState(0);

  const [isExpanded, setIsExpanded] = useState(false);

  const [preview, setPreview] = useState<{
    type: "image" | "video";
    src: string;
  } | null>(null);

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
          style: "color:#2563eb;text-decoration:underline;cursor:pointer;",
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
          "min-h-[220px] outline-none max-w-none [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_p]:my-2",
      },
      handlePaste(view, event) {
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

        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;

        event.preventDefault();
        view.dispatch(view.state.tr.insertText(text));
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
            `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;cursor:pointer;">${finalText}</a>`
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
            `<p><a href="${url.trim()}" target="_blank" rel="noopener noreferrer" style="color:#d97706;text-decoration:underline;cursor:pointer;">📄 ${label}</a></p>`
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

  const botonBase =
    "w-9 h-9 rounded flex items-center justify-center text-sm font-semibold transition-colors";

  const estiloBoton = (activo: boolean) => ({
    backgroundColor: activo ? "var(--color-primary)" : "var(--color-border)",
    color: activo ? "#fff" : "var(--color-text)",
  });

  return (
    <>
      {isExpanded && (
        <div
          className="fixed top-[56px] left-0 md:left-[240px] right-0 bottom-0 bg-black bg-opacity-60 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        className={`rounded-xl border overflow-hidden ${
        isExpanded
          ? "fixed z-50 flex flex-col top-[72px] left-1/2 md:left-[calc(240px+((100vw-240px)/2))] -translate-x-1/2 w-[min(92vw,900px)] h-[calc(100vh-104px)] shadow-2xl"
          : ""
      }`}
      style={{
        backgroundColor: "var(--color-card)",
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="border-b"
        style={{
          backgroundColor: "var(--color-bg)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={botonBase}
            style={estiloBoton(editor.isActive("bold"))}
            title="Negrita"
          >
            <span style={{ fontWeight: 900, fontSize: "16px" }}>N</span>
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={botonBase}
            style={estiloBoton(editor.isActive("italic"))}
            title="Cursiva"
          >
            <span style={{ fontStyle: "italic", fontSize: "16px" }}>I</span>
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={botonBase}
            style={estiloBoton(editor.isActive("underline"))}
            title="Subrayado"
          >
            <span
              style={{
                textDecoration: "underline",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              S
            </span>
          </button>

          <div
            className="w-px h-6 mx-1"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={botonBase}
            style={estiloBoton(editor.isActive({ textAlign: "left" }))}
            title="Alinear a la izquierda"
          >
            <AlignLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={botonBase}
            style={estiloBoton(editor.isActive({ textAlign: "center" }))}
            title="Centrar"
          >
            <AlignCenter size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={botonBase}
            style={estiloBoton(editor.isActive({ textAlign: "right" }))}
            title="Alinear a la derecha"
          >
            <AlignRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={botonBase}
            style={estiloBoton(editor.isActive({ textAlign: "justify" }))}
            title="Justificar"
          >
            <AlignJustify size={16} />
          </button>

          <div
            className="w-px h-6 mx-1"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <select
            value={currentFontSize}
            onChange={(e) => {
              editor.chain().focus().setFontSize(e.target.value).run();
              setEditorVersion((n) => n + 1);
            }}
            className="rounded px-2 py-1 text-sm"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
            title="Tamaño de letra"
          >
            <option value="12px">Pequeña</option>
            <option value="16px">Normal</option>
            <option value="22px">Grande</option>
            <option value="30px">Muy grande</option>
          </select>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`${botonBase} ml-auto`}
            style={{
              backgroundColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            title={isExpanded ? "Cerrar editor expandido" : "Expandir editor"}
          >
            ⤢
          </button>
        </div>

        <div className="px-3 pb-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={onRequestFormula}
            className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
          >
            ➕ Fórmula
          </button>
          <button
            type="button"
            onClick={onRequestImage}
            className="bg-green-600 text-white text-xs px-2 py-1 rounded"
          >
            ➕ Imagen
          </button>
          <button
            type="button"
            onClick={onRequestVideo}
            className="bg-purple-600 text-white text-xs px-2 py-1 rounded"
          >
            ➕ Video
          </button>
          <button
            type="button"
            onClick={onRequestDocument}
            className="bg-yellow-600 text-white text-xs px-2 py-1 rounded"
          >
            ➕ Documento
          </button>
          <button
            type="button"
            onClick={onRequestLink}
            className="bg-pink-600 text-white text-xs px-2 py-1 rounded"
          >
            ➕ Enlace
          </button>

          {showFormulaPanelButton && (
            <button
              type="button"
              onClick={onRequestFormulaPanel}
              className="ml-auto bg-slate-700 text-white text-xs px-3 py-1 rounded flex items-center gap-1"
              title="Gestionar fórmulas del bloque"
            >
              Fórmulas <span>&gt;</span>
            </button>
          )}
        </div>
      </div>

      <div
        className="p-4 overflow-y-auto"
        style={{
          height: fillHeight
            ? "calc(100vh - 430px)"
            : isExpanded
            ? "calc(100vh - 260px)"
            : undefined,
          maxHeight: fillHeight
            ? "calc(100vh - 430px)"
            : isExpanded
            ? "calc(100vh - 260px)"
            : "420px",
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

      {preview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.type === "image" && (
              <img
                src={preview.src}
                className="max-w-full max-h-[90vh] rounded-lg"
              />
            )}

            {preview.type === "video" && (
              <video
                src={preview.src}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  </>
  );
});

export default EditorBasico;