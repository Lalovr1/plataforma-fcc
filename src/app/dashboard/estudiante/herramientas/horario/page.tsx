"use client";

/**
 * Mi horario.
 * Permite crear un horario visual editable, personalizable y descargable.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LayoutGeneral from "@/components/LayoutGeneral";
import { supabase } from "@/utils/supabaseClient";
import { TEMA_PREDETERMINADO, normalizarTema, type Tema } from "@/lib/temas";
import {
  ArrowLeft,
  Download,
  Eye,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type Dia = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";

type SesionHorario = {
  id: string;
  dia: Dia;
  inicio: string;
  fin: string;
  salon: string;
};

type MateriaHorario = {
  id: string;
  nombre: string;
  profesor: string;
  nrc: string;
  color: string;
  sesiones: SesionHorario[];
};

type FormularioMateria = Omit<MateriaHorario, "id">;

type OpcionesVista = {
  profesor: boolean;
  salon: boolean;
  nrc: boolean;
};

type TamanoLetra = "pequena" | "mediana" | "grande";
type ModoRango = "inteligente" | "compacto" | "personalizado";
type IntensidadColor = "suave" | "media" | "fuerte";
type TituloDescargaModo = "automatico" | "personalizado";

const DIAS: { id: Dia; label: string }[] = [
  { id: "lunes", label: "Lunes" },
  { id: "martes", label: "Martes" },
  { id: "miercoles", label: "Miércoles" },
  { id: "jueves", label: "Jueves" },
  { id: "viernes", label: "Viernes" },
  { id: "sabado", label: "Sábado" },
];

const PALETAS_MATERIAS: Record<Tema, string[]> = {
  claro: [
    "#2563eb",
    "#059669",
    "#d97706",
    "#db2777",
    "#7c3aed",
    "#dc2626",
    "#0891b2",
    "#65a30d",
    "#4f46e5",
    "#c026d3",
    "#ea580c",
    "#0d9488",
  ],
  blanco: [
    "#2563eb",
    "#475569",
    "#059669",
    "#d97706",
    "#7c3aed",
    "#dc2626",
    "#0891b2",
    "#65a30d",
    "#4f46e5",
    "#c026d3",
    "#ea580c",
    "#0d9488",
  ],
  oscuro: [
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#f472b6",
    "#a78bfa",
    "#fb7185",
    "#22d3ee",
    "#bef264",
    "#818cf8",
    "#e879f9",
    "#fdba74",
    "#2dd4bf",
  ],
  gris: [
    "#475569",
    "#64748b",
    "#334155",
    "#0f766e",
    "#4f46e5",
    "#be123c",
    "#0891b2",
    "#65a30d",
    "#7c3aed",
    "#c2410c",
    "#52525b",
    "#0d9488",
  ],
  esmeralda: [
    "#059669",
    "#14b8a6",
    "#22c55e",
    "#84cc16",
    "#06b6d4",
    "#047857",
    "#65a30d",
    "#0d9488",
    "#34d399",
    "#2dd4bf",
    "#a3e635",
    "#38bdf8",
  ],
  morado: [
    "#7c3aed",
    "#8b5cf6",
    "#a855f7",
    "#c026d3",
    "#ec4899",
    "#6366f1",
    "#4f46e5",
    "#db2777",
    "#9333ea",
    "#818cf8",
    "#d946ef",
    "#f472b6",
  ],
  indigo: [
    "#4f46e5",
    "#4338ca",
    "#6366f1",
    "#2563eb",
    "#0ea5e9",
    "#7c3aed",
    "#0891b2",
    "#14b8a6",
    "#60a5fa",
    "#818cf8",
    "#a855f7",
    "#06b6d4",
  ],
  rojo: [
    "#dc2626",
    "#b91c1c",
    "#ef4444",
    "#f97316",
    "#db2777",
    "#7c3aed",
    "#ea580c",
    "#be123c",
    "#fb7185",
    "#c2410c",
    "#991b1b",
    "#f59e0b",
  ],
  rosa: [
    "#d9468f",
    "#db2777",
    "#ec4899",
    "#f472b6",
    "#be185d",
    "#7c3aed",
    "#c026d3",
    "#e879f9",
    "#f9a8d4",
    "#a855f7",
    "#fb7185",
    "#9333ea",
  ],
};

const FUENTE_HORARIO = "system-ui, sans-serif";


const INTENSIDADES_COLOR: Record<
  IntensidadColor,
  { label: string; alpha: number }
> = {
  suave: {
    label: "Suave",
    alpha: 0.3,
  },
  media: {
    label: "Media",
    alpha: 0.42,
  },
  fuerte: {
    label: "Fuerte",
    alpha: 0.54,
  },
};

const STORAGE_KEY = "fcc-academy-mi-horario-v5";

const DB_HORARIO_TABLE = "horarios_usuario";
const DIAS_VISIBLES_PREDETERMINADOS: Dia[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
];


const HORA_MINIMA = 7;
const HORA_MAXIMA = 22;
const ALTO_FILA = 76;


const opcionesBase: OpcionesVista = {
  profesor: true,
  salon: true,
  nrc: false,
};

const formularioBase: FormularioMateria = {
  nombre: "",
  profesor: "",
  nrc: "",
  color: PALETAS_MATERIAS.claro[0],
  sesiones: [],
};

const sesionBase: Omit<SesionHorario, "id"> = {
  dia: "lunes",
  inicio: "07:00",
  fin: "08:00",
  salon: "",
};

function leerHorarioLocalInicial() {
  if (typeof window === "undefined") return null;

  try {
    const guardado = localStorage.getItem(STORAGE_KEY);

    return guardado ? JSON.parse(guardado) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);

    return null;
  }
}

function normalizarDiasVisibles(dias?: unknown): Dia[] {
  if (!Array.isArray(dias)) return DIAS_VISIBLES_PREDETERMINADOS;

  const diasValidos = DIAS.filter((dia) => dias.includes(dia.id)).map(
    (dia) => dia.id
  );

  return diasValidos.length > 0 ? diasValidos : DIAS_VISIBLES_PREDETERMINADOS;
}

function crearId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function leerTemaActual(): Tema {
  if (typeof document !== "undefined") {
    const claseTema = Array.from(document.documentElement.classList).find(
      (clase) => clase.startsWith("theme-")
    );

    const temaDesdeClase = normalizarTema(claseTema?.replace("theme-", ""));

    if (temaDesdeClase) return temaDesdeClase;
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("preferencias_usuario");
      const prefs = saved ? JSON.parse(saved) : {};
      const tema = normalizarTema(prefs.tema);

      if (tema) return tema;
    } catch {}
  }

  return TEMA_PREDETERMINADO;
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
    'url("/logos/logo-azul.png")'
  );

  return extraerUrlCss(raw) ?? "/logos/logo-azul.png";
}

function obtenerTemaCanvas() {
  const esOscuro =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("theme-oscuro");

  return {
    fondoA: obtenerVariableCss("--color-bg", "#f4f8ff"),
    fondoB: obtenerVariableCss("--color-card-soft", "#f6f9ff"),
    fondoC: obtenerVariableCss("--color-card", "#ffffff"),
    celda: obtenerVariableCss("--color-card", "#ffffff"),
    celdaHeader: obtenerVariableCss("--color-card-soft", "#f1f5f9"),
    borde: obtenerVariableCss("--color-border", "#e2e8f0"),
    texto: obtenerVariableCss("--color-heading", "#0f172a"),
    textoSuave: obtenerVariableCss("--color-muted", "#64748b"),
    esOscuro,
  };
}

function minutosDesdeHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horaDesdeNumero(hora: number) {
  return `${String(hora).padStart(2, "0")}:00`;
}

function separarSesionesPorHora(sesiones: SesionHorario[]) {
  return sesiones.flatMap((sesion) => {
    const inicio = minutosDesdeHora(sesion.inicio);
    const fin = minutosDesdeHora(sesion.fin);

    if (fin <= inicio) return [];

    const bloques: SesionHorario[] = [];

    for (let minuto = inicio; minuto < fin; minuto += 60) {
      const siguiente = Math.min(fin, minuto + 60);

      bloques.push({
        ...sesion,
        id:
          inicio === minuto && siguiente === fin
            ? sesion.id
            : `${sesion.id}-${minuto}`,
        inicio: `${String(Math.floor(minuto / 60)).padStart(2, "0")}:00`,
        fin: `${String(Math.floor(siguiente / 60)).padStart(2, "0")}:00`,
      });
    }

    return bloques;
  });
}

function agruparSesionesContinuas(sesiones: SesionHorario[]) {
  const ordenDia = new Map(DIAS.map((dia, index) => [dia.id, index]));

  const ordenadas = [...sesiones].sort((a, b) => {
    const diaA = ordenDia.get(a.dia) ?? 0;
    const diaB = ordenDia.get(b.dia) ?? 0;

    if (diaA !== diaB) return diaA - diaB;

    return minutosDesdeHora(a.inicio) - minutosDesdeHora(b.inicio);
  });

  return ordenadas.reduce<SesionHorario[]>((agrupadas, sesion) => {
    const actual = { ...sesion };
    const anterior = agrupadas[agrupadas.length - 1];

    if (!anterior || anterior.dia !== actual.dia) {
      agrupadas.push(actual);
      return agrupadas;
    }

    const finAnterior = minutosDesdeHora(anterior.fin);
    const inicioActual = minutosDesdeHora(actual.inicio);
    const finActual = minutosDesdeHora(actual.fin);

    if (finAnterior >= inicioActual) {
      anterior.fin = `${String(
        Math.floor(Math.max(finAnterior, finActual) / 60)
      ).padStart(2, "0")}:00`;

      if (!anterior.salon.trim() && actual.salon.trim()) {
        anterior.salon = actual.salon;
      }

      return agrupadas;
    }

    agrupadas.push(actual);
    return agrupadas;
  }, []);
}

function aplicarModoAgrupacionMaterias(
  materias: MateriaHorario[],
  agrupar: boolean
) {
  return materias.map((materia) => ({
    ...materia,
    sesiones: agrupar
      ? agruparSesionesContinuas(materia.sesiones)
      : separarSesionesPorHora(materia.sesiones),
  }));
}

function etiquetaHora(hora: number) {
  return `${String(hora).padStart(2, "0")}:00`;
}

function colorTextoSeguro(hex: string) {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const brillo = (r * 299 + g * 587 + b * 114) / 1000;

  return brillo > 145 ? "#111827" : "#ffffff";
}

function hexConAlpha(hex: string, alpha: number) {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ajustarHex(hex: string, porcentaje: number) {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);

  const ajustar = (valor: number) => {
    const destino = porcentaje >= 0 ? 255 : 0;
    const cantidad = Math.abs(porcentaje) / 100;

    return Math.round(valor + (destino - valor) * cantidad);
  };

  return `#${[ajustar(r), ajustar(g), ajustar(b)]
    .map((valor) => valor.toString(16).padStart(2, "0"))
    .join("")}`;
}

function suavidadBloque(alpha: number) {
  if (alpha <= 0.32) return { arriba: 62, centro: 52, abajo: 46 };
  if (alpha <= 0.44) return { arriba: 54, centro: 44, abajo: 36 };

  return { arriba: 46, centro: 34, abajo: 26 };
}

function fondoBloqueHorario(hex: string, alpha: number) {
  const suavidad = suavidadBloque(alpha);

  return `linear-gradient(180deg, ${ajustarHex(
    hex,
    suavidad.arriba
  )} 0%, ${ajustarHex(hex, suavidad.centro)} 58%, ${ajustarHex(
    hex,
    suavidad.abajo
  )} 100%)`;
}

function colorTextoBloque(hex: string, alpha: number, temaOscuro: boolean) {
  if (alpha < 0.7) {
    return temaOscuro ? "#f8fafc" : "#111827";
  }

  return colorTextoSeguro(hex);
}

function sesionesSeTraslapan(a: SesionHorario, b: SesionHorario) {
  if (a.dia !== b.dia) return false;

  const inicioA = minutosDesdeHora(a.inicio);
  const finA = minutosDesdeHora(a.fin);
  const inicioB = minutosDesdeHora(b.inicio);
  const finB = minutosDesdeHora(b.fin);

  return inicioA < finB && finA > inicioB;
}

function rangoHoras(inicio: number, fin: number) {
  return Array.from(
    { length: Math.max(1, fin - inicio) },
    (_, index) => inicio + index
  );
}

function horasUsadasPorSesiones(sesiones: SesionHorario[]) {
  const horas = new Set<number>();

  sesiones.forEach((sesion) => {
    const inicio = Math.floor(minutosDesdeHora(sesion.inicio) / 60);
    const fin = Math.ceil(minutosDesdeHora(sesion.fin) / 60);

    for (let hora = inicio; hora < fin; hora++) {
      if (hora >= HORA_MINIMA && hora < HORA_MAXIMA) {
        horas.add(hora);
      }
    }
  });

  return Array.from(horas).sort((a, b) => a - b);
}

function rectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function textoCortado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMaximo: number
) {
  if (ctx.measureText(texto).width <= anchoMaximo) return texto;

  let resultado = texto;

  while (
    resultado.length > 0 &&
    ctx.measureText(`${resultado}…`).width > anchoMaximo
  ) {
    resultado = resultado.slice(0, -1);
  }

  return `${resultado}…`;
}

function dibujarTextoBloqueCanvas({
  ctx,
  lineas,
  x,
  y,
  w,
  h,
  colorTexto,
  fuente,
  tamano,
  lineasReferencia,
  altoReferencia,
}: {
  ctx: CanvasRenderingContext2D;
  lineas: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  colorTexto: string;
  fuente: string;
  tamano: TamanoLetra;
  lineasReferencia?: number;
  altoReferencia?: number;
}) {
  const baseTitulo = tamano === "pequena" ? 19 : tamano === "grande" ? 26 : 22;
  const baseSalon = tamano === "pequena" ? 14 : tamano === "grande" ? 19 : 16;
  const baseExtra = tamano === "pequena" ? 11 : tamano === "grande" ? 14 : 12;
  const baseLineHeight =
    tamano === "pequena" ? 18 : tamano === "grande" ? 26 : 22;

  const paddingVertical = 14;
  const altoParaCalculo = altoReferencia ?? h;
  const altoDisponible = Math.max(24, altoParaCalculo - paddingVertical * 2);
  const totalLineasReferencia = Math.max(
    lineas.length,
    lineasReferencia ?? lineas.length
  );
  const lineHeight = Math.max(
    12,
    Math.min(baseLineHeight, Math.floor(altoDisponible / totalLineasReferencia))
  );

  const fontTitulo = Math.max(
    11,
    Math.min(baseTitulo, Math.floor(lineHeight * 0.92))
  );

  const fontSalon = Math.max(
    10,
    Math.min(baseSalon, Math.floor(lineHeight * 0.78))
  );

  const fontExtra = Math.max(
    8,
    Math.min(baseExtra, Math.floor(lineHeight * 0.64))
  );

  const altoTotal = lineas.length * lineHeight;
  let lineaY = y + (h - altoTotal) / 2 + lineHeight * 0.75;

  ctx.shadowColor =
    colorTexto === "#ffffff"
      ? "rgba(0, 0, 0, 0.26)"
      : "rgba(255, 255, 255, 0.42)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = colorTexto;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  lineas.forEach((linea, index) => {
    if (index === 0) {
      ctx.font = `bold ${fontTitulo}px ${fuente}`;
    } else if (index === 1 && linea.toLowerCase().startsWith("salón")) {
      ctx.font = `bold ${fontSalon}px ${fuente}`;
    } else {
      ctx.font = `${fontExtra}px ${fuente}`;
    }

    ctx.fillText(textoCortado(ctx, linea, w - 24), x + w / 2, lineaY);
    lineaY += lineHeight;
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export default function MiHorarioPage() {
  const searchParams = useSearchParams();
  const volverAlModalHorario = searchParams.get("volver") === "modal-horario";
  const hrefVolver = volverAlModalHorario
    ? "/dashboard/estudiante?modal=horario"
    : "/dashboard/estudiante";

  const datosInicialesHorario = useMemo(() => leerHorarioLocalInicial(), []);
  const agruparInicial =
    datosInicialesHorario?.agruparBloquesContinuos ?? true;

  const [materias, setMaterias] = useState<MateriaHorario[]>(() =>
    aplicarModoAgrupacionMaterias(
      datosInicialesHorario?.materias ?? [],
      agruparInicial
    )
  );
  const [formulario, setFormulario] =
    useState<FormularioMateria>(formularioBase);
  const [sesionActual, setSesionActual] =
    useState<Omit<SesionHorario, "id">>(sesionBase);
  const [sesionEditandoId, setSesionEditandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalMateriaAbierto, setModalMateriaAbierto] = useState(false);
  const [materiaSeleccionadaId, setMateriaSeleccionadaId] = useState<
    string | null
  >(null);
  const [bloqueEditando, setBloqueEditando] = useState<{
    materiaId: string;
    sesionId: string;
  } | null>(null);
  const [salonBloque, setSalonBloque] = useState("");
  const [opcionesVista, setOpcionesVista] = useState<OpcionesVista>(
    datosInicialesHorario?.opcionesVista ?? opcionesBase
  );
  const [temaActual, setTemaActual] = useState<Tema>(TEMA_PREDETERMINADO);
  const [tamanoLetra, setTamanoLetra] = useState<TamanoLetra>("grande");
  const [intensidadColor, setIntensidadColor] = useState<IntensidadColor>(
    datosInicialesHorario?.intensidadColor ?? "media"
  );
  const [modoRango, setModoRango] = useState<ModoRango>(
    datosInicialesHorario?.modoRango ?? "inteligente"
  );
  const [rangoPersonalizadoInicio, setRangoPersonalizadoInicio] = useState(
    datosInicialesHorario?.rangoPersonalizadoInicio ?? 7
  );
  const [rangoPersonalizadoFin, setRangoPersonalizadoFin] = useState(
    datosInicialesHorario?.rangoPersonalizadoFin ?? 14
  );
  const [tituloDescargaModo, setTituloDescargaModo] =
    useState<TituloDescargaModo>(
      datosInicialesHorario?.tituloDescargaModo ?? "automatico"
    );
  const [tituloDescarga, setTituloDescarga] = useState(
    datosInicialesHorario?.tituloDescarga ?? ""
  );
  const [diasVisibles, setDiasVisibles] = useState<Dia[]>(() =>
    normalizarDiasVisibles(datosInicialesHorario?.diasVisibles)
  );
  const [agruparBloquesContinuos, setAgruparBloquesContinuos] =
    useState(agruparInicial);
  const [userIdHorario, setUserIdHorario] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [datosCargados, setDatosCargados] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [toastHorario, setToastHorario] = useState("");

  const coloresTema = PALETAS_MATERIAS[temaActual];
  const intensidad = INTENSIDADES_COLOR[intensidadColor];
  const temaOscuro = temaActual === "oscuro";

  const diasMostrados = useMemo(
    () =>
      DIAS.filter((dia) => diasVisibles.includes(dia.id)).length > 0
        ? DIAS.filter((dia) => diasVisibles.includes(dia.id))
        : DIAS.filter((dia) => DIAS_VISIBLES_PREDETERMINADOS.includes(dia.id)),
    [diasVisibles]
  );

  const horasInicio = useMemo(
    () =>
      Array.from({ length: HORA_MAXIMA - HORA_MINIMA }, (_, index) => {
        const hora = HORA_MINIMA + index;
        return horaDesdeNumero(hora);
      }),
    []
  );

  const horasFin = useMemo(
    () =>
      Array.from({ length: HORA_MAXIMA - HORA_MINIMA }, (_, index) => {
        const hora = HORA_MINIMA + index + 1;
        return horaDesdeNumero(hora);
      }),
    []
  );

  const sesiones = useMemo(
    () => materias.flatMap((materia) => materia.sesiones),
    [materias]
  );

  const rangoClases = useMemo(() => {
    if (sesiones.length === 0) {
      return { inicio: 7, fin: 14 };
    }

    const inicio = Math.min(...sesiones.map((s) => minutosDesdeHora(s.inicio)));
    const fin = Math.max(...sesiones.map((s) => minutosDesdeHora(s.fin)));

    return {
      inicio: Math.max(HORA_MINIMA, Math.floor(inicio / 60)),
      fin: Math.min(HORA_MAXIMA, Math.ceil(fin / 60)),
    };
  }, [sesiones]);

  const horasVisibles = useMemo(() => {
    if (sesiones.length === 0) {
      return rangoHoras(7, 14);
    }

    if (modoRango === "compacto") {
      const usadas = horasUsadasPorSesiones(sesiones);
      return usadas.length > 0 ? usadas : rangoHoras(7, 14);
    }

    if (modoRango === "personalizado") {
      const inicio = Math.min(rangoPersonalizadoInicio, rangoClases.inicio);
      const fin = Math.max(rangoPersonalizadoFin, rangoClases.fin);

      return rangoHoras(
        Math.max(HORA_MINIMA, inicio),
        Math.min(HORA_MAXIMA, fin)
      );
    }

    const duracion = rangoClases.fin - rangoClases.inicio;

    if (duracion <= 2 && rangoClases.inicio < 12) {
      return rangoHoras(7, 14);
    }

    if (duracion <= 2 && rangoClases.inicio >= 14) {
      return rangoHoras(14, 21);
    }

    if (duracion < 6) {
      const faltante = 6 - duracion;
      let inicio = rangoClases.inicio - Math.floor(faltante / 2);
      let fin = rangoClases.fin + Math.ceil(faltante / 2);

      if (inicio < HORA_MINIMA) {
        fin += HORA_MINIMA - inicio;
        inicio = HORA_MINIMA;
      }

      if (fin > HORA_MAXIMA) {
        inicio -= fin - HORA_MAXIMA;
        fin = HORA_MAXIMA;
      }

      return rangoHoras(
        Math.max(HORA_MINIMA, inicio),
        Math.min(HORA_MAXIMA, fin)
      );
    }

    return rangoHoras(rangoClases.inicio, rangoClases.fin);
  }, [
    sesiones,
    modoRango,
    rangoClases,
    rangoPersonalizadoInicio,
    rangoPersonalizadoFin,
  ]);

  const clasesTextoBloque = useMemo(() => {
    if (tamanoLetra === "pequena") {
      return {
        titulo: "text-xs",
        salon: "text-[10px]",
        detalle: "text-[9px]",
        extra: "text-[9px]",
      };
    }

    if (tamanoLetra === "grande") {
      return {
        titulo: "text-[15px]",
        salon: "text-[13px]",
        detalle: "text-xs",
        extra: "text-[11px]",
      };
    }

    return {
      titulo: "text-sm",
      salon: "text-xs",
      detalle: "text-[11px]",
      extra: "text-[10px]",
    };
  }, [tamanoLetra]);

  const materiaSeleccionada = useMemo(
    () =>
      materias.find((materia) => materia.id === materiaSeleccionadaId) ?? null,
    [materias, materiaSeleccionadaId]
  );

  useEffect(() => {
    setMounted(true);
    setTemaActual(leerTemaActual());

    const handler = (event: any) => {
      const tema = normalizarTema(event.detail?.tema);
      if (tema) setTemaActual(tema);
    };

    window.addEventListener("app:preferencias", handler);

    return () => {
      window.removeEventListener("app:preferencias", handler);
    };
  }, []);

  function aplicarDatosHorario(parsed: any) {
    const agruparGuardado = parsed.agruparBloquesContinuos ?? true;

    setMaterias(
      aplicarModoAgrupacionMaterias(parsed.materias ?? [], agruparGuardado)
    );
    setOpcionesVista(parsed.opcionesVista ?? opcionesBase);
    setTamanoLetra("grande");
    setIntensidadColor(parsed.intensidadColor ?? "media");
    setModoRango(parsed.modoRango ?? "inteligente");
    setRangoPersonalizadoInicio(parsed.rangoPersonalizadoInicio ?? 7);
    setRangoPersonalizadoFin(parsed.rangoPersonalizadoFin ?? 14);
    setTituloDescargaModo(parsed.tituloDescargaModo ?? "automatico");
    setTituloDescarga(parsed.tituloDescarga ?? "");

    setDiasVisibles(normalizarDiasVisibles(parsed.diasVisibles));

    setAgruparBloquesContinuos(agruparGuardado);
  }

  useEffect(() => {
    let activo = true;

    async function cargarHorario() {
      try {
        const guardado = localStorage.getItem(STORAGE_KEY);

        if (guardado) {
          aplicarDatosHorario(JSON.parse(guardado));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!activo) return;

        setUserIdHorario(user?.id ?? null);

        if (user?.id) {
          const { data, error } = await supabase
            .from(DB_HORARIO_TABLE)
            .select("datos")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!activo) return;

          if (!error && data?.datos) {
            aplicarDatosHorario(data.datos);
          } else if (error) {
            console.warn("No se pudo cargar horario desde Supabase:", error);
          }
        }
      } catch (error) {
        console.warn("No se pudo consultar el usuario para Mi horario:", error);
      } finally {
        if (activo) setDatosCargados(true);
      }
    }

    cargarHorario();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!datosCargados) return;

    const datosHorario = {
      materias,
      opcionesVista,
      tamanoLetra,
      intensidadColor,
      modoRango,
      rangoPersonalizadoInicio,
      rangoPersonalizadoFin,
      tituloDescargaModo,
      tituloDescarga,
      diasVisibles,
      agruparBloquesContinuos,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(datosHorario));

    if (!userIdHorario) return;

    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.from(DB_HORARIO_TABLE).upsert(
        {
          user_id: userIdHorario,
          datos: datosHorario,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.warn("No se pudo guardar horario en Supabase:", error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    datosCargados,
    userIdHorario,
    materias,
    opcionesVista,
    tamanoLetra,
    intensidadColor,
    modoRango,
    rangoPersonalizadoInicio,
    rangoPersonalizadoFin,
    tituloDescargaModo,
    tituloDescarga,
    diasVisibles,
    agruparBloquesContinuos,
  ]);

  useEffect(() => {
    if (!toastHorario) return;

    const timeout = window.setTimeout(() => {
      setToastHorario("");
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [toastHorario]);

  function cambiarCampo(campo: keyof FormularioMateria, valor: string) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function cambiarSesion(campo: keyof Omit<SesionHorario, "id">, valor: string) {
    setSesionActual((actual) => {
      if (campo === "inicio") {
        const inicio = minutosDesdeHora(valor);
        const fin = minutosDesdeHora(actual.fin);

        return {
          ...actual,
          inicio: valor,
          fin:
            fin <= inicio
              ? horaDesdeNumero(Math.min(HORA_MAXIMA, inicio / 60 + 1))
              : actual.fin,
        };
      }

      return {
        ...actual,
        [campo]: valor,
      };
    });
  }

  function reiniciarFormulario() {
    setFormulario({
      ...formularioBase,
      color: coloresTema[0],
    });
    setSesionActual(sesionBase);
    setSesionEditandoId(null);
    setEditandoId(null);
    setMensaje("");
  }

  function abrirNuevaMateria() {
    reiniciarFormulario();
    setModalMateriaAbierto(true);
  }

  function cerrarModalMateria() {
    reiniciarFormulario();
    setModalMateriaAbierto(false);
  }

  function buscarChoqueSesion(sesion: SesionHorario, ignorarSesionId?: string) {
    const sesionesFormulario = formulario.sesiones.filter(
      (bloque) => bloque.id !== ignorarSesionId
    );

    const choqueFormulario = sesionesFormulario.find((bloque) =>
      sesionesSeTraslapan(sesion, bloque)
    );

    if (choqueFormulario) {
      const dia = DIAS.find((d) => d.id === choqueFormulario.dia)?.label;

      return `Ese bloque se cruza con otro bloque de la misma materia el ${dia}.`;
    }

    for (const materia of materias) {
      if (materia.id === editandoId) continue;

      const choque = materia.sesiones.find((bloque) =>
        sesionesSeTraslapan(sesion, bloque)
      );

      if (choque) {
        const dia = DIAS.find((d) => d.id === choque.dia)?.label;

        return `Ese horario choca con ${materia.nombre} el ${dia}, de ${choque.inicio} a ${choque.fin}.`;
      }
    }

    return "";
  }

  function guardarBloque() {
    setMensaje("");

    if (
      minutosDesdeHora(sesionActual.inicio) >= minutosDesdeHora(sesionActual.fin)
    ) {
      setMensaje("La hora de inicio debe ser menor que la hora de fin.");
      return;
    }

    const bloque: SesionHorario = {
      ...sesionActual,
      id: sesionEditandoId ?? crearId(),
      salon: sesionActual.salon.trim(),
    };

    const choque = buscarChoqueSesion(bloque, bloque.id);

    if (choque) {
      setMensaje(choque);
      return;
    }

    setFormulario((actual) => ({
      ...actual,
      sesiones: sesionEditandoId
        ? actual.sesiones.map((sesion) =>
            sesion.id === sesionEditandoId ? bloque : sesion
          )
        : [...actual.sesiones, bloque],
    }));

    setSesionActual({
      ...sesionBase,
      dia: sesionActual.dia,
      inicio: sesionActual.inicio,
      fin: sesionActual.fin,
    });
    setSesionEditandoId(null);
  }

  function editarBloque(sesion: SesionHorario) {
    setSesionActual({
      dia: sesion.dia,
      inicio: sesion.inicio,
      fin: sesion.fin,
      salon: sesion.salon,
    });
    setSesionEditandoId(sesion.id);
    setMensaje("");
  }

  function eliminarBloque(id: string) {
    setFormulario((actual) => ({
      ...actual,
      sesiones: actual.sesiones.filter((sesion) => sesion.id !== id),
    }));

    if (sesionEditandoId === id) {
      setSesionActual(sesionBase);
      setSesionEditandoId(null);
    }
  }

  function guardarMateria() {
    setMensaje("");

    const nombre = formulario.nombre.trim();

    if (!nombre) {
      setMensaje("Escribe el nombre de la materia.");
      return;
    }

    const materiaFinal: MateriaHorario = {
      ...formulario,
      id: editandoId ?? crearId(),
      nombre,
      profesor: formulario.profesor.trim(),
      nrc: formulario.nrc.trim(),
      sesiones: editandoId ? formulario.sesiones : [],
    };

    setMaterias((actuales) => {
      if (editandoId) {
        return actuales.map((materia) =>
          materia.id === editandoId ? materiaFinal : materia
        );
      }

      return [...actuales, materiaFinal];
    });

    setMateriaSeleccionadaId(materiaFinal.id);
    cerrarModalMateria();
  }

  function editarMateria(materia: MateriaHorario) {
    setFormulario({
      nombre: materia.nombre,
      profesor: materia.profesor,
      nrc: materia.nrc,
      color: materia.color,
      sesiones: materia.sesiones,
    });
    setEditandoId(materia.id);
    setSesionActual(sesionBase);
    setSesionEditandoId(null);
    setMensaje("");
    setModalMateriaAbierto(true);
  }

  function eliminarMateria(id: string) {
    setMaterias((actuales) => {
      const siguientes = actuales.filter((materia) => materia.id !== id);

      if (materiaSeleccionadaId === id) {
        setMateriaSeleccionadaId(siguientes[0]?.id ?? null);
      }

      return siguientes;
    });

    if (editandoId === id) {
      reiniciarFormulario();
    }

    if (bloqueEditando?.materiaId === id) {
      setBloqueEditando(null);
      setSalonBloque("");
    }
  }

  function alternarDiaVisible(dia: Dia) {
    setDiasVisibles((actuales) => {
      const estaActivo = actuales.includes(dia);

      if (estaActivo && actuales.length <= 1) {
        return actuales;
      }

      const siguientes = estaActivo
        ? actuales.filter((diaActual) => diaActual !== dia)
        : [...actuales, dia];

      return DIAS.filter((diaBase) => siguientes.includes(diaBase.id)).map(
        (diaBase) => diaBase.id
      );
    });
  }

  function cambiarAgrupacionBloques(agrupar: boolean) {
    setAgruparBloquesContinuos(agrupar);
    setMaterias((actuales) => aplicarModoAgrupacionMaterias(actuales, agrupar));
    setBloqueEditando(null);
    setSalonBloque("");
  }

  function mostrarToastHorario(mensajeToast: string) {
    setToastHorario(mensajeToast);
  }

  function detallesMateria(materia: MateriaHorario, sesion: SesionHorario) {
    const detalles = [];

    if (opcionesVista.salon && sesion.salon) {
      detalles.push(`Salón ${sesion.salon}`);
    }

    const profesor =
      opcionesVista.profesor && materia.profesor ? materia.profesor : "";

    const nrc = opcionesVista.nrc && materia.nrc ? `NRC ${materia.nrc}` : "";

    if (profesor && nrc) {
      detalles.push(`${profesor} - ${nrc}`);
    } else if (profesor) {
      detalles.push(profesor);
    } else if (nrc) {
      detalles.push(nrc);
    }

    return detalles;
  }

  function posicionSesion(sesion: SesionHorario) {
    const inicio = Math.floor(minutosDesdeHora(sesion.inicio) / 60);
    const fin = Math.ceil(minutosDesdeHora(sesion.fin) / 60);
    const rowIndex = horasVisibles.findIndex((hora) => hora === inicio);
    const span = horasVisibles.filter((hora) => hora >= inicio && hora < fin)
      .length;

    if (rowIndex < 0 || span <= 0) return null;

    return {
      rowStart: rowIndex + 2,
      span,
    };
  }

  function buscarBloqueEnCelda(dia: Dia, hora: number) {
    const inicioCelda = hora * 60;
    const finCelda = (hora + 1) * 60;

    for (const materia of materias) {
      const sesion = materia.sesiones.find((bloque) => {
        if (bloque.dia !== dia) return false;

        const inicioBloque = minutosDesdeHora(bloque.inicio);
        const finBloque = minutosDesdeHora(bloque.fin);

        return inicioBloque < finCelda && finBloque > inicioCelda;
      });

      if (sesion) {
        return { materia, sesion };
      }
    }

    return null;
  }

  function abrirEditarBloqueHorario(
    materia: MateriaHorario,
    sesion: SesionHorario
  ) {
    setBloqueEditando({ materiaId: materia.id, sesionId: sesion.id });
    setSalonBloque(sesion.salon);
    setMensaje("");
  }

  function pintarCelda(dia: Dia, hora: number) {
    const bloqueExistente = buscarBloqueEnCelda(dia, hora);

    if (bloqueExistente) {
      abrirEditarBloqueHorario(
        bloqueExistente.materia,
        bloqueExistente.sesion
      );
      return;
    }

    if (!materiaSeleccionadaId) {
      mostrarToastHorario("Selecciona una materia antes de pintar el horario.");
      return;
    }

    const inicioNuevo = horaDesdeNumero(hora);
    const finNuevo = horaDesdeNumero(Math.min(HORA_MAXIMA, hora + 1));

    setMaterias((actuales) =>
      actuales.map((materia) => {
        if (materia.id !== materiaSeleccionadaId) return materia;

        const nuevoBloque: SesionHorario = {
          id: crearId(),
          dia,
          inicio: inicioNuevo,
          fin: finNuevo,
          salon: "",
        };

        if (!agruparBloquesContinuos) {
          return {
            ...materia,
            sesiones: [...materia.sesiones, nuevoBloque],
          };
        }

        const bloquesContiguos = materia.sesiones.filter(
          (sesion) =>
            sesion.dia === dia &&
            (sesion.fin === inicioNuevo || sesion.inicio === finNuevo)
        );

        if (bloquesContiguos.length === 0) {
          return {
            ...materia,
            sesiones: [...materia.sesiones, nuevoBloque],
          };
        }

        const inicioFusion = Math.min(
          minutosDesdeHora(inicioNuevo),
          ...bloquesContiguos.map((sesion) => minutosDesdeHora(sesion.inicio))
        );

        const finFusion = Math.max(
          minutosDesdeHora(finNuevo),
          ...bloquesContiguos.map((sesion) => minutosDesdeHora(sesion.fin))
        );

        const bloqueFusionado: SesionHorario = {
          id: bloquesContiguos[0].id,
          dia,
          inicio: `${String(Math.floor(inicioFusion / 60)).padStart(2, "0")}:00`,
          fin: `${String(Math.floor(finFusion / 60)).padStart(2, "0")}:00`,
          salon:
            bloquesContiguos.find((sesion) => sesion.salon.trim())?.salon ?? "",
        };

        return {
          ...materia,
          sesiones: [
            ...materia.sesiones.filter(
              (sesion) =>
                !bloquesContiguos.some(
                  (bloqueContiguo) => bloqueContiguo.id === sesion.id
                )
            ),
            bloqueFusionado,
          ],
        };
      })
    );

    setMensaje("");
  }

  function guardarDatosBloque() {
    if (!bloqueEditando) return;

    setMaterias((actuales) =>
      actuales.map((materia) =>
        materia.id === bloqueEditando.materiaId
          ? {
              ...materia,
              sesiones: materia.sesiones.map((sesion) =>
                sesion.id === bloqueEditando.sesionId
                  ? { ...sesion, salon: salonBloque.trim() }
                  : sesion
              ),
            }
          : materia
      )
    );

    setBloqueEditando(null);
    setSalonBloque("");
  }

  function eliminarBloqueHorario() {
    if (!bloqueEditando) return;

    setMaterias((actuales) =>
      actuales.map((materia) =>
        materia.id === bloqueEditando.materiaId
          ? {
              ...materia,
              sesiones: materia.sesiones.filter(
                (sesion) => sesion.id !== bloqueEditando.sesionId
              ),
            }
          : materia
      )
    );

    setBloqueEditando(null);
    setSalonBloque("");
  }

  async function descargarHorario() {
    if (materias.length === 0) return;

    const temaCanvas = obtenerTemaCanvas();
    const canvas = document.createElement("canvas");
    const scale = 2;
    const width = 1500;
    const margen = 54;

    const tituloFinal =
      tituloDescargaModo === "personalizado" ? tituloDescarga.trim() : "Horario";

    const header = 96;
    const altoHeaderTabla = 58;
    const altoSlot = 88;
    const totalSlots = horasVisibles.length;
    const altoTabla = altoHeaderTabla + totalSlots * altoSlot;
    const height = header + altoTabla + margen;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.scale(scale, scale);

    const gradiente = ctx.createLinearGradient(0, 0, width, height);
    gradiente.addColorStop(0, temaCanvas.fondoA);
    gradiente.addColorStop(0.56, temaCanvas.fondoB);
    gradiente.addColorStop(1, temaCanvas.fondoC);

    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, width, height);

    const logo = await cargarImagen(obtenerLogoActual());

    if (logo) {
      const maxLogoW = 126;
      const maxLogoH = 82;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const logoW = logo.width * ratio;
      const logoH = logo.height * ratio;
      const logoY = 7;
      const logoX = 34;

      ctx.globalAlpha = 1;
      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    }

    if (tituloFinal) {
      ctx.fillStyle = temaCanvas.texto;
      ctx.font = `bold 36px ${FUENTE_HORARIO}`;
      ctx.textAlign = "center";
      ctx.fillText(
        textoCortado(ctx, tituloFinal.toUpperCase(), width - 430),
        width / 2,
        58
      );
    }

    const tablaX = margen;
    const tablaY = header;
    const tablaW = width - margen * 2;
    const columnaHora = 120;
    const columnaDia = (tablaW - columnaHora) / diasMostrados.length;
    const radioTabla = 28;

    ctx.shadowColor = temaCanvas.esOscuro
      ? "rgba(0, 0, 0, 0.42)"
      : "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = temaCanvas.celda;
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.fill();

    ctx.shadowColor = "transparent";

    ctx.save();
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.clip();

    ctx.fillStyle = temaCanvas.celdaHeader;
    ctx.fillRect(tablaX, tablaY, tablaW, altoHeaderTabla);

    ctx.fillStyle = temaCanvas.textoSuave;
    ctx.font = `bold 24px ${FUENTE_HORARIO}`;
    ctx.textAlign = "center";
    ctx.fillText("Hora", tablaX + columnaHora / 2, tablaY + 36);

    diasMostrados.forEach((dia, index) => {
      const x = tablaX + columnaHora + index * columnaDia;

      ctx.fillStyle = temaCanvas.texto;
      ctx.font = `bold 24px ${FUENTE_HORARIO}`;
      ctx.fillText(dia.label, x + columnaDia / 2, tablaY + 37);
    });

    const lineaTabla = temaCanvas.esOscuro
      ? "rgba(148, 163, 184, 0.2)"
      : "rgba(37, 99, 235, 0.16)";

    ctx.strokeStyle = lineaTabla;
    ctx.lineWidth = 1;

    for (let i = 0; i < totalSlots; i++) {
      const y = tablaY + altoHeaderTabla + i * altoSlot;

      ctx.beginPath();
      ctx.moveTo(tablaX, y);
      ctx.lineTo(tablaX + tablaW, y);
      ctx.stroke();

      ctx.fillStyle = temaCanvas.textoSuave;
      ctx.font = `bold 20px ${FUENTE_HORARIO}`;
      ctx.textAlign = "center";
      ctx.fillText(
        etiquetaHora(horasVisibles[i]),
        tablaX + columnaHora / 2,
        y + altoSlot / 2 + 6
      );
    }

    for (let i = 0; i < diasMostrados.length; i++) {
      const x = tablaX + columnaHora + i * columnaDia;

      ctx.beginPath();
      ctx.moveTo(x, tablaY);
      ctx.lineTo(x, tablaY + altoTabla);
      ctx.stroke();
    }

    const bloqueMargen = 8;

    const alturasReferenciaBloque = materias.flatMap((materia) =>
      materia.sesiones
        .filter((sesion) => diasMostrados.some((dia) => dia.id === sesion.dia))
        .map((sesion) => {
          const posicion = posicionSesion(sesion);
          return posicion ? posicion.span * altoSlot - bloqueMargen * 2 : null;
        })
        .filter((alto): alto is number => typeof alto === "number")
    );

    const altoReferenciaBloque =
      alturasReferenciaBloque.length > 0
        ? Math.max(20, Math.min(...alturasReferenciaBloque))
        : altoSlot - bloqueMargen * 2;

    const lineasReferenciaBloque = Math.max(
      1,
      ...materias.flatMap((materia) =>
        materia.sesiones
          .filter((sesion) => diasMostrados.some((dia) => dia.id === sesion.dia))
          .map((sesion) => 1 + detallesMateria(materia, sesion).length)
      )
    );

    materias.forEach((materia) => {
      materia.sesiones.forEach((sesion) => {
        const diaIndex = diasMostrados.findIndex((d) => d.id === sesion.dia);
        const posicion = posicionSesion(sesion);

        if (diaIndex === -1 || !posicion) return;

        const x = tablaX + columnaHora + diaIndex * columnaDia;
        const y = tablaY + altoHeaderTabla + (posicion.rowStart - 2) * altoSlot;
        const w = columnaDia;
        const h = posicion.span * altoSlot;

        const bloqueX = x + bloqueMargen;
        const bloqueY = y + bloqueMargen;
        const bloqueW = Math.max(20, w - bloqueMargen * 2);
        const bloqueH = Math.max(20, h - bloqueMargen * 2);
        const suavidad = suavidadBloque(intensidad.alpha);
        const gradienteBloque = ctx.createLinearGradient(
          bloqueX,
          bloqueY,
          bloqueX,
          bloqueY + bloqueH
        );

        gradienteBloque.addColorStop(
          0,
          ajustarHex(materia.color, suavidad.arriba)
        );
        gradienteBloque.addColorStop(
          0.58,
          ajustarHex(materia.color, suavidad.centro)
        );
        gradienteBloque.addColorStop(
          1,
          ajustarHex(materia.color, suavidad.abajo)
        );

        ctx.fillStyle = gradienteBloque;
        rectRedondeado(ctx, bloqueX, bloqueY, bloqueW, bloqueH, 18);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.26)";
        ctx.lineWidth = 2;
        rectRedondeado(ctx, bloqueX + 1, bloqueY + 1, bloqueW - 2, bloqueH - 2, 17);
        ctx.stroke();

        const colorTexto = colorTextoBloque(
          materia.color,
          intensidad.alpha,
          temaCanvas.esOscuro
        );

        const detalles = detallesMateria(materia, sesion);
        const lineas = [materia.nombre, ...detalles];

        dibujarTextoBloqueCanvas({
          ctx,
          lineas,
          x: bloqueX,
          y: bloqueY,
          w: bloqueW,
          h: bloqueH,
          colorTexto,
          fuente: FUENTE_HORARIO,
          tamano: tamanoLetra,
          lineasReferencia: lineasReferenciaBloque,
          altoReferencia: altoReferenciaBloque,
        });
      });
    });

    ctx.restore();

    ctx.strokeStyle = temaCanvas.borde;
    ctx.lineWidth = 2;
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.stroke();

    const link = document.createElement("a");
    link.download = "horario-fcc-academy.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const modalMateria = (
    <div className="schedule-modal-overlay">
      <button
        type="button"
        onClick={cerrarModalMateria}
        className="schedule-modal-backdrop"
        aria-label="Cerrar modal"
      />

      <div className="schedule-subject-modal simple" role="dialog" aria-modal="true">
        <div className="schedule-modal-content">
          <div className="schedule-modal-header">
            <div>
              <p className="schedule-modal-eyebrow">
                {editandoId ? "Editar materia" : "Nueva materia"}
              </p>
              <h2 className="schedule-modal-title">
                {editandoId ? "Editar materia" : "Agregar materia"}
              </h2>
            </div>

            <button
              type="button"
              onClick={cerrarModalMateria}
              className="schedule-modal-close"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="schedule-simple-subject-body">
            <label className="schedule-modal-field">
              <span className="schedule-modal-label">Materia</span>
              <input
                value={formulario.nombre}
                onChange={(e) => cambiarCampo("nombre", e.target.value)}
                placeholder="Ej. Cálculo Diferencial"
                className="schedule-modal-control"
              />
            </label>

            <div className="schedule-preferences-grid">
              <label className="schedule-modal-field">
                <span className="schedule-modal-label">Profesor</span>
                <input
                  value={formulario.profesor}
                  onChange={(e) => cambiarCampo("profesor", e.target.value)}
                  placeholder="Opcional"
                  className="schedule-modal-control"
                />
              </label>

              <label className="schedule-modal-field">
                <span className="schedule-modal-label">NRC</span>
                <input
                  value={formulario.nrc}
                  onChange={(e) => cambiarCampo("nrc", e.target.value)}
                  placeholder="Opcional"
                  className="schedule-modal-control"
                />
              </label>
            </div>

            <div className="schedule-color-section">
              <span className="schedule-modal-label">Color de la materia</span>
              <div className="schedule-color-grid">
                {coloresTema.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => cambiarCampo("color", color)}
                    className={`schedule-color-dot ${
                      formulario.color === color ? "is-active" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Usar color ${color}`}
                  />
                ))}
              </div>
            </div>

            {mensaje && <p className="schedule-modal-message">{mensaje}</p>}

            <button
              type="button"
              onClick={guardarMateria}
              className="schedule-modal-save"
            >
              {editandoId ? <Save size={18} /> : <Plus size={18} />}
              {editandoId ? "Guardar cambios" : "Crear materia"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const datosBloqueEditando = bloqueEditando
    ? materias
        .flatMap((materia) =>
          materia.sesiones.map((sesion) => ({ materia, sesion }))
        )
        .find(
          ({ materia, sesion }) =>
            materia.id === bloqueEditando.materiaId &&
            sesion.id === bloqueEditando.sesionId
        )
    : null;

  const modalBloque = datosBloqueEditando ? (
    <div className="schedule-modal-overlay">
      <button
        type="button"
        onClick={() => {
          setBloqueEditando(null);
          setSalonBloque("");
        }}
        className="schedule-modal-backdrop"
        aria-label="Cerrar datos del bloque"
      />

      <div className="schedule-block-modal" role="dialog" aria-modal="true">
        <div className="schedule-modal-content">
          <div className="schedule-modal-header">
            <div>
              <p className="schedule-modal-eyebrow">Bloque del horario</p>
              <h2 className="schedule-modal-title">
                {datosBloqueEditando.materia.nombre}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setBloqueEditando(null);
                setSalonBloque("");
              }}
              className="schedule-modal-close"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="schedule-simple-subject-body">
            <div className="schedule-block-summary">
              <span
                className="schedule-subject-dot"
                style={{ backgroundColor: datosBloqueEditando.materia.color }}
              />

              <div>
                <p>
                  {
                    DIAS.find((dia) => dia.id === datosBloqueEditando.sesion.dia)
                      ?.label
                  }{" "}
                  · {datosBloqueEditando.sesion.inicio} -{" "}
                  {datosBloqueEditando.sesion.fin}
                </p>

                {(datosBloqueEditando.materia.profesor ||
                  datosBloqueEditando.materia.nrc) && (
                  <small>
                    {datosBloqueEditando.materia.profesor}
                    {datosBloqueEditando.materia.profesor &&
                    datosBloqueEditando.materia.nrc
                      ? " · "
                      : ""}
                    {datosBloqueEditando.materia.nrc
                      ? `NRC ${datosBloqueEditando.materia.nrc}`
                      : ""}
                  </small>
                )}
              </div>
            </div>

            <label className="schedule-modal-field">
              <span className="schedule-modal-label">Salón de este bloque</span>
              <input
                value={salonBloque}
                onChange={(e) => setSalonBloque(e.target.value)}
                placeholder="Ej. 204, CC02, Lab 1..."
                className="schedule-modal-control"
              />
            </label>

            <div className="schedule-block-modal-actions">
              <button
                type="button"
                onClick={eliminarBloqueHorario}
                className="schedule-action-secondary danger"
              >
                <Trash2 size={16} />
                Quitar bloque
              </button>

              <button
                type="button"
                onClick={guardarDatosBloque}
                className="schedule-modal-save"
              >
                <Save size={18} />
                Guardar salón
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .schedule-editor-shell {
          color: var(--fcc-premium-text);
        }

        html,
        body {
          scrollbar-gutter: stable;
        }

        body {
          overflow-y: scroll;
        }

        .schedule-editor-shell {
          padding-right: 6px;
        }

        .schedule-editor-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            radial-gradient(
              circle at 6% 0%,
              color-mix(in srgb, var(--fcc-premium-cyan) 4%, transparent),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface-strong),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            0 22px 50px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.78);
        }

        .theme-oscuro .theme-oscuro .schedule-editor-panel {
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .schedule-editor-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(90deg, transparent, black 42%, transparent 86%);
          opacity: 0.2;
        }

        .schedule-editor-content {
          position: relative;
          z-index: 2;
        }





        .schedule-section-title::before,
        .schedule-section-title::after {
          content: "";
          display: inline-block;
          width: 36px;
          height: 1px;
          background: color-mix(in srgb, var(--fcc-premium-accent) 42%, transparent);
        }



        .schedule-action-primary,
        .schedule-action-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 15px;
          font-size: 0.86rem;
          font-weight: 850;
          transition:
            transform 170ms ease,
            opacity 170ms ease,
            border-color 170ms ease;
        }

        .schedule-action-primary {
          color: white;
          background: var(--fcc-premium-button);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 54%, white);
          box-shadow:
            0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .theme-oscuro .schedule-action-primary {
          color: #050505;
        }

        .schedule-action-secondary {
          color: var(--fcc-premium-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 90%, transparent);
          border: 1px solid var(--fcc-premium-border);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
        }

        .schedule-action-secondary.danger {
          color: var(--color-danger, #ef4444);
          border-color: color-mix(in srgb, var(--color-danger, #ef4444) 20%, var(--fcc-premium-border));
        }

        .schedule-action-primary:hover,
        .schedule-action-secondary:hover {
          transform: translateY(-1px);
        }

        .schedule-action-secondary:disabled {
          cursor: not-allowed;
          opacity: 0.48;
          transform: none;
        }

        .schedule-builder-grid {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }



        .schedule-sidebar-section {
          margin-top: 14px;
          border-radius: 18px;
          padding: 12px;
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 78%, transparent);
          border: 1px solid var(--fcc-premium-border);
        }

        .schedule-sidebar-section-title {
          margin: 0 0 10px;
          color: var(--fcc-premium-text);
          font-size: 0.84rem;
          font-weight: 950;
          letter-spacing: -0.01em;
        }

        .schedule-sidebar-control {
          margin-top: 8px;
        }

        .schedule-sidebar-control .schedule-modal-label {
          font-size: 0.68rem;
        }

        .schedule-sidebar-select {
          width: 100%;
          min-height: 38px;
          border-radius: 12px;
          padding: 0 10px;
          color: var(--fcc-premium-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent);
          border: 1px solid var(--fcc-premium-border);
          outline: none;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .schedule-sidebar-input {
          width: 100%;
          min-height: 38px;
          border-radius: 12px;
          padding: 0 10px;
          color: var(--fcc-premium-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent);
          border: 1px solid var(--fcc-premium-border);
          outline: none;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .schedule-sidebar-note {
          margin: 0 0 10px;
          color: var(--fcc-premium-muted);
          font-size: 0.76rem;
          font-weight: 780;
          line-height: 1.38;
        }

        .schedule-palette-panel {
          position: sticky;
          top: 12px;
        }

        .schedule-palette-header,
        .schedule-panel-heading-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .schedule-palette-title,
        .schedule-panel-title {
          color: var(--fcc-premium-text);
          font-size: 1.06rem;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .schedule-palette-subtitle,
        .schedule-panel-subtitle {
          margin-top: 4px;
          color: var(--fcc-premium-muted);
          font-size: 0.78rem;
          font-weight: 750;
          line-height: 1.35;
        }

        .schedule-selected-helper {
          margin-bottom: 12px;
          border-radius: 18px;
          padding: 12px;
          color: var(--fcc-premium-muted);
          background: color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent);
          border: 1px dashed color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);
          font-size: 0.82rem;
          font-weight: 800;
          line-height: 1.4;
        }

        .schedule-selected-helper strong {
          color: var(--fcc-premium-text);
        }

        .schedule-palette-list {
          display: grid;
          gap: 10px;
        }

        .schedule-palette-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          border-radius: 18px;
          padding: 10px;
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 84%, transparent);
          border: 1px solid var(--fcc-premium-border);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.48);
        }

        .schedule-palette-card.is-selected {
          background:
            radial-gradient(
              circle at 0% 50%,
              color-mix(in srgb, var(--subject-color) 14%, transparent),
              transparent 38%
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 92%, transparent);
          border-color: color-mix(in srgb, var(--subject-color) 46%, var(--fcc-premium-border));
        }

        .schedule-palette-select {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          text-align: left;
        }

        .schedule-palette-color {
          width: 34px;
          height: 34px;
          border-radius: 14px;
          flex: 0 0 auto;
          border: 1px solid rgba(255, 255, 255, 0.55);
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
        }

        .schedule-palette-name {
          color: var(--fcc-premium-text);
          font-size: 0.92rem;
          font-weight: 950;
          line-height: 1.1;
        }

        .schedule-palette-meta {
          margin-top: 3px;
          color: var(--fcc-premium-muted);
          font-size: 0.74rem;
          font-weight: 780;
          line-height: 1.25;
        }

        .schedule-palette-actions {
          display: inline-flex;
          gap: 6px;
        }

        .schedule-panel-heading {
          display: grid;
          gap: 12px;
          justify-items: center;
          margin-bottom: 16px;
          text-align: center;
        }

        .schedule-section-title {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          color: var(--fcc-premium-text);
          font-size: 1.15rem;
          font-weight: 950;
          letter-spacing: -0.035em;
          line-height: 1;
        }

        .schedule-range-chip {
          border-radius: 999px;
          padding: 7px 12px;
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          font-size: 0.76rem;
          font-weight: 900;
        }

        .schedule-table-shell {
          overflow-x: auto;
          border-radius: 24px;
          padding: 12px;
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 82%, transparent);
          border: 1px solid var(--fcc-premium-border);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
        }

        .theme-oscuro .schedule-table-shell {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .schedule-grid {
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid var(--fcc-premium-border);
          background: var(--color-card);
          box-shadow: var(--fcc-premium-shadow-soft);
        }

        .schedule-grid-head,
        .schedule-grid-hour,
        .schedule-grid-cell {
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
        }

        .schedule-grid-head {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-heading);
          background: color-mix(in srgb, var(--color-card-soft) 74%, var(--color-card));
          font-size: 0.88rem;
          font-weight: 950;
        }

        .schedule-grid-hour {
          position: sticky;
          left: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-muted);
          background: color-mix(in srgb, var(--color-card) 96%, var(--color-card-soft));
          font-size: 0.84rem;
          font-weight: 900;
        }

        .schedule-grid-cell {
          background: color-mix(in srgb, var(--color-card) 98%, var(--color-card-soft));
        }

        .schedule-clickable-cell {
          cursor: crosshair;
          transition:
            background 150ms ease,
            box-shadow 150ms ease;
        }

        .schedule-clickable-cell:hover {
          background:
            color-mix(in srgb, var(--selected-subject-color, var(--fcc-premium-accent)) 10%, var(--color-card));
          box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--selected-subject-color, var(--fcc-premium-accent)) 26%, transparent);
        }

        .schedule-class-block {
          z-index: 30;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin: 6px;
          padding: 8px;
          text-align: center;
          border-radius: 16px;
          line-height: 1.12;
          box-shadow:
            0 10px 18px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.24),
            inset 0 -1px 0 rgba(15, 23, 42, 0.06);
        }

        .schedule-empty-state {
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          border-radius: 18px;
          padding: 20px;
          text-align: center;
          color: var(--fcc-premium-muted);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 72%, transparent);
          border: 1px dashed color-mix(in srgb, var(--fcc-premium-accent) 22%, transparent);
        }

        .schedule-modal-overlay {
          --schedule-modal-accent: var(--fcc-premium-accent);
          --schedule-modal-cyan: var(--fcc-premium-cyan);
          --schedule-modal-surface: var(--fcc-premium-surface);
          --schedule-modal-surface-soft: var(--fcc-premium-surface-soft);
          --schedule-modal-surface-strong: var(--fcc-premium-surface-strong);
          --schedule-modal-text: var(--fcc-premium-text);
          --schedule-modal-muted: var(--fcc-premium-muted);
          --schedule-modal-border: var(--fcc-premium-border);
          --schedule-modal-shadow: var(--fcc-premium-shadow);
          --schedule-modal-danger: var(--color-danger, #ef4444);

          position: fixed;
          inset: 0;
          z-index: 90;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
        }

        .schedule-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(8px);
        }

        .schedule-subject-modal,
        .schedule-block-modal {
          position: relative;
          width: min(94vw, 1040px);
          max-height: 92dvh;
          overflow-y: auto;
          border-radius: 28px;
          color: var(--schedule-modal-text);
          background:
            radial-gradient(
              circle at 12% 0%,
              color-mix(in srgb, var(--schedule-modal-cyan) 5%, transparent),
              transparent 32%
            ),
            linear-gradient(
              135deg,
              var(--schedule-modal-surface),
              var(--schedule-modal-surface-soft)
            );
          border: 1px solid color-mix(in srgb, var(--schedule-modal-accent) 14%, var(--schedule-modal-border));
          box-shadow: var(--schedule-modal-shadow);
        }

        .schedule-subject-modal.simple,
        .schedule-block-modal {
          width: min(94vw, 620px);
        }

                .schedule-subject-modal::before,
        .schedule-block-modal::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-premium-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-premium-grid) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at 12% 0%, black, transparent 72%);
          opacity: 0.16;
        }

        .schedule-modal-content {
          position: relative;
          z-index: 2;
          min-width: 0;
        }

        .schedule-modal-header {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 20px;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--schedule-modal-surface) 96%, transparent),
              color-mix(in srgb, var(--schedule-modal-surface-soft) 96%, transparent)
            );
          border-bottom: 1px solid var(--schedule-modal-border);
          backdrop-filter: blur(10px);
        }

        .schedule-modal-eyebrow {
          margin: 0 0 4px;
          color: var(--schedule-modal-accent);
          font-size: 0.68rem;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .schedule-modal-title {
          margin: 0;
          color: var(--schedule-modal-text);
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 950;
          letter-spacing: -0.052em;
          line-height: 1;
        }

        .schedule-modal-close {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 999px;
          color: var(--schedule-modal-text);
          background: color-mix(in srgb, var(--schedule-modal-surface-strong) 82%, transparent);
          border: 1px solid var(--schedule-modal-border);
        }

        .schedule-simple-subject-body,
        .schedule-preferences-body {
          display: grid;
          gap: 16px;
          padding: 18px;
          align-content: start;
          min-width: 0;
        }

        .schedule-preference-card {
          border-radius: 22px;
          padding: 14px;
          background: color-mix(in srgb, var(--schedule-modal-surface-strong) 78%, transparent);
          border: 1px solid var(--schedule-modal-border);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--schedule-modal-surface-strong) 70%, transparent);
        }

        .schedule-preferences-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .schedule-modal-field {
          display: block;
          min-width: 0;
        }

        .schedule-modal-label {
          display: block;
          margin-bottom: 6px;
          color: var(--schedule-modal-muted);
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .schedule-modal-control {
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
          padding: 0 12px;
          color: var(--schedule-modal-text);
          background: color-mix(in srgb, var(--schedule-modal-surface-strong) 78%, transparent);
          border: 1px solid var(--schedule-modal-border);
          outline: none;
          font-size: 0.9rem;
          font-weight: 760;
        }

        .schedule-modal-control:focus {
          border-color: color-mix(in srgb, var(--schedule-modal-accent) 52%, var(--schedule-modal-border));
          background: color-mix(in srgb, var(--schedule-modal-surface-strong) 92%, transparent);
        }

        .schedule-color-section {
          display: grid;
          gap: 8px;
        }

        .schedule-color-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .schedule-color-dot {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid var(--schedule-modal-border);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.36),
            0 6px 14px rgba(15, 23, 42, 0.1);
        }

        .schedule-color-dot.is-active {
          box-shadow:
            0 0 0 3px var(--schedule-modal-surface),
            0 0 0 5px var(--schedule-modal-accent),
            0 8px 18px rgba(15, 23, 42, 0.12);
        }

        .schedule-preference-title {
          margin: 0 0 10px;
          color: var(--schedule-modal-text);
          font-size: 0.92rem;
          font-weight: 950;
          letter-spacing: -0.01em;
        }

        .schedule-option-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .schedule-option-pill {
          min-height: 32px;
          border-radius: 999px;
          padding: 0 10px;
          color: var(--fcc-premium-muted);
          background: color-mix(in srgb, var(--fcc-premium-surface-soft) 82%, transparent);
          border: 1px solid var(--fcc-premium-border);
          font-size: 0.76rem;
          font-weight: 850;
        }

        .schedule-option-pill.is-active {
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 12%, transparent);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 26%, transparent);
        }

        .schedule-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          color: var(--fcc-premium-text);
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 90%, transparent);
          border: 1px solid var(--fcc-premium-border);
        }

        .schedule-icon-button.danger {
          color: var(--color-danger, #ef4444);
        }

        .schedule-modal-message {
          margin: 0;
          border-radius: 16px;
          padding: 11px 12px;
          color: var(--schedule-modal-danger);
          background: color-mix(in srgb, var(--schedule-modal-danger) 8%, var(--schedule-modal-surface));
          border: 1px solid color-mix(in srgb, var(--schedule-modal-danger) 26%, var(--schedule-modal-border));
          font-size: 0.88rem;
          font-weight: 850;
          text-align: center;
        }

        .schedule-floating-toast {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 120;
          max-width: min(360px, calc(100vw - 32px));
          border-radius: 18px;
          padding: 12px 14px;
          color: var(--fcc-premium-text);
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 70%
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 94%, transparent);
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 20%, var(--fcc-premium-border));
          box-shadow:
            0 18px 38px rgba(15, 23, 42, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.62);
          font-size: 0.86rem;
          font-weight: 900;
          line-height: 1.35;
          animation: schedule-toast-in 180ms ease-out;
        }

        @keyframes schedule-toast-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .schedule-modal-save {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
          width: 100%;
          border-radius: 14px;
          color: #ffffff;
          background: var(--fcc-premium-button);
          border: 1px solid color-mix(in srgb, var(--schedule-modal-accent) 64%, white);
          box-shadow: 0 14px 24px color-mix(in srgb, var(--schedule-modal-accent) 18%, transparent);
          font-size: 0.9rem;
          font-weight: 950;
        }

        .theme-oscuro .schedule-modal-save {
          color: #050505;
        }

        .schedule-block-summary {
          display: flex;
          gap: 10px;
          align-items: center;
          border-radius: 18px;
          padding: 12px;
          background: color-mix(in srgb, var(--schedule-modal-surface-strong) 78%, transparent);
          border: 1px solid var(--schedule-modal-border);
        }

        .schedule-block-summary p {
          margin: 0;
          color: var(--schedule-modal-text);
          font-size: 0.9rem;
          font-weight: 950;
        }

        .schedule-block-summary small {
          color: var(--schedule-modal-muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .schedule-block-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 1100px) {
          .schedule-builder-grid {
            grid-template-columns: 1fr;
          }

          .schedule-palette-panel {
            position: relative;
            top: auto;
          }
        }

        @media (max-width: 768px) {
          .schedule-preferences-grid,
          .schedule-block-modal-actions {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
            .schedule-editor-panel,
          .schedule-subject-modal,
          .schedule-block-modal {
            border-radius: 24px;
          }

          .schedule-section-title::before,
          .schedule-section-title::after {
            width: 24px;
          }

          .schedule-panel-heading-row,
          .schedule-palette-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .schedule-range-chip {
            width: fit-content;
          }

          .schedule-modal-header {
            padding: 16px;
          }

          .schedule-simple-subject-body {
            padding: 14px;
          }
        }


        .schedule-left-stack {
          position: sticky;
          top: 12px;
          display: grid;
          gap: 12px;
          align-self: start;
          min-width: 0;
        }

        .schedule-standalone-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 38px;
          border-radius: 16px;
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 7%, var(--fcc-premium-surface-strong));
          border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 20%, var(--fcc-premium-border));
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
          font-size: 0.84rem;
          font-weight: 950;
        }

        .schedule-standalone-back:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 34%, var(--fcc-premium-border));
        }

        .schedule-side-panel {
          align-self: start;
        }

        .schedule-preview-panel {
          position: relative;
        }

        .schedule-preview-tools {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          pointer-events: none;
        }

        .schedule-preview-tools > * {
          pointer-events: auto;
        }

        .schedule-download-button {
          min-height: 36px;
          border-radius: 14px;
          padding: 0 13px;
          font-size: 0.82rem;
        }

        .schedule-panel-heading.compact {
          margin-bottom: 14px;
          padding-top: 2px;
        }

        .schedule-palette-header.compact {
          margin-bottom: 12px;
        }

        .schedule-settings-panel {
          padding: 14px;
        }

        .schedule-settings-title {
          margin: 0 0 10px;
          color: var(--fcc-premium-text);
          font-size: 1rem;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .schedule-settings-details {
          border-radius: 16px;
          background: color-mix(in srgb, var(--fcc-premium-surface-strong) 82%, transparent);
          border: 1px solid var(--fcc-premium-border);
          overflow: hidden;
        }

        .schedule-settings-details + .schedule-settings-details {
          margin-top: 8px;
        }

        .schedule-settings-details summary {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          cursor: pointer;
          color: var(--fcc-premium-text);
          font-size: 0.82rem;
          font-weight: 950;
          list-style: none;
        }

        .schedule-settings-details summary::-webkit-details-marker {
          display: none;
        }

        .schedule-settings-details summary::after {
          content: "⌄";
          color: var(--fcc-premium-muted);
          font-size: 0.9rem;
          transition: transform 170ms ease;
        }

        .schedule-settings-details[open] summary::after {
          transform: rotate(180deg);
        }

        .schedule-settings-details[open] {
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 58%
            ),
            color-mix(in srgb, var(--fcc-premium-accent) 5%, var(--fcc-premium-surface-strong));
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 28%, var(--fcc-premium-border));
          box-shadow:
            0 10px 22px color-mix(in srgb, var(--fcc-premium-accent) 7%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
        }

        .schedule-settings-details[open] summary {
          color: var(--fcc-premium-accent);
          border-bottom: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 14%, transparent);
        }

        .schedule-settings-details[open] .schedule-settings-body {
          background: color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
        }

        .schedule-settings-body {
          display: grid;
          gap: 10px;
          padding: 0 12px 12px;
        }

        .schedule-settings-help {
          margin: 0;
          color: var(--fcc-premium-muted);
          font-size: 0.74rem;
          font-weight: 760;
          line-height: 1.35;
        }

        .schedule-option-pill {
          min-height: 32px;
          padding: 0 10px;
          font-size: 0.75rem;
        }

        .schedule-option-pill.is-active {
          color: var(--fcc-premium-accent);
          background: color-mix(in srgb, var(--fcc-premium-accent) 13%, transparent);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 30%, transparent);
        }

        .schedule-inline-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        @media (max-width: 1100px) {
          .schedule-left-stack {
            position: relative;
            top: auto;
          }
        }

        @media (max-width: 720px) {
          .schedule-preview-tools {
            position: static;
            margin-bottom: 10px;
          }

          .schedule-panel-heading.compact {
            padding-top: 0;
          }

          .schedule-download-button {
            width: fit-content;
          }
        }

      `}</style>

      <div className="schedule-editor-shell min-w-0">
        <div
          className="schedule-builder-grid"
          style={{
            ["--selected-subject-color" as string]:
              materiaSeleccionada?.color ?? "var(--fcc-premium-accent)",
          }}
        >
          <div className="schedule-left-stack">
            <Link href={hrefVolver} className="schedule-standalone-back">
              <ArrowLeft size={16} />
              Volver
            </Link>

            <aside className="schedule-editor-panel schedule-side-panel p-4 min-w-0">
              <div className="schedule-editor-content">
                <div className="schedule-palette-header compact">
                  <div>
                    <h2 className="schedule-palette-title">Materias</h2>
                    <p className="schedule-palette-subtitle">
                      Selecciona una materia.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={abrirNuevaMateria}
                    className="schedule-action-secondary"
                  >
                    <Plus size={16} />
                    Nueva
                  </button>
                </div>

                <div className="schedule-selected-helper">
                  {materiaSeleccionada ? (
                    <>
                      Pintando con <strong>{materiaSeleccionada.nombre}</strong>.
                    </>
                  ) : (
                    "Crea o selecciona una materia para empezar."
                  )}
                </div>

                {materias.length === 0 ? (
                  <div className="schedule-empty-state min-h-[128px]">
                    <p className="font-black">No hay materias</p>
                    <p className="text-sm mt-1">
                      Crea una materia y luego colócala en el horario.
                    </p>
                  </div>
                ) : (
                  <div className="schedule-palette-list">
                    {materias.map((materia) => {
                      const seleccionada = materia.id === materiaSeleccionadaId;

                      return (
                        <div
                          key={materia.id}
                          className={`schedule-palette-card ${
                            seleccionada ? "is-selected" : ""
                          }`}
                          style={{ ["--subject-color" as string]: materia.color }}
                        >
                          <button
                            type="button"
                            onClick={() => setMateriaSeleccionadaId(materia.id)}
                            className="schedule-palette-select"
                          >
                            <span
                              className="schedule-palette-color"
                              style={{ backgroundColor: materia.color }}
                            />

                            <span className="min-w-0">
                              <span className="schedule-palette-name block truncate">
                                {materia.nombre}
                              </span>

                              <span className="schedule-palette-meta block truncate">
                                {materia.profesor || "Sin profesor"}
                                {materia.nrc ? ` · NRC ${materia.nrc}` : ""}
                              </span>
                            </span>
                          </button>

                          <div className="schedule-palette-actions">
                            <button
                              type="button"
                              onClick={() => editarMateria(materia)}
                              className="schedule-icon-button"
                              aria-label="Editar materia"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => eliminarMateria(materia.id)}
                              className="schedule-icon-button danger"
                              aria-label="Eliminar materia"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <aside className="schedule-editor-panel schedule-settings-panel min-w-0">
              <div className="schedule-editor-content">
                <h2 className="schedule-settings-title">Ajustes visuales</h2>

                <details className="schedule-settings-details">
                  <summary>Color de bloques</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {(Object.keys(INTENSIDADES_COLOR) as IntensidadColor[]).map(
                        (key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setIntensidadColor(key)}
                            className={`schedule-option-pill ${
                              intensidadColor === key ? "is-active" : ""
                            }`}
                          >
                            {INTENSIDADES_COLOR[key].label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </details>

                <details className="schedule-settings-details">
                  <summary>Horas visibles</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {[
                        { key: "inteligente", label: "Automático" },
                        { key: "compacto", label: "Solo clases" },
                        { key: "personalizado", label: "Manual" },
                      ].map((opcion) => (
                        <button
                          key={opcion.key}
                          type="button"
                          onClick={() => setModoRango(opcion.key as ModoRango)}
                          className={`schedule-option-pill ${
                            modoRango === opcion.key ? "is-active" : ""
                          }`}
                        >
                          {opcion.label}
                        </button>
                      ))}
                    </div>

                    {modoRango === "personalizado" && (
                      <div className="schedule-inline-two">
                        <label className="block">
                          <span className="schedule-modal-label">Desde</span>
                          <select
                            value={rangoPersonalizadoInicio}
                            onChange={(e) =>
                              setRangoPersonalizadoInicio(Number(e.target.value))
                            }
                            className="schedule-sidebar-select"
                          >
                            {Array.from(
                              { length: HORA_MAXIMA - HORA_MINIMA },
                              (_, index) => HORA_MINIMA + index
                            ).map((hora) => (
                              <option key={hora} value={hora}>
                                {etiquetaHora(hora)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="schedule-modal-label">Hasta</span>
                          <select
                            value={rangoPersonalizadoFin}
                            onChange={(e) =>
                              setRangoPersonalizadoFin(Number(e.target.value))
                            }
                            className="schedule-sidebar-select"
                          >
                            {Array.from(
                              { length: HORA_MAXIMA - HORA_MINIMA },
                              (_, index) => HORA_MINIMA + index + 1
                            ).map((hora) => (
                              <option key={hora} value={hora}>
                                {etiquetaHora(hora)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                </details>

                <details className="schedule-settings-details">
                  <summary>Bloques continuos</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {[
                        { value: true, label: "Agrupar" },
                        { value: false, label: "Separar" },
                      ].map((opcion) => (
                        <button
                          key={opcion.label}
                          type="button"
                          onClick={() =>
                            cambiarAgrupacionBloques(opcion.value)
                          }
                          className={`schedule-option-pill ${
                            agruparBloquesContinuos === opcion.value
                              ? "is-active"
                              : ""
                          }`}
                        >
                          {opcion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>

                <details className="schedule-settings-details">
                  <summary>Días visibles</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {DIAS.map((dia) => {
                        const activo = diasVisibles.includes(dia.id);

                        return (
                          <button
                            key={dia.id}
                            type="button"
                            onClick={() => alternarDiaVisible(dia.id)}
                            className={`schedule-option-pill ${
                              activo ? "is-active" : ""
                            }`}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </details>

                <details className="schedule-settings-details">
                  <summary>Datos visibles</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {[
                        { key: "salon", label: "Salón" },
                        { key: "profesor", label: "Profesor" },
                        { key: "nrc", label: "NRC" },
                      ].map((opcion) => {
                        const key = opcion.key as keyof OpcionesVista;
                        const activo = opcionesVista[key];

                        return (
                          <button
                            key={opcion.key}
                            type="button"
                            onClick={() =>
                              setOpcionesVista((actual) => ({
                                ...actual,
                                [key]: !actual[key],
                              }))
                            }
                            className={`schedule-option-pill ${
                              activo ? "is-active" : ""
                            }`}
                          >
                            {opcion.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </details>

                <details className="schedule-settings-details">
                  <summary>Título al descargar</summary>
                  <div className="schedule-settings-body">
                    <div className="schedule-option-group">
                      {[
                        { key: "automatico", label: "Horario" },
                        { key: "personalizado", label: "Personalizado" },
                      ].map((opcion) => (
                        <button
                          key={opcion.key}
                          type="button"
                          onClick={() =>
                            setTituloDescargaModo(
                              opcion.key as TituloDescargaModo
                            )
                          }
                          className={`schedule-option-pill ${
                            tituloDescargaModo === opcion.key ? "is-active" : ""
                          }`}
                        >
                          {opcion.label}
                        </button>
                      ))}
                    </div>

                    {tituloDescargaModo === "personalizado" && (
                      <input
                        value={tituloDescarga}
                        onChange={(e) => setTituloDescarga(e.target.value)}
                        placeholder="Ej. Horario Primavera 2027"
                        className="schedule-sidebar-input"
                      />
                    )}
                  </div>
                </details>
              </div>
            </aside>
          </div>

          <section className="schedule-editor-panel schedule-preview-panel p-3 sm:p-4 min-w-0">
            <div className="schedule-editor-content">
              <div className="schedule-preview-tools">
                <p className="schedule-range-chip">
                  {modoRango === "compacto"
                    ? "Horas con clase"
                    : `${etiquetaHora(horasVisibles[0])} - ${etiquetaHora(
                        horasVisibles[horasVisibles.length - 1] + 1
                      )}`}
                </p>

                <button
                  type="button"
                  onClick={descargarHorario}
                  disabled={materias.length === 0}
                  className="schedule-action-secondary schedule-download-button"
                >
                  <Download size={17} />
                  Descargar
                </button>
              </div>

              <div className="schedule-panel-heading compact">
                <div>
                  <h2 className="schedule-section-title">Vista previa</h2>
                  <p className="schedule-panel-subtitle">
                    Da clic en una celda vacía para pintar. Da clic en un bloque
                    para editar el salón o quitarlo.
                  </p>
                </div>
              </div>

              <div className="schedule-table-shell">
                <div
                  className="schedule-grid grid relative min-w-[900px]"
                  style={{
                    gridTemplateColumns: `74px repeat(${diasMostrados.length}, minmax(132px, 1fr))`,
                    gridTemplateRows: `44px repeat(${horasVisibles.length}, ${ALTO_FILA}px)`,
                    fontFamily: FUENTE_HORARIO,
                  }}
                >
                  <div
                    className="schedule-grid-head sticky left-0 z-20"
                    style={{ gridColumn: 1, gridRow: 1 }}
                  >
                    Hora
                  </div>

                  {diasMostrados.map((dia, index) => (
                    <div
                      key={dia.id}
                      className="schedule-grid-head"
                      style={{ gridColumn: index + 2, gridRow: 1 }}
                    >
                      {dia.label}
                    </div>
                  ))}

                  {horasVisibles.map((hora, rowIndex) => (
                    <div
                      key={`hora-${hora}`}
                      className="schedule-grid-hour"
                      style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                    >
                      {etiquetaHora(hora)}
                    </div>
                  ))}

                  {horasVisibles.map((hora, rowIndex) =>
                    diasMostrados.map((dia, dayIndex) => (
                      <button
                        key={`${dia.id}-${hora}`}
                        type="button"
                        onClick={() => pintarCelda(dia.id, hora)}
                        className="schedule-grid-cell schedule-clickable-cell"
                        style={{
                          gridColumn: dayIndex + 2,
                          gridRow: rowIndex + 2,
                        }}
                        aria-label={`Colocar materia en ${dia.label} a las ${etiquetaHora(
                          hora
                        )}`}
                      />
                    ))
                  )}

                  {materias.flatMap((materia) =>
                    materia.sesiones.map((sesion) => {
                      const diaIndex = diasMostrados.findIndex((d) => d.id === sesion.dia);
                      const posicion = posicionSesion(sesion);

                      if (diaIndex === -1 || !posicion) return null;

                      const detalles = detallesMateria(materia, sesion);
                      const colorTexto = colorTextoBloque(
                        materia.color,
                        intensidad.alpha,
                        temaOscuro
                      );

                      return (
                        <button
                          key={`${materia.id}-${sesion.id}`}
                          type="button"
                          onClick={() => abrirEditarBloqueHorario(materia, sesion)}
                          className="schedule-class-block hover:brightness-105 transition"
                          style={{
                            gridColumn: diaIndex + 2,
                            gridRow: `${posicion.rowStart} / span ${posicion.span}`,
                            background: fondoBloqueHorario(
                              materia.color,
                              intensidad.alpha
                            ),
                            color: colorTexto,
                            textShadow:
                              colorTexto === "#ffffff"
                                ? "0 1px 2px rgba(0, 0, 0, 0.16)"
                                : "0 1px 0 rgba(255, 255, 255, 0.42)",
                          }}
                        >
                          <p
                            className={`font-black leading-tight ${clasesTextoBloque.titulo}`}
                          >
                            {materia.nombre}
                          </p>

                          {detalles.length > 0 && (
                            <div className="mt-1 flex flex-col items-center justify-center leading-tight opacity-95">
                              {detalles.map((detalle, index) => {
                                const esSalon = detalle
                                  .toLowerCase()
                                  .startsWith("salón");

                                return (
                                  <span
                                    key={detalle}
                                    className={
                                      esSalon
                                        ? `${clasesTextoBloque.salon} font-bold`
                                        : index > 0
                                        ? `${clasesTextoBloque.extra} opacity-90`
                                        : clasesTextoBloque.detalle
                                    }
                                  >
                                    {detalle}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}

                  {materias.length === 0 && (
                    <div
                      className="schedule-empty-state"
                      style={{ gridColumn: "2 / -1", gridRow: "2 / span 2" }}
                    >
                      <p className="font-black">Todavía no hay materias</p>
                      <p className="text-sm mt-1">
                        Crea una materia en la columna izquierda para empezar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {mounted &&
          modalMateriaAbierto &&
          createPortal(modalMateria, document.body)}

        {mounted && modalBloque && createPortal(modalBloque, document.body)}

        {toastHorario && (
          <div className="schedule-floating-toast" role="status">
            {toastHorario}
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}
