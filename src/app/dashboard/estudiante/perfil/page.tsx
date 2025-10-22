/**
 * Página de perfil del estudiante: muestra avatar, nivel, barra de XP,
 * logros (divididos en desbloqueados y bloqueados)
 * y permite editar la configuración del avatar.
 */

"use client";

import { useEffect, useState } from "react";
import LayoutGeneral from "@/components/LayoutGeneral";
import BarraXP from "@/components/BarraXP";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import ModalEditorAvatar from "@/components/ModalEditorAvatar";
import toast from "react-hot-toast";
import GridLogros from "@/components/GridLogros";

// Modal para editar nombre
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
    if (open) setNombreLocal(usuario?.nombre ?? "");
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

export default function PerfilEstudiantePage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [openAvatar, setOpenAvatar] = useState(false);
  const [openNombre, setOpenNombre] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("usuarios")
        .select("id, nombre, puntos, nivel, avatar_config")
        .eq("id", user.id)
        .single();

      if (!userData) return;

      const { data: desbloqueados } = await supabase
        .from("logros_usuarios")
        .select("logro_id")
        .eq("usuario_id", user.id);

      const idsDesbloqueados = new Set(desbloqueados?.map((l) => l.logro_id));

      const { data: todosLogros } = await supabase
        .from("logros")
        .select("id,nombre,descripcion,icono_url");

      const logrosDesbloqueados = (todosLogros ?? [])
        .filter((l) => idsDesbloqueados.has(l.id))
        .map((l) => ({
          id: l.id,
          titulo: l.nombre,
          descripcion: l.descripcion,
          icono_url: l.icono_url,
          desbloqueado: true,
        }));

      const logrosBloqueados = (todosLogros ?? [])
        .filter((l) => !idsDesbloqueados.has(l.id))
        .map((l) => ({
          id: l.id,
          titulo: l.nombre,
          descripcion: l.descripcion,
          icono_url: l.icono_url,
          desbloqueado: false,
        }));

      setUsuario({
        ...userData,
        logrosDesbloqueados,
        logrosBloqueados,
      });
    };
    run();
  }, []);

  if (!usuario) {
    return (
      <LayoutGeneral rol="estudiante">
        <p style={{ color: "var(--color-muted)" }}>Cargando perfil...</p>
      </LayoutGeneral>
    );
  }

  const level = usuario.nivel ?? Math.floor((usuario.puntos ?? 0) / 500);

  const config: AvatarConfig =
    usuario.avatar_config ??
    {
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
    }

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
    } else {
      setUsuario((u: any) => ({ ...u, avatar_config: newConfig }));
      toast.success("Avatar actualizado correctamente");
      setOpenAvatar(false);
    }
  };

  return (
    <LayoutGeneral rol="estudiante">
      <div className="grid grid-cols-3 gap-8">
        {/* Columna izquierda (avatar + editar nombre) */}
        <div className="col-span-1 space-y-6">
          {/* Tarjeta avatar */}
          <div
            className="flex flex-col items-center rounded-xl p-8 shadow"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <RenderizadorAvatar config={config} size={350} />
            <h1 className="text-3xl font-bold mt-4">{usuario.nombre}</h1>
            <p style={{ color: "var(--color-muted)" }}>Nivel {level}</p>

            <button
              className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
              onClick={() => setOpenAvatar(true)}
            >
              Cambiar avatar
            </button>
          </div>

          {/* Tarjeta información */}
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

        {/* Columna derecha (experiencia + logros) */}
        <div className="col-span-2 space-y-6">
          {/* Experiencia */}
          <div
            className="text-2xl p-6 rounded-xl shadow"
            style={{ backgroundColor: "var(--color-card)" }}
          >
            <BarraXP xp={usuario.puntos ?? 0} />
          </div>

          {/* Logros */}
          <div
            className="p-6 rounded-xl shadow space-y-8"
            style={{ backgroundColor: "var(--color-card)" }}
          >
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-heading)" }}
            >
              Logros
            </h2>

            {/* Desbloqueados */}
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

            {/* Bloqueados */}
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

      {/* Modales */}
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
