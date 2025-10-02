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

  const { data: profesor } = await supabase
    .from("usuarios")
    .select("id, nombre, avatar_config, frame_url")
    .eq("id", user.id)
    .single();

  const { data: cursos } = await supabase
    .from("materias")
    .select(`
      id,
      nombre,
      curso_carreras (
        id,
        semestre,
        carrera:carreras (id, nombre)
      )
    `)
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
          <div
            className="p-6 rounded-xl shadow"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--color-heading)" }}
            >
              Mis Cursos
            </h2>
            {cursos && cursos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {cursos.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-lg shadow flex flex-col justify-between"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    <div>
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: "var(--color-heading)" }}
                      >
                        {c.nombre}
                      </h3>

                      {c.curso_carreras && c.curso_carreras.length > 0 ? (
                        c.curso_carreras.map((cc: any) => (
                          <p
                            key={cc.id}
                            className="text-sm"
                            style={{ color: "var(--color-muted)" }}
                          >
                            Carrera: {cc.carrera?.nombre ?? "Desconocida"} —{" "}
                            Semestre: {cc.semestre ?? "N/A"}
                          </p>
                        ))
                      ) : (
                        <p
                          className="text-sm"
                          style={{ color: "var(--color-muted)" }}
                        >
                          Sin carreras asignadas
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Link
                        href={`/dashboard/profesor/cursos/${c.id}/editar`}
                        className="flex-1 text-white px-3 py-1 rounded-lg text-sm text-center"
                        style={{ backgroundColor: "#2563eb" }}
                      >
                        Editar curso
                      </Link>

                      <Link
                        href={`/curso/${c.id}`}
                        className="flex-1 text-white px-3 py-1 rounded-lg text-sm text-center"
                        style={{ backgroundColor: "#16a34a" }}
                      >
                        Previsualizar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--color-muted)" }}>
                Aún no has creado cursos. Usa la opción “Agregar curso” en el
                menú lateral.
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
