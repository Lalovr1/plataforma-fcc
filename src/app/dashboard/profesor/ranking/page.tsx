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
          className="text-2xl font-bold"
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
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg min-w-0"
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
              <div className="flex items-center gap-3 min-w-0 w-full">
                <span
                  className="font-bold flex-shrink-0 text-center"
                  style={{
                    width: index < 3 ? "2.5rem" : "1.5rem",
                    fontSize: index < 3 ? "2rem" : "1.25rem",
                    color: "var(--color-heading)",
                  }}
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
                  size={typeof window !== "undefined"
                  ? window.innerWidth < 640
                    ? index < 3
                      ? 72
                      : 60
                    : index < 3
                    ? 100
                    : 80
                  : 80}
                />
                <span
                  className="font-semibold break-words min-w-0"
                  style={{
                    fontSize: index < 3 ? "1.5rem" : "1.25rem",
                    color: "var(--color-text)",
                  }}
                >
                  {user.nombre}
                </span>
              </div>
              <span
                className="font-bold self-end sm:self-auto"
                style={{
                  fontSize: index < 3 ? "1.75rem" : "1.25rem",
                  color: "#38bdf8", 
                }}
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
