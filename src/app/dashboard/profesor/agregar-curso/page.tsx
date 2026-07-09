"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import LayoutGeneral from "@/components/LayoutGeneral";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

interface Carrera {
  id: number;
  nombre: string;
}

interface Seccion {
  nombre: string;
}

interface Periodo {
  nombre: "Primavera" | "Verano" | "Otoño";
  anio: number;
  secciones: Seccion[];
}

interface CursoCarrera {
  carrera_id: number | null;
  semestre: number | null;
  area: string;
  periodos: Periodo[];
}

const crearCarreraInicial = (): CursoCarrera => ({
  carrera_id: null,
  semestre: null,
  area: "Ciencias Básicas",
  periodos: [
    {
      nombre: "Primavera",
      anio: new Date().getFullYear(),
      secciones: [],
    },
  ],
});

export default function AgregarCursoPage() {
  const [nombre, setNombre] = useState("");
  const [cursoCarreras, setCursoCarreras] = useState<CursoCarrera[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState<CursoCarrera | null>(null);
  const [editandoCarreraIndex, setEditandoCarreraIndex] = useState<number | null>(
    null
  );
  const [carreraAEliminarIndex, setCarreraAEliminarIndex] = useState<number | null>(
    null
  );
  const [carrerasDisponibles, setCarrerasDisponibles] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchCarreras = async () => {
      const { data } = await supabase
        .from("carreras")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      setCarrerasDisponibles(data || []);
    };

    fetchCarreras();
  }, []);

  useEffect(() => {
    if (!nuevaCarrera && carreraAEliminarIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [nuevaCarrera, carreraAEliminarIndex]);

  const getCarreraNombre = (id: number | null) =>
    carrerasDisponibles.find((c) => c.id === id)?.nombre || "Sin carrera";

  const validarCursoCarrera = (cc: CursoCarrera) => {
    if (!cc.carrera_id) {
      return "Selecciona una carrera.";
    }

    if (!cc.semestre) {
      return "Selecciona un semestre.";
    }

    if (!cc.area.trim()) {
      return "Selecciona un área.";
    }

    if (cc.periodos.length === 0) {
      return "Agrega al menos un período.";
    }

    if (cc.periodos.some((p) => !p.anio || p.anio < 2000)) {
      return "Revisa el año de los períodos.";
    }

    if (cc.periodos.some((p) => p.secciones.length === 0)) {
      return "Cada período necesita al menos una sección.";
    }

    if (
      cc.periodos.some((p) =>
        p.secciones.some((s) => !s.nombre.trim())
      )
    ) {
      return "Completa el nombre de todas las secciones.";
    }

    return null;
  };

  const guardarNuevaCarrera = () => {
    if (!nuevaCarrera) return;

    const error = validarCursoCarrera(nuevaCarrera);

    if (error) {
      toast.error(error);
      return;
    }

    const carreraLimpia: CursoCarrera = {
      ...nuevaCarrera,
      area: nuevaCarrera.area.trim(),
      periodos: nuevaCarrera.periodos.map((p) => ({
        ...p,
        secciones: p.secciones.map((s) => ({
          nombre: s.nombre.trim(),
        })),
      })),
    };

    if (editandoCarreraIndex !== null) {
      setCursoCarreras((prev) =>
        prev.map((cc, idx) =>
          idx === editandoCarreraIndex ? carreraLimpia : cc
        )
      );
    } else {
      setCursoCarreras((prev) => [...prev, carreraLimpia]);
    }

    setNuevaCarrera(null);
    setEditandoCarreraIndex(null);
  };

  const abrirAgregarCarrera = () => {
    setEditandoCarreraIndex(null);
    setNuevaCarrera(crearCarreraInicial());
  };

  const abrirEditarCarrera = (index: number) => {
    const carrera = cursoCarreras[index];

    if (!carrera) return;

    setEditandoCarreraIndex(index);
    setNuevaCarrera({
      ...carrera,
      periodos: carrera.periodos.map((p) => ({
        ...p,
        secciones: p.secciones.map((s) => ({ ...s })),
      })),
    });
  };

  const cerrarModalCarrera = () => {
    setNuevaCarrera(null);
    setEditandoCarreraIndex(null);
  };

  const eliminarCarreraConfirmada = () => {
    if (carreraAEliminarIndex === null) return;

    setCursoCarreras((prev) =>
      prev.filter((_, index) => index !== carreraAEliminarIndex)
    );
    setCarreraAEliminarIndex(null);
  };

  const actualizarPeriodo = (
    periodoIndex: number,
    cambios: Partial<Periodo>
  ) => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: nuevaCarrera.periodos.map((p, i) =>
        i === periodoIndex ? { ...p, ...cambios } : p
      ),
    });
  };

  const agregarPeriodo = () => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: [
        ...nuevaCarrera.periodos,
        {
          nombre: "Primavera",
          anio: new Date().getFullYear(),
          secciones: [],
        },
      ],
    });
  };

  const eliminarPeriodo = (periodoIndex: number) => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: nuevaCarrera.periodos.filter((_, i) => i !== periodoIndex),
    });
  };

  const agregarSeccion = (periodoIndex: number) => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: nuevaCarrera.periodos.map((p, i) =>
        i === periodoIndex
          ? {
              ...p,
              secciones: [...p.secciones, { nombre: "" }],
            }
          : p
      ),
    });
  };

  const actualizarSeccion = (
    periodoIndex: number,
    seccionIndex: number,
    nombreSeccion: string
  ) => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: nuevaCarrera.periodos.map((p, i) =>
        i === periodoIndex
          ? {
              ...p,
              secciones: p.secciones.map((s, j) =>
                j === seccionIndex ? { ...s, nombre: nombreSeccion } : s
              ),
            }
          : p
      ),
    });
  };

  const eliminarSeccion = (periodoIndex: number, seccionIndex: number) => {
    if (!nuevaCarrera) return;

    setNuevaCarrera({
      ...nuevaCarrera,
      periodos: nuevaCarrera.periodos.map((p, i) =>
        i === periodoIndex
          ? {
              ...p,
              secciones: p.secciones.filter((_, j) => j !== seccionIndex),
            }
          : p
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      toast.error("Escribe el nombre del curso.");
      return;
    }

    if (cursoCarreras.length === 0) {
      toast.error("Debes agregar al menos una carrera ligada.");
      return;
    }

    const errorCarrera = cursoCarreras
      .map((cc) => validarCursoCarrera(cc))
      .find(Boolean);

    if (errorCarrera) {
      toast.error(errorCarrera);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("No se pudo obtener el usuario.");
        return;
      }

      const { data: materia, error: materiaError } = await supabase
        .from("materias")
        .insert({
          nombre: nombreLimpio,
          profesor_id: user.id,
          visible: false,
        })
        .select("id")
        .single();

      if (materiaError || !materia) {
        console.error("Error creando materia:", materiaError);
        toast.error("Error al crear curso.");
        return;
      }

      const cursoId = materia.id;

      for (const cc of cursoCarreras) {
        const { data: insertedCarrera, error: carreraError } = await supabase
          .from("curso_carreras")
          .insert({
            curso_id: cursoId,
            carrera_id: cc.carrera_id,
            semestre: cc.semestre,
            area: cc.area,
          })
          .select("id")
          .single();

        if (carreraError || !insertedCarrera) {
          console.error("Error insertando carrera ligada:", carreraError);
          toast.error("El curso se creó, pero falló una carrera ligada.");
          return;
        }

        for (const p of cc.periodos) {
          const { data: insertedPeriodo, error: periodoError } = await supabase
            .from("curso_periodos")
            .insert({
              curso_carrera_id: insertedCarrera.id,
              nombre: p.nombre,
              anio: p.anio,
            })
            .select("id")
            .single();

          if (periodoError || !insertedPeriodo) {
            console.error("Error insertando período:", periodoError);
            toast.error("El curso se creó, pero falló un período.");
            return;
          }

          for (const s of p.secciones) {
            const { error: seccionError } = await supabase
              .from("curso_secciones")
              .insert({
                periodo_id: insertedPeriodo.id,
                nombre: s.nombre,
              });

            if (seccionError) {
              console.error("Error insertando sección:", seccionError);
              toast.error("El curso se creó, pero falló una sección.");
              return;
            }
          }
        }
      }

      toast.success("Curso creado con éxito.");
      router.push(`/dashboard/profesor/cursos/${cursoId}/editar`);
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado al crear curso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutGeneral rol="profesor">
      <style>{`
        .agregar-curso-page,
        .agregar-curso-modal-overlay {
          --agregar-text: var(--fcc-premium-text, var(--color-text));
          --agregar-heading: var(--fcc-premium-heading, var(--color-heading));
          --agregar-muted: var(--fcc-premium-muted, var(--color-muted));
          --agregar-accent: var(--fcc-premium-accent);
          --agregar-border: var(--fcc-premium-border, var(--color-border));

          color: var(--agregar-text);
        }

        .agregar-curso-page {
          width: min(100%, 760px);
          margin: 0 auto;
          display: grid;
          gap: 16px;
          min-width: 0;
          padding-top: 8px;
        }

        .agregar-curso-hero,
        .agregar-curso-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--agregar-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .agregar-curso-hero {
          border-radius: 22px;
          padding: 16px 22px;
        }

        .agregar-curso-hero-inner {
          display: grid;
          gap: 6px;
          place-items: center;
          text-align: center;
        }

        .agregar-curso-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--agregar-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .agregar-curso-kicker::before,
        .agregar-curso-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--agregar-accent);
        }

        .agregar-curso-description {
          max-width: 620px;
          color: var(--agregar-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .agregar-curso-panel {
          padding: clamp(16px, 2.8vw, 26px);
        }

        .agregar-curso-form {
          display: grid;
          gap: 16px;
        }

        .agregar-field {
          display: grid;
          gap: 7px;
        }

        .agregar-label {
          color: var(--agregar-muted);
          font-size: 0.84rem;
          font-weight: 900;
        }

        .agregar-input,
        .agregar-select {
          min-height: 46px;
          width: 100%;
          border-radius: 16px;
          padding: 0 14px;
          color: var(--agregar-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--agregar-accent) 18%,
            var(--agregar-border)
          );
          outline: none;
          font-size: 0.94rem;
          font-weight: 750;
        }

        .agregar-input::placeholder {
          color: var(--agregar-muted);
          opacity: 0.75;
        }

        .agregar-input:focus,
        .agregar-select:focus {
          border-color: color-mix(
            in srgb,
            var(--agregar-accent) 58%,
            var(--agregar-border)
          );
          box-shadow: 0 0 0 4px color-mix(
            in srgb,
            var(--agregar-accent) 13%,
            transparent
          );
        }

        .agregar-section-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 4px 0 12px;
          color: var(--agregar-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.7vw, 1.35rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .agregar-section-title::before,
        .agregar-section-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--agregar-accent) 55%, transparent)
          );
        }

        .agregar-section-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--agregar-accent) 55%, transparent),
            transparent
          );
        }

        .agregar-carreras-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .agregar-carrera-card {
          display: grid;
          gap: 14px;
          width: 100%;
          border-radius: 22px;
          padding: 16px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--agregar-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .agregar-carrera-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 14px;
        }

        .agregar-carrera-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .agregar-carrera-main {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .agregar-carrera-title {
          color: var(--agregar-heading);
          font-size: clamp(1.05rem, 1.8vw, 1.24rem);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.04em;
          word-break: break-word;
        }

        .agregar-carrera-area {
          color: var(--agregar-accent);
          font-size: 0.94rem;
          font-weight: 900;
          line-height: 1.25;
        }

        .agregar-carrera-semestre {
          color: var(--agregar-muted);
          font-size: 0.88rem;
          font-weight: 850;
          line-height: 1.25;
        }

        .agregar-carrera-periodos {
          display: grid;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid color-mix(
            in srgb,
            var(--agregar-accent) 16%,
            transparent
          );
        }

        .agregar-periodo-resumen {
          display: grid;
          gap: 5px;
        }

        .agregar-periodo-nombre {
          color: var(--agregar-heading);
          font-size: 0.88rem;
          font-weight: 900;
          line-height: 1.25;
        }

        .agregar-secciones-resumen {
          display: grid;
          gap: 3px;
          margin: 0;
          padding-left: 16px;
          color: var(--agregar-muted);
          font-size: 0.8rem;
          font-weight: 800;
          line-height: 1.3;
        }

        .agregar-secciones-resumen li {
          padding-left: 2px;
        }

        .agregar-secciones-resumen li::marker {
          color: var(--agregar-accent);
        }

        .agregar-empty {
          min-height: 130px;
          display: grid;
          place-items: center;
          text-align: center;
          border-radius: 22px;
          padding: 22px;
          color: var(--agregar-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 68%,
            transparent
          );
          border: 1px dashed color-mix(
            in srgb,
            var(--agregar-accent) 30%,
            transparent
          );
          font-weight: 750;
        }

        .agregar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        .agregar-modal-actions {
          justify-content: center;
        }

        .agregar-primary-button,
        .agregar-muted-button,
        .agregar-danger-button,
        .agregar-success-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 0.9rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            opacity 170ms ease;
        }

        .agregar-primary-button,
        .agregar-success-button {
          color: #ffffff;
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--agregar-accent) 24%, transparent);
        }

        .theme-oscuro .agregar-primary-button,
        .theme-oscuro .agregar-success-button {
          color: #050505;
        }

        .agregar-primary-button {
          background: linear-gradient(
            135deg,
            var(--agregar-accent),
            color-mix(in srgb, var(--agregar-accent) 72%, #38bdf8)
          );
        }

        .agregar-success-button {
          background: linear-gradient(
            135deg,
            var(--agregar-accent),
            color-mix(in srgb, var(--agregar-accent) 72%, #38bdf8)
          );
        }

        .agregar-muted-button {
          color: var(--agregar-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--agregar-border);
        }

        .agregar-danger-button {
          color: #ffffff;
          background: linear-gradient(135deg, #dc2626, #ef4444);
        }

        .agregar-primary-button:hover:not(:disabled),
        .agregar-muted-button:hover:not(:disabled),
        .agregar-danger-button:hover:not(:disabled),
        .agregar-success-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .agregar-primary-button:disabled,
        .agregar-muted-button:disabled,
        .agregar-danger-button:disabled,
        .agregar-success-button:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          transform: none;
        }

        .agregar-submit-button {
          width: 100%;
          min-height: 48px;
          margin-top: 4px;
        }

        .agregar-curso-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(8px);
        }

        .agregar-curso-modal {
          position: relative;
          width: min(94vw, 760px);
          max-height: 90dvh;
          overflow-y: auto;
          overflow-x: hidden;
          border-radius: 30px;
          clip-path: inset(0 round 30px);
          padding: clamp(18px, 3vw, 28px);
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--agregar-border);
          box-shadow:
            var(--fcc-premium-shadow-hover),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          scrollbar-width: thin;
          scrollbar-color: color-mix(
            in srgb,
            var(--agregar-accent) 42%,
            transparent
          ) transparent;
        }

        .agregar-curso-modal::-webkit-scrollbar {
          width: 10px;
        }

        .agregar-curso-modal::-webkit-scrollbar-track {
          background: transparent;
          margin: 18px 0;
        }

        .agregar-curso-modal::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--agregar-accent) 42%,
            transparent
          );
          border: 3px solid transparent;
          background-clip: padding-box;
        }

        .agregar-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--agregar-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--agregar-border);
        }

        .agregar-modal-close:hover {
          color: #ef4444;
          transform: translateY(-1px);
          border-color: color-mix(in srgb, #ef4444 34%, var(--agregar-border));
        }

        .agregar-modal-title {
          padding-right: 42px;
          color: var(--agregar-heading);
          font-size: clamp(1.6rem, 3vw, 2.4rem);
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.055em;
          text-align: center;
        }

        .agregar-modal-description {
          max-width: 520px;
          margin: 8px auto 20px;
          color: var(--agregar-muted);
          text-align: center;
          font-size: 0.94rem;
          font-weight: 750;
          line-height: 1.45;
        }

        .agregar-confirm-modal {
          width: min(94vw, 560px);
        }

        .agregar-warning-box {
          border-radius: 18px;
          padding: 14px 16px;
          color: var(--agregar-heading);
          background: color-mix(in srgb, #ef4444 8%, var(--fcc-premium-surface));
          border: 1px solid color-mix(in srgb, #ef4444 28%, var(--agregar-border));
          text-align: center;
          font-size: 0.94rem;
          font-weight: 850;
          line-height: 1.45;
        }

        .agregar-modal-form {
          display: grid;
          gap: 14px;
        }

        .agregar-periodo-card {
          display: grid;
          gap: 12px;
          border-radius: 22px;
          padding: 14px;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 70%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--agregar-accent) 18%,
            var(--agregar-border)
          );
        }

        .agregar-periodo-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px auto;
          gap: 10px;
          align-items: end;
        }

        .agregar-secciones {
          display: grid;
          gap: 8px;
        }

        .agregar-seccion-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }

        @media (max-width: 640px) {
          .agregar-curso-hero {
            padding: 14px 16px;
          }

          .agregar-curso-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .agregar-curso-description {
            font-size: 0.86rem;
          }

          .agregar-carrera-top,
          .agregar-periodo-grid,
          .agregar-seccion-row {
            grid-template-columns: 1fr;
          }
          
          .agregar-carrera-actions {
            justify-content: stretch;
          }

          .agregar-actions {
            justify-content: stretch;
          }

          .agregar-primary-button,
          .agregar-muted-button,
          .agregar-danger-button,
          .agregar-success-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="agregar-curso-page">
        <section className="agregar-curso-hero">
          <div className="agregar-curso-hero-inner">
            <p className="agregar-curso-kicker">Agregar curso</p>

            <p className="agregar-curso-description">
              Configura el curso, sus carreras, períodos y secciones.
            </p>
          </div>
        </section>

        <section className="agregar-curso-panel">
          <form onSubmit={handleSubmit} className="agregar-curso-form">
            <div className="agregar-field">
              <label className="agregar-label">Nombre del curso</label>

              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="agregar-input"
                placeholder="Ingresa el nombre del curso"
                required
              />
            </div>

            <div>
              <h2 className="agregar-section-title">Carreras ligadas</h2>

              {cursoCarreras.length === 0 ? (
                <div className="agregar-empty">
                  No hay carreras agregadas.
                </div>
              ) : (
                <div className="agregar-carreras-grid">
                  {cursoCarreras.map((cc, idx) => (
                    <article key={idx} className="agregar-carrera-card">
                      <div className="agregar-carrera-top">
                        <div className="agregar-carrera-main">
                          <h3 className="agregar-carrera-title">
                            {getCarreraNombre(cc.carrera_id)}
                          </h3>

                          <p className="agregar-carrera-area">{cc.area}</p>

                          <p className="agregar-carrera-semestre">
                            Semestre {cc.semestre || "-"}
                          </p>
                        </div>

                        <div className="agregar-carrera-actions">
                          <button
                            type="button"
                            onClick={() => abrirEditarCarrera(idx)}
                            className="agregar-muted-button"
                          >
                            <Pencil size={16} strokeWidth={2.4} />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCarreraAEliminarIndex(idx)}
                            className="agregar-danger-button"
                          >
                            <Trash2 size={16} strokeWidth={2.4} />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>

                      <div className="agregar-carrera-periodos">
                        {cc.periodos.map((p, pidx) => (
                          <div key={pidx} className="agregar-periodo-resumen">
                            <p className="agregar-periodo-nombre">
                              {p.nombre} {p.anio}
                            </p>

                            <ul className="agregar-secciones-resumen">
                              {p.secciones.map((s, sidx) => (
                                <li key={sidx}>{s.nombre}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="agregar-actions mt-4">
                <button
                  type="button"
                  onClick={abrirAgregarCarrera}
                  className="agregar-primary-button"
                >
                  <Plus size={17} strokeWidth={2.4} />
                  <span>Agregar carrera</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="agregar-primary-button agregar-submit-button"
            >
              <Save size={18} strokeWidth={2.4} />
              <span>{loading ? "Agregando..." : "Agregar curso"}</span>
            </button>
          </form>
        </section>
      </div>

      {carreraAEliminarIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="agregar-curso-modal-overlay"
            onClick={() => setCarreraAEliminarIndex(null)}
          >
            <div
              className="agregar-curso-modal agregar-confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="agregar-modal-close"
                onClick={() => setCarreraAEliminarIndex(null)}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <h3 className="agregar-modal-title">Eliminar carrera</h3>

              <p className="agregar-modal-description">
                Esta carrera se quitará de la configuración del curso antes de
                crearlo.
              </p>

              <div className="agregar-warning-box">
                Revisa bien esta acción si ya habías configurado períodos y
                secciones para esta carrera.
              </div>

              <div className="agregar-actions agregar-modal-actions mt-5">
                <button
                  type="button"
                  onClick={() => setCarreraAEliminarIndex(null)}
                  className="agregar-muted-button"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={eliminarCarreraConfirmada}
                  className="agregar-danger-button"
                >
                  <Trash2 size={17} strokeWidth={2.4} />
                  <span>Confirmar eliminación</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {nuevaCarrera &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="agregar-curso-modal-overlay"
            onClick={cerrarModalCarrera}
          >
            <div
              className="agregar-curso-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="agregar-modal-close"
                onClick={cerrarModalCarrera}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <h3 className="agregar-modal-title">
                {editandoCarreraIndex !== null ? "Editar carrera" : "Agregar carrera"}
              </h3>

              <p className="agregar-modal-description">
                {editandoCarreraIndex !== null
                  ? "Ajusta la carrera, semestre, área, períodos y secciones."
                  : "Define la carrera, semestre, área, períodos y secciones disponibles para este curso."}
              </p>

              <div className="agregar-modal-form">
                <div className="agregar-field">
                  <label className="agregar-label">Carrera</label>

                  <select
                    value={nuevaCarrera.carrera_id || ""}
                    onChange={(e) =>
                      setNuevaCarrera({
                        ...nuevaCarrera,
                        carrera_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="agregar-select"
                  >
                    <option value="">Seleccione carrera</option>

                    {carrerasDisponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="agregar-field">
                  <label className="agregar-label">Semestre</label>

                  <select
                    value={nuevaCarrera.semestre || ""}
                    onChange={(e) =>
                      setNuevaCarrera({
                        ...nuevaCarrera,
                        semestre: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="agregar-select"
                  >
                    <option value="">Seleccione semestre</option>

                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Semestre {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="agregar-field">
                  <label className="agregar-label">Área</label>

                  <select
                    value={nuevaCarrera.area}
                    onChange={(e) =>
                      setNuevaCarrera({
                        ...nuevaCarrera,
                        area: e.target.value,
                      })
                    }
                    className="agregar-select"
                  >
                    <option value="Ciencias Básicas">Ciencias Básicas</option>
                    <option value="Computación">Computación</option>
                  </select>
                </div>

                <h4 className="agregar-section-title">Períodos</h4>

                {nuevaCarrera.periodos.map((p, idx) => (
                  <div key={idx} className="agregar-periodo-card">
                    <div className="agregar-periodo-grid">
                      <div className="agregar-field">
                        <label className="agregar-label">Período</label>

                        <select
                          value={p.nombre}
                          onChange={(e) =>
                            actualizarPeriodo(idx, {
                              nombre: e.target.value as Periodo["nombre"],
                            })
                          }
                          className="agregar-select"
                        >
                          <option value="Primavera">Primavera</option>
                          <option value="Verano">Verano</option>
                          <option value="Otoño">Otoño</option>
                        </select>
                      </div>

                      <div className="agregar-field">
                        <label className="agregar-label">Año</label>

                        <input
                          type="number"
                          value={p.anio}
                          onChange={(e) =>
                            actualizarPeriodo(idx, {
                              anio: Number(e.target.value),
                            })
                          }
                          className="agregar-input"
                          placeholder="Año"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarPeriodo(idx)}
                        className="agregar-danger-button"
                      >
                        <Trash2 size={16} strokeWidth={2.4} />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    <div className="agregar-secciones">
                      <label className="agregar-label">Secciones</label>

                      {p.secciones.map((s, sidx) => (
                        <div key={sidx} className="agregar-seccion-row">
                          <input
                            type="text"
                            value={s.nombre}
                            onChange={(e) =>
                              actualizarSeccion(idx, sidx, e.target.value)
                            }
                            className="agregar-input"
                            placeholder="Nombre de la sección"
                          />

                          <button
                            type="button"
                            onClick={() => eliminarSeccion(idx, sidx)}
                            className="agregar-danger-button"
                          >
                            <Trash2 size={16} strokeWidth={2.4} />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => agregarSeccion(idx)}
                        className="agregar-muted-button"
                      >
                        <Plus size={16} strokeWidth={2.4} />
                        <span>Agregar sección</span>
                      </button>
                    </div>
                  </div>
                ))}

                <div className="agregar-actions">
                  <button
                    type="button"
                    onClick={agregarPeriodo}
                    className="agregar-muted-button"
                  >
                    <Plus size={16} strokeWidth={2.4} />
                    <span>Agregar período</span>
                  </button>
                </div>

                <div className="agregar-actions agregar-modal-actions">
                  <button
                    type="button"
                    onClick={cerrarModalCarrera}
                    className="agregar-muted-button"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={guardarNuevaCarrera}
                    className="agregar-success-button"
                  >
                    <Save size={17} strokeWidth={2.4} />
                    <span>
                      {editandoCarreraIndex !== null
                        ? "Guardar cambios"
                        : "Guardar carrera"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </LayoutGeneral>
  );
}