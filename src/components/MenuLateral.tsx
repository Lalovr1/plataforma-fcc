/**
 * Menú lateral principal.
 * Muestra opciones de navegación distintas para estudiante y profesor,
 * además de accesos comunes como configuración y cerrar sesión.
 */

"use client";

import { useEffect, useState } from "react";
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

  const [tutorialActivo, setTutorialActivo] = useState<boolean>(() =>
    typeof window !== "undefined" ? !!(window as any).__tutorialActivo : false
  );

  useEffect(() => {
    const handler = (e: any) => setTutorialActivo(!!e.detail?.activo);
    window.addEventListener("tutorial:estado", handler);

    setTutorialActivo(
      typeof window !== "undefined" ? !!(window as any).__tutorialActivo : false
    );

    return () => window.removeEventListener("tutorial:estado", handler);
  }, []);

  return (
    <aside
      className="menu-lateral fixed top-0 left-0 h-full w-64 flex flex-col justify-between shadow-lg z-20"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
        pointerEvents: tutorialActivo ? "none" : "auto", 
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
        onClick={async () => {
          const { supabase } = await import("@/utils/supabaseClient");

          try {
            await supabase.auth.signOut();
          } catch (err) {
            console.error("Error al cerrar sesión en Supabase:", err);
          }

          window.dispatchEvent(new Event("logout"));

          localStorage.clear();
          window.location.href = "/login";
        }}
        className="flex items-center gap-3 px-4 py-3 rounded-md hover:opacity-80"
        style={{
          color: "#f87171",
        }}
      >
        <LogOut size={20} /> Cerrar sesión
      </button>
    </aside>
  );
}
