/**
 * Página de perfil del profesor: muestra avatar, información
 * y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import ModalEditorAvatar from "@/components/ModalEditorAvatar";
import toast from "react-hot-toast";

const CACHE_KEY_BASE = "fcc_academy_perfil_profesor_v1";

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

function guardarPerfilCache(usuario: any) {
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

function leerPerfilCache(usuarioId: string) {
  try {
    const raw = sessionStorage.getItem(getCacheKey(usuarioId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.usuario) return null;

    return {
      ...parsed.usuario,
      avatar_config: parseAvatarConfig(parsed.usuario.avatar_config),
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
  usuario: any;
  setUsuario: any;
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

    setUsuario((u: any) => ({
      ...u,
      nombre: nombreLimpio,
    }));

    onClose();
  };

  return createPortal(
    <div className="perfil-profesor-modal-overlay" onClick={onClose}>
      <div
        className="perfil-profesor-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="perfil-profesor-modal-close"
          title="Cerrar"
        >
          ×
        </button>

        <div className="perfil-profesor-modal-head">
          <p className="perfil-profesor-kicker">Perfil docente</p>
          <h2>Editar nombre</h2>
        </div>

        <input
          type="text"
          value={nombreLocal}
          onChange={(e) => setNombreLocal(e.target.value)}
          className="perfil-profesor-input"
          placeholder="Ingresa tu nombre"
        />

        <div className="perfil-profesor-modal-actions">
          <button
            type="button"
            className="perfil-profesor-secondary-button"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="perfil-profesor-primary-button"
            onClick={handleSave}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PerfilProfesorPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [openNombre, setOpenNombre] = useState(false);

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

        const { data, error } = await supabase
          .from("usuarios")
          .select("id, nombre, puntos, nivel, avatar_config")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error cargando perfil profesor:", error);
          return;
        }

        const usuarioData = {
          ...data,
          avatar_config: parseAvatarConfig(data?.avatar_config),
        };

        setUsuario(usuarioData);
        guardarPerfilCache(usuarioData);
      } catch (e) {
        console.error("Error inicializando perfil profesor:", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (usuario?.id) {
      guardarPerfilCache(usuario);
    }
  }, [usuario]);

  const estilos = (
    <style>{`
      .perfil-profesor-page,
      .perfil-profesor-modal-overlay {
        --perfil-profesor-accent: var(--fcc-premium-accent);
        --perfil-profesor-cyan: var(--fcc-premium-cyan);
        --perfil-profesor-surface: var(--fcc-premium-surface);
        --perfil-profesor-surface-soft: var(--fcc-premium-surface-soft);
        --perfil-profesor-surface-strong: var(--fcc-premium-surface-strong);
        --perfil-profesor-text: var(--fcc-premium-text);
        --perfil-profesor-heading: var(--fcc-premium-text);
        --perfil-profesor-muted: var(--fcc-premium-muted);
        --perfil-profesor-border: var(--fcc-premium-border);
        --perfil-profesor-border-strong: var(--fcc-premium-border-strong);

        --perfil-profesor-avatar-core: color-mix(in srgb, var(--perfil-profesor-cyan) 18%, transparent);
        --perfil-profesor-avatar-a: color-mix(in srgb, var(--perfil-profesor-accent) 34%, transparent);
        --perfil-profesor-avatar-b: color-mix(in srgb, var(--perfil-profesor-cyan) 28%, transparent);
        --perfil-profesor-avatar-c: color-mix(in srgb, var(--perfil-profesor-accent) 26%, transparent);
        --perfil-profesor-avatar-border: color-mix(in srgb, var(--perfil-profesor-accent) 28%, transparent);
        --perfil-profesor-avatar-shadow-a: color-mix(in srgb, var(--perfil-profesor-accent) 4%, transparent);
        --perfil-profesor-avatar-shadow-b: color-mix(in srgb, var(--perfil-profesor-accent) 18%, transparent);
        --perfil-profesor-avatar-orbit-a: color-mix(in srgb, var(--perfil-profesor-accent) 20%, transparent);
        --perfil-profesor-avatar-orbit-b: color-mix(in srgb, var(--perfil-profesor-cyan) 22%, transparent);
      }

      .perfil-profesor-page {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .perfil-profesor-grid {
        display: grid;
        grid-template-columns: minmax(360px, 540px) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
        min-width: 0;
      }

      .perfil-profesor-stack {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .perfil-profesor-card {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--perfil-profesor-surface) 96%, transparent),
            color-mix(in srgb, var(--perfil-profesor-surface-soft) 98%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--perfil-profesor-accent) 14%, var(--perfil-profesor-border));
        box-shadow:
          var(--fcc-premium-shadow-soft),
          inset 0 1px 0 color-mix(in srgb, var(--perfil-profesor-surface-strong) 65%, transparent);
      }

      .perfil-profesor-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--perfil-profesor-accent) 9%, transparent),
            transparent 34%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--perfil-profesor-accent) 7%, transparent) 22% 22.4%,
            transparent 22.4% 100%
          );
        opacity: 0.78;
      }

      .perfil-profesor-card-content {
        position: relative;
        z-index: 2;
      }

      .perfil-profesor-user-card {
        padding: 24px 20px 24px;
        min-height: 610px;
        text-align: center;
      }

      .perfil-profesor-back-link {
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
        color: var(--perfil-profesor-accent);
        font-weight: 950;
        font-size: 0.86rem;
        white-space: nowrap;
        background: color-mix(in srgb, var(--perfil-profesor-surface) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--perfil-profesor-accent) 16%, var(--perfil-profesor-border));
        box-shadow:
          0 12px 26px color-mix(in srgb, var(--perfil-profesor-accent) 10%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--perfil-profesor-surface-strong) 70%, transparent);
        backdrop-filter: blur(10px);
        transition:
          transform 170ms ease,
          border-color 170ms ease,
          box-shadow 170ms ease,
          background 170ms ease;
      }

      .perfil-profesor-back-link:hover {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--perfil-profesor-surface-strong) 92%, transparent);
        border-color: color-mix(in srgb, var(--perfil-profesor-accent) 28%, var(--perfil-profesor-border));
        box-shadow: 0 16px 30px color-mix(in srgb, var(--perfil-profesor-accent) 14%, transparent);
      }

      .perfil-profesor-avatar-stage {
        position: relative;
        width: min(100%, 390px);
        height: 390px;
        margin: 0 auto 6px;
        display: grid;
        place-items: center;
        overflow: visible;
        isolation: isolate;
      }

      .perfil-profesor-avatar-stage::before {
        content: "";
        position: absolute;
        width: 82%;
        height: 82%;
        border-radius: 999px;
        background:
          radial-gradient(circle, var(--perfil-profesor-avatar-core), transparent 62%),
          conic-gradient(
            from 210deg,
            transparent 0deg,
            var(--perfil-profesor-avatar-a) 42deg,
            transparent 84deg,
            var(--perfil-profesor-avatar-b) 145deg,
            transparent 210deg,
            var(--perfil-profesor-avatar-c) 285deg,
            transparent 360deg
          );
        filter: blur(0.2px);
        opacity: 0.95;
        z-index: -3;
      }

      .perfil-profesor-avatar-stage::after {
        content: "";
        position: absolute;
        width: 70%;
        height: 70%;
        border-radius: 999px;
        border: 1px solid var(--perfil-profesor-avatar-border);
        box-shadow:
          0 0 0 14px var(--perfil-profesor-avatar-shadow-a),
          0 0 42px var(--perfil-profesor-avatar-shadow-b);
        z-index: -2;
      }

      .perfil-profesor-avatar-orbit {
        position: absolute;
        inset: 17%;
        z-index: -1;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,
            transparent 0 12%,
            var(--perfil-profesor-avatar-orbit-a) 12% 18%,
            transparent 18% 100%
          ),
          linear-gradient(
            180deg,
            transparent 0 60%,
            var(--perfil-profesor-avatar-orbit-b) 60% 64%,
            transparent 64% 100%
          );
        transform: rotate(-18deg);
        opacity: 0.95;
      }

      .perfil-profesor-avatar-render {
        position: relative;
        z-index: 2;
        transform: none;
        transform-origin: center;
      }

      .perfil-profesor-name {
        margin-top: 2px;
        color: var(--perfil-profesor-heading);
        font-size: clamp(1.85rem, 4vw, 2.5rem);
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.055em;
        overflow-wrap: anywhere;
      }

      .perfil-profesor-role {
        margin-top: 10px;
        color: var(--perfil-profesor-muted);
        font-size: 1rem;
        font-weight: 850;
      }

      .perfil-profesor-primary-button,
      .perfil-profesor-secondary-button {
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
          background 170ms ease,
          border-color 170ms ease,
          box-shadow 170ms ease;
      }

      .perfil-profesor-primary-button {
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            var(--perfil-profesor-accent),
            color-mix(in srgb, var(--perfil-profesor-accent) 72%, var(--perfil-profesor-cyan))
          );
        box-shadow: 0 14px 26px color-mix(in srgb, var(--perfil-profesor-accent) 22%, transparent);
      }

      .theme-oscuro .perfil-profesor-primary-button {
        color: #050505;
      }

      .perfil-profesor-secondary-button {
        color: var(--perfil-profesor-text);
        background: color-mix(in srgb, var(--perfil-profesor-surface-strong) 78%, transparent);
        border: 1px solid var(--perfil-profesor-border);
      }

      .perfil-profesor-primary-button:hover,
      .perfil-profesor-secondary-button:hover {
        transform: translateY(-1px);
      }

      .perfil-profesor-user-card .perfil-profesor-primary-button {
        margin-top: 20px;
        width: 100%;
      }

      .perfil-profesor-info-card {
        padding: 20px;
        min-height: 150px;
        text-align: center;
      }

      .perfil-profesor-section-title {
        color: var(--perfil-profesor-heading);
        font-size: 1.22rem;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .perfil-profesor-info-button {
        width: 100%;
        margin-top: 18px;
      }

      .perfil-profesor-skeleton {
        animation: perfilProfesorPulse 1.35s ease-in-out infinite;
      }

      .perfil-profesor-skeleton-block {
        border-radius: 18px;
        background: color-mix(in srgb, var(--perfil-profesor-border-strong) 30%, transparent);
      }

      .perfil-profesor-modal-overlay {
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

      .perfil-profesor-modal-card {
        position: relative;
        width: min(92vw, 390px);
        overflow: hidden;
        border-radius: 28px;
        padding: 24px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--perfil-profesor-surface) 97%, transparent),
            color-mix(in srgb, var(--perfil-profesor-surface-soft) 99%, transparent)
          );
        border: 1px solid color-mix(in srgb, var(--perfil-profesor-accent) 16%, var(--perfil-profesor-border));
        box-shadow: var(--fcc-premium-shadow-hover);
      }

      .perfil-profesor-modal-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            circle at 50% 0%,
            color-mix(in srgb, var(--perfil-profesor-accent) 10%, transparent),
            transparent 40%
          ),
          linear-gradient(
            135deg,
            transparent 0 22%,
            color-mix(in srgb, var(--perfil-profesor-accent) 8%, transparent) 22% 22.5%,
            transparent 22.5% 100%
          );
      }

      .perfil-profesor-modal-card > * {
        position: relative;
        z-index: 2;
      }

      .perfil-profesor-modal-close {
        position: absolute;
        right: 14px;
        top: 14px;
        z-index: 3;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        color: var(--perfil-profesor-text);
        background: color-mix(in srgb, var(--perfil-profesor-surface-strong) 76%, transparent);
        border: 1px solid var(--perfil-profesor-border);
        font-size: 1.35rem;
        line-height: 1;
        transition: transform 170ms ease;
      }

      .perfil-profesor-modal-close:hover {
        transform: scale(1.04);
      }

      .perfil-profesor-modal-head {
        display: grid;
        gap: 8px;
        padding-right: 34px;
        margin-bottom: 16px;
      }

      .perfil-profesor-kicker {
        color: var(--perfil-profesor-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }

      .perfil-profesor-modal-head h2 {
        color: var(--perfil-profesor-heading);
        font-size: 1.55rem;
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.05em;
      }

      .perfil-profesor-input {
        width: 100%;
        min-height: 48px;
        border-radius: 16px;
        padding: 0 14px;
        color: var(--perfil-profesor-text);
        background: color-mix(in srgb, var(--perfil-profesor-surface-strong) 78%, transparent);
        border: 1px solid color-mix(in srgb, var(--perfil-profesor-accent) 18%, var(--perfil-profesor-border));
        outline: none;
        font-size: 0.94rem;
        font-weight: 760;
      }

      .perfil-profesor-input::placeholder {
        color: var(--perfil-profesor-muted);
      }

      .perfil-profesor-input:focus {
        border-color: color-mix(in srgb, var(--perfil-profesor-accent) 58%, var(--perfil-profesor-border));
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--perfil-profesor-accent) 12%, transparent);
      }

      .perfil-profesor-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 16px;
      }

      @keyframes perfilProfesorPulse {
        0%, 100% {
          opacity: 0.58;
        }
        50% {
          opacity: 1;
        }
      }

      @media (max-width: 1280px) {
        .perfil-profesor-grid {
          grid-template-columns: minmax(420px, 500px) minmax(0, 1fr);
        }
      }

      @media (max-width: 1024px) {
        .perfil-profesor-grid {
          grid-template-columns: 1fr;
        }

        .perfil-profesor-user-card {
          min-height: unset;
          max-width: 620px;
          width: 100%;
          margin: 0 auto;
        }

        .perfil-profesor-info-card {
          max-width: 100%;
          width: 100%;
          margin: 0 auto;
        }
      }

      @media (max-width: 640px) {
        .perfil-profesor-grid {
          gap: 16px;
        }

        .perfil-profesor-card {
          border-radius: 24px;
        }

        .perfil-profesor-user-card,
        .perfil-profesor-info-card {
          padding: 16px;
        }

        .perfil-profesor-avatar-stage {
          width: min(100%, 320px);
          height: 320px;
        }

        .perfil-profesor-avatar-render {
          transform: scale(0.82);
        }

        .perfil-profesor-modal-actions {
          flex-direction: column-reverse;
        }

        .perfil-profesor-modal-actions button {
          width: 100%;
        }
      }
    `}</style>
  );

  if (loading && !usuario) {
    return (
      <LayoutGeneral rol="profesor">
        {estilos}

        <div className="perfil-profesor-page">
          <div className="perfil-profesor-grid">
            <div className="perfil-profesor-stack">
              <section className="perfil-profesor-card perfil-profesor-user-card perfil-profesor-skeleton">
                <Link href="/dashboard/profesor" className="perfil-profesor-back-link">
                  <ArrowLeft size={18} strokeWidth={2.4} />
                  <span>Volver a inicio</span>
                </Link>

                <div className="perfil-profesor-card-content">
                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "305px",
                      height: "305px",
                      borderRadius: "999px",
                      margin: "0 auto",
                    }}
                  />

                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "72%",
                      height: "34px",
                      margin: "18px auto 0",
                    }}
                  />

                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "32%",
                      height: "18px",
                      margin: "12px auto 0",
                    }}
                  />

                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "100%",
                      height: "46px",
                      marginTop: "20px",
                    }}
                  />
                </div>
              </section>

              <section className="perfil-profesor-card perfil-profesor-info-card perfil-profesor-skeleton">
                <div className="perfil-profesor-card-content">
                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "48%",
                      height: "26px",
                      margin: "0 auto",
                    }}
                  />

                  <div
                    className="perfil-profesor-skeleton-block"
                    style={{
                      width: "100%",
                      height: "46px",
                      marginTop: "18px",
                    }}
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
      <LayoutGeneral rol="profesor">
        {estilos}

        <p style={{ color: "var(--color-muted)" }}>
          No se pudo cargar el perfil.
        </p>
      </LayoutGeneral>
    );
  }

  const config: AvatarConfig = usuario.avatar_config ?? defaultAvatar;

  const handleSave = async (newConfig: AvatarConfig) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ avatar_config: newConfig })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Error al guardar avatar");
      return;
    }

    toast.success("Avatar actualizado correctamente");

    setUsuario((u: any) => ({
      ...u,
      avatar_config: newConfig,
    }));

    setOpen(false);
  };

  return (
    <LayoutGeneral rol="profesor">
      {estilos}

      <div className="perfil-profesor-page">
        <div className="perfil-profesor-grid">
          <div className="perfil-profesor-stack">
            <section className="perfil-profesor-card perfil-profesor-user-card">
              <Link href="/dashboard/profesor" className="perfil-profesor-back-link">
                <ArrowLeft size={18} strokeWidth={2.4} />
                <span>Volver a inicio</span>
              </Link>

              <div className="perfil-profesor-card-content">
                <div className="perfil-profesor-avatar-stage">
                  <span className="perfil-profesor-avatar-orbit" />

                  <div className="perfil-profesor-avatar-render">
                    <RenderizadorAvatar config={config} size={350} />
                  </div>
                </div>

                <h1 className="perfil-profesor-name">{usuario.nombre}</h1>

                <p className="perfil-profesor-role">Perfil docente</p>

                <button
                  type="button"
                  className="perfil-profesor-primary-button"
                  onClick={() => setOpen(true)}
                >
                  Cambiar avatar
                </button>
              </div>
            </section>

            <section className="perfil-profesor-card perfil-profesor-info-card">
              <div className="perfil-profesor-card-content">
                <h2 className="perfil-profesor-section-title">Información</h2>

                <button
                  type="button"
                  className="perfil-profesor-primary-button perfil-profesor-info-button"
                  onClick={() => setOpenNombre(true)}
                >
                  Editar nombre
                </button>
              </div>
            </section>
          </div>

        </div>
      </div>

      <ModalEditorAvatar
        open={open}
        onClose={() => setOpen(false)}
        initialConfig={config}
        onSave={handleSave}
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
