/**
 * Renderiza el avatar del usuario en base a una configuración de capas.
 * Cada capa corresponde a una parte del avatar (piel, ojos, ropa, etc.)
 * y puede incluir un marco opcional encima.
 */

"use client";

export type AvatarConfig = {
  skin: string;
  eyes?: string | null;
  mouth?: string | null;
  eyebrow?: string | null;
  hair?: string | null;
  clothes?: string | null;
  accessory?: string | null;
};

interface Props {
  config?: AvatarConfig | null;
  frameUrl?: string | null;
  size?: number;
}

export default function RenderizadorAvatar({ config, frameUrl, size = 150 }: Props) {
  const defaultConfig: AvatarConfig = {
    skin: "default.png",
    eyes: "none",
    mouth: "none",
    eyebrow: "none",
    hair: "none",
    clothes: "none",
    accessory: null,
  };

  const safeConfig = config ?? defaultConfig;

  const layers: Array<[string, string | undefined | null]> = [
    ["skin", safeConfig.skin],
    ["eyes", safeConfig.eyes],
    ["mouth", safeConfig.mouth],
    ["eyebrow", safeConfig.eyebrow],
    ["hair", safeConfig.hair],
    ["clothes", safeConfig.clothes],
    ["accessory", safeConfig.accessory],
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {layers.map(([folder, file]) =>
        file && file !== "none" ? (
          <img
            key={`${folder}-${file}`}
            src={`/avatars/base/${folder}/${file}`}
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
