/**
 * Página de Configuración de Usuario
 * - Cambiar tema (oscuro/claro)
 * - Cambiar tamaño de letra con previsualización en vivo
 * - Guardar preferencias en Supabase (configuraciones_usuario)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import toast from "react-hot-toast";

type Tema = "oscuro" | "claro";
type Tamano = "pequena" | "mediana" | "grande";

export default function PaginaConfiguracion() {
  const [cargandoTodo, setCargandoTodo] = useState(true);
  const [rol, setRol] = useState<"estudiante" | "profesor">("estudiante");

  const [tema, setTema] = useState<Tema>(() => {
    try {
      const saved = localStorage.getItem("preferencias_usuario");
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.tema === "oscuro" || prefs.tema === "claro") {
          return prefs.tema;
        }
      }
    } catch {}
    return "claro"; 
  });

  const [tamano, setTamano] = useState<Tamano>("mediana");

  const fontClass = useMemo(() => {
    if (tamano === "pequena") return "text-[15px]";
    if (tamano === "grande") return "text-lg";
    return "text-base";
  }, [tamano]);

  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setCargandoTodo(false);
          return;
        }

        const { data: u } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", user.id)
          .single();
        if (u?.rol === "profesor") setRol("profesor");

        const { data: pref } = await supabase
          .from("configuraciones_usuario")
          .select("tema, tamano_fuente")
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (pref) {
          if (pref.tema === "oscuro" || pref.tema === "claro") {
            setTema(pref.tema);
          }
          if (["pequena", "mediana", "grande"].includes(pref.tamano_fuente)) {
            setTamano(pref.tamano_fuente as Tamano);
          }
        }

        window.dispatchEvent(
          new CustomEvent("app:preferencias", {
            detail: {
              tema: pref?.tema ?? tema,
              tamano_fuente: pref?.tamano_fuente ?? tamano,
            },
          })
        );
      } catch (e) {
        console.error(e);
      } finally {
        setCargandoTodo(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("app:preferencias", {
        detail: { tema, tamano_fuente: tamano },
      })
    );
    localStorage.setItem(
      "preferencias_usuario",
      JSON.stringify({ tema, tamano_fuente: tamano })
    );
  }, [tema, tamano]);

  async function guardar() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No hay usuario autenticado");
        return;
      }

      const { error } = await supabase.from("configuraciones_usuario").upsert(
        {
          usuario_id: user.id,
          tema,
          tamano_fuente: tamano,
        },
        { onConflict: "usuario_id" }
      );

      if (error) throw error;
      toast.success("Preferencias guardadas");
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudieron guardar las preferencias");
    }
  }

  function resetLocal() {
    setTema("claro");
    setTamano("mediana");
  }

  if (cargandoTodo) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-muted)" }}
      >
        Cargando configuración…
      </div>
    );
  }

  const getButtonStyle = (isActive: boolean) => ({
    border: isActive ? "2px solid #22d3ee" : `1px solid var(--color-border)`,
    backgroundColor: isActive ? "var(--color-card)" : "var(--color-bg)",
    color: "var(--color-text)",
    cursor: "pointer",
  });

  return (
    <LayoutGeneral rol={rol}>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-heading)" }}>
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
          <h2 className="font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
            Tema
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setTema("oscuro")}
              className="px-4 py-2 rounded-lg"
              style={getButtonStyle(tema === "oscuro")}
            >
              Oscuro
            </button>
            <button
              onClick={() => setTema("claro")}
              className="px-4 py-2 rounded-lg"
              style={getButtonStyle(tema === "claro")}
            >
              Claro
            </button>
          </div>
        </section>

        {/* Tamaño de letra */}
        <section
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
            Tamaño de letra
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setTamano("pequena")}
              className="px-4 py-2 rounded-lg"
              style={getButtonStyle(tamano === "pequena")}
            >
              Pequeña
            </button>
            <button
              onClick={() => setTamano("mediana")}
              className="px-4 py-2 rounded-lg"
              style={getButtonStyle(tamano === "mediana")}
            >
              Mediana
            </button>
            <button
              onClick={() => setTamano("grande")}
              className="px-4 py-2 rounded-lg"
              style={getButtonStyle(tamano === "grande")}
            >
              Grande
            </button>
          </div>

          <div
            className={`mt-4 rounded-lg border p-4 ${fontClass}`}
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}
          >
            <div className="font-semibold mb-1" style={{ color: "var(--color-heading)" }}>
              Vista previa
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Este es un ejemplo de párrafo con el tamaño de letra seleccionado.
            </p>
          </div>
        </section>

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={guardar}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            Guardar
          </button>
          <button
            onClick={resetLocal}
            className="px-5 py-2 rounded-lg"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              backgroundColor: "var(--color-card)",
            }}
          >
            Restablecer
          </button>
        </div>
      </div>
    </LayoutGeneral>
  );
}
