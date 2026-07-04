/**
 * Ranking global de estudiantes con soporte de temas.
 */

"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  avatar_config: AvatarConfig | null;
}

interface RankingCache {
  timestamp: number;
  usuarios: Usuario[];
  miUsuario: Usuario | null;
  miPosicion: number | null;
}

const CACHE_KEY_BASE = "fcc_academy_ranking_estudiante_v1";

export default function EstudianteRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [miUsuario, setMiUsuario] = useState<Usuario | null>(null);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cacheCargado, setCacheCargado] = useState(false);

  const getCacheKey = (usuarioId: string) => `${CACHE_KEY_BASE}_${usuarioId}`;

  const guardarCache = (
    usuarioId: string,
    rankingUsuarios: Usuario[],
    usuarioActual: Usuario | null,
    posicionActual: number | null
  ) => {
    try {
      sessionStorage.setItem(
        getCacheKey(usuarioId),
        JSON.stringify({
          timestamp: Date.now(),
          usuarios: rankingUsuarios,
          miUsuario: usuarioActual,
          miPosicion: posicionActual,
        })
      );
    } catch {}
  };

  const leerCache = (usuarioId: string): RankingCache | null => {
    try {
      const raw = sessionStorage.getItem(getCacheKey(usuarioId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.usuarios)) return null;

      return {
        timestamp: Number(parsed.timestamp) || Date.now(),
        usuarios: parsed.usuarios,
        miUsuario: parsed.miUsuario ?? null,
        miPosicion: parsed.miPosicion ?? null,
      };
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    try {
      const usuarioLocal = localStorage.getItem("user_id");
      if (!usuarioLocal) return;

      const cache = leerCache(usuarioLocal);
      if (!cache) return;

      setUsuarios(cache.usuarios);
      setMiUsuario(cache.miUsuario);
      setMiPosicion(cache.miPosicion);
      setCacheCargado(true);
      setCargandoInicial(false);
    } catch {}
  }, []);

  const fetchRanking = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: ranking } = await supabase
      .from("usuarios")
      .select("id, nombre, puntos, avatar_config")
      .eq("rol", "estudiante")
      .order("puntos", { ascending: false })
      .limit(20);

    let miUsuarioData: Usuario | null = null;
    let miPos: number | null = null;

    if (user) {
      const { data: misDatos } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, avatar_config")
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

    const rankingUsuarios = (ranking as Usuario[]) ?? [];

    setUsuarios(rankingUsuarios);
    setMiUsuario(miUsuarioData);
    setMiPosicion(miPos);

    if (user) {
      guardarCache(user.id, rankingUsuarios, miUsuarioData, miPos);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const usuarioLocal = localStorage.getItem("user_id");

        if (usuarioLocal) {
          const cache = leerCache(usuarioLocal);

          if (cache && !cacheCargado) {
            setUsuarios(cache.usuarios);
            setMiUsuario(cache.miUsuario);
            setMiPosicion(cache.miPosicion);
            setCargandoInicial(false);
          }
        }

        await fetchRanking();
      } catch (e) {
        console.error("Error cargando ranking:", e);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
  }, []);

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          🏆 Ranking Global
        </h1>

        {cargandoInicial ? (
          <>
            <div
              className="p-4 sm:p-5 rounded-xl shadow border min-w-0 overflow-hidden animate-pulse"
              style={{
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <div
                className="h-5 rounded w-32 mb-4"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div className="flex items-center gap-4">
                <div
                  className="h-6 rounded w-12"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-14 w-14 rounded-full"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <div
                  className="h-5 rounded w-40"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
              </div>
            </div>

            <div
              className="p-3 sm:p-6 rounded-xl shadow space-y-3 sm:space-y-4 min-w-0 overflow-hidden"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="rounded-lg animate-pulse"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    padding: "clamp(0.75rem, 3vw, 1.25rem)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-8 rounded w-12"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />
                    <div
                      className="h-16 w-16 rounded-full"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />
                    <div
                      className="h-5 rounded w-40"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {miUsuario && miPosicion && (
              <div
                className="p-4 sm:p-5 rounded-xl shadow border min-w-0 overflow-hidden"
                style={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                }}
              >
                <h2 className="text-lg font-bold mb-2 text-cyan-500">
                  Tu posición
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className="text-xl font-bold w-12 pl-8">
                      #{miPosicion}
                    </span>

                    <RenderizadorAvatar
                      config={miUsuario.avatar_config}
                      size={60}
                    />

                    <span
                      className="font-semibold text-base sm:text-lg break-words min-w-0"
                      style={{ color: "var(--color-text)" }}
                    >
                      {miUsuario.nombre}
                    </span>
                  </div>

                  <span className="text-cyan-500 font-bold text-lg self-end sm:self-auto">
                    {miUsuario.puntos} pts
                  </span>
                </div>
              </div>
            )}

            <div
              className="p-3 sm:p-6 rounded-xl shadow space-y-3 sm:space-y-4 min-w-0 overflow-hidden"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              {usuarios.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>
                  Todavía no hay estudiantes en el ranking.
                </p>
              ) : (
                usuarios.map((user, index) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg transition min-w-0"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "rgba(250, 204, 21, 0.15)"
                          : index === 1
                          ? "rgba(148, 163, 184, 0.15)"
                          : index === 2
                          ? "rgba(251, 146, 60, 0.15)"
                          : "var(--color-bg)",
                      padding: "clamp(0.75rem, 3vw, 1.25rem)",
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

                      <div
                        className={
                          index < 3
                            ? "justify-self-center scale-75 sm:scale-100 -my-3 sm:my-0"
                            : "justify-self-center scale-90 sm:scale-100 -my-1 sm:my-0"
                        }
                      >
                        <RenderizadorAvatar
                          config={user.avatar_config}
                          size={index < 3 ? 100 : 80}
                        />
                      </div>

                      <span
                        className={`font-semibold break-words min-w-0 ${
                          index < 3
                            ? "text-lg sm:text-xl xl:text-2xl"
                            : "text-sm sm:text-base xl:text-lg"
                        }`}
                        style={{ color: "var(--color-text)" }}
                      >
                        {user.nombre}
                      </span>
                    </div>

                    <span
                      className={`font-bold whitespace-nowrap self-center sm:self-auto text-right ${
                        index < 3
                          ? "text-cyan-600 text-2xl"
                          : "text-cyan-500 text-base"
                      }`}
                    >
                      {user.puntos} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </LayoutGeneral>
  );
}