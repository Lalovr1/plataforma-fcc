"use client";

/**
 * Mi horario.
 * Permite crear un horario visual editable, personalizable y descargable.
 */

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import LayoutGeneral from "@/components/LayoutGeneral";
import { TEMA_PREDETERMINADO, normalizarTema, type Tema } from "@/lib/temas";
import {
  ArrowLeft,
  Download,
  Eye,
  Palette,
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
type TituloDescargaModo = "ninguno" | "automatico" | "personalizado";

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

const FUENTES = [
  { label: "Sistema", value: "system-ui, sans-serif" },
  { label: "Moderna", value: "Arial, sans-serif" },
  { label: "Interfaz", value: "Segoe UI, sans-serif" },
  { label: "Redonda", value: "Trebuchet MS, sans-serif" },
  { label: "Limpia", value: "Verdana, sans-serif" },
  { label: "Compacta", value: "Tahoma, sans-serif" },
  { label: "Clásica", value: "Georgia, serif" },
  { label: "Editorial", value: "Palatino, serif" },
  { label: "Formal", value: "Times New Roman, serif" },
  { label: "Técnica", value: "Courier New, monospace" },
  { label: "Cartel", value: "Impact, sans-serif" },
  { label: "Casual", value: "Comic Sans MS, cursive" },
];

const INTENSIDADES_COLOR: Record<
  IntensidadColor,
  { label: string; alpha: number }
> = {
  suave: {
    label: "Suave",
    alpha: 0.58,
  },
  media: {
    label: "Media",
    alpha: 0.76,
  },
  fuerte: {
    label: "Fuerte",
    alpha: 1,
  },
};

const STORAGE_KEY = "fcc-academy-mi-horario-v5";

const HORA_MINIMA = 7;
const HORA_MAXIMA = 22;
const ALTO_FILA = 76;

const ESTILO_HORARIO_VISTA: CSSProperties = {
  background:
    "radial-gradient(circle at 8% 4%, color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent), transparent 30%), radial-gradient(circle at 92% 86%, color-mix(in srgb, var(--fcc-premium-cyan) 10%, transparent), transparent 32%), linear-gradient(135deg, var(--fcc-premium-surface), var(--fcc-premium-surface-soft))",
  border: "1px solid var(--fcc-premium-border)",
};

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
}) {
  const baseTitulo = tamano === "pequena" ? 17 : tamano === "grande" ? 23 : 20;
  const baseSalon = tamano === "pequena" ? 13 : tamano === "grande" ? 17 : 15;
  const baseExtra = tamano === "pequena" ? 10 : tamano === "grande" ? 13 : 11;
  const baseLineHeight =
    tamano === "pequena" ? 17 : tamano === "grande" ? 24 : 20;

  const paddingVertical = 14;
  const altoDisponible = Math.max(24, h - paddingVertical * 2);
  const lineHeight = Math.max(
    12,
    Math.min(baseLineHeight, Math.floor(altoDisponible / lineas.length))
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
}

export default function MiHorarioPage() {
  const [materias, setMaterias] = useState<MateriaHorario[]>([]);
  const [formulario, setFormulario] =
    useState<FormularioMateria>(formularioBase);
  const [sesionActual, setSesionActual] =
    useState<Omit<SesionHorario, "id">>(sesionBase);
  const [sesionEditandoId, setSesionEditandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalMateriaAbierto, setModalMateriaAbierto] = useState(false);
  const [modalPersonalizacionAbierto, setModalPersonalizacionAbierto] =
    useState(false);
  const [opcionesVista, setOpcionesVista] =
    useState<OpcionesVista>(opcionesBase);
  const [temaActual, setTemaActual] = useState<Tema>(TEMA_PREDETERMINADO);
  const [fuenteHorario, setFuenteHorario] = useState(FUENTES[0].value);
  const [tamanoLetra, setTamanoLetra] = useState<TamanoLetra>("mediana");
  const [intensidadColor, setIntensidadColor] =
    useState<IntensidadColor>("media");
  const [modoRango, setModoRango] = useState<ModoRango>("inteligente");
  const [rangoPersonalizadoInicio, setRangoPersonalizadoInicio] = useState(7);
  const [rangoPersonalizadoFin, setRangoPersonalizadoFin] = useState(14);
  const [tituloDescargaModo, setTituloDescargaModo] =
    useState<TituloDescargaModo>("automatico");
  const [tituloDescarga, setTituloDescarga] = useState("");
  const [mounted, setMounted] = useState(false);
  const [datosCargados, setDatosCargados] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const coloresTema = PALETAS_MATERIAS[temaActual];
  const intensidad = INTENSIDADES_COLOR[intensidadColor];
  const temaOscuro = temaActual === "oscuro";

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
        titulo: "text-[11px]",
        detalle: "text-[9px]",
      };
    }

    if (tamanoLetra === "grande") {
      return {
        titulo: "text-sm",
        detalle: "text-[11px]",
      };
    }

    return {
      titulo: "text-xs",
      detalle: "text-[10px]",
    };
  }, [tamanoLetra]);

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

  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);

    if (!guardado) {
      setDatosCargados(true);
      return;
    }

    try {
      const parsed = JSON.parse(guardado);

      setMaterias(parsed.materias ?? []);
      setOpcionesVista(parsed.opcionesVista ?? opcionesBase);
      setFuenteHorario(parsed.fuenteHorario ?? FUENTES[0].value);
      setTamanoLetra(
        parsed.tamanoLetra === "compacta"
          ? "pequena"
          : parsed.tamanoLetra === "normal"
          ? "mediana"
          : parsed.tamanoLetra ?? "mediana"
      );
      setIntensidadColor(parsed.intensidadColor ?? "media");
      setModoRango(parsed.modoRango ?? "inteligente");
      setRangoPersonalizadoInicio(parsed.rangoPersonalizadoInicio ?? 7);
      setRangoPersonalizadoFin(parsed.rangoPersonalizadoFin ?? 14);
      setTituloDescargaModo(parsed.tituloDescargaModo ?? "automatico");
      setTituloDescarga(parsed.tituloDescarga ?? "");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setDatosCargados(true);
    }
  }, []);

  useEffect(() => {
    if (!datosCargados) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        materias,
        opcionesVista,
        fuenteHorario,
        tamanoLetra,
        intensidadColor,
        modoRango,
        rangoPersonalizadoInicio,
        rangoPersonalizadoFin,
        tituloDescargaModo,
        tituloDescarga,
      })
    );
  }, [
    datosCargados,
    materias,
    opcionesVista,
    fuenteHorario,
    tamanoLetra,
    intensidadColor,
    modoRango,
    rangoPersonalizadoInicio,
    rangoPersonalizadoFin,
    tituloDescargaModo,
    tituloDescarga,
  ]);

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

    let sesionesFinales = formulario.sesiones;

    if (sesionesFinales.length === 0) {
      if (
        minutosDesdeHora(sesionActual.inicio) >=
        minutosDesdeHora(sesionActual.fin)
      ) {
        setMensaje("La hora de inicio debe ser menor que la hora de fin.");
        return;
      }

      const bloqueInicial: SesionHorario = {
        ...sesionActual,
        id: crearId(),
        salon: sesionActual.salon.trim(),
      };

      const choque = buscarChoqueSesion(bloqueInicial, bloqueInicial.id);

      if (choque) {
        setMensaje(choque);
        return;
      }

      sesionesFinales = [bloqueInicial];
    }

    for (const sesion of sesionesFinales) {
      const choque = buscarChoqueSesion(sesion, sesion.id);

      if (choque) {
        setMensaje(choque);
        return;
      }
    }

    const materiaFinal: MateriaHorario = {
      ...formulario,
      id: editandoId ?? crearId(),
      nombre,
      profesor: formulario.profesor.trim(),
      nrc: formulario.nrc.trim(),
      sesiones: sesionesFinales,
    };

    setMaterias((actuales) => {
      if (editandoId) {
        return actuales.map((materia) =>
          materia.id === editandoId ? materiaFinal : materia
        );
      }

      return [...actuales, materiaFinal];
    });

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
    setMaterias((actuales) => actuales.filter((materia) => materia.id !== id));

    if (editandoId === id) {
      reiniciarFormulario();
    }
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

  async function descargarHorario() {
    if (materias.length === 0) return;

    const temaCanvas = obtenerTemaCanvas();
    const canvas = document.createElement("canvas");
    const scale = 2;
    const width = 1500;
    const margen = 54;

    const tituloFinal =
      tituloDescargaModo === "ninguno"
        ? ""
        : tituloDescargaModo === "personalizado"
        ? tituloDescarga.trim()
        : "Horario";

    const header = tituloFinal ? 78 : 52;
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

    if (tituloFinal) {
      ctx.fillStyle = temaCanvas.texto;
      ctx.font = `bold 32px ${fuenteHorario}`;
      ctx.textAlign = "center";
      ctx.fillText(textoCortado(ctx, tituloFinal, width - 420), width / 2, 46);
    }

    const logo = await cargarImagen(obtenerLogoActual());

    if (logo) {
      const maxLogoW = 76;
      const maxLogoH = 58;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const logoW = logo.width * ratio;
      const logoH = logo.height * ratio;
      const logoY = tituloFinal ? 10 : 4;
      const logoX = width - logoW - 30;

      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    }

    const tablaX = margen;
    const tablaY = header;
    const tablaW = width - margen * 2;
    const columnaHora = 120;
    const columnaDia = (tablaW - columnaHora) / DIAS.length;

    ctx.shadowColor = temaCanvas.esOscuro
      ? "rgba(0, 0, 0, 0.42)"
      : "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = temaCanvas.celda;
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, 28);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = temaCanvas.borde;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = temaCanvas.celdaHeader;
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoHeaderTabla, 28);
    ctx.fill();

    ctx.fillStyle = temaCanvas.textoSuave;
    ctx.font = `bold 18px ${fuenteHorario}`;
    ctx.textAlign = "center";
    ctx.fillText("Hora", tablaX + columnaHora / 2, tablaY + 36);

    DIAS.forEach((dia, index) => {
      const x = tablaX + columnaHora + index * columnaDia;

      ctx.fillStyle = temaCanvas.texto;
      ctx.font = `bold 20px ${fuenteHorario}`;
      ctx.fillText(dia.label, x + columnaDia / 2, tablaY + 36);
    });

    ctx.strokeStyle = temaCanvas.borde;
    ctx.lineWidth = 1;

    for (let i = 0; i <= totalSlots; i++) {
      const y = tablaY + altoHeaderTabla + i * altoSlot;

      ctx.beginPath();
      ctx.moveTo(tablaX, y);
      ctx.lineTo(tablaX + tablaW, y);
      ctx.stroke();

      if (i < totalSlots) {
        ctx.fillStyle = temaCanvas.textoSuave;
        ctx.font = `bold 17px ${fuenteHorario}`;
        ctx.textAlign = "center";
        ctx.fillText(
          etiquetaHora(horasVisibles[i]),
          tablaX + columnaHora / 2,
          y + altoSlot / 2 + 6
        );
      }
    }

    for (let i = 0; i <= DIAS.length; i++) {
      const x = tablaX + columnaHora + i * columnaDia;

      ctx.beginPath();
      ctx.moveTo(x, tablaY);
      ctx.lineTo(x, tablaY + altoTabla);
      ctx.stroke();
    }

    materias.forEach((materia) => {
      materia.sesiones.forEach((sesion) => {
        const diaIndex = DIAS.findIndex((d) => d.id === sesion.dia);
        const posicion = posicionSesion(sesion);

        if (diaIndex === -1 || !posicion) return;

        const x = tablaX + columnaHora + diaIndex * columnaDia;
        const y = tablaY + altoHeaderTabla + (posicion.rowStart - 2) * altoSlot;
        const w = columnaDia;
        const h = posicion.span * altoSlot;

        ctx.fillStyle = hexConAlpha(materia.color, intensidad.alpha);
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

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
          x,
          y,
          w,
          h,
          colorTexto,
          fuente: fuenteHorario,
          tamano: tamanoLetra,
        });
      });
    });

    const link = document.createElement("a");
    link.download = "horario-fcc-academy.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const modalMateria = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={cerrarModalMateria}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar modal"
      />

      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 border-b"
          style={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <h2 className="text-lg font-black">
            {editandoId ? "Editar materia" : "Agregar materia"}
          </h2>

          <button
            type="button"
            onClick={cerrarModalMateria}
            className="rounded-lg p-2 hover:opacity-80"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            }}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block md:col-span-3">
                <span className="text-sm font-semibold">Materia</span>
                <input
                  value={formulario.nombre}
                  onChange={(e) => cambiarCampo("nombre", e.target.value)}
                  placeholder="Ej. Cálculo Diferencial"
                  className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold">Profesor</span>
                <input
                  value={formulario.profesor}
                  onChange={(e) => cambiarCampo("profesor", e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">NRC</span>
                <input
                  value={formulario.nrc}
                  onChange={(e) => cambiarCampo("nrc", e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </label>
            </div>

            <div>
              <span className="text-sm font-semibold">Color</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {coloresTema.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => cambiarCampo("color", color)}
                    className="w-9 h-9 rounded-full"
                    style={{
                      backgroundColor: color,
                      border:
                        formulario.color === color
                          ? "3px solid var(--color-text)"
                          : "1px solid var(--color-border)",
                    }}
                    aria-label={`Usar color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl p-3 space-y-3"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3 className="text-sm font-black">
                {sesionEditandoId ? "Editar bloque" : "Bloque de horario"}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold">Día</span>
                  <select
                    value={sesionActual.dia}
                    onChange={(e) => cambiarSesion("dia", e.target.value)}
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {DIAS.map((dia) => (
                      <option key={dia.id} value={dia.id}>
                        {dia.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold">Inicio</span>
                  <select
                    value={sesionActual.inicio}
                    onChange={(e) => cambiarSesion("inicio", e.target.value)}
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {horasInicio.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold">Fin</span>
                  <select
                    value={sesionActual.fin}
                    onChange={(e) => cambiarSesion("fin", e.target.value)}
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {horasFin.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold">Salón</span>
                  <input
                    value={sesionActual.salon}
                    onChange={(e) => cambiarSesion("salon", e.target.value)}
                    placeholder="Ej. 204"
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={guardarBloque}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--color-primary) 16%, transparent)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Plus size={16} />
                {sesionEditandoId ? "Guardar bloque" : "Agregar bloque"}
              </button>
            </div>

            {mensaje && (
              <p className="text-sm font-semibold text-red-400">{mensaje}</p>
            )}
          </div>

          <aside
            className="rounded-2xl p-3 space-y-3"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="rounded-2xl p-4 text-center shadow"
              style={{
                backgroundColor: hexConAlpha(formulario.color, intensidad.alpha),
                color: colorTextoBloque(
                  formulario.color,
                  intensidad.alpha,
                  temaOscuro
                ),
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)",
              }}
            >
              <p className="font-black leading-tight">
                {formulario.nombre.trim() || "Nombre de materia"}
              </p>

              <div className="mt-1 text-xs leading-tight opacity-95 space-y-0.5">
                {opcionesVista.salon &&
                  (formulario.sesiones[0]?.salon || sesionActual.salon) && (
                    <p>
                      Salón {formulario.sesiones[0]?.salon || sesionActual.salon}
                    </p>
                  )}

                {opcionesVista.profesor && formulario.profesor.trim() && (
                  <p>{formulario.profesor}</p>
                )}

                {opcionesVista.nrc && formulario.nrc.trim() && (
                  <p>NRC {formulario.nrc}</p>
                )}
              </div>
            </div>

            <h3 className="text-sm font-black">Bloques de esta materia</h3>

            {formulario.sesiones.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                Agrega al menos un bloque. Si guardas la materia sin agregarlo,
                se usará el bloque que tienes seleccionado.
              </p>
            ) : (
              <div className="space-y-2">
                {formulario.sesiones.map((sesion) => (
                  <div
                    key={sesion.id}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <strong>
                          {DIAS.find((dia) => dia.id === sesion.dia)?.label}
                        </strong>
                        <br />
                        {sesion.inicio} - {sesion.fin}
                        {sesion.salon ? ` · Salón ${sesion.salon}` : ""}
                      </span>

                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => editarBloque(sesion)}
                          className="p-1.5 rounded-lg hover:opacity-80"
                          style={{ color: "var(--color-text)" }}
                          aria-label="Editar bloque"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminarBloque(sesion.id)}
                          className="p-1.5 rounded-lg hover:opacity-80"
                          style={{ color: "#f87171" }}
                          aria-label="Eliminar bloque"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={guardarMateria}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              {editandoId ? <Save size={18} /> : <Plus size={18} />}
              {editandoId ? "Guardar cambios" : "Guardar materia"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );

  const modalPersonalizacion = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={() => setModalPersonalizacionAbierto(false)}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar personalización"
      />

      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-4"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-black">Personalizar horario</h2>

          <button
            type="button"
            onClick={() => setModalPersonalizacionAbierto(false)}
            className="rounded-lg p-2 hover:opacity-80"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            }}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-bold mb-2">Intensidad del color</h3>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(INTENSIDADES_COLOR) as IntensidadColor[]).map(
                (key) => {
                  const activo = intensidadColor === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIntensidadColor(key)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold"
                      style={{
                        backgroundColor: activo
                          ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                          : "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: activo
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                      }}
                    >
                      {INTENSIDADES_COLOR[key].label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold">Tipo de letra</span>
              <select
                value={fuenteHorario}
                onChange={(e) => setFuenteHorario(e.target.value)}
                className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                {FUENTES.map((fuente) => (
                  <option key={fuente.value} value={fuente.value}>
                    {fuente.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold">Tamaño de letra</span>
              <select
                value={tamanoLetra}
                onChange={(e) => setTamanoLetra(e.target.value as TamanoLetra)}
                className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <option value="pequena">Pequeña</option>
                <option value="mediana">Mediana</option>
                <option value="grande">Grande</option>
              </select>
            </label>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-2">Horas visibles</h3>

            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { key: "inteligente", label: "Inteligente" },
                { key: "compacto", label: "Solo horas con clase" },
                { key: "personalizado", label: "Personalizado" },
              ].map((opcion) => {
                const activo = modoRango === opcion.key;

                return (
                  <button
                    key={opcion.key}
                    type="button"
                    onClick={() => setModoRango(opcion.key as ModoRango)}
                    className="rounded-xl px-3 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: activo
                        ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                        : "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: activo ? "var(--color-primary)" : "var(--color-muted)",
                    }}
                  >
                    {opcion.label}
                  </button>
                );
              })}
            </div>

            {modoRango === "personalizado" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-bold">Desde</span>
                  <select
                    value={rangoPersonalizadoInicio}
                    onChange={(e) =>
                      setRangoPersonalizadoInicio(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
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
                  <span className="text-sm font-bold">Hasta</span>
                  <select
                    value={rangoPersonalizadoFin}
                    onChange={(e) =>
                      setRangoPersonalizadoFin(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl px-3 py-2 outline-none"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
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

          <div>
            <h3 className="text-sm font-bold mb-2">Título de descarga</h3>

            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { key: "automatico", label: "Horario" },
                { key: "personalizado", label: "Personalizado" },
                { key: "ninguno", label: "Sin título" },
              ].map((opcion) => {
                const activo = tituloDescargaModo === opcion.key;

                return (
                  <button
                    key={opcion.key}
                    type="button"
                    onClick={() =>
                      setTituloDescargaModo(opcion.key as TituloDescargaModo)
                    }
                    className="rounded-xl px-3 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: activo
                        ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                        : "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: activo ? "var(--color-primary)" : "var(--color-muted)",
                    }}
                  >
                    {opcion.label}
                  </button>
                );
              })}
            </div>

            {tituloDescargaModo === "personalizado" && (
              <input
                value={tituloDescarga}
                onChange={(e) => setTituloDescarga(e.target.value)}
                placeholder="Ej. Horario Primavera 2027"
                className="w-full rounded-xl px-3 py-2 outline-none"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold mb-2">Información visible</h3>

            <div className="flex flex-wrap gap-2">
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
                    className="rounded-xl px-3 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: activo
                        ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                        : "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: activo ? "var(--color-primary)" : "var(--color-muted)",
                    }}
                  >
                    {activo ? "Mostrar" : "Ocultar"} {opcion.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-4 min-w-0">
        <section
          className="rounded-2xl p-3 sm:p-4 shadow flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/estudiante/herramientas"
              className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 shrink-0"
              style={{ color: "var(--color-primary)" }}
            >
              <ArrowLeft size={16} />
              Volver
            </Link>

            <span
              className="hidden sm:block h-6 w-px"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            <h1 className="text-lg sm:text-xl font-black truncate">Mi horario</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModalPersonalizacionAbierto(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <Palette size={18} />
              Personalizar
            </button>

            <button
              type="button"
              onClick={abrirNuevaMateria}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              <Plus size={18} />
              Agregar materia
            </button>

            <button
              type="button"
              onClick={descargarHorario}
              disabled={materias.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <Download size={18} />
              Descargar
            </button>
          </div>
        </section>

        <section
          className="rounded-2xl p-4 shadow"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Eye size={20} style={{ color: "var(--color-primary)" }} />
              <h2 className="text-lg font-bold">Vista previa</h2>
            </div>

            <p className="text-xs sm:text-sm" style={{ color: "var(--color-muted)" }}>
              {modoRango === "compacto"
                ? "Horas con clase"
                : `${etiquetaHora(horasVisibles[0])} - ${etiquetaHora(
                    horasVisibles[horasVisibles.length - 1] + 1
                  )}`}
            </p>
          </div>

          <div
            className="rounded-3xl p-3 sm:p-4 overflow-x-auto shadow-inner"
            style={ESTILO_HORARIO_VISTA}
          >
            <div
              className="grid relative min-w-[900px] rounded-2xl overflow-hidden shadow"
              style={{
                gridTemplateColumns: `74px repeat(${DIAS.length}, minmax(126px, 1fr))`,
                gridTemplateRows: `44px repeat(${horasVisibles.length}, ${ALTO_FILA}px)`,
                fontFamily: fuenteHorario,
              }}
            >
              <div
                className="sticky left-0 z-20 flex items-center justify-center text-xs font-bold border"
                style={{
                  gridColumn: 1,
                  gridRow: 1,
                  backgroundColor: "var(--color-card-soft)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-muted)",
                }}
              >
                Hora
              </div>

              {DIAS.map((dia, index) => (
                <div
                  key={dia.id}
                  className="flex items-center justify-center text-sm font-black border"
                  style={{
                    gridColumn: index + 2,
                    gridRow: 1,
                    backgroundColor: "var(--color-card-soft)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-heading)",
                  }}
                >
                  {dia.label}
                </div>
              ))}

              {horasVisibles.map((hora, rowIndex) => (
                <div
                  key={`hora-${hora}`}
                  className="sticky left-0 z-10 flex items-center justify-center text-[11px] font-bold border"
                  style={{
                    gridColumn: 1,
                    gridRow: rowIndex + 2,
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-muted)",
                  }}
                >
                  {etiquetaHora(hora)}
                </div>
              ))}

              {horasVisibles.map((hora, rowIndex) =>
                DIAS.map((dia, dayIndex) => (
                  <div
                    key={`${dia.id}-${hora}`}
                    className="border"
                    style={{
                      gridColumn: dayIndex + 2,
                      gridRow: rowIndex + 2,
                      backgroundColor: "var(--color-card)",
                      borderColor: "var(--color-border)",
                    }}
                  />
                ))
              )}

              {materias.flatMap((materia) =>
                materia.sesiones.map((sesion) => {
                  const diaIndex = DIAS.findIndex((d) => d.id === sesion.dia);
                  const posicion = posicionSesion(sesion);

                  if (diaIndex === -1 || !posicion) return null;

                  const detalles = detallesMateria(materia, sesion);

                  return (
                    <button
                      key={`${materia.id}-${sesion.id}`}
                      type="button"
                      onClick={() => editarMateria(materia)}
                      className="z-30 p-2 overflow-hidden shadow flex flex-col items-center justify-center text-center hover:brightness-105 transition"
                      style={{
                        gridColumn: diaIndex + 2,
                        gridRow: `${posicion.rowStart} / span ${posicion.span}`,
                        backgroundColor: hexConAlpha(materia.color, intensidad.alpha),
                        color: colorTextoBloque(
                          materia.color,
                          intensidad.alpha,
                          temaOscuro
                        ),
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)",
                      }}
                    >
                      <p className={`font-black leading-tight ${clasesTextoBloque.titulo}`}>
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
                                    ? "text-[11px] font-bold"
                                    : index > 0
                                    ? "text-[9px] opacity-90"
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
                  className="z-30 rounded-2xl p-4 text-center flex flex-col items-center justify-center"
                  style={{
                    gridColumn: "2 / -1",
                    gridRow: "2 / span 2",
                    color: "var(--color-muted)",
                  }}
                >
                  <p className="font-bold">Todavía no hay materias</p>
                  <p className="text-sm mt-1">
                    Agrega una materia para empezar a construir tu horario.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl p-4 shadow"
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold">Materias</h2>

            <button
              type="button"
              onClick={abrirNuevaMateria}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                color: "var(--color-primary)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>

          {materias.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Cuando agregues materias aparecerán aquí para editarlas o
              eliminarlas.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {materias.map((materia) => (
                <div
                  key={materia.id}
                  className="rounded-xl p-3 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: materia.color }}
                      />
                      <p className="font-bold truncate">{materia.nombre}</p>
                    </div>

                    <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                      {materia.sesiones.length} bloque
                      {materia.sesiones.length === 1 ? "" : "s"}
                      {materia.profesor ? ` · ${materia.profesor}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editarMateria(materia)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-80"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      <Pencil size={16} />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarMateria(materia.id)}
                      className="rounded-lg px-3 py-2 hover:opacity-80"
                      style={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        color: "#f87171",
                      }}
                      aria-label="Eliminar materia"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {mounted &&
          modalMateriaAbierto &&
          createPortal(modalMateria, document.body)}

        {mounted &&
          modalPersonalizacionAbierto &&
          createPortal(modalPersonalizacion, document.body)}
      </div>
    </LayoutGeneral>
  );
}