/**
 * Encabezado del dashboard.
 * Muestra un saludo personalizado con el nombre, nivel y avatar del usuario.
 */

import Image from "next/image";

interface EncabezadoDashboardProps {
  name: string;
  level: number;
  avatarUrl?: string;
}

export default function EncabezadoDashboard({
  name,
  level,
  avatarUrl = "/avatar.png",
}: EncabezadoDashboardProps) {
  return (
    <header className="flex items-center justify-between bg-gray-900 p-4 rounded-lg shadow mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bienvenido, {name}</h1>
        <p className="text-gray-400">Nivel {level}</p>
      </div>

      <div className="flex items-center space-x-3">
        <Image
          src={avatarUrl}
          alt="Avatar"
          width={40}
          height={40}
          className="rounded-full border-2 border-cyan-500"
        />
      </div>
    </header>
  );
}
