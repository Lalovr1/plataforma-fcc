/**
 * Renderiza el avatar del usuario con su marco decorativo.
 * Soporta avatar y marco personalizados, además de ajustar el tamaño.
 */

import Image from "next/image";

type AvatarConMarcoProps = {
  avatarUrl?: string;
  frameUrl?: string;
  size?: number;
};

export default function AvatarConMarco({
  avatarUrl = "/avatars/default/avatar.png",
  frameUrl = "/avatars/default/frame.png",
  size = 64,
}: AvatarConMarcoProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={avatarUrl}
        alt="Avatar del usuario"
        width={size}
        height={size}
        className="rounded-full object-cover"
      />

      <Image
        src={frameUrl}
        alt="Marco decorativo"
        width={size}
        height={size}
        className="absolute top-0 left-0"
      />
    </div>
  );
}
