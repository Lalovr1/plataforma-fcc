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
  frame_url?: string | null;
}

export default function WidgetRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config, frame_url")
        .order("puntos", { ascending: false })
        .limit(5);

      if (!error && data) {
        setUsuarios(data);
      }
    };

    fetchRanking();
  }, []);

  const defaultConfig: AvatarConfig = {
    skin: "default.png",
    eyes: "none",
    mouth: "none",
    eyebrow: "none",
    hair: "none",
    clothes: "none",
    accessory: null,
  };

  if (usuarios.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 shadow-lg text-center">
        <h2 className="text-lg font-bold text-cyan-400 mb-4">🏆 TOP 5 GLOBAL</h2>
        <p className="text-gray-400">Aún no hay jugadores en el ranking.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg text-center">
      <h2 className="text-xl font-bold text-cyan-400 mb-6">🏆 TOP 5 GLOBAL</h2>

      <div className="flex justify-center items-end gap-8 mb-6">
        {usuarios[1] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={64}
              config={usuarios[1].avatar_config ?? defaultConfig}
              frameUrl={usuarios[1].frame_url}
            />
            <p className="text-gray-300 mt-2">{usuarios[1].nombre}</p>
            <span className="text-sm text-gray-400">{usuarios[1].puntos} pts</span>
            <span className="text-gray-400 font-bold">🥈 #2</span>
          </div>
        )}

        {usuarios[0] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={80}
              config={usuarios[0].avatar_config ?? defaultConfig}
              frameUrl={usuarios[0].frame_url}
            />
            <p className="text-yellow-400 font-bold mt-2">{usuarios[0].nombre}</p>
            <span className="text-sm text-gray-400">{usuarios[0].puntos} pts</span>
            <span className="text-yellow-400 font-bold">🥇 #1</span>
          </div>
        )}

        {usuarios[2] && (
          <div className="flex flex-col items-center">
            <RenderizadorAvatar
              size={56}
              config={usuarios[2].avatar_config ?? defaultConfig}
              frameUrl={usuarios[2].frame_url}
            />
            <p className="text-gray-300 mt-2">{usuarios[2].nombre}</p>
            <span className="text-sm text-gray-400">{usuarios[2].puntos} pts</span>
            <span className="text-orange-500 font-bold">🥉 #3</span>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {usuarios.slice(3).map((user, idx) => (
          <li
            key={user.id}
            className="flex items-center justify-between bg-gray-700 px-4 py-2 rounded hover:bg-gray-600"
          >
            <div className="flex items-center space-x-3">
              <span className="font-bold text-gray-400">#{idx + 4}</span>
              <RenderizadorAvatar
                size={32}
                config={user.avatar_config ?? defaultConfig}
                frameUrl={user.frame_url}
              />
              <p>{user.nombre}</p>
            </div>
            <span className="text-sm text-gray-300">{user.puntos} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
