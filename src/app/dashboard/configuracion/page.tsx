/**
 * Página de Configuración de Usuario
 * - Cambiar tema (oscuro/claro)
 * - Previsualizar cambios al instante
 * - Guardar en Supabase una sola vez al salir de configuración si hubo cambios
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";

type Tema = "oscuro" | "claro";

function esTemaValido(valor: any): valor is Tema {
  return valor === "oscuro" || valor === "claro";
}

function leerTemaDesdeLocalStorage(): Tema | null {
  try {
    const saved = localStorage.getItem("preferencias_usuario");
    if (!saved) return null;

    const prefs = JSON.parse(saved);
    if (esTemaValido(prefs.tema)) return prefs.tema;
  } catch {}

  return null;
}

function leerTemaActual(): Tema {
  const temaLocal = leerTemaDesdeLocalStorage();
  if (temaLocal) return temaLocal;

  try {
    if (
      document.documentElement.classList.contains("theme-oscuro") ||
      document.body.classList.contains("theme-oscuro")
    ) {
      return "oscuro";
    }
  } catch {}

  return "claro";
}

function aplicarTemaEnApp(nuevoTema: Tema) {
  localStorage.setItem(
    "preferencias_usuario",
    JSON.stringify({ tema: nuevoTema })
  );

  window.dispatchEvent(
    new CustomEvent("app:preferencias", {
      detail: { tema: nuevoTema },
    })
  );
}

export default function PaginaConfiguracion() {
  const [rol, setRol] = useState<"estudiante" | "profesor">("estudiante");
  const [tema, setTema] = useState<Tema | null>(null);

  const temaActualRef = useRef<Tema | null>(null);
  const temaGuardadoRef = useRef<Tema | null>(null);
  const userIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const temaInicial = leerTemaActual();

    setTema(temaInicial);
    temaActualRef.current = temaInicial;
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const temaLocal = leerTemaDesdeLocalStorage();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        userIdRef.current = user.id;

        const { data: u } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", user.id)
          .single();

        if (u?.rol === "profesor") setRol("profesor");

        const { data: pref } = await supabase
          .from("configuraciones_usuario")
          .select("tema")
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (esTemaValido(pref?.tema)) {
          temaGuardadoRef.current = pref.tema;

          if (!temaLocal) {
            setTema(pref.tema);
            temaActualRef.current = pref.tema;
            aplicarTemaEnApp(pref.tema);
          }
        } else {
          temaGuardadoRef.current = temaActualRef.current ?? leerTemaActual();
        }
      } catch (e) {
        console.error(e);
      }
    }

    init();

    return () => {
      const temaFinal = temaActualRef.current;
      const temaGuardado = temaGuardadoRef.current;

      if (!temaFinal || temaFinal === temaGuardado) return;

      void guardarTemaEnSupabase(temaFinal);
    };
  }, []);

  async function guardarTemaEnSupabase(temaParaGuardar: Tema) {
    try {
      let userId = userIdRef.current;

      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        userId = user?.id ?? null;
      }

      if (!userId) return;

      const { error } = await supabase.from("configuraciones_usuario").upsert(
        {
          usuario_id: userId,
          tema: temaParaGuardar,
        },
        { onConflict: "usuario_id" }
      );

      if (error) throw error;

      temaGuardadoRef.current = temaParaGuardar;
    } catch (e) {
      console.error("No se pudo guardar el tema:", e);
    }
  }

  function aplicarTemaSeleccionado(nuevoTema: Tema) {
    setTema(nuevoTema);
    temaActualRef.current = nuevoTema;
    aplicarTemaEnApp(nuevoTema);
  }

  const getButtonStyle = (isActive: boolean) => ({
    border: isActive ? "2px solid #22d3ee" : `1px solid var(--color-border)`,
    backgroundColor: isActive ? "var(--color-card)" : "var(--color-bg)",
    color: "var(--color-text)",
    cursor: "pointer",
  });

  return (
    <LayoutGeneral rol={rol}>
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          Configuración
        </h1>

        {/* Tema */}
        <section
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            className="font-semibold mb-3"
            style={{ color: "var(--color-heading)" }}
          >
            Tema
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => aplicarTemaSeleccionado("oscuro")}
              className="px-4 py-2 rounded-lg w-full sm:w-auto"
              style={getButtonStyle(tema === "oscuro")}
            >
              Oscuro
            </button>

            <button
              onClick={() => aplicarTemaSeleccionado("claro")}
              className="px-4 py-2 rounded-lg w-full sm:w-auto"
              style={getButtonStyle(tema === "claro")}
            >
              Claro
            </button>
          </div>
        </section>

        {/* Vista previa */}
        <section
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            className="font-semibold mb-3"
            style={{ color: "var(--color-heading)" }}
          >
            Vista previa
          </h2>

          <div
            className="rounded-xl overflow-hidden border"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="grid grid-cols-[72px_1fr] min-h-[260px]">
              <div
                className="p-3 border-r flex flex-col gap-3"
                style={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div
                  className="h-8 rounded"
                  style={{ backgroundColor: "var(--color-primary)" }}
                />

                <div className="space-y-2 mt-2">
                  <div
                    className="h-3 rounded"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                  <div
                    className="h-3 rounded"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                  <div
                    className="h-3 rounded"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                  <div
                    className="h-3 rounded"
                    style={{ backgroundColor: "var(--color-border)" }}
                  />
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className="text-lg font-bold"
                      style={{ color: "var(--color-heading)" }}
                    >
                      Inicio
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--color-muted)" }}
                    >
                      Así se verían tus tarjetas y contenido principal.
                    </div>
                  </div>

                  <div
                    className="w-12 h-12 rounded-full"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-3 border"
                    style={{
                      backgroundColor: "var(--color-card)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "var(--color-heading)" }}
                    >
                      Curso en progreso
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--color-muted)" }}
                    >
                      Matemáticas discretas
                    </div>

                    <div
                      className="mt-3 h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: "var(--color-border)" }}
                    >
                      <div
                        className="h-full w-2/3 rounded-full"
                        style={{ backgroundColor: "var(--color-primary)" }}
                      />
                    </div>
                  </div>

                  <div
                    className="rounded-lg p-3 border"
                    style={{
                      backgroundColor: "var(--color-card)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "var(--color-heading)" }}
                    >
                      Ranking global
                    </div>

                    <div className="mt-3 space-y-2">
                      <div
                        className="h-3 rounded"
                        style={{ backgroundColor: "var(--color-border)" }}
                      />
                      <div
                        className="h-3 rounded w-4/5"
                        style={{ backgroundColor: "var(--color-border)" }}
                      />
                      <div
                        className="h-3 rounded w-2/3"
                        style={{ backgroundColor: "var(--color-border)" }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-lg p-3 border"
                  style={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-heading)" }}
                  >
                    Cursos
                  </div>

                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Los colores de fondo, tarjetas, texto y bordes cambian con
                    el tema seleccionado.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LayoutGeneral>
  );
}