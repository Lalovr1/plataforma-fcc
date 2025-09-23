/**
 * Dashboard principal del estudiante.
 * Muestra información del usuario, sus cursos con progreso,
 * ranking global y barra de experiencia.
 */

import LayoutGeneral from "@/components/LayoutGeneral";
import WidgetRanking from "@/components/WidgetRanking";
import TarjetaUsuario from "@/components/TarjetaUsuario";
import BarraXP from "@/components/BarraXP";
import SeccionCursos from "@/components/SeccionCursos";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function EstudianteDashboard() {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  // Obtener usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LayoutGeneral rol="estudiante">
        <p className="text-red-400">No se encontró usuario autenticado</p>
      </LayoutGeneral>
    );
  }

  // Traer datos del usuario en tabla `usuarios`
  const { data: usuario } = await supabase
    .from("usuarios")
    .select(
      "id, nombre, carrera_id, semestre_id, nivel, puntos, avatar_config, frame_url"
    )
    .eq("id", user.id)
    .single();

  // Revisar si ya tiene progreso registrado
  const { data: progresoExistente } = await supabase
    .from("progreso")
    .select("materia_id")
    .eq("usuario_id", user.id);

  // Si no tiene progreso → insertar materias iniciales
  if (!progresoExistente || progresoExistente.length === 0) {
    if (usuario?.carrera_id && usuario?.semestre_id) {
      const { data: materias } = await supabase
        .from("materias")
        .select("id, nombre")
        .eq("carrera_id", usuario.carrera_id)
        .eq("semestre_id", usuario.semestre_id);

      if (materias && materias.length > 0) {
        await supabase.from("progreso").insert(
          materias.map((m) => ({
            usuario_id: usuario.id,
            materia_id: m.id,
            progreso: 0,
            visible: true,
          }))
        );
      }
    }
  }

  // Traer cursos visibles para mostrar en el dashboard
  const { data: cursos } = await supabase
    .from("progreso")
    .select(
      `
      id,
      progreso,
      visible,
      materia: materias ( id, nombre )
    `
    )
    .eq("usuario_id", user.id)
    .eq("visible", true);

  const mappedCourses =
    cursos?.map((c) => ({
      id: c.materia.id,
      name: c.materia.nombre,
      progress: c.progreso,
      progresoId: c.id,
    })) ?? [];

  // Calcular nivel y XP
  const level = usuario?.nivel ?? Math.floor((usuario?.puntos ?? 0) / 1000);
  const nextLevelXP = (level + 1) * 1000;

  return (
    <LayoutGeneral rol="estudiante">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <TarjetaUsuario
            name={usuario?.nombre ?? "Usuario"}
            level={level}
            avatarConfig={usuario?.avatar_config}
            frameUrl={usuario?.frame_url}
            rol="estudiante"
          />
          <SeccionCursos initialCourses={mappedCourses} />
        </div>

        <div className="space-y-6">
          <WidgetRanking />
          <div className="bg-gray-900 p-4 rounded-xl shadow">
            <BarraXP currentXP={usuario?.puntos ?? 0} nextLevelXP={nextLevelXP} />
          </div>
          <div className="bg-gray-900 p-4 rounded-xl shadow">
            <h3 className="font-bold mb-2">Logros</h3>
            <p className="text-gray-400 text-sm">
              Aún no has desbloqueado logros. ¡Sigue participando!
            </p>
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
