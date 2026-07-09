/**
 * Cuadrícula de cursos que muestra materias agrupadas
 * y permite inscribirse con período/sección o como visitante.
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import {
  Check,
  ChevronRight,
  EyeOff,
  GraduationCap,
  UserRound,
  X,
} from "lucide-react";

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
  const [mostrarFormularioInscripcion, setMostrarFormularioInscripcion] = useState(false);

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

  const cerrarModal = () => {
    setSelected(null);
    setMostrarFormularioInscripcion(false);
  };

  const abrirCurso = async (m: any) => {
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
    setMostrarFormularioInscripcion(false);
  };

  const renderStatus = (m: any) => {
    if (!m.progresoEstado?.exists) return null;

    if (m.progresoEstado.visible) {
      return (
        <span className="fcc-course-status is-inscrito">
          <Check size={13} strokeWidth={2.8} />
          Inscrito
        </span>
      );
    }

    return (
      <span className="fcc-course-status is-oculto">
        <EyeOff size={13} strokeWidth={2.6} />
        Oculto
      </span>
    );
  };

  const renderCard = (m: any) => (
    <article
      key={m.id}
      className="fcc-course-grid-card"
      role="button"
      tabIndex={0}
      onClick={() => abrirCurso(m)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrirCurso(m);
        }
      }}
    >
      {renderStatus(m)}

      <div className="fcc-course-grid-content">
        <h3 className="fcc-course-grid-title">{m.nombre}</h3>

        <div className="fcc-course-grid-meta">
          {m.curso_carreras && m.curso_carreras.length > 0 ? (
            m.curso_carreras.map((cc: any, idx: number) => (
              <div key={idx} className="fcc-course-grid-career">
                <GraduationCap size={15} strokeWidth={2.3} />
                <span>{cc.carrera?.nombre ?? "Desconocida"}</span>
                <small>Semestre {cc.semestre ?? "N/A"}</small>
              </div>
            ))
          ) : (
            <p className="fcc-course-grid-muted">Sin carreras ligadas</p>
          )}

          <div className="fcc-course-grid-profesor">
            <UserRound size={15} strokeWidth={2.3} />
            <span>{m.profesor?.nombre ?? "Aún no hay profesor asignado"}</span>
          </div>
        </div>

        <div className="fcc-course-grid-action">
          <span>Ver detalles</span>
          <ChevronRight size={16} strokeWidth={2.6} />
        </div>
      </div>
    </article>
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
    <>
      <style>{`
        .fcc-course-grid-root {
          --fcc-course-grid-text: var(--fcc-premium-text, var(--color-text));
          --fcc-course-grid-heading: var(--fcc-premium-heading, var(--color-heading));
          --fcc-course-grid-muted: var(--fcc-premium-muted, var(--color-muted));
          --fcc-course-grid-accent: var(--fcc-premium-accent);
          --fcc-course-grid-border: var(--fcc-premium-border);

          position: relative;
          min-width: 0;
        }

        .fcc-course-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: stretch;
        }

        @media (min-width: 900px) {
          .fcc-course-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .fcc-course-grid-card {
          position: relative;
          min-width: 0;
          min-height: 172px;
          overflow: hidden;
          border-radius: 24px;
          padding: 18px;
          cursor: pointer;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-course-grid-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--fcc-course-grid-text);
          transition:
            transform 170ms ease,
            box-shadow 170ms ease,
            border-color 170ms ease;
        }

        .fcc-course-grid-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              135deg,
              transparent 0%,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 30%,
                transparent
              ) 50%,
              transparent 100%
            );
          opacity: 0.42;
        }

        .fcc-course-grid-card:hover {
          transform: translateY(-2px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .fcc-course-grid-card:focus-visible {
          outline: none;
          box-shadow:
            var(--fcc-premium-shadow-hover),
            0 0 0 4px color-mix(
              in srgb,
              var(--fcc-premium-accent) 18%,
              transparent
            );
        }

        .fcc-course-status {
          position: absolute;
          z-index: 4;
          top: 18px;
          right: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 28px;
          border-radius: 999px;
          padding: 0 10px;
          font-size: 0.72rem;
          font-weight: 950;
          line-height: 1;
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
        }

        .fcc-course-status.is-inscrito {
          color: #ffffff;
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .fcc-course-status.is-oculto {
          color: #ffffff;
          background: linear-gradient(135deg, #d97706, #f59e0b);
        }

        .fcc-course-grid-content {
          position: relative;
          z-index: 2;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 11px;
          text-align: center;
        }

        .fcc-course-grid-title {
          width: 100%;
          margin: 0 auto;
          padding-inline: 92px;
          color: var(--fcc-course-grid-heading);
          font-size: clamp(1.02rem, 1.25vw, 1.2rem);
          font-weight: 950;
          line-height: 1.15;
          letter-spacing: -0.035em;
          text-align: center;
          text-wrap: balance;
          word-break: break-word;
        }

        .fcc-course-grid-meta {
          width: 100%;
          display: grid;
          gap: 7px;
        }

        .fcc-course-grid-career,
        .fcc-course-grid-profesor {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex-wrap: wrap;
          color: var(--fcc-course-grid-muted);
          font-size: 0.84rem;
          font-weight: 750;
          line-height: 1.25;
        }

        .fcc-course-grid-career svg,
        .fcc-course-grid-profesor svg {
          flex: 0 0 auto;
          color: var(--fcc-course-grid-accent);
          opacity: 0.9;
        }

        .fcc-course-grid-career small {
          color: color-mix(
            in srgb,
            var(--fcc-course-grid-muted) 82%,
            transparent
          );
          font-size: 0.78rem;
          font-weight: 800;
        }

        .fcc-course-grid-muted {
          color: var(--fcc-course-grid-muted);
          font-size: 0.86rem;
          font-weight: 750;
        }

        .fcc-course-grid-action {
          align-self: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 34px;
          border-radius: 13px;
          padding: 0 13px;
          color: var(--fcc-course-grid-accent);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 78%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--fcc-premium-accent) 20%,
            var(--fcc-course-grid-border)
          );
          font-size: 0.82rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            background 170ms ease;
        }

        .fcc-course-grid-card:hover .fcc-course-grid-action {
          transform: translateY(-1px);
          background: color-mix(
            in srgb,
            var(--fcc-premium-accent) 10%,
            var(--fcc-premium-surface-strong)
          );
        }

        .fcc-course-grid-card:hover .fcc-course-grid-action svg {
          transform: translateX(2px);
        }

        .fcc-course-grid-action svg {
          transition: transform 170ms ease;
        }

        .fcc-course-group-stack {
          display: grid;
          gap: 28px;
        }

        .fcc-course-group-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 14px;
          color: var(--fcc-course-grid-heading);
          text-align: center;
          font-size: clamp(1.05rem, 1.7vw, 1.35rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .fcc-course-group-title::before,
        .fcc-course-group-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--fcc-premium-accent) 55%, transparent)
          );
        }

        .fcc-course-group-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--fcc-premium-accent) 55%, transparent),
            transparent
          );
        }

        .fcc-course-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background:
            radial-gradient(
              circle at center,
              color-mix(in srgb, var(--fcc-premium-accent) 12%, transparent),
              transparent 44%
            ),
            rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(8px);
        }

        .fcc-course-modal {
          position: relative;
          width: min(95vw, 620px);
          max-height: 90dvh;
          overflow-y: auto;
          border-radius: 28px;
          padding: 22px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            var(--fcc-premium-shadow-hover),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--fcc-course-grid-text);
        }

        .fcc-course-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--fcc-course-grid-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--fcc-premium-border);
          transition:
            transform 170ms ease,
            color 170ms ease,
            border-color 170ms ease;
        }

        .fcc-course-modal-close:hover {
          transform: translateY(-1px);
          color: #ef4444;
          border-color: color-mix(
            in srgb,
            #ef4444 34%,
            var(--fcc-premium-border)
          );
        }

        .fcc-course-modal-title {
          max-width: 520px;
          margin: 0 auto;
          padding: 22px 34px 4px;
          color: var(--fcc-course-grid-heading);
          text-align: center;
          font-size: clamp(1.35rem, 2.6vw, 1.85rem);
          font-weight: 950;
          line-height: 1.05;
          letter-spacing: -0.05em;
          word-break: break-word;

          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .fcc-course-modal-details {
          margin-top: 16px;
          display: grid;
          gap: 10px;
        }

        .fcc-course-modal-detail {
          border-radius: 18px;
          padding: 12px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 74%,
            transparent
          );
          border: 1px solid var(--fcc-premium-border);
          color: var(--fcc-course-grid-muted);
          font-size: 0.88rem;
          font-weight: 750;
          line-height: 1.35;
        }

        .fcc-course-modal-detail strong {
          display: block;
          color: var(--fcc-course-grid-heading);
          font-size: 0.92rem;
          font-weight: 950;
        }

        .fcc-course-modal-profesor {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: var(--fcc-course-grid-muted);
          text-align: center;
          font-size: 0.88rem;
          font-weight: 800;
        }

        .fcc-course-modal-success {
          margin-top: 16px;
          border-radius: 18px;
          padding: 12px;
          text-align: center;
          color: #16a34a;
          background: color-mix(in srgb, #22c55e 10%, transparent);
          border: 1px solid color-mix(in srgb, #22c55e 24%, transparent);
          font-weight: 950;
        }

        .fcc-course-modal-form {
          margin-top: 16px;
          display: grid;
          gap: 14px;
        }

        .fcc-course-form-intro {
          border-radius: 18px;
          padding: 12px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 68%,
            transparent
          );
          border: 1px solid var(--fcc-premium-border);
          color: var(--fcc-course-grid-muted);
          text-align: center;
          font-size: 0.88rem;
          font-weight: 800;
          line-height: 1.4;
        }

        .fcc-course-field label {
          display: block;
          margin-bottom: 6px;
          color: var(--fcc-course-grid-heading);
          font-size: 0.84rem;
          font-weight: 900;
        }

        .fcc-course-select {
          width: 100%;
          min-height: 42px;
          border-radius: 15px;
          padding: 0 12px;
          color: var(--fcc-course-grid-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--fcc-premium-accent) 18%,
            var(--fcc-premium-border)
          );
          outline: none;
          font-size: 0.9rem;
          font-weight: 750;
        }

        .fcc-course-select:focus {
          border-color: color-mix(
            in srgb,
            var(--fcc-premium-accent) 58%,
            var(--fcc-premium-border)
          );
          box-shadow: 0 0 0 4px
            color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
        }

        .fcc-course-select:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .fcc-course-visitante {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 18px;
          padding: 12px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 68%,
            transparent
          );
          border: 1px solid var(--fcc-premium-border);
          color: var(--fcc-course-grid-muted);
          font-size: 0.88rem;
          font-weight: 850;
        }

        .fcc-course-visitante input {
          width: 17px;
          height: 17px;
          accent-color: var(--fcc-premium-accent);
        }

        .fcc-course-modal-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          padding-top: 4px;
        }

        .fcc-course-modal-btn {
          min-height: 40px;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 0.88rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            box-shadow 170ms ease;
        }

        .fcc-course-modal-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .fcc-course-modal-btn:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .fcc-course-modal-btn.is-muted {
          color: var(--fcc-course-grid-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 82%,
            transparent
          );
          border: 1px solid var(--fcc-premium-border);
        }

        .fcc-course-modal-btn.is-primary {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--fcc-premium-accent),
            color-mix(in srgb, var(--fcc-premium-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
        }

        .fcc-course-modal-btn.is-warning {
          color: #ffffff;
          background: linear-gradient(135deg, #d97706, #f59e0b);
          box-shadow: 0 14px 28px
            color-mix(in srgb, #f59e0b 22%, transparent);
        }

        .theme-oscuro .fcc-course-modal-btn.is-primary {
          color: #050505;
        }

        @media (max-width: 640px) {
          .fcc-course-grid-card {
            min-height: 170px;
            padding: 16px;
          }

          .fcc-course-status {
            top: 14px;
            right: 14px;
          }

          .fcc-course-grid-title {
            padding-inline: 0;
            padding-top: 26px;
          }

          .fcc-course-modal {
            padding: 18px;
            border-radius: 24px;
          }

          .fcc-course-modal-title {
            padding-left: 30px;
            padding-right: 30px;
          }

          .fcc-course-modal-actions {
            flex-direction: column;
          }

          .fcc-course-modal-btn {
            width: 100%;
          }
        }
      `}</style>

      <div className="fcc-course-grid-root">
        {groupBy === "none" ? (
          <div className="fcc-course-grid">
            {[...materiasConEstado]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((m) => renderCard(m))}
          </div>
        ) : (
          <div className="fcc-course-group-stack">
            {Object.keys(grouped)
              .sort()
              .map((k) => (
                <section key={k}>
                  <h2 className="fcc-course-group-title">{k}</h2>

                  <div className="fcc-course-grid">
                    {grouped[k]
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((m) => renderCard(m))}
                  </div>
                </section>
              ))}
          </div>
        )}

        {selected &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fcc-course-modal-overlay"
              onClick={cerrarModal}
            >
              <div
                className="fcc-course-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="fcc-course-modal-close"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>

                <h3 className="fcc-course-modal-title">{selected.nombre}</h3>

                <div className="fcc-course-modal-details">
                  {selected.curso_carreras &&
                  selected.curso_carreras.length > 0 ? (
                    selected.curso_carreras.map((cc: any, idx: number) => (
                      <div key={idx} className="fcc-course-modal-detail">
                        <strong>{cc.carrera?.nombre ?? "Desconocida"}</strong>
                        <span>Semestre {cc.semestre ?? "N/A"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="fcc-course-modal-detail">
                      Sin carreras ligadas
                    </div>
                  )}

                  <p className="fcc-course-modal-profesor">
                    <UserRound size={15} strokeWidth={2.3} />
                    <span>
                      {selected.profesor?.nombre ??
                        "Aún no hay profesor asignado"}
                    </span>
                  </p>
                </div>

                {selected.progresoEstado?.exists &&
                  selected.progresoEstado.visible ? (
                    <p className="fcc-course-modal-success">
                      Ya está en tu inicio
                    </p>
                  ) : selected.progresoEstado?.exists ? (
                    <div className="fcc-course-modal-actions mt-4">
                      <button
                        type="button"
                        className="fcc-course-modal-btn is-muted"
                        onClick={cerrarModal}
                        disabled={loading}
                      >
                        Volver
                      </button>

                      <button
                        type="button"
                        className="fcc-course-modal-btn is-warning"
                        onClick={inscribirse}
                        disabled={loading}
                      >
                        {loading ? "Guardando..." : "Reactivar curso"}
                      </button>
                    </div>
                  ) : !mostrarFormularioInscripcion ? (
                    <div className="fcc-course-modal-actions mt-4">
                      <button
                        type="button"
                        className="fcc-course-modal-btn is-muted"
                        onClick={cerrarModal}
                        disabled={loading}
                      >
                        Volver
                      </button>

                      <button
                        type="button"
                        className="fcc-course-modal-btn is-primary"
                        onClick={() => setMostrarFormularioInscripcion(true)}
                        disabled={loading}
                      >
                        Tomar curso
                      </button>
                    </div>
                  ) : (
                    <div className="fcc-course-modal-form">
                      <p className="fcc-course-form-intro">
                        Completa estos datos para agregar el curso a tu inicio.
                      </p>

                      <div className="fcc-course-field">
                        <label>Selecciona carrera</label>

                        <select
                          value={selectedCarrera ?? ""}
                          onChange={(e) => {
                            setSelectedCarrera(e.target.value || null);
                            setSelectedPeriodo(null);
                            setSelectedSeccion(null);

                            if (e.target.value) {
                              const carrera = selected.curso_carreras?.find(
                                (cc: any) =>
                                  String(cc.carrera?.id) === e.target.value
                              );

                              setPeriodos(carrera?.curso_periodos || []);
                            } else {
                              setPeriodos([]);
                            }
                          }}
                          disabled={visitante}
                          className="fcc-course-select"
                        >
                          <option value="">-- Seleccionar --</option>

                          {(selected.curso_carreras ?? []).map((cc: any) => (
                            <option key={cc.id} value={cc.carrera?.id}>
                              {cc.carrera?.nombre} (Semestre {cc.semestre})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedCarrera && (
                        <div className="fcc-course-field">
                          <label>Selecciona período</label>

                          <select
                            value={selectedPeriodo ?? ""}
                            onChange={(e) =>
                              setSelectedPeriodo(e.target.value || null)
                            }
                            disabled={visitante}
                            className="fcc-course-select"
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
                        <div className="fcc-course-field">
                          <label>Selecciona sección</label>

                          <select
                            value={selectedSeccion ?? ""}
                            onChange={(e) =>
                              setSelectedSeccion(e.target.value || null)
                            }
                            disabled={visitante}
                            className="fcc-course-select"
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

                      <label className="fcc-course-visitante">
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

                        <span>Tomar curso como visitante</span>
                      </label>

                      <div className="fcc-course-modal-actions">
                        <button
                          type="button"
                          className="fcc-course-modal-btn is-muted"
                          onClick={cerrarModal}
                          disabled={loading}
                        >
                          Volver
                        </button>

                        <button
                          type="button"
                          className="fcc-course-modal-btn is-primary"
                          onClick={inscribirse}
                          disabled={loading}
                        >
                          {loading ? "Guardando..." : "Inscribirse"}
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </>
  );
}