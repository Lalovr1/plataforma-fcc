/**
 * Dashboard principal del estudiante.
 * Muestra información del usuario, sus cursos con progreso,
 * ranking global, barra de experiencia y precarga Mi horario.
 */

import LayoutGeneral from "@/components/LayoutGeneral";
import WidgetRanking from "@/components/WidgetRanking";
import TarjetaUsuario from "@/components/TarjetaUsuario";
import BloqueXPEnVivo from "@/components/BloqueXPEnVivo";
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

  const [
    { data: usuario },
    { data: cursos },
    { data: quizzesMateria },
    { data: intentosUsuario },
    { data: horarioUsuario },
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, carrera_id, semestre_id, nivel, puntos, avatar_config")
      .eq("id", user.id)
      .single(),

    supabase
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
      .eq("visible", true),

    supabase.from("quizzes").select("id, materia_id"),

    supabase
      .from("intentos_quiz")
      .select("quiz_id, usuario_id")
      .eq("usuario_id", user.id)
      .eq("completado", true),

    supabase
      .from("horarios_usuario")
      .select("datos")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const quizzesPorMateria = new Map<string, string[]>();

  (quizzesMateria ?? []).forEach((quiz: any) => {
    if (!quiz.materia_id) return;

    const actuales = quizzesPorMateria.get(quiz.materia_id) ?? [];
    actuales.push(quiz.id);
    quizzesPorMateria.set(quiz.materia_id, actuales);
  });

  const quizzesCompletados = new Set(
    (intentosUsuario ?? []).map((intento: any) => intento.quiz_id)
  );

  let mappedCourses =
    (cursos ?? [])
      .map((c: any) => {
        const materia = Array.isArray(c.materia) ? c.materia[0] : c.materia;

        if (!materia?.id) return null;

        const quizzesCurso = quizzesPorMateria.get(materia.id) ?? [];

        const completadosUnicos = quizzesCurso.filter((quizId) =>
          quizzesCompletados.has(quizId)
        ).length;

        const progresoReal =
          quizzesCurso.length > 0
            ? Math.round((completadosUnicos / quizzesCurso.length) * 100)
            : 0;

        return {
          id: materia.id,
          name: materia.nombre,
          progress: progresoReal,
          progresoId: c.id,
          progresoGuardado: Number(c.progreso ?? 0),
        };
      })
      .filter(Boolean) as {
      id: string;
      name: string;
      progress: number;
      progresoId: string;
      progresoGuardado: number;
    }[];

  const actualizacionesPendientes = mappedCourses
    .filter((curso) => curso.progresoGuardado !== curso.progress)
    .map((curso) =>
      supabase
        .from("progreso")
        .update({ progreso: curso.progress })
        .eq("id", curso.progresoId)
    );

  if (actualizacionesPendientes.length > 0) {
    await Promise.all(actualizacionesPendientes);
  }

  mappedCourses = mappedCourses
    .map(({ progresoGuardado, ...curso }) => curso)
    .sort((a, b) => {
      if (b.progress !== a.progress) {
        return b.progress - a.progress;
      }

      return a.name.localeCompare(b.name);
    });

  const level = usuario?.nivel ?? 0;

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .dashboard-estudiante-shell {
          --fcc-dashboard-course-bg:
            radial-gradient(
              circle at 88% 12%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );

          --fcc-dashboard-course-border: var(--fcc-premium-border);

          --fcc-dashboard-course-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .bloque-cursos {
          background: var(--fcc-dashboard-course-bg);
          border: 1px solid var(--fcc-dashboard-course-border);
          box-shadow: var(--fcc-dashboard-course-shadow);
        }
      `}</style>

      <div className="dashboard-estudiante-shell grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 min-w-0">
        <div className="xl:col-span-2 space-y-4 md:space-y-6 min-w-0">
          <div className="avatar-principal">
            <TarjetaUsuario
              name={usuario?.nombre ?? "Usuario"}
              level={level}
              avatarConfig={usuario?.avatar_config}
              rol="estudiante"
              initialHorarioDatos={horarioUsuario?.datos ?? null}
            />
          </div>

          <div className="bloque-cursos rounded-[28px] min-w-0 overflow-hidden">
            <SeccionCursos
              initialCourses={mappedCourses}
              userId={usuario?.id ?? user.id}
            />
          </div>
        </div>

        <div className="space-y-4 md:space-y-6 min-w-0">
          <div className="widget-ranking">
            <WidgetRanking />
          </div>

          <div className="barra-xp">
            <BloqueXPEnVivo
              userId={usuario?.id ?? user.id}
              initialXp={usuario?.puntos ?? 0}
            />
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
