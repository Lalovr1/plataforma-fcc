import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { obtenerUsuarioConRolServidor } from "@/lib/rolServidor";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, rol } = await obtenerUsuarioConRolServidor();

  if (!user || !rol) {
    redirect("/login");
  }

  return children;
}