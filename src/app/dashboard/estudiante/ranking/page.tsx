/**
 * Página de ranking global de estudiantes.
 * Muestra el top 20 por puntos, así como la posición actual del usuario logueado.
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

export default function EstudianteRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [miUsuario, setMiUsuario] = useState<Usuario | null>(null);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      // Top 20 global
      const { data: ranking } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config, frame_url")
        .order("puntos", { ascending: false })
        .limit(20);

      // Usuario actual
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let miUsuarioData: Usuario | null = null;
      let miPos: number | null = null;

      if (user) {
        const { data: misDatos } = await supabase
          .from("usuarios")
          .select("id, nombre, puntos, avatar_config, frame_url")
          .eq("id", user.id)
          .single();

        if (misDatos) {
          miUsuarioData = misDatos;

          // Ranking completo para calcular posición real
          const { data: todos } = await supabase
            .from("usuarios")
            .select("id")
            .order("puntos", { ascending: false });

          miPos = todos?.findIndex((u) => u.id === user.id) ?? null;
          if (miPos !== null && miPos >= 0) miPos += 1;
        }
      }

      if (ranking) setUsuarios(ranking);
      setMiUsuario(miUsuarioData);
      setMiPosicion(miPos);
    };

    fetchRanking();
  }, []);

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">🏆 Ranking Global</h1>

        {miUsuario && miPosicion && (
          <div className="bg-gray-800 p-5 rounded-xl shadow border border-blue-500">
            <h2 className="text-lg font-bold mb-2 text-blue-400">
              Tu posición
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold w-12">#{miPosicion}</span>
                <RenderizadorAvatar
                  config={miUsuario.avatar_config}
                  frameUrl={miUsuario.frame_url}
                  size={40}
                />
                <span className="font-semibold text-lg">
                  {miUsuario.nombre}
                </span>
              </div>
              <span className="text-blue-400 font-bold text-lg">
                {miUsuario.puntos} pts
              </span>
            </div>
          </div>
        )}

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
