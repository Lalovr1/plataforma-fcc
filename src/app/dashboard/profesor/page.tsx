/**
 * Dashboard del profesor:
 * - Muestra la tarjeta con su avatar, nombre y datos básicos.
 * - Lista de cursos creados con opción para editar.
 * - Widget lateral de ranking global (Top 5).
 */

import LayoutGeneral from "@/components/LayoutGeneral";
import TarjetaUsuario from "@/components/TarjetaUsuario";
import WidgetRanking from "@/components/WidgetRanking";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function ProfesorDashboard() {
  const supabase = createServerComponentClient({ cookies });

  // Usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LayoutGeneral rol="profesor">
        <p className="text-red-400">No se encontró usuario autenticado</p>
      </LayoutGeneral>
    );
  }

  // Datos del profesor
  const { data: profesor } = await supabase
    .from("usuarios")
    .select("id, nombre, avatar_config, frame_url")
    .eq("id", user.id)
    .single();

  // Cursos creados por el profesor
  const { data: cursos } = await supabase
    .from("materias")
    .select(
      `
      id,
      nombre,
      area,
      semestre_id,
      carrera:carreras (id, nombre)
    `
    )
    .eq("profesor_id", user.id);

  return (
    <LayoutGeneral rol="profesor">
      <div className="grid grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="col-span-2 space-y-6">
          <TarjetaUsuario
            name={profesor?.nombre ?? "Profesor"}
            level={0}
            avatarConfig={profesor?.avatar_config}
            frameUrl={profesor?.frame_url}
            rol="profesor"
          />

          {/* Cursos creados */}
          <div className="bg-gray-900 p-6 rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4 text-white">Mis Cursos</h2>
            {cursos && cursos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {cursos.map((c) => (
                  <div
                    key={c.id}
                    className="bg-gray-800 p-4 rounded-lg shadow text-gray-200 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-semibold">{c.nombre}</h3>
                      <p className="text-sm text-gray-400">Área: {c.area}</p>
                      <p className="text-sm text-gray-400">
                        Semestre: {c.semestre_id ?? "N/A"}
                      </p>
                      <p className="text-sm text-gray-400">
                        Carrera: {c.carrera?.nombre ?? "N/A"}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/profesor/cursos/${c.id}/editar`}
                      className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm text-center"
                    >
                      Editar curso
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">
                Aún no has creado cursos. Usa la opción “Agregar curso” en el menú lateral.
              </p>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <WidgetRanking />
        </div>
      </div>
    </LayoutGeneral>
  );
}
