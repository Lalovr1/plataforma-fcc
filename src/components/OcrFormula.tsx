"use client";

import { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Props {
  onResult: (titulo: string, ecuacion: string) => void;
}

export default function OcrFormula({ onResult }: Props) {
  const [image, setImage] = useState<string>();
  const cropperRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [ecuacion, setEcuacion] = useState("");

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCrop = async () => {
    const cropper = (cropperRef.current as any)?.cropper;
    const croppedImage = cropper?.getCroppedCanvas().toDataURL("image/png");
    if (!croppedImage) return;

    setLoading(true);
    try {
      const isLocal = process.env.NODE_ENV === "development";
      const endpoint = isLocal
        ? process.env.NEXT_PUBLIC_OCR_URL_LOCAL
        : process.env.NEXT_PUBLIC_OCR_URL_REMOTE;

      const response = await fetch(endpoint as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: croppedImage.replace(/^data:image\/\w+;base64,/, ""),
        }),
      });

      const data = await response.json();

      const resultado = data.ecuacion || data.latex;
      if (resultado) {
        setEcuacion(resultado);
        onResult(titulo, resultado);
      } else {
        console.warn("OCR no devolvió ni ecuacion ni latex:", data);
      }
    } catch (err) {
      console.error("Error OCR:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ocr-formula">
      <style>{`
        .ocr-formula {
          --ocr-accent: var(--fcc-premium-accent, var(--color-primary));
          --ocr-surface: var(--fcc-premium-surface, var(--color-card));
          --ocr-surface-soft: var(--fcc-premium-surface-soft, var(--color-card));
          --ocr-surface-strong: var(--fcc-premium-surface-strong, var(--color-card));
          --ocr-text: var(--fcc-premium-text, var(--color-text));
          --ocr-muted: var(--fcc-premium-muted, var(--color-muted));
          --ocr-border: var(--fcc-premium-border, var(--color-border));
          display: grid;
          gap: 14px;
          min-width: 0;
          color: var(--ocr-text);
        }

        .ocr-formula-picker {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          padding: 0 14px;
          color: var(--ocr-text);
          background: color-mix(in srgb, var(--ocr-surface-strong) 74%, transparent);
          border: 1px solid var(--ocr-border);
          font-size: 0.92rem;
          font-weight: 900;
          text-align: center;
          cursor: pointer;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease;
        }

        .ocr-formula-picker:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--ocr-accent) 42%, var(--ocr-border));
          background: color-mix(in srgb, var(--ocr-accent) 8%, var(--ocr-surface-strong));
        }

        .ocr-formula-picker input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .ocr-formula-stack {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .ocr-formula-cropper {
          overflow: hidden;
          border-radius: 18px;
          background: var(--ocr-surface);
          border: 1px solid var(--ocr-border);
        }

        .ocr-formula-cropper .cropper-container {
          font-size: 0;
        }

        .ocr-formula-button {
          min-height: 42px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 0 16px;
          color: #ffffff;
          background: var(--ocr-accent);
          border: 1px solid color-mix(in srgb, var(--ocr-accent) 68%, white);
          font-size: 0.9rem;
          font-weight: 950;
          text-align: center;
          transition:
            transform 170ms ease,
            opacity 170ms ease,
            filter 170ms ease;
        }

        .ocr-formula-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .ocr-formula-button:disabled {
          cursor: not-allowed;
          opacity: 0.68;
        }

        .theme-oscuro .ocr-formula-button {
          color: #050505;
        }

        .ocr-formula-input,
        .ocr-formula-textarea {
          width: 100%;
          border-radius: 14px;
          color: var(--ocr-text);
          background: color-mix(in srgb, var(--ocr-surface-strong) 74%, transparent);
          border: 1px solid var(--ocr-border);
          outline: none;
          font-size: 0.92rem;
          font-weight: 750;
          transition:
            border-color 170ms ease,
            background 170ms ease;
        }

        .ocr-formula-input {
          min-height: 44px;
          padding: 0 13px;
        }

        .ocr-formula-textarea {
          min-height: 92px;
          padding: 12px 13px;
          resize: none;
          line-height: 1.45;
        }

        .ocr-formula-input:focus,
        .ocr-formula-textarea:focus {
          border-color: color-mix(in srgb, var(--ocr-accent) 56%, var(--ocr-border));
          background: color-mix(in srgb, var(--ocr-surface-strong) 90%, transparent);
        }

        .ocr-formula-preview {
          border-radius: 16px;
          padding: 14px;
          color: var(--ocr-text);
          background: color-mix(in srgb, var(--ocr-surface-strong) 58%, transparent);
          border: 1px solid var(--ocr-border);
          text-align: center;
          overflow-x: auto;
        }

        .ocr-formula-preview-label {
          margin: 0 0 8px;
          color: var(--ocr-muted);
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ocr-formula-empty {
          color: var(--ocr-muted);
          font-size: 0.88rem;
          font-weight: 800;
        }

        .ocr-formula-preview .katex-display {
          margin: 0.25em 0;
        }

        .ocr-formula-preview .katex {
          font-size: 0.96em;
        }
      `}</style>

      {!image && (
        <label className="ocr-formula-picker">
          Seleccionar imagen de la fórmula
          <input type="file" accept="image/*" onChange={onSelectFile} />
        </label>
      )}

      {image && (
        <div className="ocr-formula-stack">
          <div className="ocr-formula-cropper">
            <Cropper
              src={image}
              style={{ height: 250, width: "100%" }}
              aspectRatio={0}
              guides={true}
              ref={cropperRef}
            />
          </div>

          <button
            type="button"
            onClick={handleCrop}
            disabled={loading}
            className="ocr-formula-button"
          >
            {loading ? "Procesando..." : "Recortar y convertir"}
          </button>

          {/* === BLOQUE: Título, Latex editable y Vista previa === */}
          <div className="ocr-formula-stack">
            <input
              type="text"
              placeholder="Título (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={loading}
              className="ocr-formula-input"
            />

            <textarea
              rows={3}
              value={ecuacion}
              onChange={(e) => setEcuacion(e.target.value)}
              disabled={loading}
              className="ocr-formula-textarea"
            />

            <div className="ocr-formula-preview">
              <p className="ocr-formula-preview-label">Vista previa</p>

              {ecuacion ? (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {`$$${ecuacion}$$`}
                </ReactMarkdown>
              ) : (
                <span className="ocr-formula-empty">
                  Aún no hay ecuación detectada
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
