/**
 * Renderiza el avatar del usuario en base a una configuración de capas.
 * Cada capa corresponde a una parte del avatar (piel, ojos, ropa, etc.)
 */

"use client";

export type AvatarConfig = {
  skin: string;
  eyes?: string | null;
  mouth?: string | null;
  hair?: string | null;
  clothes?: string | null;
  accessory?: string | null;
  nose?: string | null;
  glasses?: string | null;
};

interface Props {
  config?: AvatarConfig | null;
  frameUrl?: string | null;
  size?: number;
}

export default function RenderizadorAvatar({ config, frameUrl, size = 150 }: Props) {
  const defaultConfig: AvatarConfig = {
    skin: "Piel1.png",
    eyes: "none",
    mouth: "none",
    hair: "none",
    clothes: "none",
    accessory: "none",
    nose: "none",
    glasses: "none",
  };

  const safeConfig = config ?? defaultConfig;

  const folderMap: Record<string, string> = {
    skin: "Pieles",
    eyes: "Ojos",
    mouth: "Boca",
    clothes: "Ropa",
    hair: "Cabello",
    nose: "Nariz",
    glasses: "Lentes",
    accessory: "AtuendosEspeciales",
  };

  const layers: Array<[keyof AvatarConfig, string | undefined | null]> = [
    ["skin", safeConfig.skin],
    ["eyes", safeConfig.eyes],
    ["mouth", safeConfig.mouth],
    ["clothes", safeConfig.clothes],
    ["hair", safeConfig.hair],
    ["nose", safeConfig.nose],
    ["glasses", safeConfig.glasses],
    ["accessory", safeConfig.accessory],
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {layers.map(([folder, file]) =>
        file && file !== "none" ? (
          <img
            key={`${folder}-${file}`}
            src={`/ElementosAvatar/${folderMap[folder]}/${file}`}
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            alt={folder}
            draggable={false}
          />
        ) : null
      )}

      {frameUrl && (
        <img
          src={`/avatars/frames/${frameUrl}`}
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          alt="frame"
          draggable={false}
        />
      )}
    </div>
  );
}
