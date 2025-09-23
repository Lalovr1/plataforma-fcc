/**
 * Página de perfil del estudiante: muestra avatar, nivel, barra de XP,
 * logros y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useState } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import BarraXP from "@/components/BarraXP";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import ModalEditorAvatar from "@/components/ModalEditorAvatar";

export default function PerfilEstudiantePage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, nivel, avatar_config, frame_url")
        .eq("id", user.id)
        .single();

      setUsuario(data);
    };
    run();
  }, []);

  if (!usuario) {
    return (
      <LayoutGeneral rol="estudiante">
        <p className="text-gray-400">Cargando perfil...</p>
      </LayoutGeneral>
    );
  }

  const level = usuario.nivel ?? Math.floor((usuario.puntos ?? 0) / 1000);
  const nextLevelXP = (level + 1) * 1000;

  const config: AvatarConfig =
    usuario?.avatar_config ?? {
      skin: "default.png",
      eyes: "none",
      mouth: "none",
      eyebrow: "none",
      hair: "none",
      clothes: "none",
      accessory: "none",
    };

  const handleSave = async (newConfig: AvatarConfig, frameUrl: string | null) => {
    await supabase
      .from("usuarios")
      .update({ avatar_config: newConfig, frame_url: frameUrl })
      .eq("id", usuario.id);

    setUsuario((u: any) => ({ ...u, avatar_config: newConfig, frame_url: frameUrl }));
    setOpen(false);
  };

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-8">
        <div className="flex flex-col items-center bg-gray-800 rounded-xl p-8 shadow">
          <RenderizadorAvatar config={config} frameUrl={usuario.frame_url} size={200} />
          <h1 className="text-3xl font-bold mt-4">{usuario.nombre}</h1>
          <p className="text-gray-400">Nivel {level}</p>

          <button
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
            onClick={() => setOpen(true)}
          >
            Cambiar avatar
          </button>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-2">Experiencia</h2>
          <BarraXP currentXP={usuario.puntos ?? 0} nextLevelXP={nextLevelXP} />
        </div>

        <div className="bg-gray-900 p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4">Logros</h2>
          <p className="text-gray-400 text-sm">
            Aún no has desbloqueado logros. ¡Sigue participando!
          </p>
        </div>
      </div>

      <ModalEditorAvatar
        open={open}
        onClose={() => setOpen(false)}
        initialConfig={config}
        initialFrameUrl={usuario.frame_url}
        onSave={handleSave}
      />
    </LayoutGeneral>
  );
}
