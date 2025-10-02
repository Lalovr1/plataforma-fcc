/**
 * Redirección raíz del dashboard:
 * - Si no hay usuario autenticado → va a /login.
 * - Si el rol es profesor → va a /dashboard/profesor.
 * - Caso contrario (alumno) → va a /dashboard/estudiante.
 */

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardRoot() {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const rol =
    user?.email?.endsWith("@alumno.buap.mx") || user?.email?.endsWith("@alm.buap.mx")
      ? "estudiante"
      : "profesor";

  if (rol === "profesor") {
    redirect("/dashboard/profesor");
  }

  redirect("/dashboard/estudiante");
}
