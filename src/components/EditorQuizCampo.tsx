"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageBase from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";

export type EditorQuizCampoRef = {
  insertFormula: (latex: string) => void;
  insertImage: (url: string, alt?: string) => void;
  getHTML: () => string;
  setContent: (html: string) => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  onUploadImage?: (file: File) => Promise<{ url: string; name: string }>;
};

const CustomImage = ImageBase.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      {
        ...HTMLAttributes,
        style: `
          max-height:140px;
          max-width:100%;
          height:auto;
          border-radius:8px;
          margin:6px auto;
          display:block;
        `,
      },
    ];
  },
});

const cleanEmptyEditorHtml = (html: string) => {
  const cleaned = html.trim();

  if (
    cleaned === "" ||
    cleaned === "<p></p>" ||
    cleaned === "<p><br></p>" ||
    cleaned === "<p>&nbsp;</p>"
  ) {
    return "";
  }

  const textOnly = cleaned
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, "")
    .trim();

  const hasMath =
    cleaned.includes('data-type="inline-math"') ||
    cleaned.includes("data-type='inline-math'");

  const hasImage = /<img\b/i.test(cleaned);

  if (!textOnly && !hasMath && !hasImage) {
    return "";
  }

  return html;
};

const markdownMathToTiptapHtml = (value: string) => {
  if (!value) return "";

  const trimmed = value.trim();

  if (!trimmed) return "";

  const hasExistingHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

  if (hasExistingHtml) {
    return trimmed;
  }

  const escaped = trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withMath = escaped.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
    const cleanLatex = String(latex).trim().replace(/"/g, "&quot;");

    return `<span data-type="inline-math" data-latex="${cleanLatex}"></span>`;
  });

  return `<p>${withMath}</p>`;
};

const EditorQuizCampo = forwardRef<EditorQuizCampoRef, Props>(
  function EditorQuizCampo(
    {
      value,
      onChange,
      placeholder = "Escribe aquí",
      compact = false,
      onUploadImage,
    },
    ref
  ) {
    const [showFormulaModal, setShowFormulaModal] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState("");

    const [showImageModal, setShowImageModal] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit,
        CustomImage.configure({
          inline: false,
          allowBase64: false,
        }),
        Mathematics.configure({
          katexOptions: {
            throwOnError: false,
          },
        }),
      ],
      content: markdownMathToTiptapHtml(value),
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "min-h-[20px] outline-none max-w-none break-words leading-[20px] [&_p]:my-0 [&_.tiptap]:outline-none",
        },
      },
      onUpdate({ editor }) {
        onChange(cleanEmptyEditorHtml(editor.getHTML()));
      },
    });

    useEffect(() => {
        if (!editor) return;

        const nextRaw = markdownMathToTiptapHtml(value || "");
        const currentNormalized = cleanEmptyEditorHtml(editor.getHTML() || "");
        const nextNormalized = cleanEmptyEditorHtml(nextRaw || "");

        if (currentNormalized !== nextNormalized) {
            editor.commands.setContent(nextRaw || "");
        }
    }, [editor, value]);

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
                alt: alt || "Imagen del quiz",
              },
            })
            .run();
        },

        getHTML() {
          return cleanEmptyEditorHtml(editor?.getHTML() || "");
        },

        setContent(html: string) {
          editor?.commands.setContent(
            markdownMathToTiptapHtml(cleanEmptyEditorHtml(html || ""))
          );
        },
      }),
      [editor]
    );

    if (!editor) return null;

    return (
      <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
        <div
          className="w-full rounded px-3 py-1.5 text-sm min-h-[34px] flex flex-col justify-center"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;

            if (target.tagName === "IMG") {
              const src = target.getAttribute("src");
              if (src) setPreviewImage(src);
            }
          }}
        >
          <EditorContent editor={editor} />

          {editor.isEmpty && (
            <div
              className="pointer-events-none text-sm -mt-[20px] leading-[20px]"
              style={{ color: "var(--color-muted)" }}
            >
              {placeholder}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFormulaModal(true)}
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded h-[34px] shrink-0 self-start"
        >
          ➕ Fórmula
        </button>

        <button
          type="button"
          onClick={() => setShowImageModal(true)}
          className="bg-green-600 text-white text-xs px-3 py-1 rounded h-[34px] shrink-0 self-start"
        >
          ➕ Imagen
        </button>

        {showFormulaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130] p-3 sm:p-4">
            <div
              className="rounded-xl p-4 sm:p-5 w-full max-w-md"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3 className="font-bold mb-3">Insertar fórmula</h3>

              <textarea
                value={formulaLatex}
                onChange={(e) => setFormulaLatex(e.target.value)}
                rows={3}
                className="w-full rounded px-3 py-2 mb-3"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                placeholder="Ej. x + 1"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormulaLatex("");
                    setShowFormulaModal(false);
                  }}
                  className="px-3 py-1 rounded"
                  style={{
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!formulaLatex.trim()) return;

                    editor
                      .chain()
                      .focus()
                      .insertContent({
                        type: "inlineMath",
                        attrs: {
                          latex: formulaLatex.trim(),
                        },
                      })
                      .run();

                    setFormulaLatex("");
                    setShowFormulaModal(false);
                  }}
                  className="px-3 py-1 rounded bg-green-600 text-white"
                >
                  Insertar
                </button>
              </div>
            </div>
          </div>
        )}

        {showImageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130] p-3 sm:p-4">
            <div
              className="rounded-xl p-4 sm:p-5 w-full max-w-md"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3 className="font-bold mb-3">Insertar imagen</h3>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full rounded px-3 py-2 mb-3 text-sm"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setShowImageModal(false);
                  }}
                  className="px-3 py-1 rounded"
                  style={{
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!imageFile || uploadingImage}
                  onClick={async () => {
                    if (!imageFile || !onUploadImage) return;

                    setUploadingImage(true);

                    try {
                      const { url, name } = await onUploadImage(imageFile);

                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: "image",
                          attrs: {
                            src: url,
                            alt: name,
                          },
                        })
                        .run();

                      setImageFile(null);
                      setShowImageModal(false);
                    } catch (error) {
                      console.error(error);
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                  className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                >
                  {uploadingImage ? "Subiendo..." : "Insertar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {previewImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[140] p-3"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage}
              className="max-w-full max-h-[90vh] rounded-lg"
              alt="Vista ampliada"
            />
          </div>
        )}
      </div>
    );
  }
);

export default EditorQuizCampo;