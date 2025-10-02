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

  const { data: usuario } = await supabase
    .from("usuarios")
    .select(
      "id, nombre, carrera_id, semestre_id, nivel, puntos, avatar_config, frame_url"
    )
    .eq("id", user.id)
    .single();

  const { data: progresoExistente } = await supabase
    .from("progreso")
    .select("materia_id")
    .eq("usuario_id", user.id);

  if (!progresoExistente || progresoExistente.length === 0) {
    if (usuario?.carrera_id && usuario?.semestre_id) {
      const { data: cursoCarreras } = await supabase
        .from("curso_carreras")
        .select("curso_id, cursos ( id, nombre )")
        .eq("carrera_id", usuario.carrera_id)
        .eq("semestre", usuario.semestre_id);

      if (cursoCarreras && cursoCarreras.length > 0) {
        await supabase.from("progreso").insert(
          cursoCarreras.map((cc) => ({
            usuario_id: usuario.id,
            materia_id: cc.curso_id,
            progreso: 0,
            visible: true,
          }))
        );
      }
    }
  }

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

  const { data: quizzesMateria } = await supabase
    .from("quizzes")
    .select("id, materia_id");

  const { data: intentosUsuario } = await supabase
    .from("intentos_quiz")
    .select("quiz_id, usuario_id")
    .eq("usuario_id", user.id)
    .eq("completado", true);

  let mappedCourses: any[] = [];

  if (cursos && cursos.length > 0) {
    mappedCourses = await Promise.all(
      cursos.map(async (c) => {
        const quizzesCurso = (quizzesMateria || []).filter(
          (q) => q.materia_id === c.materia.id
        );

        const intentosCurso = (intentosUsuario || []).filter((i) =>
          quizzesCurso.map((q) => q.id).includes(i.quiz_id)
        );

        const completadosUnicos = new Set(
          intentosCurso.map((i) => i.quiz_id)
        ).size;

        const progresoReal =
          quizzesCurso.length > 0
            ? Math.round((completadosUnicos / quizzesCurso.length) * 100)
            : 0;

        await supabase
          .from("progreso")
          .update({ progreso: progresoReal })
          .eq("id", c.id);

        return {
          id: c.materia.id,
          name: c.materia.nombre,
          progress: progresoReal,
          progresoId: c.id,
        };
      })
    );

    mappedCourses.sort((a, b) => {
      if (b.progress !== a.progress) {
        return b.progress - a.progress;
      }
      return a.name.localeCompare(b.name);
    });
  }

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
          <SeccionCursos initialCourses={mappedCourses} userId={usuario?.id} />
        </div>

        <div className="space-y-6">
          <WidgetRanking />
          {/* 📌 Tarjeta XP */}
          <div
            className="p-4 rounded-xl shadow"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            <BarraXP
              currentXP={usuario?.puntos ?? 0}
              nextLevelXP={nextLevelXP}
            />
          </div>
          {/* 📌 Tarjeta Logros */}
          <div
            className="p-4 rounded-xl shadow"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            <h3 className="font-bold mb-2" style={{ color: "var(--color-heading)" }}>
              Logros
            </h3>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Aún no has desbloqueado logros. ¡Sigue participando!
            </p>
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
