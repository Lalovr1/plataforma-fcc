/**
 * Este componente define la estructura base de las páginas internas.
 * Incluye el menú lateral (según rol) y la barra superior,
 * dejando el área central para el contenido dinámico.
 */

"use client";

import MenuLateral from "./MenuLateral";
import BarraSuperiorLogo from "./BarraSuperiorLogo";

export default function LayoutGeneral({
  children,
  rol = "estudiante",
}: {
  children: React.ReactNode;
  rol?: string;
}) {
  return (
    <div className="flex">
      <MenuLateral rol={rol} />

      <div className="flex-1 flex flex-col ml-64">
        <BarraSuperiorLogo />
        <main className="flex-1 p-6 mt-16">{children}</main>
      </div>
    </div>
  );
}
