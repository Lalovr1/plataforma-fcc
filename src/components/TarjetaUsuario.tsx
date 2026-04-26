/**
 * Tarjeta de usuario que muestra el avatar, nombre, nivel y un botón
 * para acceder al perfil. Se adapta según el rol (estudiante/profesor).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface TarjetaUsuarioProps {
  name?: string;
  level?: number;
  avatarConfig?: AvatarConfig | null;
  rol?: "estudiante" | "profesor";
}

export default function TarjetaUsuario({
  name = "Usuario",
  level = 0,
  avatarConfig,
  rol = "estudiante",
}: TarjetaUsuarioProps) {

  const defaultConfig: AvatarConfig = {
    gender: "masculino",
    skin: "base/masculino/piel.png",
    skinColor: "#f1c27d",
    eyes: "Ojos1.png",
    mouth: "Boca1.png",
    nose: "Nariz1.png",
    glasses: "none",
    hair: "Cabello1.png",
    playera: "Playera1",
    sueter: "none",
    collar: "none",
    pulsera: "none",
    accessory: "none",
  };

  const [avatar, setAvatar] = useState<AvatarConfig>(avatarConfig ?? defaultConfig);

  //  Escuchar cambios del avatar en tiempo real (por tutorial o editor)
  useEffect(() => {
    const handler = () => {
      const savedConfig = localStorage.getItem("avatar_config");
      if (savedConfig) {
        setAvatar(JSON.parse(savedConfig));
      }
    };
    window.addEventListener("avatarActualizado", handler);
    return () => window.removeEventListener("avatarActualizado", handler);
  }, []);

  useEffect(() => {
    if (avatarConfig) setAvatar(avatarConfig);
  }, [avatarConfig]);

  const perfilUrl =
    rol === "profesor"
      ? "/dashboard/profesor/perfil"
      : "/dashboard/estudiante/perfil";

  const [tutorialActivo, setTutorialActivo] = useState<boolean>(() =>
    typeof window !== "undefined" ? !!(window as any).__tutorialActivo : false
  );

  useEffect(() => {
    const handler = (e: any) => setTutorialActivo(!!e.detail?.activo);
    window.addEventListener("tutorial:estado", handler);

    setTutorialActivo(
      typeof window !== "undefined" ? !!(window as any).__tutorialActivo : false
    );

    return () => window.removeEventListener("tutorial:estado", handler);
  }, []);

  return (
    <div
      className="rounded-xl px-4 sm:px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 lg:gap-12 shadow-md overflow-hidden"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
        minHeight: "clamp(180px, 24vw, 250px)",
        pointerEvents: tutorialActivo ? "none" : "auto", //  bloquea clics durante tutorial
      }}
    >
      {/* Avatar */}
      <div className="shrink-0 flex justify-center items-center">
        <div className="scale-[0.65] sm:scale-[0.8] lg:scale-100 origin-center">
          <RenderizadorAvatar config={avatar} size={300} />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight truncate"
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
