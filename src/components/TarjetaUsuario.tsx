/**
 * Tarjeta de usuario que muestra el avatar, nombre, nivel y un botón
 * para acceder al perfil. Se adapta según el rol (estudiante/profesor).
 */

"use client";

import Link from "next/link";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface TarjetaUsuarioProps {
  name?: string;
  level?: number;
  avatarConfig?: AvatarConfig | null;
  frameUrl?: string | null;
  rol?: "estudiante" | "profesor";
}

export default function TarjetaUsuario({
  name = "Usuario",
  level = 0,
  avatarConfig,
  frameUrl,
  rol = "estudiante",
}: TarjetaUsuarioProps) {
  const defaultConfig: AvatarConfig = {
    skin: "default.png",
    eyes: "none",
    mouth: "none",
    eyebrow: "none",
    hair: "none",
    clothes: "none",
    accessory: null,
  };

  const perfilUrl =
    rol === "profesor"
      ? "/dashboard/profesor/perfil"
      : "/dashboard/estudiante/perfil";

  return (
    <div
      className="
        rounded-xl px-8 py-10 flex items-center gap-10
        shadow-md
      "
      style={{ backgroundColor: "#B8C3CA", minHeight: "180px" }}
    >
      <div className="shrink-0">
        <RenderizadorAvatar
          config={avatarConfig ?? defaultConfig}
          frameUrl={frameUrl}
          size={130}
        />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-3xl font-bold leading-tight truncate text-black">
          Bienvenido, {name}
        </h2>
        <p className="text-lg text-gray-800 mt-1">Nivel {level}</p>

        <Link href={perfilUrl}>
          <button className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
            Ver perfil
          </button>
        </Link>
      </div>
    </div>
  );
}
