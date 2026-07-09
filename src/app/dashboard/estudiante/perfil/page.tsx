/**
 * Página de perfil del estudiante: muestra avatar, nivel, barra de XP,
 * logros (divididos en desbloqueados y bloqueados)
 * y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LayoutGeneral from "@/components/LayoutGeneral";
import BarraXP from "@/components/BarraXP";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import ModalEditorAvatar from "@/components/ModalEditorAvatar";
import toast from "react-hot-toast";
import GridLogros from "@/components/GridLogros";

type LogroPerfil = {
  id: string;
  titulo: string;
  descripcion: string;
  icono_url: string | null;
  desbloqueado: boolean;
};

type UsuarioPerfil = {
  id: string;
  nombre: string;
  puntos: number | null;
  nivel: number | null;
  avatar_config: AvatarConfig | null;
  logrosDesbloqueados: LogroPerfil[];
  logrosBloqueados: LogroPerfil[];
};

const CACHE_KEY_BASE = "fcc_academy_perfil_estudiante_v1";

const defaultAvatar: AvatarConfig = {
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

function getCacheKey(usuarioId: string) {
  return `${CACHE_KEY_BASE}_${usuarioId}`;
}

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

function guardarPerfilCache(usuario: UsuarioPerfil | null) {
  try {
    if (!usuario?.id) return;

    sessionStorage.setItem(
      getCacheKey(usuario.id),
      JSON.stringify({
        timestamp: Date.now(),
        usuario,
      })
    );
  } catch {}
}

function leerPerfilCache(usuarioId: string): UsuarioPerfil | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(usuarioId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.usuario) return null;

    return {
      ...parsed.usuario,
      avatar_config: parseAvatarConfig(parsed.usuario.avatar_config),
      logrosDesbloqueados: Array.isArray(parsed.usuario.logrosDesbloqueados)
        ? parsed.usuario.logrosDesbloqueados
        : [],
      logrosBloqueados: Array.isArray(parsed.usuario.logrosBloqueados)
        ? parsed.usuario.logrosBloqueados
        : [],
    };
  } catch {
    return null;
  }
}

function ModalEditarNombre({
  open,
  onClose,
  usuario,
  setUsuario,
}: {
  open: boolean;
  onClose: () => void;
  usuario: UsuarioPerfil | null;
  setUsuario: React.Dispatch<React.SetStateAction<UsuarioPerfil | null>>;
}) {
  const [nombreLocal, setNombreLocal] = useState(usuario?.nombre ?? "");

  useEffect(() => {
    if (open) {
      setNombreLocal(usuario?.nombre ?? "");
    }
  }, [open, usuario]);

  if (!open || !usuario) return null;

  const handleSave = async () => {
    const nombreLimpio = nombreLocal.trim();

    if (!nombreLimpio) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .update({ nombre: nombreLimpio })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Error al guardar cambios");
      return;
    }

    toast.success("Nombre actualizado correctamente");

    setUsuario((u) =>
      u
        ? {
            ...u,
            nombre: nombreLimpio,
          }
        : u
    );

    onClose();
  };

  return createPortal(
    <div className="perfil-modal-overlay" onClick={onClose}>
      <div className="perfil-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="perfil-modal-close"
          title="Cerrar"
        >
          ×
        </button>

        <div className="perfil-modal-head">
          <p className="perfil-kicker">Perfil</p>
          <h2>Editar nombre</h2>
        </div>

        <input
          type="text"
          value={nombreLocal}
          onChange={(e) => setNombreLocal(e.target.value)}
          className="perfil-input"
          placeholder="Ingresa tu nombre"
        />

        <div className="perfil-modal-actions">
          <button className="perfil-secondary-button" onClick={onClose}>
            Cancelar
          </button>

          <button className="perfil-primary-button" onClick={handleSave}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PerfilEstudiantePage() {
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAvatar, setOpenAvatar] = useState(false);
  const [openNombre, setOpenNombre] = useState(false);

  useLayoutEffect(() => {
    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerPerfilCache(usuarioLocal);
    if (!cache) return;

    setUsuario(cache);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const cache = leerPerfilCache(user.id);

        if (cache) {
          setUsuario(cache);
          setLoading(false);
        }

        const { data: userData, error: userError } = await supabase
          .from("usuarios")
          .select("id, nombre, puntos, nivel, avatar_config")
          .eq("id", user.id)
          .single();

        if (userError || !userData) {
          console.error("Error cargando perfil estudiante:", userError);
          return;
        }

        const [{ data: desbloqueados }, { data: todosLogros }] =
          await Promise.all([
            supabase
              .from("logros_usuarios")
              .select("logro_id")
              .eq("usuario_id", user.id),

            supabase
              .from("logros")
              .select("id,nombre,descripcion,icono_url"),
          ]);

        const idsDesbloqueados = new Set(
          (desbloqueados ?? []).map((l: any) => l.logro_id)
        );

        const logrosMapeados = (todosLogros ?? []).map((l: any) => ({
          id: l.id,
          titulo: l.nombre,
          descripcion: l.descripcion ?? "",
          icono_url: l.icono_url ?? null,
          desbloqueado: idsDesbloqueados.has(l.id),
        }));

        const perfilData: UsuarioPerfil = {
          ...userData,
          avatar_config: parseAvatarConfig(userData.avatar_config),
          logrosDesbloqueados: logrosMapeados.filter((l) => l.desbloqueado),
          logrosBloqueados: logrosMapeados.filter((l) => !l.desbloqueado),
        };

        setUsuario(perfilData);
        guardarPerfilCache(perfilData);
      } catch (e) {
        console.error("Error inicializando perfil estudiante:", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const estilos = (
    <style>{`
      .perfil-page,
      .perfil-modal-overlay {
        --perfil-accent: var(--fcc-premium-accent);
        --perfil-cyan: var(--fcc-premium-cyan);
        --perfil-surface: var(--fcc-premium-surface);
        --perfil-surface-soft: var(--fcc-premium-surface-soft);
        --perfil-surface-strong: var(--fcc-premium-surface-strong);
        --perfil-text: var(--fcc-premium-text);
        --perfil-heading: var(--fcc-premium-heading);
        --perfil-muted: var(--fcc-premium-muted);
        --perfil-border: var(--fcc-premium-border);
        --perfil-border-strong: var(--fcc-premium-border-strong);

        --perfil-avatar-core: color-mix(in srgb, var(--perfil-cyan) 18%, transparent);
        --perfil-avatar-a: color-mix(in srgb, var(--perfil-accent) 34%, transparent);
        --perfil-avatar-b: color-mix(in srgb, var(--perfil-cyan) 28%, transparent);
        --perfil-avatar-c: color-mix(in srgb, var(--perfil-accent) 26%, transparent);
        --perfil-avatar-border: color-mix(in srgb, var(--perfil-accent) 28%, transparent);
        --perfil-avatar-shadow-a: color-mix(in srgb, var(--perfil-accent) 4%, transparent);
        --perfil-avatar-shadow-b: color-mix(in srgb, var(--perfil-accent) 18%, transparent);
        --perfil-avatar-orbit-a: color-mix(in srgb, var(--perfil-accent) 20%, transparent);
        --perfil-avatar-orbit-b: color-mix(in srgb, var(--perfil-cyan) 22%, transparent);
      }

      .perfil-page {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .perfil-back-link {
        position: absolute;
        left: 16px;
        top: 16px;
        z-index: 5;
        width: fit-content;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 38px;
        padding: 0 12px;
        border-radius: 999px;
        color: var(--perfil-accent);
        font-weight: 950;
        font-size: 0.86rem;
        white-space: nowrap;
        background: color-mix(in srgb, var(--perfil-surface) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--perfil-accent) 16%, var(--perfil-border));
        box-shadow:
          0 12px 26px color-mix(in srgb, var(--perfil-accent) 10%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--perfil-surface-strong) 70%, transparent);
        backdrop-filter: blur(10px);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          box-shadow 170ms ease,
          background 170ms ease;
      }

      .perfil-back-link:hover {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--perfil-surface-strong) 92%, transparent);
        border-color: color-mix(in srgb, var(--perfil-accent) 28%, var(--perfil-border));
        box-shadow: 0 16px 30px color-mix(in srgb, var(--perfil-accent) 14%, transparent);
      }

      .perfil-grid {
        display: grid;
        grid-template-columns: minmax(470px, 540px) minmax(0, 980px);
        gap: 20px;
        align-items: start;
        min-width: 0;
      }

      .perfil-stack {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .perfil-stack-right {
        width: 100%;
      }

      .perfil-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--perfil-surface) 96%, transparent),
            color-mix(in srgb, var(--perfil-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--perfil-accent) 14%, var(--perfil-border));
        box-shadow:
          var(--fcc-premium-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--perfil-surface-strong) 65%, transparent);
      }

      .perfil-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--perfil-accent) 10%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--perfil-accent) 7%, transparent) 22% 22.4%,
            transparent 22.4% 100%
          );
        opacity: 0.9;
      }

      .perfil-xp-card::before {
        background:
          radial-gradient(
            circle at 18% 18%,
            color-mix(in srgb, var(--perfil-cyan) 7%, transparent),
            transparent 30%
          ),
          radial-gradient(
            circle at 82% 78%,
            color-mix(in srgb, var(--perfil-cyan) 5%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--perfil-cyan) 5%, transparent) 22% 22.4%,
            transparent 22.4% 100%
          );
        opacity: 0.68;
      }

      .perfil-card-content {
        position: relative;
        z-index: 2;
      }

      .perfil-user-card {
        padding: 24px 20px 24px;
        min-height: 610px;
        text-align: center;
      }

      .perfil-avatar-stage {
        position: relative;
        width: min(100%, 390px);
        height: 390px;
        margin: 0 auto 6px;
        display: grid;
        place-items: center;
        overflow: visible;
        isolation: isolate;
      }

      .perfil-avatar-stage::before {
        content: "";
        position: absolute;
        width: 82%;
        height: 82%;
        border-radius: 999px;
        background:
          radial-gradient(circle, var(--perfil-avatar-core), transparent 62%),
          conic-gradient(
            from 210deg,
            transparent 0deg,
            var(--perfil-avatar-a) 42deg,
            transparent 84deg,
            var(--perfil-avatar-b) 145deg,
            transparent 210deg,
            var(--perfil-avatar-c) 285deg,
            transparent 360deg
          );
        filter: blur(0.2px);
        opacity: 0.95;
        z-index: -3;
      }

      .perfil-avatar-stage::after {
        content: "";
        position: absolute;
        width: 70%;
        height: 70%;
        border-radius: 999px;
        border: 1px solid var(--perfil-avatar-border);
        box-shadow:
          0 0 0 14px var(--perfil-avatar-shadow-a),
          0 0 42px var(--perfil-avatar-shadow-b);
        z-index: -2;
      }

      .perfil-avatar-orbit {
        position: absolute;
        inset: 17%;
        z-index: -1;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,
            transparent 0 12%,
            var(--perfil-avatar-orbit-a) 12% 18%,
            transparent 18% 100%
          ),
          linear-gradient(
            180deg,
            transparent 0 60%,
            var(--perfil-avatar-orbit-b) 60% 64%,
            transparent 64% 100%
          );
        transform: rotate(-18deg);
        opacity: 0.95;
      }

      .perfil-avatar-render {
        position: relative;
        z-index: 2;
        transform: none;
        transform-origin: center;
      }

      .perfil-name {
        margin-top: 2px;
        color: var(--perfil-heading);
        font-size: clamp(1.85rem, 4vw, 2.5rem);
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.055em;
        overflow-wrap: anywhere;
      }

      .perfil-level {
        margin-top: 10px;
        color: var(--perfil-muted);
        font-size: 1rem;
        font-weight: 850;
      }

      .perfil-primary-button,
      .perfil-secondary-button {
        min-height: 46px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        padding: 0 16px;
        font-size: 0.94rem;
        font-weight: 950;
        transition:
          transform 170ms ease,
          filter 170ms ease,
          background 170ms ease,
          border-color 170ms ease;
      }

      .perfil-primary-button {
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            var(--perfil-accent),
            color-mix(in srgb, var(--perfil-accent) 72%, var(--perfil-cyan))
          );
        box-shadow: 0 14px 26px color-mix(in srgb, var(--perfil-accent) 22%, transparent);
      }

      .theme-oscuro .perfil-primary-button {
        color: #050505;
      }

      .perfil-secondary-button {
        color: var(--perfil-text);
        background: color-mix(in srgb, var(--perfil-surface-strong) 78%, transparent);
        border: 1px solid var(--perfil-border);
      }

      .perfil-primary-button:hover,
      .perfil-secondary-button:hover {
        transform: translateY(-1px);
      }

      .perfil-user-card .perfil-primary-button {
        margin-top: 20px;
        width: 100%;
      }

      .perfil-info-card {
        padding: 20px;
        min-height: 150px;
        text-align: center;
      }

      .perfil-section-title {
        color: var(--perfil-heading);
        font-size: 1.22rem;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .perfil-info-button {
        width: 100%;
        margin-top: 18px;
      }

      .perfil-xp-card {
        padding: 16px 18px;
      }

      .perfil-logros-card {
        padding: 18px 18px 20px;
      }

      .perfil-logros-content {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 24px;
      }

      .perfil-logros-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        text-align: center;
      }

      .perfil-logros-title {
        color: var(--perfil-heading);
        font-size: clamp(1.45rem, 3vw, 1.9rem);
        font-weight: 950;
        letter-spacing: -0.055em;
      }

      .perfil-logros-group {
        display: grid;
        gap: 12px;
        min-width: 0;
      }

      .perfil-subtitle {
        color: var(--perfil-heading);
        font-size: 1.05rem;
        font-weight: 920;
        letter-spacing: -0.035em;
      }

      .perfil-empty {
        color: var(--perfil-muted);
        font-size: 0.92rem;
        font-weight: 750;
        line-height: 1.45;
        padding: 14px 16px;
        border-radius: 18px;
        background: color-mix(in srgb, var(--perfil-surface-strong) 62%, transparent);
        border: 1px solid var(--perfil-border);
      }

      .perfil-logros-grid-wrap {
        width: 100%;
        min-width: 0;
      }

      .perfil-logros-grid-wrap > * {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(74px, 74px)) !important;
        justify-content: start !important;
        justify-items: center !important;
        align-items: center !important;
        gap: 18px 18px !important;
      }

      .perfil-skeleton {
        animation: perfilPulse 1.35s ease-in-out infinite;
      }

      .perfil-skeleton-block {
        border-radius: 18px;
        background: color-mix(in srgb, var(--perfil-border-strong) 30%, transparent);
      }

      .perfil-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, 0.62);
        backdrop-filter: blur(8px);
      }

      .perfil-modal-card {
        position: relative;
        width: min(92vw, 390px);
        overflow: hidden;
        border-radius: 28px;
        padding: 24px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--perfil-surface) 97%, transparent),
            color-mix(in srgb, var(--perfil-surface-soft) 99%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--perfil-accent) 16%, var(--perfil-border));
        box-shadow: var(--fcc-premium-shadow-hover);
      }

      .perfil-modal-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--perfil-accent) 10%, transparent),
            transparent 40%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--perfil-accent) 8%, transparent) 22% 22.5%,
            transparent 22.5% 100%
          );
      }

      .perfil-modal-card > * {
        position: relative;
        z-index: 2;
      }

      .perfil-modal-close {
        position: absolute;
        right: 14px;
        top: 14px;
        z-index: 3;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        color: var(--perfil-text);
        background: color-mix(in srgb, var(--perfil-surface-strong) 76%, transparent);
        border: 1px solid var(--perfil-border);
        font-size: 1.35rem;
        line-height: 1;
        transition: transform 170ms ease;
      }

      .perfil-modal-close:hover {
        transform: scale(1.04);
      }

      .perfil-modal-head {
        display: grid;
        gap: 8px;
        padding-right: 34px;
        margin-bottom: 16px;
      }

      .perfil-kicker {
        color: var(--perfil-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }

      .perfil-modal-head h2 {
        color: var(--perfil-heading);
        font-size: 1.55rem;
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.05em;
      }

      .perfil-input {
        width: 100%;
        min-height: 48px;
        border-radius: 16px;
        padding: 0 14px;
        color: var(--perfil-text);
        background: color-mix(in srgb, var(--perfil-surface-strong) 78%, transparent);
        border: 1px solid color-mix(in srgb, var(--perfil-accent) 18%, var(--perfil-border));
        outline: none;
        font-size: 0.94rem;
        font-weight: 760;
      }

      .perfil-input::placeholder {
        color: var(--perfil-muted);
      }

      .perfil-input:focus {
        border-color: color-mix(in srgb, var(--perfil-accent) 58%, var(--perfil-border));
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--perfil-accent) 12%, transparent);
      }

      .perfil-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 16px;
      }

      @keyframes perfilPulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }

      @media (max-width: 1280px) {
        .perfil-grid {
          grid-template-columns: minmax(420px, 500px) minmax(0, 1fr);
        }
      }

      @media (max-width: 1024px) {
        .perfil-grid {
          grid-template-columns: 1fr;
        }

        .perfil-stack-left,
        .perfil-stack-right {
          max-width: 100%;
        }

        .perfil-user-card {
          min-height: unset;
          max-width: 620px;
          width: 100%;
          margin: 0 auto;
        }

        .perfil-info-card,
        .perfil-xp-card,
        .perfil-logros-card {
          max-width: 100%;
          width: 100%;
          margin: 0 auto;
        }
      }

      @media (max-width: 640px) {
        .perfil-grid {
          gap: 16px;
        }

        .perfil-card {
          border-radius: 24px;
        }

        .perfil-user-card,
        .perfil-info-card,
        .perfil-xp-card,
        .perfil-logros-card {
          padding: 16px;
        }

        .perfil-avatar-stage {
          width: min(100%, 320px);
          height: 320px;
        }

        .perfil-avatar-render {
          transform: scale(0.82);
        }

        .perfil-logros-grid-wrap > * {
          grid-template-columns: repeat(auto-fill, minmax(68px, 68px)) !important;
          gap: 14px 14px !important;
        }

        .perfil-modal-actions {
          flex-direction: column-reverse;
        }

        .perfil-modal-actions button {
          width: 100%;
        }
      }
    `}</style>
  );

  if (loading && !usuario) {
    return (
      <LayoutGeneral rol="estudiante">
        {estilos}

        <div className="perfil-page">

          <div className="perfil-grid">
            <div className="perfil-stack perfil-stack-left">
              <section className="perfil-card perfil-user-card perfil-skeleton">
                <Link href="/dashboard/estudiante" className="perfil-back-link">
                  <ArrowLeft size={18} strokeWidth={2.4} />
                  <span>Volver a inicio</span>
                </Link>

                <div className="perfil-card-content">
                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "305px",
                      height: "305px",
                      borderRadius: "999px",
                      margin: "0 auto",
                    }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "72%",
                      height: "34px",
                      margin: "18px auto 0",
                    }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "32%",
                      height: "18px",
                      margin: "12px auto 0",
                    }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "100%",
                      height: "46px",
                      marginTop: "20px",
                    }}
                  />
                </div>
              </section>

              <section className="perfil-card perfil-info-card perfil-skeleton">
                <div className="perfil-card-content">
                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "48%",
                      height: "26px",
                      margin: "0 auto",
                    }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "100%",
                      height: "46px",
                      marginTop: "18px",
                    }}
                  />
                </div>
              </section>
            </div>

            <div className="perfil-stack perfil-stack-right">
              <section className="perfil-card perfil-xp-card perfil-skeleton">
                <div
                  className="perfil-skeleton-block"
                  style={{ width: "100%", height: "86px" }}
                />
              </section>

              <section className="perfil-card perfil-logros-card perfil-skeleton">
                <div className="perfil-logros-content">
                  <div
                    className="perfil-skeleton-block"
                    style={{
                      width: "34%",
                      height: "32px",
                      margin: "0 auto",
                    }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{ width: "100%", height: "120px" }}
                  />

                  <div
                    className="perfil-skeleton-block"
                    style={{ width: "100%", height: "120px" }}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  if (!usuario) {
    return (
      <LayoutGeneral rol="estudiante">
        {estilos}

        <p style={{ color: "var(--color-muted)" }}>
          No se pudo cargar el perfil.
        </p>
      </LayoutGeneral>
    );
  }

  const level = usuario.nivel ?? Math.floor((usuario.puntos ?? 0) / 500);
  const config: AvatarConfig = usuario.avatar_config ?? defaultAvatar;

  const handleSaveAvatar = async (newConfig: AvatarConfig) => {
    if (!newConfig.gender || !newConfig.skin) {
      toast.error("Debes seleccionar un tipo de cuerpo antes de guardar.");
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .update({ avatar_config: newConfig })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Error al guardar el avatar");
      return;
    }

    setUsuario((u) =>
      u
        ? {
            ...u,
            avatar_config: newConfig,
          }
        : u
    );

    toast.success("Avatar actualizado correctamente");
    setOpenAvatar(false);
  };

  return (
    <LayoutGeneral rol="estudiante">
      {estilos}

      <div className="perfil-page">

        <div className="perfil-grid">
          <div className="perfil-stack perfil-stack-left">
            <section className="perfil-card perfil-user-card">
              <Link href="/dashboard/estudiante" className="perfil-back-link">
                <ArrowLeft size={18} strokeWidth={2.4} />
                <span>Volver a inicio</span>
              </Link>

              <div className="perfil-card-content">
                <div className="perfil-avatar-stage">
                  <span className="perfil-avatar-orbit" />

                  <div className="perfil-avatar-render">
                    <RenderizadorAvatar config={config} size={350} />
                  </div>
                </div>

                <h1 className="perfil-name">{usuario.nombre}</h1>

                <p className="perfil-level">Nivel {level}</p>

                <button
                  className="perfil-primary-button"
                  onClick={() => setOpenAvatar(true)}
                >
                  Cambiar avatar
                </button>
              </div>
            </section>

            <section className="perfil-card perfil-info-card">
              <div className="perfil-card-content">
                <h2 className="perfil-section-title">Información</h2>

                <button
                  className="perfil-primary-button perfil-info-button"
                  onClick={() => setOpenNombre(true)}
                >
                  Editar nombre
                </button>
              </div>
            </section>
          </div>

          <div className="perfil-stack perfil-stack-right">
            <section className="perfil-card perfil-xp-card">
              <div className="perfil-card-content">
                <BarraXP xp={usuario.puntos ?? 0} />
              </div>
            </section>

            <section className="perfil-card perfil-logros-card">
              <div className="perfil-logros-content">
                <div className="perfil-logros-header">
                  <h2 className="perfil-logros-title">Logros</h2>
                </div>

                <div className="perfil-logros-group">
                  <h3 className="perfil-subtitle">Desbloqueados</h3>

                  {usuario.logrosDesbloqueados.length === 0 ? (
                    <p className="perfil-empty">
                      Aún no has desbloqueado logros.
                    </p>
                  ) : (
                    <div className="perfil-logros-grid-wrap">
                      <GridLogros logros={usuario.logrosDesbloqueados} />
                    </div>
                  )}
                </div>

                <div className="perfil-logros-group">
                  <h3 className="perfil-subtitle">Bloqueados</h3>

                  {usuario.logrosBloqueados.length === 0 ? (
                    <p className="perfil-empty">
                      ¡Has desbloqueado todos los logros disponibles!
                    </p>
                  ) : (
                    <div className="perfil-logros-grid-wrap">
                      <GridLogros logros={usuario.logrosBloqueados} />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ModalEditorAvatar
        open={openAvatar}
        onClose={() => setOpenAvatar(false)}
        initialConfig={config}
        onSave={handleSaveAvatar}
      />

      <ModalEditarNombre
        open={openNombre}
        onClose={() => setOpenNombre(false)}
        usuario={usuario}
        setUsuario={setUsuario}
      />
    </LayoutGeneral>
  );
}