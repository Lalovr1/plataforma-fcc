/**
 * Ranking global de estudiantes con soporte de temas.
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
      const { data: ranking } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config, frame_url")
        .eq("rol", "estudiante")
        .order("puntos", { ascending: false })
        .limit(20);

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

          const { data: todos } = await supabase
            .from("usuarios")
            .select("id")
            .eq("rol", "estudiante")
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
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-heading)" }}>
          🏆 Ranking Global
        </h1>

        {miUsuario && miPosicion && (
          <div
            className="p-5 rounded-xl shadow border"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <h2 className="text-lg font-bold mb-2 text-cyan-500">
              Tu posición
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold w-12">#{miPosicion}</span>
                <RenderizadorAvatar
                  config={miUsuario.avatar_config}
                  frameUrl={miUsuario.frame_url}
                  size={60}
                />
                <span
                  className="font-semibold text-lg"
                  style={{ color: "var(--color-text)" }}
                >
                  {miUsuario.nombre}
                </span>
              </div>
              <span className="text-cyan-500 font-bold text-lg">
                {miUsuario.puntos} pts
              </span>
            </div>
          </div>
        )}

        <div
          className="p-6 rounded-xl shadow space-y-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          {usuarios.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center justify-between rounded-lg transition`}
              style={{
                backgroundColor:
                  index === 0
                    ? "rgba(250, 204, 21, 0.15)"
                    : index === 1
                    ? "rgba(148, 163, 184, 0.15)"
                    : index === 2
                    ? "rgba(251, 146, 60, 0.15)"
                    : "var(--color-bg)",
                padding: "1.25rem",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`font-bold ${
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
                <RenderizadorAvatar
                  config={user.avatar_config}
                  frameUrl={user.frame_url}
                  size={index < 3 ? 100 : 80}
                />
                <span
                  className={`font-semibold ${
                    index < 3 ? "text-xl" : "text-base"
                  }`}
                  style={{ color: "var(--color-text)" }}
                >
                  {user.nombre}
                </span>
              </div>
              <span
                className={`font-bold ${
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
