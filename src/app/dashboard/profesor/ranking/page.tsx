/**
 * Página de ranking global para profesores: muestra el top 20 de usuarios
 * ordenados por puntos con sus avatares y posición.
 */

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  avatar_config: AvatarConfig | null;
  frame_url: string | null;
}

export default function ProfesorRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const { data: ranking } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config, frame_url")
        .order("puntos", { ascending: false })
        .limit(20);

      if (ranking) setUsuarios(ranking);
    };

    fetchRanking();
  }, []);

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">🏆 Ranking Global</h1>

        <div className="bg-gray-900 p-6 rounded-xl shadow space-y-4">
          {usuarios.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center justify-between rounded-lg ${
                index === 0
                  ? "bg-yellow-900/40 p-5 text-xl"
                  : index === 1
                  ? "bg-gray-700/40 p-5 text-lg"
                  : index === 2
                  ? "bg-orange-900/40 p-5 text-lg"
                  : "bg-gray-800/40 p-3"
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`font-bold ${
                    index < 3 ? "text-2xl w-10" : "text-lg w-6"
                  }`}
                >
                  {index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : `#${index + 1}`}
                </span>
                <RenderizadorAvatar
                  config={user.avatar_config}
                  frameUrl={user.frame_url}
                  size={index < 3 ? 48 : 32}
                />
                <span
                  className={`font-semibold ${
                    index < 3 ? "text-lg" : "text-base"
                  }`}
                >
                  {user.nombre}
                </span>
              </div>
              <span
                className={`font-bold ${
                  index < 3 ? "text-blue-300 text-xl" : "text-blue-400"
                }`}
              >
                {user.puntos} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </LayoutGeneral>
  );
}
