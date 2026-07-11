"use client";

/**
 * Vista rápida del horario académico del estudiante.
 * Carga el horario guardado, lo muestra en el modal y permite descargarlo.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

type Dia = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";
type ModoRango = "inteligente" | "compacto" | "personalizado";
type IntensidadColor = "suave" | "media" | "fuerte";

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

type OpcionesVista = {
  profesor: boolean;
  salon: boolean;
  nrc: boolean;
};


const HORARIO_STORAGE_KEY = "fcc-academy-mi-horario-v5";
const HORARIO_STORAGE_KEYS = [
  HORARIO_STORAGE_KEY,
  "fcc-academy-mi-horario-v4",
  "fcc-academy-mi-horario-v3",
  "fcc-academy-mi-horario",
];
const DB_HORARIO_TABLE = "horarios_usuario";
const HORA_MINIMA = 7;
const HORA_MAXIMA = 22;
const DIAS_VISIBLES_PREDETERMINADOS: Dia[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
];

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

const DIAS: { id: Dia; label: string; corto: string }[] = [
  { id: "lunes", label: "Lunes", corto: "Lun" },
  { id: "martes", label: "Martes", corto: "Mar" },
  { id: "miercoles", label: "Miércoles", corto: "Mié" },
  { id: "jueves", label: "Jueves", corto: "Jue" },
  { id: "viernes", label: "Viernes", corto: "Vie" },
  { id: "sabado", label: "Sábado", corto: "Sáb" },
];

const opcionesBase: OpcionesVista = {
  profesor: true,
  salon: true,
  nrc: false,
};


function minutosDesdeHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return 0;

  return h * 60 + m;
}

function etiquetaHora(hora: number) {
  return `${String(hora).padStart(2, "0")}:00`;
}

function rangoHoras(inicio: number, fin: number) {
  return Array.from(
    { length: Math.max(1, fin - inicio) },
    (_, index) => inicio + index,
  );
}

function hexConAlpha(hex: string, alpha: number) {
  const limpio = hex.replace("#", "");

  if (limpio.length !== 6) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ajustarHex(hex: string, porcentaje: number) {
  const limpio = hex.replace("#", "");

  if (limpio.length !== 6) return "#93c5fd";

  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) return "#93c5fd";

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
    suavidad.arriba,
  )} 0%, ${ajustarHex(hex, suavidad.centro)} 58%, ${ajustarHex(
    hex,
    suavidad.abajo,
  )} 100%)`;
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

function textoCortadoCanvas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxWidth: number,
) {
  if (ctx.measureText(texto).width <= maxWidth) return texto;

  let resultado = texto;

  while (resultado.length > 0 && ctx.measureText(`${resultado}…`).width > maxWidth) {
    resultado = resultado.slice(0, -1);
  }

  return `${resultado}…`;
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

function cargarImagenCanvas(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = src;
  });
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
        Math.floor(Math.max(finAnterior, finActual) / 60),
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
  agrupar: boolean,
) {
  return materias.map((materia) => ({
    ...materia,
    sesiones: agrupar
      ? agruparSesionesContinuas(materia.sesiones ?? [])
      : separarSesionesPorHora(materia.sesiones ?? []),
  }));
}

function colorTextoSeguro(hex: string) {
  const limpio = hex.replace("#", "");

  if (limpio.length !== 6) return "#ffffff";

  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) return "#ffffff";

  const brillo = (r * 299 + g * 587 + b * 114) / 1000;
  return brillo > 145 ? "#08111f" : "#ffffff";
}

function obtenerRangoInteligente(sesiones: SesionHorario[]) {
  if (sesiones.length === 0) {
    return { inicio: 7, fin: 14 };
  }

  const inicio = Math.min(...sesiones.map((s) => minutosDesdeHora(s.inicio)));
  const fin = Math.max(...sesiones.map((s) => minutosDesdeHora(s.fin)));

  const rangoClases = {
    inicio: Math.max(HORA_MINIMA, Math.floor(inicio / 60)),
    fin: Math.min(HORA_MAXIMA, Math.ceil(fin / 60)),
  };

  const duracion = rangoClases.fin - rangoClases.inicio;

  if (duracion <= 2 && rangoClases.inicio < 12) {
    return { inicio: 7, fin: 14 };
  }

  if (duracion <= 2 && rangoClases.inicio >= 14) {
    return { inicio: 14, fin: 21 };
  }

  if (duracion < 6) {
    const faltante = 6 - duracion;
    let rangoInicio = rangoClases.inicio - Math.floor(faltante / 2);
    let rangoFin = rangoClases.fin + Math.ceil(faltante / 2);

    if (rangoInicio < HORA_MINIMA) {
      rangoFin += HORA_MINIMA - rangoInicio;
      rangoInicio = HORA_MINIMA;
    }

    if (rangoFin > HORA_MAXIMA) {
      rangoInicio -= rangoFin - HORA_MAXIMA;
      rangoFin = HORA_MAXIMA;
    }

    return {
      inicio: Math.max(HORA_MINIMA, rangoInicio),
      fin: Math.min(HORA_MAXIMA, rangoFin),
    };
  }

  return rangoClases;
}

function posicionSesion(sesion: SesionHorario, horasVisibles: number[]) {
  const inicio = Math.floor(minutosDesdeHora(sesion.inicio) / 60);
  const fin = Math.ceil(minutosDesdeHora(sesion.fin) / 60);
  const rowIndex = horasVisibles.findIndex((hora) => hora === inicio);
  const span = horasVisibles.filter(
    (hora) => hora >= inicio && hora < fin,
  ).length;

  if (rowIndex < 0 || span <= 0) return null;

  return {
    rowStart: rowIndex + 2,
    span,
  };
}

function detallesMateria(
  materia: MateriaHorario,
  sesion: SesionHorario,
  opcionesVista: OpcionesVista,
) {
  const detalles = [];

  if (opcionesVista.salon && sesion.salon) {
    detalles.push(`Salón ${sesion.salon}`);
  }

  const profesor =
    opcionesVista.profesor && materia.profesor ? materia.profesor : "";

  const nrc = opcionesVista.nrc && materia.nrc ? `NRC ${materia.nrc}` : "";

  if (profesor && nrc) {
    detalles.push(`${profesor} · ${nrc}`);
  } else if (profesor) {
    detalles.push(profesor);
  } else if (nrc) {
    detalles.push(nrc);
  }

  return detalles;
}

export default function HorarioVistaRapida({
  initialHorarioDatos,
}: {
  initialHorarioDatos?: unknown | null;
}) {
  function obtenerHorarioInicialRapido() {
    const inicial = normalizarDatosHorario(initialHorarioDatos);

    if (Array.isArray(inicial?.materias) && inicial.materias.length > 0) {
      return inicial;
    }

    if (typeof window === "undefined") return inicial;

    try {
      const llaves = new Set(HORARIO_STORAGE_KEYS);

      for (let index = 0; index < localStorage.length; index += 1) {
        const llave = localStorage.key(index);

        if (llave?.toLowerCase().includes("horario")) {
          llaves.add(llave);
        }
      }

      for (const llave of llaves) {
        const guardado = localStorage.getItem(llave);
        const parsed = normalizarDatosHorario(guardado);

        if (Array.isArray(parsed?.materias) && parsed.materias.length > 0) {
          if (llave !== HORARIO_STORAGE_KEY) {
            localStorage.setItem(HORARIO_STORAGE_KEY, guardado ?? "");
          }

          return parsed;
        }
      }
    } catch {
      // Si localStorage no está disponible, seguimos con lo que venga de props.
    }

    return inicial;
  }

  const horarioInicial = obtenerHorarioInicialRapido();
  const agruparInicial = horarioInicial?.agruparBloquesContinuos ?? true;
  const materiasIniciales = Array.isArray(horarioInicial?.materias)
    ? horarioInicial.materias
    : [];
  const diasIniciales = Array.isArray(horarioInicial?.diasVisibles)
    ? DIAS.filter((dia) => horarioInicial.diasVisibles.includes(dia.id)).map(
        (dia) => dia.id,
      )
    : DIAS_VISIBLES_PREDETERMINADOS;

  const [materias, setMaterias] = useState<MateriaHorario[]>(() =>
    aplicarModoAgrupacionMaterias(materiasIniciales, agruparInicial),
  );
  const [opcionesVista, setOpcionesVista] = useState<OpcionesVista>(
    horarioInicial?.opcionesVista ?? opcionesBase,
  );
  const [diasVisibles, setDiasVisibles] = useState<Dia[]>(
    diasIniciales.length > 0 ? diasIniciales : DIAS_VISIBLES_PREDETERMINADOS,
  );
  const [intensidadColor, setIntensidadColor] = useState<IntensidadColor>(
    horarioInicial?.intensidadColor ?? "media",
  );
  const [modoRango, setModoRango] = useState<ModoRango>(
    horarioInicial?.modoRango ?? "inteligente",
  );
  const [rangoPersonalizadoInicio, setRangoPersonalizadoInicio] = useState(
    horarioInicial?.rangoPersonalizadoInicio ?? 7,
  );
  const [rangoPersonalizadoFin, setRangoPersonalizadoFin] = useState(
    horarioInicial?.rangoPersonalizadoFin ?? 14,
  );
  const [agruparBloquesContinuos, setAgruparBloquesContinuos] =
    useState(agruparInicial);
  const [confirmarDescarga, setConfirmarDescarga] = useState(false);
  const [cargado, setCargado] = useState(materiasIniciales.length > 0);

  function normalizarDatosHorario(raw: any) {
    if (!raw) return null;

    let parsed = raw;

    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }

    if (parsed?.datos) {
      return normalizarDatosHorario(parsed.datos);
    }

    if (Array.isArray(parsed)) {
      return { materias: parsed };
    }

    if (Array.isArray(parsed?.materias)) {
      return parsed;
    }

    return null;
  }

  function obtenerCantidadMateriasHorario(raw: any) {
    const parsed = normalizarDatosHorario(raw);

    return Array.isArray(parsed?.materias) ? parsed.materias.length : 0;
  }

  function aplicarDatosHorario(
    raw: any,
    opciones?: {
      permitirVacio?: boolean;
    },
  ) {
    const parsed = normalizarDatosHorario(raw);

    if (!parsed) return false;

    const agruparGuardado = parsed.agruparBloquesContinuos ?? true;
    const materiasGuardadas = Array.isArray(parsed.materias)
      ? parsed.materias
      : [];

    if (!opciones?.permitirVacio && materiasGuardadas.length === 0) {
      return false;
    }

    const diasGuardados = Array.isArray(parsed.diasVisibles)
      ? DIAS.filter((dia) => parsed.diasVisibles.includes(dia.id)).map(
          (dia) => dia.id,
        )
      : DIAS_VISIBLES_PREDETERMINADOS;

    setMaterias(
      aplicarModoAgrupacionMaterias(materiasGuardadas, agruparGuardado),
    );
    setOpcionesVista(parsed.opcionesVista ?? opcionesBase);
    setDiasVisibles(
      diasGuardados.length > 0
        ? diasGuardados
        : DIAS_VISIBLES_PREDETERMINADOS,
    );
    setIntensidadColor(parsed.intensidadColor ?? "media");
    setModoRango(parsed.modoRango ?? "inteligente");
    setRangoPersonalizadoInicio(parsed.rangoPersonalizadoInicio ?? 7);
    setRangoPersonalizadoFin(parsed.rangoPersonalizadoFin ?? 14);
    setAgruparBloquesContinuos(agruparGuardado);

    return materiasGuardadas.length > 0;
  }

  function cargarHorarioLocal() {
    const llaves = new Set(HORARIO_STORAGE_KEYS);

    for (let index = 0; index < localStorage.length; index += 1) {
      const llave = localStorage.key(index);

      if (llave?.toLowerCase().includes("horario")) {
        llaves.add(llave);
      }
    }

    for (const llave of llaves) {
      const guardado = localStorage.getItem(llave);

      if (!guardado) continue;

      const tieneMaterias = aplicarDatosHorario(guardado, {
        permitirVacio: false,
      });

      if (tieneMaterias) {
        if (llave !== HORARIO_STORAGE_KEY) {
          localStorage.setItem(HORARIO_STORAGE_KEY, guardado);
        }

        return true;
      }
    }

    return false;
  }

  useEffect(() => {
    let activo = true;

    async function leerHorarioSupabasePorSesion() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn("No se pudo obtener sesión para Mi horario:", sessionError);
      }

      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from(DB_HORARIO_TABLE)
        .select("datos, updated_at")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.warn("No se pudo cargar horario por sesión:", error);
      }

      return data?.datos ?? null;
    }

    async function leerHorarioSupabasePorRls() {
      const { data, error } = await supabase
        .from(DB_HORARIO_TABLE)
        .select("datos, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("No se pudo cargar horario por RLS:", error);
      }

      return data?.datos ?? null;
    }

    async function cargarHorario() {
      let encontroDatos = false;

      if (initialHorarioDatos) {
        const tieneMateriasIniciales = aplicarDatosHorario(initialHorarioDatos, {
          permitirVacio: false,
        });

        if (tieneMateriasIniciales) {
          localStorage.setItem(
            HORARIO_STORAGE_KEY,
            JSON.stringify(initialHorarioDatos),
          );
          encontroDatos = true;

          if (activo) setCargado(true);
        }
      }

      try {
        const datosPorSesion = await leerHorarioSupabasePorSesion();

        if (!activo) return;

        if (datosPorSesion) {
          const tieneMaterias = aplicarDatosHorario(datosPorSesion, {
            permitirVacio: false,
          });

          if (tieneMaterias) {
            localStorage.setItem(
              HORARIO_STORAGE_KEY,
              JSON.stringify(datosPorSesion),
            );
            encontroDatos = true;
          }
        }

        if (!encontroDatos) {
          const datosPorRls = await leerHorarioSupabasePorRls();

          if (!activo) return;

          if (datosPorRls) {
            const tieneMaterias = aplicarDatosHorario(datosPorRls, {
              permitirVacio: false,
            });

            if (tieneMaterias) {
              localStorage.setItem(
                HORARIO_STORAGE_KEY,
                JSON.stringify(datosPorRls),
              );
              encontroDatos = true;
            }
          }
        }
      } catch (error) {
        console.warn("No se pudo consultar Supabase para Mi horario:", error);
      }

      if (!encontroDatos) {
        try {
          encontroDatos = cargarHorarioLocal();
        } catch (error) {
          console.warn("No se pudo cargar horario local:", error);
        }
      }

      if (activo) setCargado(true);
    }

    cargarHorario();

    return () => {
      activo = false;
    };
  }, [initialHorarioDatos]);

  useEffect(() => {
    const refrescar = () => {
      try {
        cargarHorarioLocal();
      } catch (error) {
        console.warn("No se pudo refrescar horario local:", error);
      }
    };

    window.addEventListener("focus", refrescar);
    window.addEventListener("storage", refrescar);
    window.addEventListener("horarioActualizado", refrescar);

    return () => {
      window.removeEventListener("focus", refrescar);
      window.removeEventListener("storage", refrescar);
      window.removeEventListener("horarioActualizado", refrescar);
    };
  }, []);

  useEffect(() => {
    const solicitarDescarga = () => {
      setConfirmarDescarga(true);
    };

    window.addEventListener("solicitarDescargaHorario", solicitarDescarga);

    return () => {
      window.removeEventListener("solicitarDescargaHorario", solicitarDescarga);
    };
  }, []);

  const diasMostrados = useMemo(() => {
    const filtrados = DIAS.filter((dia) => diasVisibles.includes(dia.id));

    return filtrados.length > 0
      ? filtrados
      : DIAS.filter((dia) => DIAS_VISIBLES_PREDETERMINADOS.includes(dia.id));
  }, [diasVisibles]);

  const sesiones = useMemo(
    () =>
      materias.flatMap((materia) =>
        (materia.sesiones ?? []).filter((sesion) =>
          diasMostrados.some((dia) => dia.id === sesion.dia),
        ),
      ),
    [materias, diasMostrados],
  );

  const horasVisibles = useMemo(() => {
    if (modoRango === "personalizado") {
      const inicio = Math.max(
        HORA_MINIMA,
        Math.min(rangoPersonalizadoInicio, HORA_MAXIMA - 1),
      );
      const fin = Math.max(
        inicio + 1,
        Math.min(rangoPersonalizadoFin, HORA_MAXIMA),
      );

      return rangoHoras(inicio, fin);
    }

    if (modoRango === "compacto" && sesiones.length > 0) {
      const inicio = Math.max(
        HORA_MINIMA,
        Math.floor(Math.min(...sesiones.map((s) => minutosDesdeHora(s.inicio))) / 60),
      );
      const fin = Math.min(
        HORA_MAXIMA,
        Math.ceil(Math.max(...sesiones.map((s) => minutosDesdeHora(s.fin))) / 60),
      );

      return rangoHoras(inicio, Math.max(inicio + 1, fin));
    }

    const rango = obtenerRangoInteligente(sesiones);
    return rangoHoras(rango.inicio, rango.fin);
  }, [
    modoRango,
    rangoPersonalizadoInicio,
    rangoPersonalizadoFin,
    sesiones,
  ]);

  const intensidad = INTENSIDADES_COLOR[intensidadColor];

  async function descargarHorarioRapido() {
    if (materias.length === 0) {
      setConfirmarDescarga(false);
      return;
    }

    const canvas = document.createElement("canvas");
    const scale = 2;
    const width = 1500;
    const margen = 54;
    const header = 92;
    const altoHeaderTabla = 58;
    const altoSlot = 88;
    const altoTabla = altoHeaderTabla + horasVisibles.length * altoSlot;
    const height = header + altoTabla + margen;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.scale(scale, scale);

    const fondo = ctx.createLinearGradient(0, 0, width, height);
    fondo.addColorStop(0, "#f0fdfa");
    fondo.addColorStop(0.58, "#ffffff");
    fondo.addColorStop(1, "#ecfeff");

    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, width, height);

    const logo = await cargarImagenCanvas(obtenerLogoActual());

    if (logo) {
      const maxLogoW = 118;
      const maxLogoH = 76;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const logoW = logo.width * ratio;
      const logoH = logo.height * ratio;

      ctx.drawImage(logo, 34, 8, logoW, logoH);
    }

    ctx.fillStyle = "#06261f";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HORARIO", width / 2, 58);

    const tablaX = margen;
    const tablaY = header;
    const tablaW = width - margen * 2;
    const columnaHora = 122;
    const columnaDia = (tablaW - columnaHora) / diasMostrados.length;
    const radioTabla = 28;

    ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff";
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.fill();

    ctx.shadowColor = "transparent";

    ctx.save();
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.clip();

    ctx.fillStyle = "#f0fdfa";
    ctx.fillRect(tablaX, tablaY, tablaW, altoHeaderTabla);

    const lineaTabla = "rgba(20, 184, 166, 0.18)";

    ctx.strokeStyle = lineaTabla;
    ctx.lineWidth = 1;

    for (let i = 0; i <= horasVisibles.length; i += 1) {
      const y = tablaY + altoHeaderTabla + i * altoSlot;

      ctx.beginPath();
      ctx.moveTo(tablaX, y);
      ctx.lineTo(tablaX + tablaW, y);
      ctx.stroke();
    }

    for (let i = 0; i <= diasMostrados.length; i += 1) {
      const x = tablaX + columnaHora + i * columnaDia;

      ctx.beginPath();
      ctx.moveTo(x, tablaY);
      ctx.lineTo(x, tablaY + altoTabla);
      ctx.stroke();
    }

    ctx.fillStyle = "#0f3b33";
    ctx.font = "bold 23px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hora", tablaX + columnaHora / 2, tablaY + 37);

    diasMostrados.forEach((dia, index) => {
      const x = tablaX + columnaHora + index * columnaDia;

      ctx.fillText(dia.label, x + columnaDia / 2, tablaY + 37);
    });

    ctx.fillStyle = "#2f766a";
    ctx.font = "bold 20px system-ui, sans-serif";

    horasVisibles.forEach((hora, index) => {
      const y = tablaY + altoHeaderTabla + index * altoSlot;

      ctx.fillText(
        etiquetaHora(hora),
        tablaX + columnaHora / 2,
        y + altoSlot / 2 + 7,
      );
    });

    const bloqueMargen = 8;
    const alturasReferenciaBloque = materias.flatMap((materia) =>
      (materia.sesiones ?? [])
        .filter((sesion) => diasMostrados.some((dia) => dia.id === sesion.dia))
        .map((sesion) => {
          const posicion = posicionSesion(sesion, horasVisibles);
          return posicion ? posicion.span * altoSlot - bloqueMargen * 2 : null;
        })
        .filter((alto): alto is number => typeof alto === "number"),
    );

    const altoReferenciaBloque =
      alturasReferenciaBloque.length > 0
        ? Math.max(20, Math.min(...alturasReferenciaBloque))
        : altoSlot - bloqueMargen * 2;

    const detallesReferencia = Math.max(
      1,
      ...materias.flatMap((materia) =>
        (materia.sesiones ?? [])
          .filter((sesion) => diasMostrados.some((dia) => dia.id === sesion.dia))
          .map((sesion) => 1 + detallesMateria(materia, sesion, opcionesVista).length),
      ),
    );

    materias.forEach((materia) => {
      (materia.sesiones ?? []).forEach((sesion) => {
        const diaIndex = diasMostrados.findIndex((dia) => dia.id === sesion.dia);
        const posicion = posicionSesion(sesion, horasVisibles);

        if (diaIndex === -1 || !posicion) return;

        const x = tablaX + columnaHora + diaIndex * columnaDia;
        const y = tablaY + altoHeaderTabla + (posicion.rowStart - 2) * altoSlot;
        const w = columnaDia;
        const h = posicion.span * altoSlot;
        const bloqueX = x + bloqueMargen;
        const bloqueY = y + bloqueMargen;
        const bloqueW = Math.max(20, w - bloqueMargen * 2);
        const bloqueH = Math.max(20, h - bloqueMargen * 2);
        const color = materia.color || "#2563eb";
        const suavidad = suavidadBloque(intensidad.alpha);
        const gradiente = ctx.createLinearGradient(
          bloqueX,
          bloqueY,
          bloqueX,
          bloqueY + bloqueH,
        );

        gradiente.addColorStop(0, ajustarHex(color, suavidad.arriba));
        gradiente.addColorStop(0.58, ajustarHex(color, suavidad.centro));
        gradiente.addColorStop(1, ajustarHex(color, suavidad.abajo));

        ctx.fillStyle = gradiente;
        rectRedondeado(ctx, bloqueX, bloqueY, bloqueW, bloqueH, 18);
        ctx.fill();

        const detalles = detallesMateria(materia, sesion, opcionesVista);
        const lineas = [materia.nombre, ...detalles];
        const lineHeight = Math.max(
          14,
          Math.min(22, Math.floor((altoReferenciaBloque - 22) / detallesReferencia)),
        );
        const tituloSize = Math.min(24, Math.max(16, lineHeight + 2));
        const detalleSize = Math.min(16, Math.max(11, lineHeight - 5));
        const totalAlto = lineHeight * lineas.length;
        let yTexto = bloqueY + bloqueH / 2 - totalAlto / 2 + lineHeight * 0.78;

        ctx.fillStyle = "#08111f";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.shadowColor = "rgba(255, 255, 255, 0.38)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;

        lineas.forEach((linea, index) => {
          ctx.font = `${
            index === 0 ? "bold" : "600"
          } ${index === 0 ? tituloSize : detalleSize}px system-ui, sans-serif`;
          ctx.fillText(
            textoCortadoCanvas(ctx, linea, bloqueW - 22),
            bloqueX + bloqueW / 2,
            yTexto,
          );
          yTexto += lineHeight;
        });

        ctx.shadowColor = "transparent";
      });
    });

    ctx.restore();

    ctx.strokeStyle = "rgba(20, 184, 166, 0.36)";
    ctx.lineWidth = 2;
    rectRedondeado(ctx, tablaX, tablaY, tablaW, altoTabla, radioTabla);
    ctx.stroke();

    const link = document.createElement("a");
    link.download = "horario-fcc-academy.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    setConfirmarDescarga(false);
  }

  if (!cargado) {
    return (
      <div className="fcc-schedule-quick">
        <div className="fcc-schedule-scroll is-loading">
          <div className="fcc-schedule-empty stable">
            <span>Cargando horario...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fcc-schedule-quick">
      <div className="fcc-schedule-scroll">
        <div
          className="fcc-schedule-grid"
          style={{
            gridTemplateColumns: `clamp(42px, 9vw, 76px) repeat(${diasMostrados.length}, minmax(0, 1fr))`,
            gridTemplateRows: `clamp(34px, 7vw, 44px) repeat(${horasVisibles.length}, var(--fcc-schedule-row-height))`,
          }}
        >
          <div
            className="fcc-schedule-cell fcc-schedule-head fcc-schedule-hour-head"
            style={{ gridColumn: 1, gridRow: 1 }}
          >
            Hora
          </div>

          {diasMostrados.map((dia, index) => (
            <div
              key={dia.id}
              className="fcc-schedule-cell fcc-schedule-head fcc-schedule-day-head"
              style={{ gridColumn: index + 2, gridRow: 1 }}
            >
              <span className="fcc-schedule-day-full">{dia.label}</span>
              <span className="fcc-schedule-day-short">{dia.corto}</span>
            </div>
          ))}

          {horasVisibles.map((hora, rowIndex) => (
            <div
              key={`hora-${hora}`}
              className="fcc-schedule-cell fcc-schedule-hour-cell"
              style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
            >
              {etiquetaHora(hora)}
            </div>
          ))}

          {horasVisibles.map((hora, rowIndex) =>
            diasMostrados.map((dia, dayIndex) => (
              <div
                key={`${dia.id}-${hora}`}
                className="fcc-schedule-cell fcc-schedule-base-cell"
                style={{ gridColumn: dayIndex + 2, gridRow: rowIndex + 2 }}
              />
            )),
          )}

          {materias.flatMap((materia) =>
            (materia.sesiones ?? []).map((sesion) => {
              const diaIndex = diasMostrados.findIndex(
                (dia) => dia.id === sesion.dia,
              );
              const posicion = posicionSesion(sesion, horasVisibles);

              if (diaIndex === -1 || !posicion) return null;

              const detalles = detallesMateria(materia, sesion, opcionesVista);
              const color = materia.color || "#2563eb";

              return (
                <div
                  key={`${materia.id}-${sesion.id}`}
                  className={`fcc-schedule-subject ${
                    agruparBloquesContinuos ? "is-grouped" : "is-separated"
                  }`}
                  style={{
                    gridColumn: diaIndex + 2,
                    gridRow: `${posicion.rowStart} / span ${posicion.span}`,
                    background: fondoBloqueHorario(color, intensidad.alpha),
                    color: "#08111f",
                    textShadow: "0 1px 0 rgba(255, 255, 255, 0.38)",
                  }}
                >
                  <strong>{materia.nombre}</strong>

                  {detalles.length > 0 && (
                    <div>
                      {detalles.map((detalle) => (
                        <span key={detalle}>{detalle}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }),
          )}

          {materias.length === 0 && (
            <div className="fcc-schedule-empty-inside">
              <strong>Todavía no tienes materias en tu horario</strong>
              <span>
                Usa Personalizar para agregar tus clases y después volverán a
                aparecer aquí.
              </span>
            </div>
          )}
        </div>
      </div>

      {confirmarDescarga && (
        <div className="fcc-schedule-confirm" role="dialog" aria-modal="true">
          <div className="fcc-schedule-confirm-card">
            <strong>¿Descargar horario?</strong>
            <span>Se guardará una imagen PNG de tu horario actual.</span>

            <div>
              <button type="button" onClick={() => setConfirmarDescarga(false)}>
                Cancelar
              </button>
              <button type="button" onClick={descargarHorarioRapido}>
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


