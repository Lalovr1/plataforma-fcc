import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  const supabase = createServerComponentClient({
    cookies: () => cookieStore,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const correo = user.email?.toLowerCase() ?? "";

  const esEstudiante =
    correo.endsWith("@alumno.buap.mx") ||
    correo.endsWith("@alm.buap.mx");

  const esProfesor = correo.endsWith("@correo.buap.mx");

  if (!esProfesor) {
    if (esEstudiante) {
      redirect("/dashboard/estudiante");
    }

    redirect("/login");
  }

  return <>{children}</>;
}