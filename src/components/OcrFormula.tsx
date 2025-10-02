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
    <div>
      {!image && <input type="file" accept="image/*" onChange={onSelectFile} />}
      {image && (
        <div>
          <Cropper
            src={image}
            style={{ height: 250, width: "100%" }}
            aspectRatio={0}
            guides={true}
            ref={cropperRef}
          />
          <button
            onClick={handleCrop}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? "Procesando..." : "Recortar y convertir"}
          </button>

          {/* === BLOQUE: Título, Latex editable y Vista previa === */}
          <div className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Título (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={loading}
              className="w-full rounded px-3 py-2 border border-gray-600"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
              }}
            />

            <textarea
              rows={3}
              value={ecuacion}
              onChange={(e) => setEcuacion(e.target.value)}
              disabled={loading}
              className="w-full rounded px-3 py-2 border border-gray-600 resize-none"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
              }}
            />

            <div
              className="rounded p-3 text-center"
              style={{
                backgroundColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <p
                className="text-xs mb-2"
                style={{ color: "var(--color-muted)" }}
              >
                Vista previa:
              </p>
              {ecuacion ? (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {`$$${ecuacion}$$`}
                </ReactMarkdown>
              ) : (
                <span
                  className="text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
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
