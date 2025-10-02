/**
 * Modal de edición del avatar del usuario.
 * Permite personalizar cabello, ojos, ropa, accesorios y marcos,
 * mostrando una vista previa en tiempo real.
 */

"use client";

import { useState, useEffect } from "react";
import RenderizadorAvatar, { AvatarConfig } from "./RenderizadorAvatar";

interface Props {
  open: boolean;
  onClose: () => void;
  initialConfig: AvatarConfig;
  initialFrameUrl: string | null;
  onSave: (newConfig: AvatarConfig, frameUrl: string | null) => void;
}

export default function ModalEditorAvatar({
  open,
  onClose,
  initialConfig,
  initialFrameUrl,
  onSave,
}: Props) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);
  const [frameUrl, setFrameUrl] = useState<string | null>(initialFrameUrl);
  const [currentTab, setCurrentTab] = useState("skin");

  useEffect(() => {
    if (open) {
      setConfig(initialConfig);
      setFrameUrl(initialFrameUrl);
    }
  }, [open, initialConfig, initialFrameUrl]);

  if (!open) return null;

  const TABS = [
    { key: "skin", label: "Pieles", items: ["Piel1.png"] },
    { key: "hair", label: "Cabello", items: ["none", "Cabello1.png", "Cabello2.png", "Cabello3.png", "Cabello4.png"] },
    { key: "eyes", label: "Ojos", items: ["Ojos1.png", "Ojos2.png", "Ojos3.png", "Ojos4.png", "Ojos5.png"] },
    { key: "mouth", label: "Boca", items: ["Boca1.png", "Boca2.png", "Boca3.png", "Boca4.png", "Boca5.png"] },
    { key: "nose", label: "Nariz", items: ["Nariz1.png", "Nariz2.png", "Nariz3.png", "Nariz4.png", "Nariz5.png"] },
    { key: "glasses", label: "Lentes", items: ["none", "Lentes1.png", "Lentes2.png"] },
    {
      key: "clothes",
      label: "Ropa",
      items: ["none", "Camisa1.png", "Capa1.png", "Chaqueta1.png", "Playera1.png", "Playera2.png", "Playera3.png", "Sudadera1.png", "SudaderaBuap.png"],
    },
    { key: "accessory", label: "AtuendosEspeciales", items: ["none", "CabezaLoboBuap.png"] },
    { key: "frame", label: "Marcos", items: ["none"] },
  ];

  const handleSave = () => {
    onSave(config, frameUrl);
  };

  const getCurrentValue = (tabKey: string) => {
    if (tabKey === "frame") return frameUrl ?? "none";
    const val = (config as any)[tabKey];
    return val ?? "none";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="p-6 rounded-xl w-full max-w-5xl max-h-[85vh] shadow-lg flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
      >
        <h2 className="text-2xl font-bold mb-4 text-center" style={{ color: "var(--color-heading)" }}>
          Editor de Avatar
        </h2>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Vista previa */}
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <RenderizadorAvatar config={config} frameUrl={frameUrl} size={520} />
          </div>

          {/* Controles */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  style={{
                    backgroundColor: currentTab === tab.key ? "var(--color-btn)" : "var(--color-card)",
                    color: currentTab === tab.key ? "var(--color-text-btn)" : "var(--color-muted)",
                  }}
                  className="px-3 py-1 rounded-md text-sm font-medium"
                  onClick={() => setCurrentTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenedor con scroll fijo */}
            <div className="h-[400px] overflow-y-auto pr-2">
              {/* Grid con padding en todos los lados */}
              <div className="grid grid-cols-2 gap-4 pt-2 pb-2 px-2">
                {TABS.find((t) => t.key === currentTab)?.items.map((file) => {
                  const currentValue = getCurrentValue(currentTab);
                  const isSelected = currentValue === file;

                  return (
                    <div
                      key={file}
                      className={`min-w-0 cursor-pointer rounded-lg border transition-[transform,box-shadow,border-color] duration-150
                        ${isSelected
                          ? "ring-4 ring-[var(--color-btn)] border-[var(--color-btn)] scale-[1.03]"
                          : "border-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-btn)]"}`}
                      onClick={() => {
                        if (currentTab === "frame") {
                          setFrameUrl(file === "none" ? null : file);
                        } else {
                          setConfig({ ...config, [currentTab]: file });
                        }
                      }}
                    >
                      <div className="w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)]">
                        {file === "none" ? (
                          <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                            Ninguno
                          </span>
                        ) : (
                          <img
                            src={`/ElementosAvatar/${TABS.find((t) => t.key === currentTab)?.label}/${file}`}
                            className="max-w-full max-h-full object-contain"
                            alt={file}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-6 flex justify-end gap-4">
          <button className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white" onClick={onClose}>
            Cancelar
          </button>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={handleSave}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
