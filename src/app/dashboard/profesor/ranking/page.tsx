/**
 * Página de ranking global para profesores: muestra el top 20 de estudiantes.
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
}

export default function ProfesorRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const { data: ranking } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config")
        .eq("rol", "estudiante") 
        .order("puntos", { ascending: false })
        .limit(20);

      if (ranking) setUsuarios(ranking);
    };

    fetchRanking();
  }, []);

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          🏆 Ranking Global
        </h1>

        <div
          className="p-3 sm:p-6 rounded-xl shadow space-y-3 sm:space-y-4 min-w-0 overflow-hidden"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          {usuarios.map((user, index) => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg transition min-w-0"
              style={{
                backgroundColor:
                  index === 0
                    ? "rgba(234,179,8,0.15)" 
                    : index === 1
                    ? "rgba(156,163,175,0.15)" 
                    : index === 2
                    ? "rgba(249,115,22,0.15)" 
                    : "var(--color-bg)",
                padding: "1rem",
              }}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <span
                  className={`font-bold self-end sm:self-auto ${
                    index < 3 ? "text-3xl w-12" : "text-lg w-8"
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
                <div className={index < 3 ? "justify-self-center scale-75 sm:scale-100 -my-3 sm:my-0" : "justify-self-center scale-90 sm:scale-100 -my-1 sm:my-0"}>
                  <RenderizadorAvatar
                    config={user.avatar_config}
                    size={index < 3 ? 100 : 80}
                  />
                </div>
                <span
                  className={`font-semibold break-words min-w-0 ${
                    index < 3 ? "text-lg sm:text-xl xl:text-2xl" : "text-sm sm:text-base xl:text-lg"
                  }`}
                  style={{ color: "var(--color-text)" }}
                >
                  {user.nombre}
                </span>
              </div>
              <span
                className={`font-bold whitespace-nowrap self-center sm:self-auto text-right ${
                  index < 3 ? "text-cyan-600 text-2xl" : "text-cyan-500 text-base"
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
