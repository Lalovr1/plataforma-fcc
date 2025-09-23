/**
 * Menú lateral principal.
 * Muestra opciones de navegación distintas para estudiante y profesor,
 * además de accesos comunes como configuración y cerrar sesión.
 */

"use client";

import Link from "next/link";
import {
  BookOpen,
  Trophy,
  Star,
  Users,
  Settings,
  LogOut,
  Home,
  PlusCircle,
} from "lucide-react";

interface Props {
  rol: string;
}

export default function MenuLateral({ rol }: Props) {
  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-gray-950 flex flex-col justify-between shadow-lg z-20">
      <div>
        <div className="p-4 border-b border-gray-900">
          <img src="/logo.png" alt="FCC Maths" className="w-full h-auto" />
        </div>

        <nav className="mt-4 flex flex-col gap-1">
          {rol === "estudiante" && (
            <>
              <Link
                href="/dashboard/estudiante"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Home size={20} /> Inicio
              </Link>
              <Link
                href="/dashboard/estudiante/cursos"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <BookOpen size={20} /> Cursos
              </Link>
              <Link
                href="/dashboard/estudiante/ranking"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Trophy size={20} /> Ranking
              </Link>
              <Link
                href="/dashboard/logros"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Star size={20} /> Logros
              </Link>
              <Link
                href="/dashboard/amigos"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Users size={20} /> Amigos
              </Link>
            </>
          )}

          {rol === "profesor" && (
            <>
              <Link
                href="/dashboard/profesor"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Home size={20} /> Inicio
              </Link>
              <Link
                href="/dashboard/profesor/cursos"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <BookOpen size={20} /> Cursos
              </Link>
              <Link
                href="/dashboard/profesor/ranking"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <Trophy size={20} /> Ranking
              </Link>
              <Link
                href="/dashboard/profesor/agregar-curso"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
              >
                <PlusCircle size={20} /> Agregar curso
              </Link>
            </>
          )}

          <Link
            href="/dashboard/configuracion"
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-900"
          >
            <Settings size={20} /> Configuración
          </Link>
        </nav>
      </div>

      <button
        onClick={() => {
          window.location.href = "/login";
        }}
        className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-gray-900"
      >
        <LogOut size={20} /> Cerrar sesión
      </button>
    </aside>
  );
}
