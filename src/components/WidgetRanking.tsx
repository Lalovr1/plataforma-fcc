/**
 * Muestra el ranking global de los 5 mejores jugadores.
 * Incluye un podio visual para el Top 3 y lista para 4° y 5° lugar.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  avatar_config?: AvatarConfig | null;
}

export default function WidgetRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config")
        .eq("rol", "estudiante")
        .order("puntos", { ascending: false })
        .limit(5);

      if (!error && data) {
        setUsuarios(data);
      }
    };

    fetchRanking();
  }, []);

  const defaultConfig: AvatarConfig = {
    gender: "masculino",
    skin: "base/masculino/piel.png",
    skinColor: "#f1c27d",
    eyes: "cara/ojos/masculino/Ojos1.png",
    mouth: "cara/bocas/Boca1.png",
    nose: "cara/narices/Nariz1.png",
    glasses: "none",
    hair: "cabello/masculino/Cabello1.png",
    playera: "Playera1",
    sueter: "none",
    collar: "none",
    pulsera: "none",
    accessory: "none",
  };

  if (usuarios.length === 0) {
    return (
      <div
        className="rounded-lg p-4 shadow-lg text-center"
        style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
      >
        <h2
          className="text-lg font-bold mb-4"
          style={{ color: "var(--color-accent)" }}
        >
          🏆 TOP 5 GLOBAL
        </h2>
        <p style={{ color: "var(--color-muted)" }}>
          Aún no hay jugadores en el ranking.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-6 shadow-lg text-center"
      style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
    >
      <h2
        className="text-xl font-bold mb-6"
        style={{ color: "var(--color-accent)" }}
      >
        🏆 TOP 5 GLOBAL
      </h2>

      <div className="flex justify-center items-end gap-8 mb-6">
        {usuarios[1] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={100}
              config={usuarios[1].avatar_config ?? defaultConfig}
            />
            <p className="mt-2" style={{ color: "var(--color-text)" }}>
              {usuarios[1].nombre}
            </p>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {usuarios[1].puntos} pts
            </span>
            <span className="font-bold" style={{ color: "var(--color-muted)" }}>
              🥈 #2
            </span>
          </div>
        )}

        {usuarios[0] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={180}
              config={usuarios[0].avatar_config ?? defaultConfig}
            />
            <p className="text-xl font-bold mt-2" style={{ color: "var(--color-heading)" }}>
              {usuarios[0].nombre}
            </p>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {usuarios[0].puntos} pts
            </span>
            <span className="font-bold" style={{ color: "var(--color-accent)" }}>
              🥇 #1
            </span>
          </div>
        )}

        {usuarios[2] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={100}
              config={usuarios[2].avatar_config ?? defaultConfig}
            />
            <p className="mt-2" style={{ color: "var(--color-text)" }}>
              {usuarios[2].nombre}
            </p>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {usuarios[2].puntos} pts
            </span>
            <span className="font-bold" style={{ color: "var(--color-muted)" }}>
              🥉 #3
            </span>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {usuarios.slice(3).map((user, idx) => (
          <li
            key={user.id}
            className="flex items-center justify-between px-4 py-2 rounded transition"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center space-x-3">
              <span
                className="font-bold"
                style={{ color: "var(--color-muted)" }}
              >
                #{idx + 4}
              </span>
              <RenderizadorAvatar
                size={60}
                config={user.avatar_config ?? defaultConfig}
              />
              <p>{user.nombre}</p>
            </div>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {user.puntos} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
