/**
 * Página de curso: valida sesión con Supabase y muestra el visualizador del curso.
 */

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LayoutGeneral from "@/components/LayoutGeneral";
import VisualizadorCurso from "@/components/VisualizadorCurso";

interface Params {
  id: string;
}

export default async function CursoPage({ params }: { params: Params }) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LayoutGeneral>
        <p className="text-red-400">Debes iniciar sesión para ver este curso</p>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral>
      <VisualizadorCurso materiaId={params.id} userId={user.id} />
    </LayoutGeneral>
  );
}
