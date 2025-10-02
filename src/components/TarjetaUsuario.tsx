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
    skin: "Piel1.png",
    eyes: "Ojos1.png",
    hair: "none",
    mouth: "Boca1.png",
    nose: "Nariz1.png",
    glasses: "none",
    clothes: "none",
    accessory: "none",
  };

  const perfilUrl =
    rol === "profesor"
      ? "/dashboard/profesor/perfil"
      : "/dashboard/estudiante/perfil";

  return (
    <div
      className="
        rounded-xl px-10 py-3 flex items-center gap-12
        shadow-md
      "
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
        minHeight: "250px",
      }}
    >
      <div className="shrink-0">
        <RenderizadorAvatar
          config={avatarConfig ?? defaultConfig}
          frameUrl={frameUrl}
          size={300} 
        />
      </div>

      <div className="flex-1 min-w-0">
        <h2
          className="text-4xl font-bold leading-tight truncate" 
          style={{ color: "var(--color-heading)" }}
        >
          {rol === "profesor"
          ? `Bienvenido, profesor ${name}`
          : `Bienvenido, ${name}`}
        </h2>
        {rol === "estudiante" && (
          <p className="text-xl mt-2" style={{ color: "var(--color-muted)" }}>
            Nivel {level}
          </p>
        )}

        <Link href={perfilUrl}>
          <button className="mt-5 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
            Ver perfil
          </button>
        </Link>
      </div>
    </div>
  );
}
