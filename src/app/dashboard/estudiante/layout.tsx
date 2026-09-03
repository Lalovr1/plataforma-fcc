import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { obtenerUsuarioConRolServidor } from "@/lib/rolServidor";

export default async function EstudianteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, rol } = await obtenerUsuarioConRolServidor();

  if (!user) {
    redirect("/login");
  }

  if (rol === "profesor") {
    redirect("/dashboard/profesor");
  }

  if (rol !== "estudiante") {
    redirect("/login");
  }

  return children;
}