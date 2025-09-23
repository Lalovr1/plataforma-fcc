/**
 * Modal de edición del avatar del usuario.
 * Permite personalizar cabello, ojos, ropa, accesorios y marcos,
 * mostrando una vista previa en tiempo real.
 */

"use client";

import { useState } from "react";
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
  const [currentTab, setCurrentTab] = useState("hair");

  if (!open) return null;

  const TABS = [
    { key: "hair", label: "Cabello", items: ["none", "default.png"] },
    { key: "eyes", label: "Ojos", items: ["none"] },
    { key: "clothes", label: "Ropa", items: ["none", "default.png"] },
    { key: "accessories", label: "Accesorios", items: ["none"] },
    { key: "skin", label: "Cuerpo", items: ["default.png"] },
    { key: "mouth", label: "Boca", items: ["none"] },
    { key: "eyebrow", label: "Cejas", items: ["none", "default.png"] },
    { key: "frame", label: "Marcos", items: ["none"] },
  ];

  const handleSave = () => {
    onSave(config, frameUrl);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-4xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-white text-center">Editor de Avatar</h2>

        <div className="flex gap-6">
          <div className="flex flex-col items-center">
            <RenderizadorAvatar config={config} frameUrl={frameUrl} size={200} />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`px-3 py-1 rounded ${
                    currentTab === tab.key
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
                  onClick={() => setCurrentTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {TABS.find((t) => t.key === currentTab)?.items.map((file) => (
                <div
                  key={file}
                  className={`cursor-pointer p-2 rounded border ${
                    (config as any)[currentTab] === file
                      ? "border-indigo-500"
                      : "border-gray-600"
                  }`}
                  onClick={() => {
                    if (currentTab === "frame") {
                      setFrameUrl(file === "none" ? null : file);
                    } else {
                      setConfig({ ...config, [currentTab]: file });
                    }
                  }}
                >
                  <div className="w-full aspect-square flex items-center justify-center bg-gray-800 rounded">
                    {file === "none" ? (
                      <span className="text-gray-400 text-sm">Ninguno</span>
                    ) : (
                      <img
                        src={`/avatars/base/${currentTab}/${file}`}
                        className="max-w-full max-h-full object-contain"
                        alt={file}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button
            className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            onClick={handleSave}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
