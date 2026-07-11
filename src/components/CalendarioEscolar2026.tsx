"use client";

/**
 * Calendario escolar 2026 para profesional semestral.
 * Vista de solo consulta, con preferencias persistentes por usuario.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

type ModoCalendarioAcademico = "semestral" | "cuatrimestral";
type PeriodoCalendarioAcademico = "completo" | "primavera" | "verano" | "otono";
type TipoEventoCalendario =
  | "reinicio"
  | "inicio"
  | "inscripcion"
  | "gestion"
  | "fin"
  | "suspension"
  | "vacaciones"
  | "diaBuap";

type EventoCalendario = {
  fecha: string;
  tipo: TipoEventoCalendario;
  label: string;
};

type PreferenciasCalendario = {
  modo: ModoCalendarioAcademico;
  periodo: PeriodoCalendarioAcademico;
};

const CALENDARIO_ESCOLAR_ANIO_DISPONIBLE = 2026;
const CALENDARIO_STORAGE_KEY = "fcc-academy-calendario-escolar-2026-v1";
const DB_CALENDARIO_TABLE = "calendarios_usuario";

const CALENDARIO_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const CALENDARIO_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PERIODOS_CALENDARIO: {
  id: PeriodoCalendarioAcademico;
  label: string;
  meses: number[];
}[] = [
  {
    id: "completo",
    label: "Todo el año",
    meses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: "primavera",
    label: "Primavera",
    meses: [0, 1, 2, 3, 4, 5],
  },
  {
    id: "verano",
    label: "Verano",
    meses: [5, 6],
  },
  {
    id: "otono",
    label: "Otoño",
    meses: [7, 8, 9, 10, 11],
  },
];

const EVENTOS_CALENDARIO_2026: EventoCalendario[] = [
  { fecha: "2026-01-01", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-01-06", tipo: "reinicio", label: "Reinicio de actividades" },

  { fecha: "2026-02-02", tipo: "suspension", label: "Suspensión de labores" },

  { fecha: "2026-03-13", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-03-16", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-03-30", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-03-31", tipo: "vacaciones", label: "Vacaciones" },

  { fecha: "2026-04-01", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-04-02", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-04-03", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-04-04", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-04-06", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-04-07", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-04-08", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-04-09", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-04-10", tipo: "vacaciones", label: "Vacaciones" },

  { fecha: "2026-05-01", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-05-05", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-05-10", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-05-15", tipo: "suspension", label: "Suspensión de labores" },

  { fecha: "2026-06-02", tipo: "fin", label: "Fin de cursos y exámenes" },
  { fecha: "2026-06-08", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-06-08", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-06-09", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-06-09", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-06-10", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-06-10", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-06-11", tipo: "inicio", label: "Inicio de cursos" },

  { fecha: "2026-07-08", tipo: "fin", label: "Fin de cursos y exámenes" },
  { fecha: "2026-07-09", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-10", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-13", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-14", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-07-14", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-15", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-07-15", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-16", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-07-16", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-17", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-07-17", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-07-20", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-21", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-22", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-23", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-24", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-27", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-28", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-29", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-30", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-07-31", tipo: "vacaciones", label: "Vacaciones" },

  { fecha: "2026-08-03", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-08-04", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-08-05", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-08-06", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-08-07", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-08-10", tipo: "reinicio", label: "Reinicio de actividades" },

  { fecha: "2026-09-16", tipo: "suspension", label: "Suspensión de labores" },

  { fecha: "2026-11-01", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-11-02", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-11-16", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-11-23", tipo: "diaBuap", label: "Día de la Benemérita Universidad Autónoma de Puebla" },

  { fecha: "2026-12-14", tipo: "fin", label: "Fin de cursos y exámenes" },
  { fecha: "2026-12-15", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-12-16", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-12-16", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-12-17", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-12-17", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-12-18", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-12-18", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-12-21", tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { fecha: "2026-12-21", tipo: "gestion", label: "Actividades académicas y administrativas" },
  { fecha: "2026-12-22", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-23", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-24", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-25", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-25", tipo: "suspension", label: "Suspensión de labores" },
  { fecha: "2026-12-28", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-29", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-30", tipo: "vacaciones", label: "Vacaciones" },
  { fecha: "2026-12-31", tipo: "vacaciones", label: "Vacaciones" },
];

const LEYENDA_CALENDARIO: { tipo: TipoEventoCalendario; label: string }[] = [
  { tipo: "reinicio", label: "Reinicio de actividades" },
  { tipo: "inicio", label: "Inicio de cursos" },
  { tipo: "inscripcion", label: "Inscripción / reinscripción" },
  { tipo: "gestion", label: "Actividades académicas y administrativas" },
  { tipo: "fin", label: "Fin de cursos y exámenes" },
  { tipo: "suspension", label: "Suspensión de labores" },
  { tipo: "vacaciones", label: "Vacaciones" },
  { tipo: "diaBuap", label: "Día de la BUAP" },
];

function fechaCalendarioKey(monthIndex: number, day: number) {
  return `${CALENDARIO_ESCOLAR_ANIO_DISPONIBLE}-${String(monthIndex + 1).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function eventosPorFechaCalendario() {
  return EVENTOS_CALENDARIO_2026.reduce<Record<string, EventoCalendario[]>>(
    (mapa, evento) => {
      mapa[evento.fecha] = [...(mapa[evento.fecha] ?? []), evento];
      return mapa;
    },
    {},
  );
}

function fechaEnPeriodo(
  fecha: string,
  periodo: PeriodoCalendarioAcademico,
) {
  if (periodo === "completo") return true;

  if (periodo === "primavera") {
    return fecha >= "2026-01-01" && fecha <= "2026-06-02";
  }

  if (periodo === "verano") {
    return fecha >= "2026-06-08" && fecha <= "2026-07-31";
  }

  return fecha >= "2026-08-01" && fecha <= "2026-12-31";
}

function normalizarPreferenciasCalendario(raw: unknown): PreferenciasCalendario {
  const parsed =
    raw && typeof raw === "object"
      ? (raw as Partial<PreferenciasCalendario>)
      : {};

  const modo: ModoCalendarioAcademico =
    parsed.modo === "cuatrimestral" ? "cuatrimestral" : "semestral";

  const periodoValido = PERIODOS_CALENDARIO.some(
    (item) => item.id === parsed.periodo,
  );

  return {
    modo,
    periodo: periodoValido
      ? (parsed.periodo as PeriodoCalendarioAcademico)
      : "completo",
  };
}

function leerPreferenciasLocales() {
  if (typeof window === "undefined") {
    return normalizarPreferenciasCalendario(null);
  }

  try {
    const guardado = localStorage.getItem(CALENDARIO_STORAGE_KEY);

    return normalizarPreferenciasCalendario(
      guardado ? JSON.parse(guardado) : null,
    );
  } catch {
    localStorage.removeItem(CALENDARIO_STORAGE_KEY);

    return normalizarPreferenciasCalendario(null);
  }
}

function obtenerVariableCss(nombre: string, fallback: string) {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(nombre)
    .trim();

  return value || fallback;
}

function extraerUrlCss(valor: string) {
  const match = valor.match(/url\((["']?)(.*?)\1\)/);
  return match?.[2] || null;
}

function obtenerLogoActual() {
  const raw = obtenerVariableCss(
    "--fcc-sidebar-logo-image",
    'url("/logos/logo-azul.png")',
  );

  return extraerUrlCss(raw) ?? "/logos/logo-azul.png";
}

function cargarImagenCanvas(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = src;
  });
}

function IconoReinicioCalendario({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M23.6 9.1A10 10 0 1 0 26 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path d="M23.1 4.6v7.2h-7.2z" fill="currentColor" />
      <circle cx="16" cy="16" r="6.3" fill="#28bce3" />
    </svg>
  );
}

function rectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radio = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + w - radio, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radio);
  ctx.lineTo(x + w, y + h - radio);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radio, y + h);
  ctx.lineTo(x + radio, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radio);
  ctx.lineTo(x, y + radio);
  ctx.quadraticCurveTo(x, y, x + radio, y);
  ctx.closePath();
}

function dibujarIconoReinicioCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#16a34a";
  ctx.fillStyle = "#16a34a";
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, 0, size * 0.36, Math.PI * 0.15, Math.PI * 1.86);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.24, -size * 0.46);
  ctx.lineTo(size * 0.47, -size * 0.18);
  ctx.lineTo(size * 0.1, -size * 0.17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#28bce3";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default function CalendarioEscolar2026() {
  const preferenciasIniciales = useMemo(() => leerPreferenciasLocales(), []);

  const [modo, setModo] = useState<ModoCalendarioAcademico>(
    preferenciasIniciales.modo,
  );
  const [periodo, setPeriodo] = useState<PeriodoCalendarioAcademico>(
    preferenciasIniciales.periodo,
  );
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [borradorModo, setBorradorModo] = useState<ModoCalendarioAcademico>(
    preferenciasIniciales.modo,
  );
  const [borradorPeriodo, setBorradorPeriodo] =
    useState<PeriodoCalendarioAcademico>(preferenciasIniciales.periodo);
  const [userIdCalendario, setUserIdCalendario] = useState<string | null>(null);
  const [preferenciasCargadas, setPreferenciasCargadas] = useState(false);

  const anioActual = new Date().getFullYear();
  const eventosPorFecha = useMemo(() => eventosPorFechaCalendario(), []);
  const mesesVisibles = useMemo(
    () =>
      PERIODOS_CALENDARIO.find((item) => item.id === periodo)?.meses ??
      PERIODOS_CALENDARIO[0].meses,
    [periodo],
  );
  const etiquetaPeriodo =
    PERIODOS_CALENDARIO.find((item) => item.id === periodo)?.label ??
    "Todo el año";
  const esAnioDisponible = anioActual === CALENDARIO_ESCOLAR_ANIO_DISPONIBLE;
  const disponible = modo === "semestral" && esAnioDisponible;

  function eventosDelDia(monthIndex: number, day: number) {
    return (eventosPorFecha[fechaCalendarioKey(monthIndex, day)] ?? []).filter(
      (evento) => fechaEnPeriodo(evento.fecha, periodo),
    );
  }

  function abrirAjustes() {
    setBorradorModo(modo);
    setBorradorPeriodo(periodo);
    setAjustesAbiertos(true);
  }

  function guardarAjustes() {
    setModo(borradorModo);
    setPeriodo(borradorPeriodo);
    setAjustesAbiertos(false);
  }

  useEffect(() => {
    let activo = true;

    async function cargarPreferencias() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!activo) return;

        setUserIdCalendario(user?.id ?? null);

        if (!user?.id) return;

        const { data, error } = await supabase
          .from(DB_CALENDARIO_TABLE)
          .select("datos")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!activo) return;

        if (!error && data?.datos) {
          const preferencias = normalizarPreferenciasCalendario(data.datos);

          setModo(preferencias.modo);
          setPeriodo(preferencias.periodo);
          localStorage.setItem(
            CALENDARIO_STORAGE_KEY,
            JSON.stringify(preferencias),
          );
        } else if (error) {
          console.warn("No se pudo cargar el calendario escolar:", error);
        }
      } catch (error) {
        console.warn("No se pudo consultar preferencias del calendario:", error);
      } finally {
        if (activo) setPreferenciasCargadas(true);
      }
    }

    cargarPreferencias();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!preferenciasCargadas) return;

    const datos = { modo, periodo };

    localStorage.setItem(CALENDARIO_STORAGE_KEY, JSON.stringify(datos));

    if (!userIdCalendario) return;

    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.from(DB_CALENDARIO_TABLE).upsert(
        {
          user_id: userIdCalendario,
          datos,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        console.warn("No se pudo guardar el calendario escolar:", error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [preferenciasCargadas, userIdCalendario, modo, periodo]);

  async function descargarCalendario() {
    if (!disponible) return;

    const meses = mesesVisibles;
    const scale = 2;
    const width = 1600;
    const margen = 56;
    const header = 122;
    const gap = 20;
    const monthW = (width - margen * 2 - gap * 2) / 3;
    const monthH = 226;
    const rows = Math.ceil(meses.length / 3);
    const leyendaH = 138;
    const height =
      header +
      rows * monthH +
      Math.max(0, rows - 1) * gap +
      leyendaH +
      margen;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#f0fdfa");
    bg.addColorStop(0.58, "#ffffff");
    bg.addColorStop(1, "#ecfeff");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const logo = await cargarImagenCanvas(obtenerLogoActual());

    let headerTextX = margen;

    if (logo) {
      const maxLogoW = 126;
      const maxLogoH = 82;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const logoW = logo.width * ratio;
      const logoH = logo.height * ratio;

      ctx.drawImage(logo, margen, 18, logoW, logoH);
      headerTextX = margen + logoW + 22;
    }

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText("CALENDARIO ESCOLAR 2026", headerTextX, 56);

    ctx.fillStyle = "#475569";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(
      `Profesional ${modo} · ${etiquetaPeriodo}`,
      headerTextX,
      88,
    );

    function dibujarMes(monthIndex: number, x: number, y: number) {
      const primerDia = new Date(CALENDARIO_ESCOLAR_ANIO_DISPONIBLE, monthIndex, 1);
      const totalDias = new Date(
        CALENDARIO_ESCOLAR_ANIO_DISPONIBLE,
        monthIndex + 1,
        0,
      ).getDate();
      const offset = (primerDia.getDay() + 6) % 7;
      const cellW = (monthW - 24) / 7;
      const cellH = 24;

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(15, 23, 42, 0.09)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      rectRedondeado(ctx, x, y, monthW, monthH, 22);
      ctx.fill();
      ctx.shadowColor = "transparent";

      ctx.strokeStyle = "rgba(20, 184, 166, 0.18)";
      ctx.lineWidth = 1.4;
      rectRedondeado(ctx, x, y, monthW, monthH, 22);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillText(CALENDARIO_MESES[monthIndex].toUpperCase(), x + 14, y + 30);

      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = "#475569";

      CALENDARIO_DIAS.forEach((dia, index) => {
        ctx.textAlign = "center";
        ctx.fillText(dia, x + 12 + cellW * index + cellW / 2, y + 52);
      });

      for (let day = 1; day <= totalDias; day += 1) {
        const pos = offset + day - 1;
        const col = pos % 7;
        const row = Math.floor(pos / 7);
        const cx = x + 12 + col * cellW + cellW / 2;
        const cy = y + 70 + row * cellH;

        const eventos = eventosDelDia(monthIndex, day);
        const tipos = eventos.map((evento) => evento.tipo);
        const weekend = col >= 5;

        if (weekend) {
          ctx.fillStyle = "rgba(34, 211, 238, 0.13)";
          rectRedondeado(ctx, cx - cellW / 2 + 2, cy - 14, cellW - 4, 22, 5);
          ctx.fill();
        }

        if (tipos.includes("vacaciones")) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1.6;
          rectRedondeado(ctx, cx - cellW / 2 + 3, cy - 14, cellW - 6, 22, 4);
          ctx.stroke();
        }

        if (tipos.includes("inscripcion")) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = 1.6;
          rectRedondeado(ctx, cx - cellW / 2 + 5, cy - 12, cellW - 10, 18, 4);
          ctx.stroke();
        }

        ctx.fillStyle = "#0f172a";
        ctx.font = "15px system-ui, sans-serif";
        ctx.textAlign = "center";

        if (tipos.includes("reinicio")) {
          dibujarIconoReinicioCanvas(ctx, cx, cy - 3, 24);
        } else if (tipos.includes("inicio")) {
          ctx.fillStyle = "#28bce3";
          ctx.beginPath();
          ctx.arc(cx, cy - 3, 10, 0, Math.PI * 2);
          ctx.fill();
        } else if (tipos.includes("diaBuap")) {
          ctx.fillStyle = "#e0f2fe";
          ctx.strokeStyle = "#075985";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 3, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#075985";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText("B", cx, cy + 1);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.fillText(String(day), cx, cy + 2);
        }

        if (tipos.includes("fin")) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(cx, cy - 3, 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (tipos.includes("suspension")) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 10);
          ctx.lineTo(cx + 7, cy + 4);
          ctx.moveTo(cx + 7, cy - 10);
          ctx.lineTo(cx - 7, cy + 4);
          ctx.stroke();
        }

        if (tipos.includes("gestion")) {
          ctx.fillStyle = "#334155";
          rectRedondeado(ctx, cx - 10, cy + 7, 20, 3, 999);
          ctx.fill();
        }
      }
    }

    function dibujarIconoLeyenda(tipo: TipoEventoCalendario, x: number, y: number) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (tipo === "reinicio") {
        dibujarIconoReinicioCanvas(ctx, x, y, 22);
      } else if (tipo === "inicio") {
        ctx.fillStyle = "#28bce3";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (tipo === "inscripcion") {
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 2;
        rectRedondeado(ctx, x - 12, y - 9, 24, 18, 5);
        ctx.stroke();
      } else if (tipo === "gestion") {
        ctx.fillStyle = "#334155";
        rectRedondeado(ctx, x - 11, y - 2, 22, 4, 999);
        ctx.fill();
      } else if (tipo === "fin") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tipo === "suspension") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 7);
        ctx.lineTo(x + 7, y + 7);
        ctx.moveTo(x + 7, y - 7);
        ctx.lineTo(x - 7, y + 7);
        ctx.stroke();
      } else if (tipo === "vacaciones") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        rectRedondeado(ctx, x - 12, y - 9, 24, 18, 5);
        ctx.stroke();
      } else if (tipo === "diaBuap") {
        ctx.fillStyle = "#e0f2fe";
        ctx.strokeStyle = "#075985";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#075985";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText("B", x, y + 1);
      }

      ctx.restore();
    }

    meses.forEach((monthIndex, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);

      dibujarMes(
        monthIndex,
        margen + col * (monthW + gap),
        header + row * (monthH + gap),
      );
    });

    const leyendaY = header + rows * monthH + Math.max(0, rows - 1) * gap + 24;
    const leyendaX = margen;
    const leyendaW = width - margen * 2;

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    rectRedondeado(ctx, leyendaX, leyendaY, leyendaW, 104, 22);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = "rgba(20, 184, 166, 0.18)";
    ctx.lineWidth = 1.4;
    rectRedondeado(ctx, leyendaX, leyendaY, leyendaW, 104, 22);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 21px system-ui, sans-serif";
    ctx.fillText("CLAVES", leyendaX + 20, leyendaY + 34);

    const itemsPorFila = 4;
    const itemW = (leyendaW - 40) / itemsPorFila;

    LEYENDA_CALENDARIO.forEach((item, index) => {
      const col = index % itemsPorFila;
      const row = Math.floor(index / itemsPorFila);
      const baseX = leyendaX + 20 + col * itemW;
      const baseY = leyendaY + 58 + row * 32;

      dibujarIconoLeyenda(item.tipo, baseX + 12, baseY - 5);

      ctx.fillStyle = "#475569";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.label, baseX + 34, baseY);
    });

    const link = document.createElement("a");
    link.download = `calendario-escolar-2026-${periodo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }


  useEffect(() => {
    const abrir = () => abrirAjustes();
    const descargar = () => {
      void descargarCalendario();
    };

    window.addEventListener("abrirAjustesCalendarioEscolar", abrir);
    window.addEventListener("solicitarDescargaCalendarioEscolar", descargar);

    return () => {
      window.removeEventListener("abrirAjustesCalendarioEscolar", abrir);
      window.removeEventListener("solicitarDescargaCalendarioEscolar", descargar);
    };
  }, [modo, periodo, disponible, mesesVisibles]);

  function renderMonth(monthName: string, monthIndex: number) {
    const primerDia = new Date(CALENDARIO_ESCOLAR_ANIO_DISPONIBLE, monthIndex, 1);
    const totalDias = new Date(
      CALENDARIO_ESCOLAR_ANIO_DISPONIBLE,
      monthIndex + 1,
      0,
    ).getDate();
    const offset = (primerDia.getDay() + 6) % 7;
    const celdas = Array.from(
      { length: offset + totalDias },
      (_, index) => (index < offset ? null : index - offset + 1),
    );

    return (
      <section key={monthName} className="fcc-calendar-month">
        <h4>{monthName}</h4>

        <div className="fcc-calendar-weekdays">
          {CALENDARIO_DIAS.map((dia) => (
            <span key={dia}>{dia}</span>
          ))}
        </div>

        <div className="fcc-calendar-days">
          {celdas.map((day, index) => {
            if (!day) {
              return <span key={`empty-${index}`} className="is-empty" />;
            }

            const eventos = eventosDelDia(monthIndex, day);
            const tipos = eventos.map((evento) => evento.tipo);
            const finSemana = index % 7 >= 5;

            return (
              <span
                key={day}
                className={`fcc-calendar-day ${finSemana ? "is-weekend" : ""} ${tipos
                  .map((tipo) => `has-${tipo}`)
                  .join(" ")}`}
                title={eventos.map((evento) => evento.label).join(" · ")}
              >
                <b>{day}</b>
                <i className="fcc-calendar-markers" aria-hidden="true">
                  {tipos.includes("reinicio") && (
                    <em className="mark-reinicio">
                      <IconoReinicioCalendario />
                    </em>
                  )}
                  {tipos.includes("inicio") && <em className="mark-inicio" />}
                  {tipos.includes("diaBuap") && <em className="mark-buap">B</em>}
                </i>
              </span>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="fcc-calendar-tool">
      <style>{`
        .fcc-calendar-tool {
          min-height: 0;
          display: grid;
          gap: 14px;
        }

        .fcc-calendar-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 22px;
          padding: 12px;
          background:
            radial-gradient(
              circle at 5% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 34%
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
        }

        .fcc-calendar-control h4 {
          margin: 0;
          color: var(--fcc-user-text);
          font-size: 1rem;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .fcc-calendar-current {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .fcc-calendar-current span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          border-radius: 999px;
          padding: 0 10px;
          color: var(--fcc-user-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          font-size: 0.78rem;
          font-weight: 930;
        }

        .fcc-calendar-unavailable {
          min-height: 360px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          padding: 24px;
          text-align: center;
          background: var(--fcc-user-modal-placeholder-bg);
          border: 1px dashed var(--fcc-user-modal-placeholder-border);
        }

        .fcc-calendar-unavailable strong {
          color: var(--fcc-user-text);
          font-size: 1.2rem;
          font-weight: 950;
        }

        .fcc-calendar-unavailable span {
          display: block;
          margin-top: 8px;
          max-width: 560px;
          color: var(--fcc-user-muted);
          font-size: 0.92rem;
          font-weight: 760;
          line-height: 1.45;
        }

        .fcc-calendar-body {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 14px;
        }

        .fcc-calendar-months {
          min-height: 0;
          max-height: min(680px, calc(100dvh - 220px));
          overflow: auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 2px 4px 2px 2px;
          scrollbar-gutter: stable;
        }

        .fcc-calendar-month {
          min-width: 0;
          border-radius: 20px;
          padding: 12px;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 90%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 84%, transparent)
            );
          border: 1px solid var(--fcc-user-card-border);
          box-shadow:
            0 14px 24px rgba(15, 23, 42, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.58);
        }

        .fcc-calendar-month h4 {
          margin: 0 0 8px;
          color: var(--fcc-user-text);
          font-size: 1rem;
          font-weight: 950;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }

        .fcc-calendar-weekdays,
        .fcc-calendar-days {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 3px;
        }

        .fcc-calendar-weekdays span {
          color: var(--fcc-user-muted);
          font-size: 0.58rem;
          font-weight: 950;
          text-align: center;
        }

        .fcc-calendar-day,
        .fcc-calendar-days .is-empty {
          position: relative;
          min-height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--fcc-user-text);
          font-size: 0.78rem;
          font-weight: 760;
        }

        .fcc-calendar-day b {
          position: relative;
          z-index: 2;
          font-weight: 820;
        }

        .fcc-calendar-day.is-weekend {
          background: color-mix(in srgb, var(--fcc-premium-cyan) 12%, transparent);
        }

        .fcc-calendar-day.has-vacaciones {
          outline: 1.5px solid #ef4444;
          outline-offset: -1.5px;
          background: color-mix(in srgb, #ef4444 5%, transparent);
        }

        .fcc-calendar-day.has-inscripcion {
          outline: 1.5px solid #0ea5e9;
          outline-offset: -1.5px;
          background: color-mix(in srgb, #0ea5e9 8%, transparent);
        }

        .fcc-calendar-day.has-fin b {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1.6px solid #ef4444;
          color: #dc2626;
        }

        .fcc-calendar-day.has-suspension::after {
          content: "×";
          position: absolute;
          inset: 0;
          z-index: 3;
          display: grid;
          place-items: center;
          color: #ef4444;
          font-size: 1.45rem;
          font-weight: 900;
          line-height: 1;
        }

        .fcc-calendar-day.has-gestion::before {
          content: "";
          position: absolute;
          left: 24%;
          right: 24%;
          bottom: 3px;
          z-index: 4;
          height: 3px;
          border-radius: 999px;
          background: #334155;
        }

        .fcc-calendar-day.has-reinicio b,
        .fcc-calendar-day.has-inicio b,
        .fcc-calendar-day.has-diaBuap b {
          opacity: 0;
        }

        .fcc-calendar-markers {
          position: absolute;
          inset: 0;
          z-index: 6;
          display: grid;
          place-items: center;
          font-style: normal;
          pointer-events: none;
        }

        .fcc-calendar-markers em {
          font-style: normal;
        }

        .mark-reinicio {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          color: #16a34a;
        }

        .mark-reinicio svg {
          width: 25px;
          height: 25px;
          display: block;
          filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.9));
        }

        .mark-inicio {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #28bce3;
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.9),
            0 0 0 4px color-mix(in srgb, #28bce3 18%, transparent);
        }

        .mark-gestion {
          width: 14px;
          height: 3px;
          border-radius: 999px;
          background: #334155;
        }

        .mark-buap {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #075985;
          border: 2px solid #075985;
          background: #e0f2fe;
          font-size: 0.72rem;
          font-weight: 950;
          line-height: 1;
        }

        .fcc-calendar-legend {
          align-self: start;
          border-radius: 22px;
          padding: 14px;
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent),
              transparent 60%
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.05);
        }

        .fcc-calendar-legend h4 {
          margin: 0 0 10px;
          color: var(--fcc-user-text);
          font-size: 0.96rem;
          font-weight: 950;
        }

        .fcc-calendar-legend ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }

        .fcc-calendar-legend li {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          color: var(--fcc-user-muted);
          font-size: 0.78rem;
          font-weight: 760;
          line-height: 1.22;
        }

        .fcc-calendar-legend-icon {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: color-mix(in srgb, var(--fcc-premium-surface) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          color: var(--fcc-user-accent);
          font-size: 0.78rem;
          font-weight: 950;
        }

        .fcc-calendar-legend-icon.kind-reinicio {
          color: #16a34a;
          border: 0;
          background: transparent;
        }

        .fcc-calendar-legend-icon.kind-reinicio svg {
          width: 22px;
          height: 22px;
          display: block;
        }

        .fcc-calendar-legend-icon.kind-inicio::before {
          content: "";
          width: 15px;
          height: 15px;
          border-radius: 999px;
          background: #28bce3;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.78);
        }

        .fcc-calendar-legend-icon.kind-inscripcion {
          border-color: #0ea5e9;
        }

        .fcc-calendar-legend-icon.kind-gestion::before {
          content: "";
          width: 15px;
          height: 3px;
          border-radius: 999px;
          background: #334155;
        }

        .fcc-calendar-legend-icon.kind-fin {
          color: #ef4444;
          border-radius: 999px;
          border-color: #ef4444;
        }

        .fcc-calendar-legend-icon.kind-suspension {
          color: #ef4444;
          font-size: 1.05rem;
        }

        .fcc-calendar-legend-icon.kind-vacaciones {
          border-color: #ef4444;
          background: color-mix(in srgb, #ef4444 7%, transparent);
        }

        .fcc-calendar-legend-icon.kind-diaBuap {
          color: #075985;
          border-radius: 999px;
          border-color: #075985;
          background: #e0f2fe;
        }

        .fcc-calendar-settings-overlay {
          position: fixed;
          inset: 0;
          z-index: 26000;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.36);
          backdrop-filter: blur(7px);
        }

        .theme-oscuro .fcc-calendar-settings-overlay {
          background: rgba(0, 0, 0, 0.62);
        }

        .fcc-calendar-settings-card {
          width: min(520px, 100%);
          border-radius: 26px;
          padding: 18px;
          color: var(--fcc-user-text);
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 12%, transparent),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-user-modal-border);
          box-shadow:
            0 30px 80px rgba(15, 23, 42, 0.28),
            var(--fcc-user-card-inset);
        }

        .fcc-calendar-settings-card h4 {
          margin: 0;
          color: var(--fcc-user-text);
          font-size: 1.35rem;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .fcc-calendar-settings-card p {
          margin: 6px 0 0;
          color: var(--fcc-user-muted);
          font-size: 0.88rem;
          font-weight: 760;
          line-height: 1.38;
        }

        .fcc-calendar-settings-section {
          margin-top: 16px;
          display: grid;
          gap: 9px;
        }

        .fcc-calendar-settings-section strong {
          color: var(--fcc-user-text);
          font-size: 0.82rem;
          font-weight: 950;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .fcc-calendar-option-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .fcc-calendar-option-grid button {
          min-height: 36px;
          border-radius: 999px;
          padding: 0 12px;
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 86%, transparent);
          border: 1px solid var(--fcc-user-card-border);
          font-size: 0.82rem;
          font-weight: 900;
          transition:
            transform 180ms ease,
            color 180ms ease,
            border-color 180ms ease,
            background 180ms ease;
        }

        .fcc-calendar-option-grid button.is-active {
          color: #ffffff;
          background: var(--fcc-premium-button);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
          box-shadow: 0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 15%, transparent);
        }

        .theme-oscuro .fcc-calendar-option-grid button.is-active {
          color: #050505;
        }

        .fcc-calendar-settings-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .fcc-calendar-settings-actions button {
          min-height: 42px;
          border-radius: 15px;
          font-size: 0.88rem;
          font-weight: 950;
        }

        .fcc-calendar-settings-actions button:first-child {
          color: var(--fcc-user-soft-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 84%, transparent);
          border: 1px solid var(--fcc-user-card-border);
        }

        .fcc-calendar-settings-actions button:last-child {
          color: #ffffff;
          background: var(--fcc-premium-button);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);
        }

        .theme-oscuro .fcc-calendar-settings-actions button:last-child {
          color: #050505;
        }

        @media (max-width: 980px) {
          .fcc-calendar-body {
            grid-template-columns: 1fr;
          }

          .fcc-calendar-months {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            max-height: min(640px, calc(100dvh - 250px));
          }
        }

        @media (max-width: 640px) {
          .fcc-calendar-control {
            align-items: stretch;
            flex-direction: column;
          }

          .fcc-calendar-current {
            justify-content: flex-start;
          }

          .fcc-calendar-months {
            grid-template-columns: 1fr;
          }

          .fcc-calendar-settings-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="fcc-calendar-control">
        <div>
          <h4>Profesional semestral · Calendario escolar 2026</h4>
        </div>

        <div className="fcc-calendar-current" aria-label="Configuración actual">
          <span>{modo === "semestral" ? "Semestral" : "Cuatrimestral"}</span>
          <span>{etiquetaPeriodo}</span>
        </div>
      </div>

      {!disponible ? (
        <div className="fcc-calendar-unavailable">
          <div>
            <strong>
              {modo === "cuatrimestral"
                ? "Calendario cuatrimestral aún no disponible"
                : "Calendario escolar pendiente de actualización"}
            </strong>
            <span>
              {modo === "cuatrimestral"
                ? "Por ahora solo está cargado el calendario profesional semestral."
                : "Este calendario corresponde únicamente a 2026. Para otros años, administración deberá cargar la versión correspondiente."}
            </span>
          </div>
        </div>
      ) : (
        <div className="fcc-calendar-body">
          <div className="fcc-calendar-months">
            {mesesVisibles.map((index) => renderMonth(CALENDARIO_MESES[index], index))}
          </div>

          <aside className="fcc-calendar-legend">
            <h4>Actividades</h4>
            <ul>
              {LEYENDA_CALENDARIO.map((item) => (
                <li key={item.tipo}>
                  <span className={`fcc-calendar-legend-icon kind-${item.tipo}`}>
                    {item.tipo === "reinicio" && <IconoReinicioCalendario />}
                    {item.tipo === "fin" && "○"}
                    {item.tipo === "suspension" && "×"}
                    {item.tipo === "diaBuap" && "B"}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {ajustesAbiertos && (
        <div className="fcc-calendar-settings-overlay" role="dialog" aria-modal="true">
          <div className="fcc-calendar-settings-card">
            <h4>Ajustes del calendario</h4>
            <p>Selecciona cómo quieres ver el calendario escolar.</p>

            <div className="fcc-calendar-settings-section">
              <strong>Tipo de calendario</strong>
              <div className="fcc-calendar-option-grid">
                {[
                  { id: "semestral", label: "Semestral" },
                  { id: "cuatrimestral", label: "Cuatrimestral" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBorradorModo(item.id as ModoCalendarioAcademico)}
                    className={borradorModo === item.id ? "is-active" : ""}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fcc-calendar-settings-section">
              <strong>Periodo</strong>
              <div className="fcc-calendar-option-grid">
                {PERIODOS_CALENDARIO.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBorradorPeriodo(item.id)}
                    className={borradorPeriodo === item.id ? "is-active" : ""}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fcc-calendar-settings-actions">
              <button type="button" onClick={() => setAjustesAbiertos(false)}>
                Cancelar
              </button>
              <button type="button" onClick={guardarAjustes}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
