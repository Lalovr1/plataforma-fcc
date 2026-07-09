"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";

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

function nombreCorto(nombre?: string) {
  if (!nombre) return "Sin asignar";
  return nombre.split(" ").slice(0, 2).join(" ");
}

export default function WidgetRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);

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

  function UsuarioPodio({
    rank,
    user,
    principal = false,
  }: {
    rank: 1 | 2 | 3;
    user?: Usuario;
    principal?: boolean;
  }) {
    const tieneUsuario = !!user;

    return (
      <div
        className={`fcc-ranking-podium-item rank-${rank} ${
          principal ? "is-main" : ""
        } ${!tieneUsuario ? "is-empty" : ""}`}
      >
        <div className="fcc-ranking-avatar-stage">
          <span className="fcc-ranking-avatar-orbit" />

          {tieneUsuario ? (
            <div className="fcc-ranking-avatar-render">
              <RenderizadorAvatar
                size={rank === 1 ? 162 : rank === 2 ? 128 : 118}
                config={user.avatar_config ?? defaultConfig}
              />
            </div>
          ) : (
            <div className="fcc-ranking-empty-avatar">
              <UserRound size={28} strokeWidth={1.9} />
            </div>
          )}
        </div>

        <div className="fcc-ranking-podium-base">
          <span className="fcc-ranking-rank-number">{rank}°</span>
        </div>

        <div className="fcc-ranking-person-copy">
          <p>{nombreCorto(user?.nombre)}</p>
          <span>{tieneUsuario ? `${user.puntos} pts` : "— pts"}</span>
        </div>
      </div>
    );
  }

  function FilaRanking({ rank, user }: { rank: 4 | 5; user?: Usuario }) {
    const tieneUsuario = !!user;

    return (
      <li className={`fcc-ranking-row ${!tieneUsuario ? "is-empty" : ""}`}>
        <div className="fcc-ranking-row-left">
          <span className="fcc-ranking-row-rank">#{rank}</span>

          {tieneUsuario ? (
            <div className="fcc-ranking-row-avatar">
              <RenderizadorAvatar
                size={46}
                config={user.avatar_config ?? defaultConfig}
              />
            </div>
          ) : (
            <div className="fcc-ranking-row-placeholder">
              <UserRound size={18} strokeWidth={1.9} />
            </div>
          )}

          <p>{nombreCorto(user?.nombre)}</p>
        </div>

        <span className="fcc-ranking-row-points">
          {tieneUsuario ? `${user.puntos} pts` : "— pts"}
        </span>
      </li>
    );
  }

  return (
    <>
      <style>{`
        .fcc-ranking-card {
          --fcc-ranking-text: var(--fcc-premium-text);
          --fcc-ranking-muted: var(--fcc-premium-muted);
          --fcc-ranking-empty: color-mix(in srgb, var(--fcc-premium-muted) 72%, transparent);
          --fcc-ranking-accent: var(--fcc-premium-accent);
          --fcc-ranking-accent-strong: var(--fcc-premium-accent-hover);

          --fcc-ranking-card-bg:
            radial-gradient(
              circle at 14% 12%,
              color-mix(in srgb, var(--fcc-premium-cyan) 10%, transparent),
              transparent 28%
            ),
            radial-gradient(
              circle at 86% 8%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 26%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          --fcc-ranking-card-border: var(--fcc-premium-border);
          --fcc-ranking-card-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 68%, transparent);

          --fcc-ranking-grid-line-a:
            color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);
          --fcc-ranking-grid-line-b:
            color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-ranking-grid-line-c:
            color-mix(in srgb, var(--fcc-premium-accent) 3%, transparent);
          --fcc-ranking-header-line:
            color-mix(in srgb, var(--fcc-premium-accent) 45%, transparent);
          --fcc-ranking-podium-glow:
            color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);

          --fcc-ranking-empty-avatar-color:
            color-mix(in srgb, var(--fcc-premium-accent) 42%, transparent);
          --fcc-ranking-empty-avatar-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 82%, transparent)
            );
          --fcc-ranking-empty-avatar-border:
            color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);
          --fcc-ranking-empty-avatar-inset:
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);

          --fcc-ranking-podium-bg:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 92%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 88%, transparent)
            );
          --fcc-ranking-podium-border: var(--fcc-premium-border);
          --fcc-ranking-podium-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
          --fcc-ranking-podium-line:
            color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);

          --fcc-ranking-row-bg:
            color-mix(in srgb, var(--fcc-premium-surface-strong) 76%, transparent);
          --fcc-ranking-row-border:
            color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent);
          --fcc-ranking-row-shadow:
            0 10px 22px color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent);

          --fcc-ranking-row-rank-bg:
            color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
          --fcc-ranking-row-rank-border:
            color-mix(in srgb, var(--fcc-premium-accent) 12%, transparent);

          --fcc-ranking-row-avatar-bg:
            color-mix(in srgb, var(--fcc-premium-surface-soft) 68%, transparent);
          --fcc-ranking-row-avatar-border:
            color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);

          --fcc-ranking-row-placeholder-color:
            color-mix(in srgb, var(--fcc-premium-accent) 42%, transparent);
          --fcc-ranking-row-placeholder-bg:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-soft) 90%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-strong) 96%, transparent)
            );

          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 20px 20px 18px;
          background: var(--fcc-ranking-card-bg);
          border: 1px solid var(--fcc-ranking-card-border);
          box-shadow: var(--fcc-ranking-card-shadow);
          color: var(--fcc-ranking-text);
        }

        .fcc-ranking-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              120deg,
              transparent 0 62%,
              var(--fcc-ranking-grid-line-a) 62.3% 62.8%,
              transparent 63.1%
            ),
            linear-gradient(var(--fcc-ranking-grid-line-b) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-ranking-grid-line-c) 1px, transparent 1px);
          background-size: auto, 30px 30px, 30px 30px;
          mask-image: radial-gradient(circle at 74% 18%, black, transparent 64%);
          opacity: 0.55;
        }

        .fcc-ranking-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 12px;
          text-align: center;
        }

        .fcc-ranking-header::before,
        .fcc-ranking-header::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--fcc-ranking-header-line)
          );
        }

        .fcc-ranking-header::after {
          background: linear-gradient(
            90deg,
            var(--fcc-ranking-header-line),
            transparent
          );
        }

        .fcc-ranking-title {
          color: var(--fcc-ranking-text);
          font-size: clamp(1rem, 1.5vw, 1.22rem);
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .fcc-ranking-podium {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: end;
          justify-items: center;
          gap: clamp(10px, 1.8vw, 16px);
          min-height: 220px;
          margin-top: 0;
          padding: 0 2px;
        }

        .fcc-ranking-podium::after {
          content: "";
          position: absolute;
          left: 10%;
          right: 10%;
          bottom: 84px;
          height: 24px;
          border-radius: 999px;
          background: radial-gradient(
            ellipse at center,
            var(--fcc-ranking-podium-glow),
            transparent 68%
          );
          z-index: -1;
        }

        .fcc-ranking-podium-item {
          --card-width: 146px;
          --rank-height: 72px;
          --avatar-stage-height: 104px;
          --avatar-circle-size: 52%;
          --avatar-orbit-size: 42%;
          --avatar-render-scale: 0.74;

          --avatar-medal-core:
            color-mix(in srgb, var(--fcc-ranking-accent) 10%, transparent);
          --avatar-medal-a:
            color-mix(in srgb, var(--fcc-ranking-accent) 18%, transparent);
          --avatar-medal-b:
            color-mix(in srgb, var(--fcc-premium-cyan) 14%, transparent);
          --avatar-medal-c:
            color-mix(in srgb, var(--fcc-ranking-accent) 14%, transparent);
          --avatar-medal-line-a:
            color-mix(in srgb, var(--fcc-ranking-accent) 12%, transparent);
          --avatar-medal-line-b:
            color-mix(in srgb, var(--fcc-premium-cyan) 13%, transparent);

          min-width: 0;
          width: 100%;
          max-width: var(--card-width);
          display: grid;
          grid-template-rows: var(--avatar-stage-height) auto minmax(52px, auto);
          justify-items: center;
          align-items: end;
          text-align: center;
        }

        .fcc-ranking-podium-item.rank-1 {
          order: 2;
          --card-width: 156px;
          --rank-height: 106px;
          --avatar-stage-height: 124px;
          --avatar-circle-size: 58%;
          --avatar-orbit-size: 46%;
          --avatar-render-scale: 0.78;

          --avatar-medal-core: rgba(255, 215, 90, 0.42);
          --avatar-medal-a: rgba(245, 158, 11, 0.56);
          --avatar-medal-b: rgba(255, 236, 150, 0.46);
          --avatar-medal-c: rgba(217, 119, 6, 0.34);
          --avatar-medal-line-a: rgba(245, 158, 11, 0.38);
          --avatar-medal-line-b: rgba(255, 215, 90, 0.34);
        }

        .fcc-ranking-podium-item.rank-2 {
          order: 1;
          --card-width: 146px;
          --rank-height: 76px;
          --avatar-stage-height: 108px;
          --avatar-circle-size: 52%;
          --avatar-orbit-size: 42%;
          --avatar-render-scale: 0.74;

          --avatar-medal-core: rgba(226, 232, 240, 0.46);
          --avatar-medal-a: rgba(148, 163, 184, 0.52);
          --avatar-medal-b: rgba(248, 250, 252, 0.48);
          --avatar-medal-c: rgba(100, 116, 139, 0.28);
          --avatar-medal-line-a: rgba(148, 163, 184, 0.36);
          --avatar-medal-line-b: rgba(226, 232, 240, 0.36);
        }

        .fcc-ranking-podium-item.rank-3 {
          order: 3;
          --card-width: 140px;
          --rank-height: 64px;
          --avatar-stage-height: 98px;
          --avatar-circle-size: 48%;
          --avatar-orbit-size: 38%;
          --avatar-render-scale: 0.70;

          --avatar-medal-core: rgba(205, 127, 50, 0.42);
          --avatar-medal-a: rgba(180, 83, 9, 0.52);
          --avatar-medal-b: rgba(222, 163, 119, 0.44);
          --avatar-medal-c: rgba(120, 53, 15, 0.30);
          --avatar-medal-line-a: rgba(180, 83, 9, 0.36);
          --avatar-medal-line-b: rgba(222, 163, 119, 0.34);
        }

        .fcc-ranking-avatar-stage {
          position: relative;
          width: 100%;
          height: var(--avatar-stage-height);
          display: grid;
          place-items: end center;
          z-index: 3;
          isolation: isolate;
        }

        .fcc-ranking-avatar-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 56%;
          width: var(--avatar-circle-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(circle, var(--avatar-medal-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--avatar-medal-a) 42deg,
              transparent 84deg,
              var(--avatar-medal-b) 145deg,
              transparent 210deg,
              var(--avatar-medal-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -2;
        }

        .fcc-ranking-avatar-orbit {
          position: absolute;
          left: 50%;
          top: 56%;
          width: var(--avatar-orbit-size);
          aspect-ratio: 1 / 1;
          z-index: -1;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(-18deg);
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--avatar-medal-line-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--avatar-medal-line-b) 60% 64%,
              transparent 64% 100%
            );
          opacity: 0.82;
        }

        .fcc-ranking-avatar-render {
          position: absolute;
          left: 50%;
          bottom: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          transform: translateX(-50%) scale(var(--avatar-render-scale));
          transform-origin: center bottom;
        }

        .fcc-ranking-empty-avatar {
          position: absolute;
          left: 50%;
          top: 56%;
          z-index: 2;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          transform: translate(-50%, -50%);
          color: var(--fcc-ranking-empty-avatar-color);
          background: var(--fcc-ranking-empty-avatar-bg);
          border: 1px solid var(--fcc-ranking-empty-avatar-border);
          box-shadow: var(--fcc-ranking-empty-avatar-inset);
        }

        .fcc-ranking-podium-base {
          position: relative;
          width: 100%;
          min-height: var(--rank-height);
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: var(--fcc-ranking-podium-bg);
          border: 1px solid var(--fcc-ranking-podium-border);
          box-shadow: var(--fcc-ranking-podium-shadow);
          overflow: hidden;
        }

        .fcc-ranking-podium-base::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              110deg,
              transparent 0 48%,
              var(--fcc-ranking-podium-line) 48.5% 49%,
              transparent 49.5%
            );
          pointer-events: none;
          opacity: 0.85;
        }

        .fcc-ranking-rank-number {
          position: relative;
          z-index: 2;
          color: var(--fcc-ranking-accent);
          font-size: 2.35rem;
          font-weight: 950;
          letter-spacing: -0.08em;
          line-height: 1;
        }

        .fcc-ranking-podium-item.rank-1 .fcc-ranking-rank-number {
          font-size: 3.2rem;
          color: var(--fcc-ranking-accent-strong);
          text-shadow:
            0 10px 24px color-mix(in srgb, var(--fcc-ranking-accent) 14%, transparent);
        }

        .fcc-ranking-podium-item.rank-2 .fcc-ranking-rank-number {
          font-size: 2.45rem;
        }

        .fcc-ranking-podium-item.rank-3 .fcc-ranking-rank-number {
          font-size: 2.15rem;
        }

        .fcc-ranking-person-copy {
          margin-top: 10px;
          min-width: 0;
          width: 100%;
          min-height: 54px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 4px;
        }

        .fcc-ranking-person-copy p {
          color: var(--fcc-ranking-text);
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
          word-break: break-word;
        }

        .fcc-ranking-podium-item.rank-1 .fcc-ranking-person-copy p {
          font-size: 14px;
        }

        .fcc-ranking-person-copy span {
          display: block;
          color: var(--fcc-ranking-muted);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.1;
        }

        .fcc-ranking-list {
          position: relative;
          z-index: 2;
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }

        .fcc-ranking-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
          border-radius: 18px;
          padding: 11px 12px;
          background: var(--fcc-ranking-row-bg);
          border: 1px solid var(--fcc-ranking-row-border);
          box-shadow: var(--fcc-ranking-row-shadow);
        }

        .fcc-ranking-row-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .fcc-ranking-row-rank {
          flex: 0 0 auto;
          min-width: 34px;
          border-radius: 999px;
          padding: 5px 8px;
          color: var(--fcc-ranking-accent);
          background: var(--fcc-ranking-row-rank-bg);
          border: 1px solid var(--fcc-ranking-row-rank-border);
          font-size: 12px;
          font-weight: 950;
          text-align: center;
        }

        .fcc-ranking-row-avatar {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 999px;
          background: var(--fcc-ranking-row-avatar-bg);
          border: 1px solid var(--fcc-ranking-row-avatar-border);
        }

        .fcc-ranking-row-avatar > * {
          transform: scale(0.78);
        }

        .fcc-ranking-row-placeholder {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--fcc-ranking-row-placeholder-color);
          background: var(--fcc-ranking-row-placeholder-bg);
          border: 1px solid var(--fcc-ranking-row-avatar-border);
        }

        .fcc-ranking-row p {
          min-width: 0;
          color: var(--fcc-ranking-text);
          font-size: 13px;
          font-weight: 850;
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fcc-ranking-row-points {
          flex: 0 0 auto;
          color: var(--fcc-ranking-muted);
          font-size: 12px;
          font-weight: 850;
        }

        .fcc-ranking-podium-item.is-empty .fcc-ranking-person-copy p,
        .fcc-ranking-row.is-empty p,
        .fcc-ranking-row.is-empty .fcc-ranking-row-points {
          color: var(--fcc-ranking-empty);
        }

        .fcc-ranking-loading .fcc-ranking-podium-base,
        .fcc-ranking-loading .fcc-ranking-empty-avatar,
        .fcc-ranking-loading .fcc-ranking-row {
          animation: fcc-ranking-pulse 1.25s ease-in-out infinite;
        }

        @keyframes fcc-ranking-pulse {
          0%, 100% {
            opacity: 0.62;
          }

          50% {
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .fcc-ranking-card {
            padding: 18px 16px 16px;
          }

          .fcc-ranking-header {
            margin-bottom: 10px;
          }

          .fcc-ranking-podium {
            gap: 8px;
            min-height: 198px;
          }

          .fcc-ranking-podium-item {
            --card-width: 112px;
            --rank-height: 60px;
            --avatar-stage-height: 84px;
            --avatar-circle-size: 68%;
            --avatar-orbit-size: 52%;
            --avatar-render-scale: 0.66;
          }

          .fcc-ranking-podium-item.rank-1 {
            --card-width: 120px;
            --rank-height: 82px;
            --avatar-stage-height: 96px;
            --avatar-circle-size: 72%;
            --avatar-orbit-size: 56%;
            --avatar-render-scale: 0.69;
          }

          .fcc-ranking-podium-item.rank-2 {
            --rank-height: 62px;
            --avatar-stage-height: 82px;
            --avatar-circle-size: 64%;
            --avatar-orbit-size: 50%;
            --avatar-render-scale: 0.64;
          }

          .fcc-ranking-podium-item.rank-3 {
            --rank-height: 54px;
            --avatar-stage-height: 78px;
            --avatar-circle-size: 58%;
            --avatar-orbit-size: 44%;
            --avatar-render-scale: 0.60;
          }

          .fcc-ranking-rank-number {
            font-size: 2rem;
          }

          .fcc-ranking-podium-item.rank-1 .fcc-ranking-rank-number {
            font-size: 2.7rem;
          }

          .fcc-ranking-podium-item.rank-2 .fcc-ranking-rank-number {
            font-size: 2.1rem;
          }

          .fcc-ranking-podium-item.rank-3 .fcc-ranking-rank-number {
            font-size: 1.85rem;
          }

          .fcc-ranking-person-copy {
            min-height: 58px;
            margin-top: 8px;
          }

          .fcc-ranking-person-copy p {
            font-size: 12px;
          }

          .fcc-ranking-podium-item.rank-1 .fcc-ranking-person-copy p {
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .fcc-ranking-podium {
            gap: 6px;
          }

          .fcc-ranking-podium-item {
            --card-width: 98px;
            --rank-height: 52px;
            --avatar-stage-height: 76px;
            --avatar-circle-size: 66%;
            --avatar-orbit-size: 48%;
            --avatar-render-scale: 0.61;
          }

          .fcc-ranking-podium-item.rank-1 {
            --card-width: 106px;
            --rank-height: 72px;
            --avatar-stage-height: 88px;
            --avatar-circle-size: 70%;
            --avatar-orbit-size: 54%;
            --avatar-render-scale: 0.64;
          }

          .fcc-ranking-podium-item.rank-2 {
            --rank-height: 56px;
            --avatar-stage-height: 76px;
            --avatar-circle-size: 60%;
            --avatar-orbit-size: 46%;
            --avatar-render-scale: 0.58;
          }

          .fcc-ranking-podium-item.rank-3 {
            --rank-height: 48px;
            --avatar-stage-height: 72px;
            --avatar-circle-size: 54%;
            --avatar-orbit-size: 40%;
            --avatar-render-scale: 0.55;
          }

          .fcc-ranking-rank-number {
            font-size: 1.8rem;
          }

          .fcc-ranking-podium-item.rank-1 .fcc-ranking-rank-number {
            font-size: 2.45rem;
          }

          .fcc-ranking-podium-item.rank-2 .fcc-ranking-rank-number {
            font-size: 1.95rem;
          }

          .fcc-ranking-podium-item.rank-3 .fcc-ranking-rank-number {
            font-size: 1.7rem;
          }

          .fcc-ranking-empty-avatar {
            width: 50px;
            height: 50px;
          }

          .fcc-ranking-person-copy {
            min-height: 60px;
          }

          .fcc-ranking-list {
            margin-top: 10px;
          }
        }
      `}</style>

      <section
        className={`fcc-ranking-card ${
          cargandoInicial ? "fcc-ranking-loading" : ""
        }`}
      >
        <div className="fcc-ranking-header">
          <h2 className="fcc-ranking-title">TOP 5 GLOBAL</h2>
        </div>

        <div className="fcc-ranking-podium">
          <UsuarioPodio
            rank={2}
            user={cargandoInicial ? undefined : usuarios[1]}
          />

          <UsuarioPodio
            rank={1}
            user={cargandoInicial ? undefined : usuarios[0]}
            principal
          />

          <UsuarioPodio
            rank={3}
            user={cargandoInicial ? undefined : usuarios[2]}
          />
        </div>

        <ul className="fcc-ranking-list">
          <FilaRanking
            rank={4}
            user={cargandoInicial ? undefined : usuarios[3]}
          />

          <FilaRanking
            rank={5}
            user={cargandoInicial ? undefined : usuarios[4]}
          />
        </ul>
      </section>
    </>
  );
}