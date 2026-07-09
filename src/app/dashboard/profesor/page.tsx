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
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

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

  const [{ data: profesor }, { data: cursos }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, avatar_config")
      .eq("id", user.id)
      .single(),

    supabase
      .from("materias")
      .select(
        `
        id,
        nombre,
        curso_carreras (
          id,
          semestre,
          carrera:carreras (id, nombre)
        )
      `
      )
      .eq("profesor_id", user.id)
      .order("nombre", { ascending: true }),
  ]);

  return (
    <LayoutGeneral rol="profesor">
      <style>{`
        .dashboard-profesor-shell {
          --fcc-profesor-panel-bg:
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

          --fcc-profesor-card-bg:
            radial-gradient(
              circle at 92% 8%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );

          --fcc-profesor-border: var(--fcc-premium-border);

          --fcc-profesor-shadow:
            var(--fcc-premium-shadow),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );

          --fcc-profesor-heading:
            var(--fcc-premium-heading, var(--color-heading));

          --fcc-profesor-text:
            var(--fcc-premium-text, var(--color-text));

          --fcc-profesor-muted:
            var(--fcc-premium-text-muted, var(--color-muted));
        }

        .bloque-cursos-profesor {
          background: var(--fcc-profesor-panel-bg);
          border: 1px solid var(--fcc-profesor-border);
          box-shadow: var(--fcc-profesor-shadow);
        }

        .titulo-cursos-profesor {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          color: var(--fcc-profesor-heading);
        }

        .titulo-cursos-profesor::before,
        .titulo-cursos-profesor::after {
          content: "";
          width: 42px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--fcc-premium-accent) 55%, transparent),
            transparent
          );
        }

        .curso-profesor-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 24px;
          padding: clamp(18px, 2.5vw, 26px);
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          text-align: center;
          background:
            radial-gradient(
              circle at 10% 18%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-profesor-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--fcc-profesor-text);
        }

        .curso-profesor-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              125deg,
              transparent 0 66%,
              color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent) 66.3% 66.9%,
              transparent 67.2%
            ),
            linear-gradient(
              125deg,
              transparent 0 74%,
              color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent) 74.2% 74.7%,
              transparent 75%
            );
          opacity: 0.85;
        }

        .curso-profesor-card::after {
          content: "";
          position: absolute;
          right: -20px;
          bottom: -25px;
          width: 220px;
          height: 150px;
          pointer-events: none;
          background:
            linear-gradient(
              color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              color-mix(in srgb, var(--fcc-premium-accent) 5%, transparent) 1px,
              transparent 1px
            );
          background-size: 22px 22px;
          mask-image: radial-gradient(circle at center, black, transparent 72%);
          opacity: 0.7;
        }

        .curso-profesor-contenido {
          position: relative;
          z-index: 2;
          width: 100%;
          min-width: 0;
        }

        .curso-profesor-titulo {
          color: var(--fcc-profesor-heading);
          font-size: clamp(1rem, 1.45vw, 1.18rem);
          font-weight: 950;
          line-height: 1.18;
          letter-spacing: -0.03em;
          text-wrap: balance;
          word-break: break-word;
        }

        .curso-profesor-carreras {
          margin-top: 10px;
          display: grid;
          gap: 4px;
        }

        .curso-profesor-muted {
          color: var(--fcc-profesor-muted);
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1.3;
        }

        .curso-profesor-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          border-radius: 14px;
          padding: 0.5rem 0.85rem;
          font-size: 0.875rem;
          font-weight: 800;
          line-height: 1.1;
          text-align: center;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease,
            background 160ms ease;
        }

        .curso-profesor-btn:hover {
          transform: translateY(-1px);
        }

        .curso-profesor-btn-primary {
          color: white;
          background: linear-gradient(
            135deg,
            var(--fcc-premium-accent),
            color-mix(in srgb, var(--fcc-premium-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
        }

        .curso-profesor-btn-secondary {
          color: var(--fcc-premium-accent);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 78%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--fcc-premium-accent) 24%,
            var(--fcc-profesor-border)
          );
        }

        .curso-profesor-empty {
          color: var(--fcc-profesor-muted);
        }
      `}</style>

      <div className="dashboard-profesor-shell grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 min-w-0">
        <div className="xl:col-span-2 space-y-4 md:space-y-6 min-w-0">
          <div className="avatar-principal">
            <TarjetaUsuario
              name={profesor?.nombre ?? "Profesor"}
              level={0}
              avatarConfig={profesor?.avatar_config}
              rol="profesor"
            />
          </div>

          <div className="bloque-cursos-profesor rounded-[28px] p-4 sm:p-6 min-w-0 overflow-hidden">
            <h2 className="titulo-cursos-profesor text-xl md:text-2xl font-black mb-5">
              Mis cursos
            </h2>

            {cursos && cursos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {cursos.map((c: any) => (
                  <div
                    key={c.id}
                    className="curso-profesor-card rounded-[22px] p-4 sm:p-5 min-w-0 flex flex-col justify-between"
                  >
                    <div className="curso-profesor-contenido">
                      <h3 className="curso-profesor-titulo">{c.nombre}</h3>

                      <div className="curso-profesor-carreras">
                        {c.curso_carreras && c.curso_carreras.length > 0 ? (
                          c.curso_carreras.map((cc: any) => (
                            <p key={cc.id} className="curso-profesor-muted">
                              {cc.carrera?.nombre ?? "Desconocida"}
                            </p>
                          ))
                        ) : (
                          <p className="curso-profesor-muted">Sin carreras asignadas</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-5">
                      <Link
                        href={`/dashboard/profesor/cursos/${c.id}/editar`}
                        className="curso-profesor-btn curso-profesor-btn-primary flex-1"
                      >
                        Editar curso
                      </Link>

                      <Link
                        href={`/curso/${c.id}`}
                        className="curso-profesor-btn curso-profesor-btn-secondary flex-1"
                      >
                        Previsualizar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="curso-profesor-card rounded-[22px] p-5">
                <p className="curso-profesor-empty text-sm font-semibold">
                  Aún no has creado cursos. Usa la opción “Agregar curso” en el
                  menú lateral.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 md:space-y-6 min-w-0">
          <div className="widget-ranking">
            <WidgetRanking />
          </div>
        </div>
      </div>
    </LayoutGeneral>
  );
}