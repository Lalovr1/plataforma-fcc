/**
 * Muestra el ranking global de los 5 mejores jugadores.
 * Incluye un podio visual para el Top 3 y lista para 4° y 5° lugar.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  avatar_config?: AvatarConfig | null;
}

const CACHE_KEY = "fcc_academy_widget_ranking_top5_v1";

function parseAvatarConfig(value: any): AvatarConfig | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

export default function WidgetRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);

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

  const leerCache = (): Usuario[] | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.usuarios)) return null;

      return parsed.usuarios;
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    const cache = leerCache();

    if (!cache) return;

    setUsuarios(cache);
    setCargandoInicial(false);
  }, []);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const cache = leerCache();

        if (cache) {
          setUsuarios(cache);
          setCargandoInicial(false);
        }

        const { data, error } = await supabase
          .from("usuarios")
          .select("id, nombre, puntos, avatar_config")
          .eq("rol", "estudiante")
          .order("puntos", { ascending: false })
          .limit(5);

        if (error) {
          console.error("Error cargando widget ranking:", error);
          return;
        }

        const parsed = ((data as any[]) ?? []).map((u) => ({
          ...u,
          avatar_config: parseAvatarConfig(u.avatar_config),
        }));

        setUsuarios(parsed);
        guardarCache(parsed);
      } finally {
        setCargandoInicial(false);
      }
    };

    fetchRanking();
  }, []);

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

  if (cargandoInicial) {
    return (
      <div
        className="rounded-lg p-4 sm:p-6 shadow-lg text-center min-w-0 overflow-hidden"
        style={{
          backgroundColor: "var(--color-card)",
          color: "var(--color-text)",
        }}
      >
        <h2
          className="text-lg sm:text-xl font-bold mb-4 sm:mb-6"
          style={{ color: "var(--color-accent)" }}
        >
          🏆 TOP 5 GLOBAL
        </h2>

        <div className="flex justify-center items-end gap-2 sm:gap-6 lg:gap-8 mb-6 overflow-hidden">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex flex-col items-center min-w-0 animate-pulse">
              <div
                className={item === 2 ? "w-32 h-32 rounded-full" : "w-20 h-20 rounded-full"}
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div
                className="h-4 rounded w-20 mt-3"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div
                className="h-3 rounded w-14 mt-2"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[4, 5].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 px-3 sm:px-4 py-2 rounded animate-pulse"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="h-5 rounded w-8"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div
                className="h-12 w-12 rounded-full"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div
                className="h-4 rounded flex-1"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div
        className="rounded-lg p-4 shadow-lg text-center"
        style={{
          backgroundColor: "var(--color-card)",
          color: "var(--color-text)",
        }}
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
      className="rounded-lg p-4 sm:p-6 shadow-lg text-center min-w-0 overflow-hidden"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
      }}
    >
      <h2
        className="text-lg sm:text-xl font-bold mb-4 sm:mb-6"
        style={{ color: "var(--color-accent)" }}
      >
        🏆 TOP 5 GLOBAL
      </h2>

      <div className="flex justify-center items-end gap-2 sm:gap-6 lg:gap-8 mb-6 overflow-hidden">
        {usuarios[1] && (
          <div className="flex flex-col items-center min-w-0">
            <RenderizadorAvatar
              size={100}
              config={usuarios[1].avatar_config ?? defaultConfig}
            />

            <p
              className="text-sm sm:text-base font-bold mt-2 text-center break-words leading-tight max-w-[110px]"
              style={{ color: "var(--color-text)" }}
            >
              {usuarios[1].nombre.split(" ").slice(0, 2).join(" ")}
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
          <div className="flex flex-col items-center min-w-0">
            <div className="scale-75 sm:scale-100 -my-6 sm:my-0">
              <RenderizadorAvatar
                size={180}
                config={usuarios[0].avatar_config ?? defaultConfig}
              />
            </div>

            <p
              className="text-base sm:text-xl font-bold mt-2 text-center break-words leading-tight max-w-[130px]"
              style={{ color: "var(--color-heading)" }}
            >
              {usuarios[0].nombre.split(" ").slice(0, 2).join(" ")}
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
          <div className="flex flex-col items-center min-w-0">
            <RenderizadorAvatar
              size={100}
              config={usuarios[2].avatar_config ?? defaultConfig}
            />

            <p
              className="text-sm sm:text-base font-bold mt-2 text-center break-words leading-tight max-w-[110px]"
              style={{ color: "var(--color-text)" }}
            >
              {usuarios[2].nombre.split(" ").slice(0, 2).join(" ")}
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
            className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 rounded transition min-w-0"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
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

              <p className="break-words min-w-0 text-left">
                {user.nombre.split(" ").slice(0, 2).join(" ")}
              </p>
            </div>

            <span
              className="text-sm shrink-0"
              style={{ color: "var(--color-muted)" }}
            >
              {user.puntos} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}