/**
 * Herramientas académicas del estudiante.
 * Centraliza utilidades como horario, calendario escolar,
 * entregas/exámenes y mapa curricular.
 */

import LayoutGeneral from "@/components/LayoutGeneral";
import {
  CalendarDays,
  Clock3,
  ClipboardList,
  Map,
  ArrowRight,
} from "lucide-react";

const herramientas = [
  {
    titulo: "Mi horario",
    descripcion:
      "Crea un horario visual con tus materias, salones, profesores y colores personalizados.",
    estado: "Primera versión",
    icono: Clock3,
    href: "/dashboard/estudiante/herramientas/horario",
  },
  {
    titulo: "Calendario escolar",
    descripcion:
      "Consulta fechas importantes del periodo escolar, vacaciones, días inhábiles y periodos académicos.",
    estado: "Próximamente",
    icono: CalendarDays,
    href: "/dashboard/estudiante/herramientas/calendario",
  },
  {
    titulo: "Entregas y exámenes",
    descripcion:
      "Registra tareas, proyectos, exámenes y revisiones importantes para tenerlas presentes.",
    estado: "Próximamente",
    icono: ClipboardList,
    href: "/dashboard/estudiante/herramientas/entregas",
  },
  {
    titulo: "Mapa curricular",
    descripcion:
      "Marca materias cursadas, revisa tu avance académico y visualiza qué materias te faltan.",
    estado: "Próximamente",
    icono: Map,
    href: "/dashboard/estudiante/herramientas/mapa-curricular",
  },
];

export default function HerramientasAcademicasPage() {
  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-5 md:space-y-6 min-w-0">
        <section
          className="rounded-2xl p-5 md:p-6 shadow min-w-0 overflow-hidden"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <div className="max-w-3xl">
            <p
              className="text-sm font-medium mb-2"
              style={{ color: "var(--color-primary)" }}
            >
              Herramientas académicas
            </p>

            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              Organiza tu semestre desde FCC Academy
            </h1>

            <p
              className="text-sm md:text-base leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              En esta sección podrás tener a la mano utilidades pensadas para
              estudiantes: tu horario, fechas importantes, entregas, exámenes y
              avance curricular.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {herramientas.map((herramienta) => {
            const Icono = herramienta.icono;
            const disponible = herramienta.estado === "Primera versión";

            return (
              <a
                key={herramienta.titulo}
                href={disponible ? herramienta.href : "#"}
                aria-disabled={!disponible}
                className={`group rounded-2xl p-5 shadow transition-transform min-h-[240px] flex flex-col justify-between ${
                  disponible
                    ? "hover:-translate-y-1 cursor-pointer"
                    : "cursor-not-allowed opacity-75"
                }`}
                style={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                        color: "var(--color-primary)",
                      }}
                    >
                      <Icono size={24} />
                    </div>

                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: disponible
                          ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                          : "color-mix(in srgb, var(--color-muted) 14%, transparent)",
                        color: disponible
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                      }}
                    >
                      {herramienta.estado}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold mb-2">
                    {herramienta.titulo}
                  </h2>

                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {herramienta.descripcion}
                  </p>
                </div>

                <div
                  className="mt-5 flex items-center gap-2 text-sm font-semibold"
                  style={{
                    color: disponible
                      ? "var(--color-primary)"
                      : "var(--color-muted)",
                  }}
                >
                  {disponible ? "Abrir herramienta" : "Se agregará después"}
                  <ArrowRight
                    size={16}
                    className={disponible ? "group-hover:translate-x-1 transition-transform" : ""}
                  />
                </div>
              </a>
            );
          })}
        </section>

        <section
          className="rounded-2xl p-5 md:p-6 shadow"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <h2 className="text-lg font-bold mb-2">Primera herramienta</h2>

          <p
            className="text-sm md:text-base leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            Empezaremos con <strong>Mi horario</strong>, para que el estudiante
            pueda construir un horario visual, personalizarlo y después
            descargarlo como imagen.
          </p>
        </section>
      </div>
    </LayoutGeneral>
  );
}