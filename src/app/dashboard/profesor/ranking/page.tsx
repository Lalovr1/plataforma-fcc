/**
 * Página de ranking global para profesores: muestra el top 20 de estudiantes.
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
}

const CACHE_KEY = "fcc_academy_ranking_profesor_v1";

export default function ProfesorRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cacheCargado, setCacheCargado] = useState(false);

  const guardarCache = (rankingUsuarios: Usuario[]) => {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          usuarios: rankingUsuarios,
        })
      );
    } catch {}
  };

  const leerCache = (): RankingCache | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.usuarios)) return null;

      return {
        timestamp: Number(parsed.timestamp) || Date.now(),
        usuarios: parsed.usuarios,
      };
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    const cache = leerCache();

    if (!cache) return;

    setUsuarios(cache.usuarios);
    setCacheCargado(true);
    setCargandoInicial(false);
  }, []);

  const fetchRanking = async () => {
    const { data: ranking, error } = await supabase
      .from("usuarios")
      .select("id, nombre, puntos, avatar_config")
      .eq("rol", "estudiante")
      .order("puntos", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error cargando ranking de profesor:", error);
      return;
    }

    const rankingUsuarios = (ranking as Usuario[]) ?? [];

    setUsuarios(rankingUsuarios);
    guardarCache(rankingUsuarios);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const cache = leerCache();

        if (cache && !cacheCargado) {
          setUsuarios(cache.usuarios);
          setCargandoInicial(false);
        }

        await fetchRanking();
      } catch (e) {
        console.error("Error inicializando ranking de profesor:", e);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
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

        {cargandoInicial ? (
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
                  padding: "1rem",
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
        ) : (
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
        )}
      </div>
    </LayoutGeneral>
  );
}