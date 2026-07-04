/**
 * Página de perfil del profesor: muestra avatar, nivel, barra de XP,
 * logros y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative p-4 sm:p-6 rounded-xl shadow w-[92vw] max-w-sm"
        style={{ backgroundColor: "var(--color-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
          style={{
            backgroundColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          title="Cerrar"
        >
          ×
        </button>

        <h2
          className="text-xl font-bold mb-4 pr-8"
          style={{ color: "var(--color-heading)" }}
        >
          Editar nombre
        </h2>

        <input
          type="text"
          value={nombreLocal}
          onChange={(e) => setNombreLocal(e.target.value)}
          className="w-full p-2 rounded-lg border"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text)",
          }}
          placeholder="Ingresa tu nombre"
        />

        <div className="flex flex-col-reverse sm:flex-row justify-end mt-4 gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition"
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

  if (loading && !usuario) {
    return (
      <LayoutGeneral rol="profesor">
        <div className="space-y-4 sm:space-y-8 min-w-0">
          <div
            className="flex flex-col items-center rounded-xl p-4 sm:p-8 shadow overflow-hidden animate-pulse"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
            }}
          >
            <div
              className="w-56 h-56 rounded-full"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            <div
              className="h-8 rounded w-48 mt-6"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            <div
              className="h-10 rounded-lg w-36 mt-4"
              style={{ backgroundColor: "var(--color-border)" }}
            />
          </div>

          <div
            className="p-4 sm:p-6 rounded-xl shadow animate-pulse"
            style={{ backgroundColor: "var(--color-card)" }}
          >
            <div
              className="h-7 rounded w-32 mb-4"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            <div
              className="h-10 rounded-lg w-32"
              style={{ backgroundColor: "var(--color-border)" }}
            />
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  if (!usuario) {
    return (
      <LayoutGeneral rol="profesor">
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
      <div className="space-y-4 sm:space-y-8 min-w-0">
        <div
          className="flex flex-col items-center rounded-xl p-4 sm:p-8 shadow overflow-hidden"
          style={{
            backgroundColor: "var(--color-card)",
            color: "var(--color-text)",
          }}
        >
          <div className="scale-[0.7] sm:scale-100 -my-12 sm:my-0">
            <RenderizadorAvatar config={config} size={350} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mt-2 sm:mt-4 text-center break-words max-w-full">
            {usuario.nombre}
          </h1>

          <button
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
            onClick={() => setOpen(true)}
          >
            Cambiar avatar
          </button>
        </div>

        <div
          className="p-4 sm:p-6 rounded-xl shadow"
          style={{ backgroundColor: "var(--color-card)" }}
        >
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "var(--color-heading)" }}
          >
            Información
          </h2>

          <button
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
            onClick={() => setOpenNombre(true)}
          >
            Editar nombre
          </button>
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