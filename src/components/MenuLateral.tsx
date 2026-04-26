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
  Menu,
  X,
} from "lucide-react";

interface Props {
  rol: string;
}

export default function MenuLateral({ rol }: Props) {
  const linkStyle: React.CSSProperties = {
    color: "var(--color-text)",
  };

  const [menuAbierto, setMenuAbierto] = useState(false);

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
      <>
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="lg:hidden fixed top-3 left-3 z-40 rounded-lg p-2 shadow-md"
          style={{
            backgroundColor: "var(--color-card)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>

        {menuAbierto && (
          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            aria-label="Cerrar menú"
          />
        )}

        <aside
          className={`menu-lateral fixed top-0 left-0 h-full w-56 flex flex-col justify-between shadow-lg z-50 transition-transform duration-300 ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
        pointerEvents: tutorialActivo ? "none" : "auto", 
      }}
    >
      <div>
        <div
          className="relative flex items-center justify-center p-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <img src="/logo.png" alt="FCC Maths" className="w-full max-w-[170px] h-auto mx-auto" />
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 hover:opacity-80"
              style={{ color: "var(--color-text)" }}
              aria-label="Cerrar menú"
            >
              <X size={22} />
            </button>
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
    </>
  );
}
