/**
 * Dashboard principal del estudiante.
 * Muestra información del usuario, sus cursos con progreso,
 * ranking global y barra de experiencia.
 */

import LayoutGeneral from "@/components/LayoutGeneral";
import WidgetRanking from "@/components/WidgetRanking";
import TarjetaUsuario from "@/components/TarjetaUsuario";
import BarraXP from "@/components/BarraXP";
import BloqueXPEnVivo from "@/components/BloqueXPEnVivo";
import SeccionCursos from "@/components/SeccionCursos";
import GridLogros from "@/components/GridLogros";
import TutorialInicio from "@/components/TutorialInicio";

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
      "id, nombre, carrera_id, semestre_id, nivel, puntos, avatar_config"
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

  // ---------- Obtener logros y separarlos ----------
  const { data: todosLogros } = await supabase
    .from("logros")
    .select("id, nombre, descripcion, icono_url, visible");

  const { data: desbloqueados } = await supabase
    .from("logros_usuarios")
    .select("logro_id")
    .eq("usuario_id", user.id);

  const idsDesbloqueados = new Set((desbloqueados ?? []).map((l: any) => l.logro_id));

  const allMapped = (todosLogros ?? []).map((l: any) => ({
    id: l.id,
    titulo: l.nombre,
    descripcion: l.descripcion ?? "",
    icono_url: l.icono_url ?? null,
    desbloqueado: idsDesbloqueados.has(l.id),
  }));

  const logrosDesbloqueados = allMapped.filter((l) => l.desbloqueado);
  const logrosBloqueados = allMapped.filter((l) => !l.desbloqueado);
  // --------------------------------------------------------

  const level = usuario?.nivel ?? 0;
  const nextLevelXP = (level + 1) * 500;

  return (
    <LayoutGeneral rol="estudiante">
      <div className="grid grid-cols-3 gap-6">
        {/* 🧍 Avatar principal */}
        <div className="col-span-2 space-y-6">
          <div className="avatar-principal">
            <TarjetaUsuario
              name={usuario?.nombre ?? "Usuario"}
              level={level}
              avatarConfig={usuario?.avatar_config}
              rol="estudiante"
            />
          </div>

          {/* 📘 Bloque de cursos */}
          <div
            className="bloque-cursos rounded-xl p-4 shadow"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              minHeight: "200px",
            }}
          >
            <SeccionCursos initialCourses={mappedCourses} userId={usuario?.id} />
          </div>
        </div>

        {/* 🧩 Columna derecha */}
        <div className="space-y-6">
          {/* 🏆 Ranking global */}
          <div className="widget-ranking">
            <WidgetRanking />
          </div>

          {/* 💥 Bloque de experiencia */}
          <div
            className="bloque-xp p-4 rounded-xl shadow"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="barra-xp">
              <BloqueXPEnVivo userId={usuario.id} initialXp={usuario?.puntos ?? 0} />
            </div>
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}
