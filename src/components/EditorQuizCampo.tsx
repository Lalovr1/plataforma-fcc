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
          border-radius:12px;
          margin:6px auto;
          display:block;
          border:1px solid var(--editor-quiz-border, transparent);
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
      <div className={`editor-quiz-campo ${compact ? "compact" : ""}`}>
        <style>{`
          .editor-quiz-campo,
          .editor-quiz-overlay {
            --editor-quiz-accent: var(--fcc-premium-accent, var(--color-accent));
            --editor-quiz-cyan: var(--fcc-premium-cyan, var(--color-accent));
            --editor-quiz-surface: var(--fcc-premium-surface, var(--color-card));
            --editor-quiz-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
            --editor-quiz-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
            --editor-quiz-text: var(--fcc-premium-text, var(--color-text));
            --editor-quiz-muted: var(--fcc-premium-muted, var(--color-muted));
            --editor-quiz-border: var(--fcc-premium-border, var(--color-border));
            --editor-quiz-shadow: var(--fcc-premium-shadow, 0 24px 70px rgba(2, 8, 23, 0.18));
          }

          .editor-quiz-campo {
            width: 100%;
            min-width: 0;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            color: var(--editor-quiz-text);
          }

          .editor-quiz-box {
            width: 100%;
            min-width: 0;
            min-height: 36px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-radius: 14px;
            padding: 8px 11px;
            color: var(--editor-quiz-text);
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 74%, transparent);
            border: 1px solid var(--editor-quiz-border);
            transition:
              border-color 170ms ease,
              background 170ms ease,
              box-shadow 170ms ease;
          }

          .editor-quiz-box:focus-within {
            border-color: color-mix(in srgb, var(--editor-quiz-accent) 52%, var(--editor-quiz-border));
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 88%, transparent);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--editor-quiz-accent) 10%, transparent);
          }

          .editor-quiz-box .ProseMirror {
            min-height: 20px;
            outline: none;
            color: var(--editor-quiz-text);
            font-size: 0.9rem;
            font-weight: 760;
            line-height: 1.35;
          }

          .editor-quiz-box .ProseMirror p {
            margin: 0;
          }

          .editor-quiz-box .ProseMirror img {
            cursor: zoom-in;
          }

          .editor-quiz-placeholder {
            pointer-events: none;
            margin-top: -20px;
            color: var(--editor-quiz-muted);
            font-size: 0.88rem;
            font-weight: 750;
            line-height: 20px;
          }

          .editor-quiz-toolbar {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            gap: 7px;
          }

          .editor-quiz-action {
            min-height: 36px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            padding: 0 11px;
            color: var(--editor-quiz-text);
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 76%, transparent);
            border: 1px solid var(--editor-quiz-border);
            font-size: 0.75rem;
            font-weight: 950;
            white-space: nowrap;
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              background 170ms ease;
          }

          .editor-quiz-action:hover {
            transform: translateY(-1px);
          }

          .editor-quiz-action.formula {
            color: color-mix(in srgb, #3b82f6 68%, var(--editor-quiz-text));
            background: color-mix(in srgb, #3b82f6 7%, var(--editor-quiz-surface-strong));
            border-color: color-mix(in srgb, #3b82f6 18%, var(--editor-quiz-border));
          }

          .editor-quiz-action.image {
            color: color-mix(in srgb, #10b981 68%, var(--editor-quiz-text));
            background: color-mix(in srgb, #10b981 7%, var(--editor-quiz-surface-strong));
            border-color: color-mix(in srgb, #10b981 18%, var(--editor-quiz-border));
          }

          .editor-quiz-overlay {
            position: fixed;
            inset: 0;
            z-index: 130;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 14px;
            background: rgba(2, 8, 23, 0.58);
            backdrop-filter: blur(8px);
          }

          .editor-quiz-modal {
            width: min(94vw, 460px);
            overflow: hidden;
            border-radius: 26px;
            padding: 20px;
            color: var(--editor-quiz-text);
            background:
              linear-gradient(
                135deg,
                var(--editor-quiz-surface),
                var(--editor-quiz-surface-soft)
              );
            border: 1px solid color-mix(in srgb, var(--editor-quiz-accent) 14%, var(--editor-quiz-border));
            box-shadow: var(--editor-quiz-shadow);
          }

          .editor-quiz-modal-title {
            margin: 0 0 14px;
            color: var(--editor-quiz-text);
            font-size: 1.12rem;
            font-weight: 950;
            line-height: 1.08;
            letter-spacing: -0.035em;
            text-align: center;
          }

          .editor-quiz-textarea {
            width: 100%;
            min-height: 96px;
            border-radius: 14px;
            padding: 12px 13px;
            color: var(--editor-quiz-text);
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 74%, transparent);
            border: 1px solid var(--editor-quiz-border);
            outline: none;
            resize: none;
            font-size: 0.92rem;
            font-weight: 760;
            line-height: 1.45;
            transition:
              border-color 170ms ease,
              background 170ms ease;
          }

          .editor-quiz-textarea:focus {
            border-color: color-mix(in srgb, var(--editor-quiz-accent) 52%, var(--editor-quiz-border));
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 88%, transparent);
          }

          .editor-quiz-file-picker {
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
            padding: 0 14px;
            color: var(--editor-quiz-text);
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 74%, transparent);
            border: 1px solid var(--editor-quiz-border);
            font-size: 0.92rem;
            font-weight: 900;
            text-align: center;
            cursor: pointer;
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              background 170ms ease;
          }

          .editor-quiz-file-picker:hover {
            transform: translateY(-1px);
            border-color: color-mix(in srgb, var(--editor-quiz-accent) 42%, var(--editor-quiz-border));
            background: color-mix(in srgb, var(--editor-quiz-accent) 8%, var(--editor-quiz-surface-strong));
          }

          .editor-quiz-file-picker input {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
          }

          .editor-quiz-file-name {
            margin: 10px 0 0;
            color: var(--editor-quiz-muted);
            font-size: 0.82rem;
            font-weight: 800;
            text-align: center;
            overflow-wrap: anywhere;
          }

          .editor-quiz-modal-actions {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
          }

          .editor-quiz-modal-button {
            min-height: 38px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            padding: 0 15px;
            color: var(--editor-quiz-text);
            background: color-mix(in srgb, var(--editor-quiz-surface-strong) 76%, transparent);
            border: 1px solid var(--editor-quiz-border);
            font-size: 0.84rem;
            font-weight: 950;
            transition:
              transform 170ms ease,
              opacity 170ms ease,
              border-color 170ms ease;
          }

          .editor-quiz-modal-button:hover:not(:disabled) {
            transform: translateY(-1px);
            border-color: color-mix(in srgb, var(--editor-quiz-accent) 28%, var(--editor-quiz-border));
          }

          .editor-quiz-modal-button.primary {
            color: #ffffff;
            background: var(--editor-quiz-accent);
            border-color: color-mix(in srgb, var(--editor-quiz-accent) 64%, white);
          }

          .theme-oscuro .editor-quiz-modal-button.primary {
            color: #050505;
          }

          .editor-quiz-modal-button:disabled {
            cursor: not-allowed;
            opacity: 0.58;
          }

          .editor-quiz-preview-overlay {
            position: fixed;
            inset: 0;
            z-index: 140;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 14px;
            background: rgba(2, 8, 23, 0.72);
            backdrop-filter: blur(6px);
          }

          .editor-quiz-preview-image {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 18px;
            border: 1px solid color-mix(in srgb, white 18%, transparent);
            box-shadow: var(--editor-quiz-shadow);
          }

          @media (max-width: 640px) {
            .editor-quiz-campo {
              flex-direction: column;
            }

            .editor-quiz-toolbar {
              width: 100%;
              display: grid;
              grid-template-columns: 1fr 1fr;
            }

            .editor-quiz-action {
              width: 100%;
            }

            .editor-quiz-modal {
              padding: 18px;
              border-radius: 22px;
            }

            .editor-quiz-modal-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>

        <div
          className="editor-quiz-box"
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
            <div className="editor-quiz-placeholder">
              {placeholder}
            </div>
          )}
        </div>

        <div className="editor-quiz-toolbar">
          <button
            type="button"
            onClick={() => setShowFormulaModal(true)}
            className="editor-quiz-action formula"
          >
            + Fórmula
          </button>

          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="editor-quiz-action image"
          >
            + Imagen
          </button>
        </div>

        {showFormulaModal && (
          <div className="editor-quiz-overlay">
            <div className="editor-quiz-modal">
              <h3 className="editor-quiz-modal-title">Insertar fórmula</h3>

              <textarea
                value={formulaLatex}
                onChange={(e) => setFormulaLatex(e.target.value)}
                rows={3}
                className="editor-quiz-textarea"
                placeholder="Ej. x + 1"
              />

              <div className="editor-quiz-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setFormulaLatex("");
                    setShowFormulaModal(false);
                  }}
                  className="editor-quiz-modal-button"
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
                  className="editor-quiz-modal-button primary"
                >
                  Insertar
                </button>
              </div>
            </div>
          </div>
        )}

        {showImageModal && (
          <div className="editor-quiz-overlay">
            <div className="editor-quiz-modal">
              <h3 className="editor-quiz-modal-title">Insertar imagen</h3>

              <label className="editor-quiz-file-picker">
                {imageFile ? "Cambiar imagen" : "Seleccionar imagen"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>

              {imageFile && (
                <p className="editor-quiz-file-name">{imageFile.name}</p>
              )}

              <div className="editor-quiz-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setShowImageModal(false);
                  }}
                  className="editor-quiz-modal-button"
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
                  className="editor-quiz-modal-button primary"
                >
                  {uploadingImage ? "Subiendo..." : "Insertar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {previewImage && (
          <div
            className="editor-quiz-preview-overlay"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage}
              className="editor-quiz-preview-image"
              alt="Vista ampliada"
            />
          </div>
        )}
      </div>
    );
  }
);

export default EditorQuizCampo;
