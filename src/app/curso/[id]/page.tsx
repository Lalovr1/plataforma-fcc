/**
 * Página de curso: valida sesión con Supabase y muestra el visualizador del curso.
 */

import { crearSupabaseServidor } from "@/utils/supabaseServer";
import LayoutGeneral from "@/components/LayoutGeneral";
import VisualizadorCurso from "@/components/VisualizadorCurso";

interface Params {
  id: string;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CursoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const supabase = await crearSupabaseServidor();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error("No se pudo confirmar la sesión para abrir el curso");
  }

  if (!user) {
    return (
      <LayoutGeneral>
        <p className="text-red-400">Debes iniciar sesión para ver este curso</p>
      </LayoutGeneral>
    );
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfilError) {
    throw new Error("No se pudo confirmar el rol necesario para abrir el curso");
  }

  const rol = perfil?.rol === "profesor" ? "profesor" : "estudiante";

  return (
    <LayoutGeneral rol={rol}>
      <VisualizadorCurso materiaId={id} userId={user.id} rol={rol} />
    </LayoutGeneral>
  );
}