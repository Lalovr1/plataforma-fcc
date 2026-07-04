/**
 * Página de perfil del estudiante: muestra avatar, nivel, barra de XP,
 * logros (divididos en desbloqueados y bloqueados)
 * y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  useEffect(() => {
    if (usuario?.id) {
      guardarPerfilCache(usuario);
    }
  }, [usuario]);

  if (loading && !usuario) {
    return (
      <LayoutGeneral rol="estudiante">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 min-w-0">
          <div className="lg:col-span-1 space-y-4 lg:space-y-6 min-w-0">
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
                className="h-4 rounded w-20 mt-3"
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

          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            <div
              className="text-base sm:text-2xl p-4 sm:p-6 rounded-xl shadow animate-pulse"
              style={{ backgroundColor: "var(--color-card)" }}
            >
              <div
                className="h-8 rounded w-40 mb-4"
                style={{ backgroundColor: "var(--color-border)" }}
              />

              <div
                className="h-5 rounded w-full"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            </div>

            <div
              className="p-4 sm:p-6 rounded-xl shadow space-y-6 sm:space-y-8 animate-pulse"
              style={{ backgroundColor: "var(--color-card)" }}
            >
              <div
                className="h-8 rounded w-32"
                style={{ backgroundColor: "var(--color-border)" }}
              />

              <div
                className="h-28 rounded-lg"
                style={{ backgroundColor: "var(--color-bg)" }}
              />

              <div
                className="h-28 rounded-lg"
                style={{ backgroundColor: "var(--color-bg)" }}
              />
            </div>
          </div>
        </div>
      </LayoutGeneral>
    );
  }

  if (!usuario) {
    return (
      <LayoutGeneral rol="estudiante">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 min-w-0">
        <div className="lg:col-span-1 space-y-4 lg:space-y-6 min-w-0">
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

            <p style={{ color: "var(--color-muted)" }}>Nivel {level}</p>

            <button
              className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
              onClick={() => setOpenAvatar(true)}
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

        <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
          <div
            className="text-base sm:text-2xl p-4 sm:p-6 rounded-xl shadow"
            style={{ backgroundColor: "var(--color-card)" }}
          >
            <BarraXP xp={usuario.puntos ?? 0} />
          </div>

          <div
            className="p-4 sm:p-6 rounded-xl shadow space-y-6 sm:space-y-8 overflow-visible"
            style={{ backgroundColor: "var(--color-card)" }}
          >
            <h2
              className="text-xl sm:text-2xl font-bold"
              style={{ color: "var(--color-heading)" }}
            >
              Logros
            </h2>

            <div>
              <h3
                className="font-semibold mb-3 text-lg"
                style={{ color: "var(--color-heading)" }}
              >
                Desbloqueados
              </h3>

              {usuario.logrosDesbloqueados.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Aún no has desbloqueado logros.
                </p>
              ) : (
                <GridLogros logros={usuario.logrosDesbloqueados} />
              )}
            </div>

            <div>
              <h3
                className="font-semibold mb-3 text-lg"
                style={{ color: "var(--color-heading)" }}
              >
                Bloqueados
              </h3>

              {usuario.logrosBloqueados.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  ¡Has desbloqueado todos los logros disponibles!
                </p>
              ) : (
                <GridLogros logros={usuario.logrosBloqueados} />
              )}
            </div>
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