/**
 * Página de perfil del profesor: muestra avatar, nivel, barra de XP,
 * logros y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useState } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import ModalEditorAvatar from "@/components/ModalEditorAvatar";
import toast from "react-hot-toast";

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
    const { error } = await supabase
      .from("usuarios")
      .update({ nombre: nombreLocal })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Error al guardar cambios");
    } else {
      toast.success("Nombre actualizado correctamente");
      setUsuario((u: any) => ({ ...u, nombre: nombreLocal }));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className="p-6 rounded-xl shadow w-96"
        style={{ backgroundColor: "var(--color-card)" }}
      >
        <h2
          className="text-xl font-bold mb-4"
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
        <div className="flex justify-end mt-4 space-x-2">
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
    </div>
  );
}

export default function PerfilProfesorPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [openNombre, setOpenNombre] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, nivel, avatar_config")
        .eq("id", user.id)
        .single();

      setUsuario(data);
    };
    run();
  }, []);

  if (!usuario) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-gray-400">Cargando perfil...</p>
      </LayoutGeneral>
    );
  }

  const level = usuario.nivel ?? Math.floor((usuario.puntos ?? 0) / 500);
  const config: AvatarConfig = usuario.avatar_config;

  const handleSave = async (newConfig: AvatarConfig) => {
    await supabase
      .from("usuarios")
      .update({ avatar_config: newConfig })
      .eq("id", usuario.id);

    setUsuario((u: any) => ({ ...u, avatar_config: newConfig }));
    setOpen(false);
  };

  return (
    <LayoutGeneral rol="profesor">
      <div className="space-y-8">
        <div
          className="flex flex-col items-center rounded-xl p-8 shadow"
          style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
        >
          <RenderizadorAvatar config={config} size={350} />
          <h1 className="text-3xl font-bold mt-4">{usuario.nombre}</h1>

          <button
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
            onClick={() => setOpen(true)}
          >
            Cambiar avatar
          </button>
        </div>

        <div
          className="p-6 rounded-xl shadow"
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
