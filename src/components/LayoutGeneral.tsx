/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral (según rol) y la barra superior,
 * dejando el área central para el contenido dinámico.
 */

"use client";

import { useEffect, useState } from "react";
import MenuLateral from "./MenuLateral";
import BarraSuperiorLogo from "./BarraSuperiorLogo";

export default function LayoutGeneral({
  children,
  rol = "estudiante",
}: {
  children: React.ReactNode;
  rol?: string;
}) {
  const [tema, setTema] = useState<"oscuro" | "claro">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("preferencias_usuario");
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.tema === "oscuro" || prefs.tema === "claro") {
            return prefs.tema;
          }
        }
      } catch {
      }
    }
    return "claro";
  });

  useEffect(() => {
    function handler(e: any) {
      if (e.detail?.tema === "oscuro" || e.detail?.tema === "claro") {
        setTema(e.detail.tema);
      }
    }
    window.addEventListener("app:preferencias", handler);
    return () => window.removeEventListener("app:preferencias", handler);
  }, []);

  useEffect(() => {
    document.body.classList.remove("theme-oscuro", "theme-claro");
    document.body.classList.add(`theme-${tema}`);
  }, [tema]);

  return (
    <div
      className="flex app-root h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <MenuLateral rol={rol} />

      <div className="flex flex-col ml-64">
        <BarraSuperiorLogo />

        <main
          className="fixed top-16 left-64 right-0 bottom-0 p-6 overflow-auto"
          style={{
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
