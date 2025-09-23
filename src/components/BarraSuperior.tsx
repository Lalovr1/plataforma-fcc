/**
 * Barra superior de la plataforma.
 * Muestra el botón de notificaciones y el avatar del usuario.
 */

import AvatarConMarco from "@/components/AvatarConMarco";

export default function BarraSuperior() {
  return (
    <header className="flex justify-end items-center gap-4 p-4 bg-gray-900 border-b border-gray-700">
      <button className="text-gray-300 hover:text-white">
        🔔
      </button>

      <AvatarConMarco size={40} />
    </header>
  );
}
