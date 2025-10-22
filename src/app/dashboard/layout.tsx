/**
 * Layout principal del dashboard:
 * - Determina el rol del usuario (estudiante o profesor) según su correo.
 * - Renderiza el menú lateral correspondiente y el contenido dinámico.
 */

import MenuLateral from "@/components/MenuLateral";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rol: "estudiante" | "profesor" = "estudiante";
  if (user) {
    if (user?.email?.endsWith("@alumno.buap.mx") || user?.email?.endsWith("@alm.buap.mx")) {
      rol = "estudiante";
    } else {
      rol = "profesor";
    }
  }

  return (
    <div className="flex-1">{children}</div>
  );
}
