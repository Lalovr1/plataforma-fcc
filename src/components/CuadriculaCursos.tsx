/**
 * Cuadrícula de cursos que muestra materias agrupadas
 * y permite inscribirse con período/sección o como visitante.
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";

interface Props {
  materias: any[];
  groupBy: string;
  userId: string;
}

function prepararMateriasIniciales(materias: any[]) {
  return (materias ?? []).map((m) => ({
    ...m,
    progresoEstado:
      m.progresoEstado ??
      (m.yaInscrito
        ? { exists: true, visible: true }
        : { exists: false, visible: false }),
  }));
}

export default function CuadriculaCursos({ materias, groupBy, userId }: Props) {
  const [materiasConEstado, setMateriasConEstado] = useState<any[]>(() =>
    prepararMateriasIniciales(materias)
  );
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedCarrera, setSelectedCarrera] = useState<string | null>(null);
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null);
  const [selectedSeccion, setSelectedSeccion] = useState<string | null>(null);
  const [visitante, setVisitante] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const base = prepararMateriasIniciales(materias);
    setMateriasConEstado(base);

    const fetchProgresos = async () => {
      if (!userId || !materias || materias.length === 0) return;

      const { data: progresos } = await supabase
        .from("progreso")
        .select("materia_id, visible")
        .eq("usuario_id", userId);

      if (cancelado) return;

      if (progresos) {
        const materiasActualizadas = materias.map((m) => {
          const progresoRow = progresos.find((p) => p.materia_id === m.id);
          return {
            ...m,
            progresoEstado: progresoRow
              ? { exists: true, visible: progresoRow.visible }
              : { exists: false, visible: false },
          };
        });

        setMateriasConEstado(materiasActualizadas);
      }
    };

    fetchProgresos();

    return () => {
      cancelado = true;
    };
  }, [materias, userId]);

  useEffect(() => {
    const fetchSecciones = async () => {
      if (!selectedPeriodo) {
        setSecciones([]);
        return;
      }

      const { data } = await supabase
        .from("curso_secciones")
        .select("id, nombre")
        .eq("periodo_id", selectedPeriodo);

      if (data) setSecciones(data);
    };

    fetchSecciones();
  }, [selectedPeriodo]);

  const inscribirse = async () => {
    if (!selected) return;

    if (selected.progresoEstado?.exists) {
      await supabase
        .from("progreso")
        .update({ visible: true })
        .eq("usuario_id", userId)
        .eq("materia_id", selected.id);

      toast.success(`${selected.nombre} movido a inicio`);

      setMateriasConEstado((prev) =>
        prev.map((m) =>
          m.id === selected.id
            ? { ...m, progresoEstado: { exists: true, visible: true } }
            : m
        )
      );

      setSelected(null);
      return;
    }

    if (!visitante && (!selectedCarrera || !selectedPeriodo || !selectedSeccion)) {
      toast.error("Debes seleccionar carrera, período y sección, o elegir visitante");
      return;
    }

    if (visitante) {
      const confirm = window.confirm(
        "El profesor no podrá ver tu progreso, ¿estás seguro?"
      );
      if (!confirm) return;
    }

    setLoading(true);

    const { error } = await supabase.from("progreso").insert([
      {
        usuario_id: userId,
        materia_id: selected.id,
        progreso: 0,
        visible: true,
        carrera_id: visitante ? null : selectedCarrera,
        periodo_id: visitante ? null : selectedPeriodo,
        seccion_id: visitante ? null : selectedSeccion,
        es_visitante: visitante,
      },
    ]);

    if (error) {
      toast.error("Error al inscribirse");
    } else {
      toast.success(`${selected.nombre} inscrito correctamente`);

      setMateriasConEstado((prev) =>
        prev.map((m) =>
          m.id === selected.id
            ? { ...m, progresoEstado: { exists: true, visible: true } }
            : m
        )
      );

      setSelected(null);
    }

    setLoading(false);
  };

  const renderCard = (m: any) => (
    <div
      key={m.id}
      className="p-4 rounded-lg shadow transition relative cursor-pointer"
      style={{
        backgroundColor: "var(--color-card)",
        color: "var(--color-text)",
      }}
      onClick={async () => {
        const { data: progresoRow } = await supabase
          .from("progreso")
          .select("id, visible")
          .eq("usuario_id", userId)
          .eq("materia_id", m.id)
          .maybeSingle();

        setSelected({
          ...m,
          progresoEstado: progresoRow
            ? { exists: true, visible: progresoRow.visible }
            : { exists: false, visible: false },
        });

        setPeriodos([]);
        setSelectedCarrera(null);
        setSelectedPeriodo(null);
        setSelectedSeccion(null);
        setVisitante(false);
      }}
    >
      <div className="flex justify-between items-start">
        <h3
          className="text-lg font-bold break-words pr-2"
          style={{ color: "var(--color-heading)" }}
        >
          {m.nombre}
        </h3>

        {m.progresoEstado?.exists && m.progresoEstado.visible && (
          <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded">
            Inscrito
          </span>
        )}

        {m.progresoEstado?.exists && !m.progresoEstado.visible && (
          <span className="bg-yellow-600 text-white text-xs font-semibold px-2 py-1 rounded">
            Oculto
          </span>
        )}
      </div>

      {m.curso_carreras && m.curso_carreras.length > 0 ? (
        m.curso_carreras.map((cc: any, idx: number) => (
          <p key={idx} className="text-sm" style={{ color: "var(--color-muted)" }}>
            Carrera: {cc.carrera?.nombre ?? "Desconocida"} — Semestre:{" "}
            {cc.semestre ?? "N/A"}
          </p>
        ))
      ) : (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Sin carreras ligadas
        </p>
      )}

      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        Profesor: {m.profesor?.nombre ?? "Aún no hay profesor asignado"}
      </p>
    </div>
  );

  const grouped: Record<string, any[]> = {};

  if (groupBy !== "none") {
    materiasConEstado.forEach((m) => {
      if (!m.curso_carreras || m.curso_carreras.length === 0) {
        const key = "Sin clasificación";
        if (!grouped[key]) grouped[key] = [];
        if (!grouped[key].some((x) => x.id === m.id)) grouped[key].push(m);
      } else {
        m.curso_carreras.forEach((cc: any) => {
          if (groupBy === "periodo") {
            cc.curso_periodos?.forEach((p: any) => {
              const key = `🗓️ ${p.nombre} ${p.anio}`;
              if (!grouped[key]) grouped[key] = [];
              if (!grouped[key].some((x) => x.id === m.id)) grouped[key].push(m);
            });
          }

          if (groupBy === "semestre") {
            const key = `📘 Semestre ${cc.semestre ?? "N/A"}`;
            if (!grouped[key]) grouped[key] = [];
            if (!grouped[key].some((x) => x.id === m.id)) grouped[key].push(m);
          }

          if (groupBy === "carrera") {
            const key = `🎓 ${cc.carrera?.nombre ?? "Carrera desconocida"}`;
            if (!grouped[key]) grouped[key] = [];
            if (!grouped[key].some((x) => x.id === m.id)) grouped[key].push(m);
          }

          if (groupBy === "area") {
            const key = `📂 ${cc.area ?? "Área desconocida"}`;
            if (!grouped[key]) grouped[key] = [];
            if (!grouped[key].some((x) => x.id === m.id)) grouped[key].push(m);
          }
        });
      }
    });
  }

  return (
    <div className="relative">
      {groupBy === "none" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...materiasConEstado]
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((m) => renderCard(m))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(grouped)
            .sort()
            .map((k) => (
              <div key={k}>
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ color: "var(--color-heading)" }}
                >
                  {k}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[k]
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((m) => renderCard(m))}
                </div>
              </div>
            ))}
        </div>
      )}

      {selected &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="p-4 sm:p-6 rounded-xl w-[95vw] max-w-[420px] max-h-[90dvh] overflow-y-auto shadow-lg space-y-4 relative"
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3"
                style={{ color: "var(--color-muted)" }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>

              <h3
                className="text-2xl font-bold text-center"
                style={{ color: "var(--color-heading)" }}
              >
                {selected.nombre}
              </h3>

              <div className="text-left space-y-2">
                {selected.curso_carreras && selected.curso_carreras.length > 0 ? (
                  selected.curso_carreras.map((cc: any, idx: number) => (
                    <div key={idx} className="text-sm" style={{ color: "var(--color-muted)" }}>
                      <p>Carrera: {cc.carrera?.nombre ?? "Desconocida"}</p>
                      <p>Semestre: {cc.semestre ?? "N/A"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    Sin carreras ligadas
                  </p>
                )}

                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Profesor: {selected.profesor?.nombre ?? "Aún no hay profesor asignado"}
                </p>
              </div>

              {selected.progresoEstado?.exists && selected.progresoEstado.visible ? (
                <p className="text-green-500 font-semibold text-center">
                  Ya está en tu inicio
                </p>
              ) : selected.progresoEstado?.exists ? (
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    className="px-4 py-2 rounded"
                    style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                    onClick={() => setSelected(null)}
                    disabled={loading}
                  >
                    Volver
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white"
                    onClick={inscribirse}
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Reactivar curso"}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label
                      className="block text-sm mb-1"
                      style={{ color: "var(--color-heading)" }}
                    >
                      Selecciona carrera:
                    </label>
                    <select
                      value={selectedCarrera ?? ""}
                      onChange={(e) => {
                        setSelectedCarrera(e.target.value || null);
                        setSelectedPeriodo(null);
                        setSelectedSeccion(null);

                        if (e.target.value) {
                          const carrera = selected.curso_carreras.find(
                            (cc: any) => String(cc.carrera?.id) === e.target.value
                          );
                          setPeriodos(carrera?.curso_periodos || []);
                        } else {
                          setPeriodos([]);
                        }
                      }}
                      disabled={visitante}
                      className="w-full p-2 rounded"
                      style={{
                        backgroundColor: "var(--color-card)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <option value="">-- Seleccionar --</option>
                      {selected.curso_carreras.map((cc: any) => (
                        <option key={cc.id} value={cc.carrera?.id}>
                          {cc.carrera?.nombre} (Semestre {cc.semestre})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCarrera && (
                    <div>
                      <label
                        className="block text-sm mb-1"
                        style={{ color: "var(--color-heading)" }}
                      >
                        Selecciona período:
                      </label>
                      <select
                        value={selectedPeriodo ?? ""}
                        onChange={(e) => setSelectedPeriodo(e.target.value || null)}
                        disabled={visitante}
                        className="w-full p-2 rounded"
                        style={{
                          backgroundColor: "var(--color-card)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <option value="">-- Seleccionar --</option>
                        {periodos.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.anio}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedPeriodo && (
                    <div>
                      <label
                        className="block text-sm mb-1"
                        style={{ color: "var(--color-heading)" }}
                      >
                        Selecciona sección:
                      </label>
                      <select
                        value={selectedSeccion ?? ""}
                        onChange={(e) => setSelectedSeccion(e.target.value || null)}
                        disabled={visitante}
                        className="w-full p-2 rounded"
                        style={{
                          backgroundColor: "var(--color-card)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <option value="">-- Seleccionar --</option>
                        {secciones.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      checked={visitante}
                      onChange={(e) => {
                        setVisitante(e.target.checked);
                        if (e.target.checked) {
                          setSelectedCarrera(null);
                          setSelectedPeriodo(null);
                          setSelectedSeccion(null);
                        }
                      }}
                    />
                    <label className="text-sm" style={{ color: "var(--color-muted)" }}>
                      Tomar curso como visitante
                    </label>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      className="px-4 py-2 rounded"
                      style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                      onClick={() => setSelected(null)}
                      disabled={loading}
                    >
                      Volver
                    </button>
                    <button
                      className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      onClick={inscribirse}
                      disabled={loading}
                    >
                      {loading ? "Guardando..." : "Inscribirse"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}