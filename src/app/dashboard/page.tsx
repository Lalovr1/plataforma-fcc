import { redirect } from "next/navigation";
import { obtenerUsuarioConRolServidor } from "@/lib/rolServidor";

export default async function DashboardPage() {
  const { user, rol } = await obtenerUsuarioConRolServidor();

  if (!user) {
    redirect("/login");
  }

  if (rol === "profesor") {
    redirect("/dashboard/profesor");
  }

  if (rol === "estudiante") {
    redirect("/dashboard/estudiante");
  }

  redirect("/login");
}