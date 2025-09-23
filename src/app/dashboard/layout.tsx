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

  // Usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rol por defecto → estudiante
  let rol: "estudiante" | "profesor" = "estudiante";
  if (user) {
    rol = user.email?.endsWith("@alumno.buap.mx") ? "estudiante" : "profesor";
  }

  return (
    <div className="flex min-h-screen">
      <MenuLateral rol={rol} />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
