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
  GraduationCap,
} from "lucide-react";

interface Props {
  rol: string;
}

export default function MenuLateral({ rol }: Props) {
  const linkStyle: React.CSSProperties = {
    color: "var(--color-text)",
  };

  return (
    <aside
      className="fixed top-0 left-0 h-full w-64 flex flex-col justify-between shadow-lg z-20"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
      }}
    >
      <div>
        <div
          className="p-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <img src="/logo.png" alt="FCC Maths" className="w-full h-auto" />
        </div>

        <nav className="mt-4 flex flex-col gap-1">
          {rol === "estudiante" && (
            <>
              <Link
                href="/dashboard/estudiante"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <Home size={20} /> Inicio
              </Link>
              <Link
                href="/dashboard/estudiante/cursos"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <BookOpen size={20} /> Cursos
              </Link>
              <Link
                href="/dashboard/estudiante/ranking"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <Trophy size={20} /> Ranking
              </Link>
              <Link
                href="/dashboard/estudiante/amigos"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <Users size={20} /> Amigos
              </Link>
              <Link
                href="/dashboard/estudiante/profesores"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <GraduationCap size={20} /> Profesores
              </Link>
            </>
          )}

          {rol === "profesor" && (
            <>
              <Link
                href="/dashboard/profesor"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <Home size={20} /> Inicio
              </Link>
              <Link
                href="/dashboard/profesor/cursos"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <BookOpen size={20} /> Cursos
              </Link>
              <Link
                href="/dashboard/profesor/ranking"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <Trophy size={20} /> Ranking
              </Link>
              <Link
                href="/dashboard/profesor/agregar-curso"
                className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
                style={linkStyle}
              >
                <PlusCircle size={20} /> Agregar curso
              </Link>
            </>
          )}

          <Link
            href="/dashboard/configuracion"
            className="flex items-center gap-3 px-4 py-2 rounded-md hover:opacity-80"
            style={linkStyle}
          >
            <Settings size={20} /> Configuración
          </Link>
        </nav>
      </div>

      <button
        onClick={() => {
          window.location.href = "/login";
        }}
        className="flex items-center gap-3 px-4 py-3 rounded-md hover:opacity-80"
        style={{
          color: "#f87171", // rojo
        }}
      >
        <LogOut size={20} /> Cerrar sesión
      </button>
    </aside>
  );
}
