"use client";

/**
 * Mapa curricular interactivo para Ingeniería en Ciencias de la Computación 2017.
 * Permite visualizar, marcar avance, elegir optativas y descargar el mapa.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/utils/supabaseClient";

type EstadoMateria = "pendiente" | "cursando" | "cursada";
type MarcaCursada = "verde" | "rayado" | "check";
type MarcaCursando = "borde" | "pulso" | "etiqueta";
type AreaMateria =
  | "basicas"
  | "computacion"
  | "tecnologia"
  | "formacion"
  | "optativa"
  | "desit"
  | "proyecto";

type MateriaMapa = {
  id: string;
  nombre: string;
  semestre: number;
  fila: number;
  area: AreaMateria;
  creditos?: number;
  clave?: string;
  placeholder?: "optativa1" | "optativa2" | "desit";
};

type DatosMapa = {
  estados: Record<string, EstadoMateria>;
  optativas: {
    optativa1: string;
    optativa2: string;
    desit: string;
  };
  preferencias: {
    marcaCursada: MarcaCursada;
    marcaCursando: MarcaCursando;
    colorCursada: string;
  };
};

type MapaCurricularICCProps = {
  modo?: "vista" | "editor";
  carreraNombre?: string | null;
  className?: string;
};

const MAPA_STORAGE_KEY = "fcc-academy-mapa-curricular-icc-2017-v1";
const DB_MAPA_TABLE = "mapas_curriculares_usuario";

const ESTADOS: EstadoMateria[] = ["pendiente", "cursando", "cursada"];

const CREDITOS_MINIMOS = 281;
const CREDITOS_MAXIMOS = 287;
const LIMITE_MATERIAS_CURSANDO = 6;

const datosBase: DatosMapa = {
  estados: {},
  optativas: {
    optativa1: "",
    optativa2: "",
    desit: "",
  },
  preferencias: {
    marcaCursada: "verde",
    marcaCursando: "borde",
    colorCursada: "#16a34a",
  },
};

const prerequisitos: Record<string, string[]> = {
  "calculo-diferencial": ["matematicas"],
  "fisica-i": ["matematicas"],
  "algebra-lineal": ["algebra-superior"],
  "calculo-integral": ["calculo-diferencial"],
  "fisica-ii": ["fisica-i"],
  "matematicas-discretas": ["matematicas"],
  "ecuaciones-diferenciales": ["calculo-integral"],
  "circuitos-electricos": ["fisica-ii"],
  "programacion-i": ["metodologia-programacion"],
  "programacion-ii": ["programacion-i"],
  ensamblador: ["programacion-i"],
  graficacion: ["programacion-ii"],
  "estructuras-datos": ["programacion-ii"],
  "probabilidad-estadistica": ["ecuaciones-diferenciales"],
  "circuitos-electronicos": ["circuitos-electricos"],
  "diseno-digital": ["circuitos-electronicos"],
  "sistemas-operativos-i": ["estructuras-datos"],
  "analisis-diseno-algoritmos": ["estructuras-datos"],
  "ingenieria-software": ["estructuras-datos"],
  "modelos-redes": ["probabilidad-estadistica"],
  "bases-datos-ingenieria": ["estructuras-datos"],
  "sistemas-operativos-ii": ["sistemas-operativos-i"],
  "redes-inalambricas": ["modelos-redes"],
  "mineria-datos": ["bases-datos-ingenieria"],
  "arquitectura-computadoras": ["diseno-digital"],
  "programacion-concurrente-paralela": ["analisis-diseno-algoritmos"],
  "desarrollo-aplicaciones-web": ["ingenieria-software"],
  "teoria-control": ["modelos-redes"],
  "administracion-redes": ["redes-inalambricas"],
  "tecnicas-ia": ["analisis-diseno-algoritmos"],
  "programacion-distribuida-aplicada": ["programacion-concurrente-paralela"],
  "desarrollo-aplicaciones-moviles": ["desarrollo-aplicaciones-web"],
  "sistemas-empotrados": ["arquitectura-computadoras"],
  "intercomunicacion-seguridad-redes": ["administracion-redes"],
  "servicio-social": ["programacion-distribuida-aplicada"],
  "practica-profesional": ["servicio-social"],
  "lengua-extranjera-ii": ["lengua-extranjera-i"],
  "lengua-extranjera-iii": ["lengua-extranjera-ii"],
  "lengua-extranjera-iv": ["lengua-extranjera-iii"],
  "optativa-i": ["desarrollo-aplicaciones-web"],
  "optativa-ii": ["optativa-i"],
  "optativa-desit": ["tecnicas-ia"],
  "proyecto-id": ["optativa-ii", "practica-profesional"],
};

const optativas = {
  optativa1: [
    "Métodos Numéricos",
    "Lógica Matemática",
    "Máquinas de Aprendizaje",
    "Lenguajes de Programación",
    "Ingeniería de Software Avanzada",
    "Interacción Humano Computadora",
    "Procesamiento Digital de Imágenes",
    "Introducción a los Compiladores",
    "Tratamiento de la Información",
    "Recuperación de la Información",
    "Simulación",
    "Cómputo Ubicuo",
  ],
  optativa2: [
    "Arquitectura Avanzada de Computadoras",
    "Investigación de Operaciones",
    "Súper Cómputo",
    "Sistemas Interactivos Modernos",
    "Web Semántico",
    "Almacenamiento de Datos",
    "Control Digital",
    "Robótica Aplicada",
    "Reconocimiento de Patrones",
    "Sistemas de Tiempo Real",
    "Visión y Animación por Computadora",
  ],
  desit: [
    "Animación por Computadora",
    "Aplicaciones Multimedia",
    "Aplicaciones Web",
  ],
};

const prerequisitoOptativa2: Partial<Record<string, string>> = {
  "Investigación de Operaciones": "Métodos Numéricos",
  "Súper Cómputo": "Lenguajes de Programación",
  "Sistemas Interactivos Modernos": "Lenguajes de Programación",
  "Web Semántico": "Minería de Datos",
  "Almacenamiento de Datos": "Minería de Datos",
  "Visión y Animación por Computadora": "Procesamiento Digital de Imágenes",
};

function optativas2Compatibles(optativa1: string) {
  if (!optativa1) return optativas.optativa2;

  return optativas.optativa2.filter((nombre) => {
    const prerequisito = prerequisitoOptativa2[nombre];

    return !prerequisito || prerequisito === optativa1;
  });
}

function optativa1NecesariaPara(optativa2: string) {
  return prerequisitoOptativa2[optativa2] ?? "";
}

function optativas1CompatiblesConOptativa2(optativa2: string) {
  const necesaria = optativa1NecesariaPara(optativa2);

  if (!necesaria) return optativas.optativa1;

  return optativas.optativa1.filter((nombre) => nombre === necesaria);
}

const materiasICC: MateriaMapa[] = [
  { id: "matematicas", nombre: "Matemáticas", semestre: 1, fila: 1, area: "basicas", creditos: 6 },
  { id: "algebra-superior", nombre: "Álgebra Superior", semestre: 1, fila: 2, area: "basicas", creditos: 6 },
  { id: "metodologia-programacion", nombre: "Metodología de la Programación", semestre: 1, fila: 5, area: "computacion", creditos: 4 },
  { id: "lengua-extranjera-i", nombre: "Lengua Extranjera I", semestre: 1, fila: 9, area: "formacion", creditos: 4 },
  { id: "formacion-humana-social", nombre: "Formación Humana y Social", semestre: 1, fila: 10, area: "formacion", creditos: 4 },

  { id: "calculo-diferencial", nombre: "Cálculo Diferencial", semestre: 2, fila: 1, area: "basicas", creditos: 6 },
  { id: "fisica-i", nombre: "Física I", semestre: 2, fila: 2, area: "basicas", creditos: 6 },
  { id: "algebra-lineal", nombre: "Álgebra Lineal con Elementos en Geo. An.", semestre: 2, fila: 3, area: "basicas", creditos: 6 },
  { id: "programacion-i", nombre: "Programación I", semestre: 2, fila: 5, area: "computacion", creditos: 6 },
  { id: "lengua-extranjera-ii", nombre: "Lengua Extranjera II", semestre: 2, fila: 9, area: "formacion", creditos: 4 },
  { id: "dhpc", nombre: "DHPC", semestre: 2, fila: 10, area: "formacion", creditos: 4 },

  { id: "calculo-integral", nombre: "Cálculo Integral", semestre: 3, fila: 1, area: "basicas", creditos: 6 },
  { id: "fisica-ii", nombre: "Física II", semestre: 3, fila: 2, area: "basicas", creditos: 6 },
  { id: "matematicas-discretas", nombre: "Matemáticas Discretas", semestre: 3, fila: 3, area: "basicas", creditos: 6 },
  { id: "programacion-ii", nombre: "Programación II", semestre: 3, fila: 5, area: "computacion", creditos: 6 },
  { id: "ensamblador", nombre: "Ensamblador", semestre: 3, fila: 6, area: "computacion", creditos: 6 },
  { id: "lengua-extranjera-iii", nombre: "Lengua Extranjera III", semestre: 3, fila: 9, area: "formacion", creditos: 4 },

  { id: "ecuaciones-diferenciales", nombre: "Ecuaciones Diferenciales", semestre: 4, fila: 1, area: "basicas", creditos: 6 },
  { id: "circuitos-electricos", nombre: "Circuitos Eléctricos", semestre: 4, fila: 2, area: "computacion", creditos: 6 },
  { id: "graficacion", nombre: "Graficación", semestre: 4, fila: 5, area: "tecnologia", creditos: 6 },
  { id: "estructuras-datos", nombre: "Estructuras de Datos", semestre: 4, fila: 6, area: "computacion", creditos: 6 },
  { id: "lengua-extranjera-iv", nombre: "Lengua Extranjera IV", semestre: 4, fila: 9, area: "formacion", creditos: 4 },

  { id: "probabilidad-estadistica", nombre: "Probab. y Estadística", semestre: 5, fila: 1, area: "basicas", creditos: 6 },
  { id: "circuitos-electronicos", nombre: "Circuitos Electrónicos", semestre: 5, fila: 2, area: "computacion", creditos: 6 },
  { id: "sistemas-operativos-i", nombre: "Sistemas Operativos I", semestre: 5, fila: 5, area: "computacion", creditos: 6 },
  { id: "analisis-diseno-algoritmos", nombre: "Análisis y Diseño de Algoritmos", semestre: 5, fila: 6, area: "computacion", creditos: 6 },
  { id: "ingenieria-software", nombre: "Ingeniería de Software", semestre: 5, fila: 7, area: "computacion", creditos: 6 },

  { id: "modelos-redes", nombre: "Modelos de Redes", semestre: 6, fila: 1, area: "tecnologia", creditos: 6 },
  { id: "diseno-digital", nombre: "Diseño Digital", semestre: 6, fila: 2, area: "computacion", creditos: 6 },
  { id: "bases-datos-ingenieria", nombre: "Bases de Datos para Ingeniería", semestre: 6, fila: 3, area: "tecnologia", creditos: 6 },
  { id: "sistemas-operativos-ii", nombre: "Sistemas Operativos II", semestre: 6, fila: 5, area: "computacion", creditos: 6 },

  { id: "redes-inalambricas", nombre: "Redes Inalámbricas", semestre: 7, fila: 1, area: "tecnologia", creditos: 6 },
  { id: "mineria-datos", nombre: "Minería de Datos", semestre: 7, fila: 2, area: "tecnologia", creditos: 6 },
  { id: "arquitectura-computadoras", nombre: "Arquitectura de Comp.", semestre: 7, fila: 3, area: "computacion", creditos: 6 },
  { id: "programacion-concurrente-paralela", nombre: "Programación Concurrente y Paralela", semestre: 7, fila: 6, area: "computacion", creditos: 6 },
  { id: "desarrollo-aplicaciones-web", nombre: "Desarrollo de Aplicaciones Web", semestre: 7, fila: 7, area: "tecnologia", creditos: 6 },

  { id: "teoria-control", nombre: "Teoría de Control", semestre: 8, fila: 1, area: "computacion", creditos: 6 },
  { id: "administracion-redes", nombre: "Administración de Redes", semestre: 8, fila: 2, area: "tecnologia", creditos: 6 },
  { id: "tecnicas-ia", nombre: "Técnicas de Inteligencia Artificial", semestre: 8, fila: 5, area: "computacion", creditos: 6 },
  { id: "programacion-distribuida-aplicada", nombre: "Programación Distribuida Aplicada", semestre: 8, fila: 6, area: "computacion", creditos: 6 },
  { id: "desarrollo-aplicaciones-moviles", nombre: "Desarrollo de Aplicaciones Móviles", semestre: 8, fila: 7, area: "computacion", creditos: 6 },

  { id: "sistemas-empotrados", nombre: "Sistemas Empotrados", semestre: 9, fila: 3, area: "computacion", creditos: 6 },
  { id: "servicio-social", nombre: "Servicio Social", semestre: 9, fila: 6, area: "computacion", creditos: 10 },
  { id: "optativa-i", nombre: "Optativa I", semestre: 9, fila: 8, area: "optativa", creditos: 6, placeholder: "optativa1" },

  { id: "intercomunicacion-seguridad-redes", nombre: "Intercomun. y Seguridad en Redes", semestre: 10, fila: 2, area: "tecnologia", creditos: 6 },
  { id: "practica-profesional", nombre: "Práctica Profesional", semestre: 10, fila: 6, area: "computacion", creditos: 5 },
  { id: "optativa-ii", nombre: "Optativa II", semestre: 10, fila: 8, area: "optativa", creditos: 6, placeholder: "optativa2" },
  { id: "optativa-desit", nombre: "Optativa DESIT", semestre: 10, fila: 4, area: "desit", creditos: 5, placeholder: "desit" },
  { id: "proyecto-id", nombre: "Proyecto I + D I", semestre: 10, fila: 9, area: "proyecto", creditos: 5 },
];

function crearDatosBase(): DatosMapa {
  return {
    estados: {},
    optativas: {
      optativa1: "",
      optativa2: "",
      desit: "",
    },
    preferencias: {
      marcaCursada: "verde",
      marcaCursando: "borde",
      colorCursada: "#16a34a",
    },
  };
}

function normalizarDatosMapa(raw: any): DatosMapa {
  if (!raw) return crearDatosBase();

  let parsed = raw;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return crearDatosBase();
    }
  }

  if (parsed?.datos) return normalizarDatosMapa(parsed.datos);

  return {
    estados:
      parsed?.estados && typeof parsed.estados === "object"
        ? parsed.estados
        : {},
    optativas: {
      ...datosBase.optativas,
      ...(parsed?.optativas ?? {}),
    },
    preferencias: {
      ...datosBase.preferencias,
      ...(parsed?.preferencias ?? {}),
      marcaCursada:
        parsed?.preferencias?.marcaCursada === "diagonal" ||
        parsed?.preferencias?.marcaCursada === "sello" ||
        parsed?.preferencias?.marcaCursada === "sombreado"
          ? "verde"
          : parsed?.preferencias?.marcaCursada ?? datosBase.preferencias.marcaCursada,
      colorCursada:
        typeof parsed?.preferencias?.colorCursada === "string" && parsed.preferencias.colorCursada
          ? parsed.preferencias.colorCursada
          : datosBase.preferencias.colorCursada,
    },
  };
}

function obtenerMapaInicialRapido() {
  if (typeof window === "undefined") return crearDatosBase();

  try {
    const guardado = localStorage.getItem(MAPA_STORAGE_KEY);

    if (guardado) {
      return normalizarDatosMapa(guardado);
    }
  } catch {
    try {
      localStorage.removeItem(MAPA_STORAGE_KEY);
    } catch {
      // No hacemos nada: solo evitamos que falle el primer render.
    }
  }

  return crearDatosBase();
}

function siguienteEstado(estado: EstadoMateria) {
  const index = ESTADOS.indexOf(estado);
  return ESTADOS[(index + 1) % ESTADOS.length];
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

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function nombreMateria(materia: MateriaMapa, datos: DatosMapa) {
  if (!materia.placeholder) return materia.nombre;

  const elegida = datos.optativas[materia.placeholder];

  return elegida || materia.nombre;
}

function claseLargoNombre(nombre: string) {
  if (nombre.length >= 34) return "is-very-long";
  if (nombre.length >= 24) return "is-long";

  return "";
}

function creditosMateria(materia: MateriaMapa) {
  return materia.creditos ?? 0;
}

function claseEstado(estado: EstadoMateria) {
  if (estado === "cursada") return "is-done";
  if (estado === "cursando") return "is-current";

  return "";
}

function etiquetaEstado(estado: EstadoMateria) {
  if (estado === "cursada") return "Cursada";
  if (estado === "cursando") return "Cursando";

  return "Pendiente";
}

export default function MapaCurricularICC({
  modo = "vista",
  carreraNombre,
  className = "",
}: MapaCurricularICCProps) {
  const carreraNormalizada = (carreraNombre ?? "").toLowerCase();
  const carreraCompatible =
    !carreraNombre ||
    carreraNormalizada.includes("ciencias de la computación") ||
    carreraNormalizada.includes("ciencias de la computacion");

  const [datos, setDatos] = useState<DatosMapa>(() => obtenerMapaInicialRapido());
  const [userId, setUserId] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const editable = modo === "editor";

  useEffect(() => {
    let activo = true;

    async function cargarMapa() {
      try {
        const guardado = localStorage.getItem(MAPA_STORAGE_KEY);

        if (guardado) {
          setDatos(normalizarDatosMapa(guardado));
        }
      } catch {
        localStorage.removeItem(MAPA_STORAGE_KEY);
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!activo) return;

        setUserId(user?.id ?? null);

        if (user?.id) {
          const { data, error } = await supabase
            .from(DB_MAPA_TABLE)
            .select("datos")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!activo) return;

          if (!error && data?.datos) {
            setDatos(normalizarDatosMapa(data.datos));
            localStorage.setItem(MAPA_STORAGE_KEY, JSON.stringify(data.datos));
          } else if (error) {
            console.warn("No se pudo cargar mapa curricular:", error);
          }
        }
      } catch (error) {
        console.warn("No se pudo consultar el mapa curricular:", error);
      } finally {
        if (activo) setCargado(true);
      }
    }

    cargarMapa();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const descargar = () => {
      descargarMapa();
    };

    window.addEventListener("solicitarDescargaMapaCurricular", descargar);

    return () => {
      window.removeEventListener("solicitarDescargaMapaCurricular", descargar);
    };
  });

  useEffect(() => {
    if (!mensaje) return;

    const timeout = window.setTimeout(() => {
      setMensaje("");
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [mensaje]);

  useEffect(() => {
    if (!cargado || !editable) return;

    const datosMapa = datos;

    localStorage.setItem(MAPA_STORAGE_KEY, JSON.stringify(datosMapa));

    if (!userId) return;

    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.from(DB_MAPA_TABLE).upsert(
        {
          user_id: userId,
          datos: datosMapa,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.warn("No se pudo guardar mapa curricular:", error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [cargado, editable, userId, datos]);

  const conteo = useMemo(() => {
    const total = materiasICC.length;
    const cursadas = materiasICC.filter(
      (materia) => datos.estados[materia.id] === "cursada"
    );
    const cursando = materiasICC.filter(
      (materia) => datos.estados[materia.id] === "cursando"
    );
    const creditosCursados = cursadas.reduce(
      (totalCreditos, materia) => totalCreditos + creditosMateria(materia),
      0
    );
    const creditosCursando = cursando.reduce(
      (totalCreditos, materia) => totalCreditos + creditosMateria(materia),
      0
    );
    const porcentaje = Math.min(
      100,
      Math.round((creditosCursados / CREDITOS_MINIMOS) * 100)
    );

    return {
      total,
      cursadas: cursadas.length,
      cursando: cursando.length,
      creditosCursados,
      creditosCursando,
      porcentaje,
    };
  }, [datos.estados]);

  const recomendadas = useMemo(() => {
    return materiasICC
      .filter((materia) => {
        const estado = datos.estados[materia.id] ?? "pendiente";

        return estado === "pendiente" && prerequisitosCumplidos(materia.id);
      })
      .sort((a, b) => {
        if (a.semestre !== b.semestre) return a.semestre - b.semestre;

        return a.fila - b.fila;
      })
      .slice(0, LIMITE_MATERIAS_CURSANDO);
  }, [datos.estados]);

  const recomendadasIds = useMemo(
    () => new Set(recomendadas.map((materia) => materia.id)),
    [recomendadas]
  );

  const optativaCurricularDesbloqueada =
    editable && prerequisitosCumplidos("optativa-i");

  const optativaDesitDesbloqueada =
    editable && prerequisitosCumplidos("optativa-desit");

  const optativaCurricularPendiente =
    optativaCurricularDesbloqueada &&
    (!datos.optativas.optativa2 || !datos.optativas.optativa1);

  const optativaDesitPendiente =
    optativaDesitDesbloqueada && !datos.optativas.desit;

  const mostrarPanelOptativas =
    optativaCurricularPendiente || optativaDesitPendiente;

  const opcionesOptativa2 = optativas2Compatibles(datos.optativas.optativa1);
  const opcionesOptativa1Compatibles = optativas1CompatiblesConOptativa2(
    datos.optativas.optativa2,
  );

  function prerequisitosCumplidos(id: string, estados = datos.estados) {
    return (prerequisitos[id] ?? []).every(
      (prerequisito) => estados[prerequisito] === "cursada"
    );
  }

  function nombresPrerequisitosPendientes(id: string, estados = datos.estados) {
    return (prerequisitos[id] ?? [])
      .filter((prerequisito) => estados[prerequisito] !== "cursada")
      .map((prerequisito) => {
        const materia = materiasICC.find((item) => item.id === prerequisito);

        return materia?.nombre ?? prerequisito;
      });
  }

  function dependientesActivos(id: string, estados = datos.estados) {
    return materiasICC.filter((materia) => {
      const estado = estados[materia.id];

      if (estado !== "cursando" && estado !== "cursada") return false;

      return (prerequisitos[materia.id] ?? []).includes(id);
    });
  }

  function cambiarEstadoMateria(id: string) {
    if (!editable) return;

    setDatos((actual) => {
      const estadoActual = actual.estados[id] ?? "pendiente";
      const siguiente = siguienteEstado(estadoActual);

      if (
        (estadoActual === "cursada" || estadoActual === "cursando") &&
        siguiente === "pendiente"
      ) {
        const bloquean = dependientesActivos(id, actual.estados);

        if (bloquean.length > 0) {
          setMensaje(
            `Primero desmarca: ${bloquean
              .slice(0, 2)
              .map((materia) => materia.nombre)
              .join(", ")}.`
          );
          return actual;
        }
      }

      if (estadoActual === "pendiente" && siguiente === "cursando") {
        const pendientes = nombresPrerequisitosPendientes(id, actual.estados);

        if (pendientes.length > 0) {
          setMensaje(`Primero debes cursar: ${pendientes.slice(0, 2).join(", ")}.`);
          return actual;
        }

        const cursandoActuales = materiasICC.filter(
          (materia) => actual.estados[materia.id] === "cursando"
        ).length;

        if (cursandoActuales >= LIMITE_MATERIAS_CURSANDO) {
          setMensaje("Solo puedes marcar hasta 6 materias como cursando.");
          return actual;
        }
      }

      return {
        ...actual,
        estados: {
          ...actual.estados,
          [id]: siguiente,
        },
      };
    });
  }

  function cambiarOptativa(
    key: keyof DatosMapa["optativas"],
    value: string
  ) {
    setDatos((actual) => {
      const siguientes = {
        ...actual.optativas,
        [key]: value,
      };

      if (key === "optativa2") {
        const compatibles = optativas1CompatiblesConOptativa2(value);

        if (
          siguientes.optativa1 &&
          value &&
          !compatibles.includes(siguientes.optativa1)
        ) {
          siguientes.optativa1 = "";
        }

        if (value) {
          const necesaria = optativa1NecesariaPara(value);

          setMensaje(
            necesaria
              ? `Para esa Optativa II necesitas elegir ${necesaria} como Optativa I.`
              : "Esta Optativa II no exige una Optativa I específica."
          );
        }
      }

      if (
        key === "optativa1" &&
        siguientes.optativa2 &&
        !optativas2Compatibles(value).includes(siguientes.optativa2)
      ) {
        setMensaje("Esa Optativa I no es compatible con la Optativa II elegida.");
        return actual;
      }

      return {
        ...actual,
        optativas: siguientes,
      };
    });
  }

  function cambiarPreferencia<K extends keyof DatosMapa["preferencias"]>(
    key: K,
    value: DatosMapa["preferencias"][K]
  ) {
    setDatos((actual) => ({
      ...actual,
      preferencias: {
        ...actual.preferencias,
        [key]: value,
      },
    }));
  }

  async function descargarMapa() {
    if (!carreraCompatible) return;

    const scale = 2;
    const width = 1800;
    const margen = 54;
    const header = 112;
    const leftArea = 178;
    const colW = (width - margen * 2 - leftArea) / 10;
    const rowH = 88;
    const startX = margen + leftArea;
    const startY = header + 60;
    const mapX = margen;
    const mapY = startY - 54;
    const mapW = width - margen * 2;
    const mapH = rowH * 10 + 66;
    const height = Math.ceil(mapY + mapH + 26);

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);

    const fondo = ctx.createLinearGradient(0, 0, width, height);
    fondo.addColorStop(0, "#ecfdf5");
    fondo.addColorStop(0.46, "#ffffff");
    fondo.addColorStop(1, "#eff6ff");
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, width, height);

    const logo = await cargarImagen(obtenerLogoActual());

    if (logo) {
      const maxLogoW = 132;
      const maxLogoH = 86;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      ctx.drawImage(logo, 36, 14, logo.width * ratio, logo.height * ratio);
    }

    ctx.fillStyle = "#0f2f29";
    ctx.font = "bold 38px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MAPA CURRICULAR", width / 2, 48);

    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(
      "INGENIERÍA EN CIENCIAS DE LA COMPUTACIÓN 2017",
      width / 2,
      80,
    );

    ctx.shadowColor = "rgba(15, 23, 42, 0.10)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    roundedRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(20, 184, 166, 0.28)";
    ctx.lineWidth = 2;
    roundedRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.stroke();

    ctx.save();
    roundedRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.clip();

    const gridTop = startY - 44;
    const gridBottom = startY + rowH * 10;

    ctx.strokeStyle = "rgba(20, 184, 166, 0.16)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 10; i += 1) {
      const x = startX + i * colW;

      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridBottom);
      ctx.stroke();

      if (i < 10) {
        ctx.fillStyle = "#356f65";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), x + colW / 2, startY - 18);
      }
    }

    ctx.fillStyle = "#356f65";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Semestre", margen + leftArea / 2, startY - 18);

    function dibujarTextoMultilinea(
      texto: string,
      x: number,
      y: number,
      maxWidth: number,
      lineHeight: number,
      maxLines: number,
      font: string,
      color: string,
    ) {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = texto.split(" ");
      const lines: string[] = [];
      let line = "";

      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;

        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });

      if (line) lines.push(line);

      const visible = lines.slice(0, maxLines);
      const totalH = (visible.length - 1) * lineHeight;

      visible.forEach((value, index) => {
        ctx.fillText(value, x, y - totalH / 2 + index * lineHeight);
      });

      ctx.textBaseline = "alphabetic";
    }

    function dibujarArea(
      label: string,
      row: number,
      span: number,
      bgTop: string,
      bgBottom: string,
      border: string,
      color: string,
      fontSize = 22,
    ) {
      const x = margen + 14;
      const y = startY + (row - 1) * rowH + 4;
      const w = leftArea - 30;
      const h = span * rowH - 12;
      const grad = ctx.createLinearGradient(x, y, x, y + h);

      grad.addColorStop(0, bgTop);
      grad.addColorStop(1, bgBottom);

      ctx.fillStyle = grad;
      roundedRect(ctx, x, y, w, h, 17);
      ctx.fill();

      ctx.strokeStyle = border;
      ctx.lineWidth = 2.4;
      roundedRect(ctx, x, y, w, h, 17);
      ctx.stroke();

      dibujarTextoMultilinea(
        label,
        x + w / 2,
        y + h / 2,
        w - 20,
        fontSize + 2,
        4,
        `bold ${fontSize}px system-ui, sans-serif`,
        color,
      );
    }

    function rectMateria(materia: MateriaMapa) {
      const x = startX + (materia.semestre - 1) * colW + 8;
      const y = startY + (materia.fila - 1) * rowH;
      const w = colW - 16;
      const h = 62;

      return { x, y, w, h };
    }

    dibujarArea("Ciencias Básicas", 1, 3, "#edffd3", "#dbf99f", "#8dbb46", "#4f6f1f", 23);
    dibujarArea("Ingeniería en Computación", 4, 3, "#dbeafe", "#a7c7fb", "#4f86c6", "#24456d", 20);
    dibujarArea("Tecnología", 7, 2, "#f1e9ff", "#cab2f0", "#7e62a8", "#6b3fa0", 19);
    dibujarArea("Formación General Universitaria", 9, 2, "#fffbd1", "#fff176", "#c8bc45", "#6b5f08", 20);

    const rectsMaterias = new Map(
      materiasICC.map((materia) => [materia.id, rectMateria(materia)]),
    );

    materiasICC.forEach((materia) => {
      const { x, y, w, h } = rectMateria(materia);
      const estado = datos.estados[materia.id] ?? "pendiente";
      const bloqueada = estado === "pendiente" && !prerequisitosCumplidos(materia.id);
      const colorCursada = datos.preferencias.colorCursada || "#16a34a";

      ctx.save();

      if (bloqueada) {
        const gradLocked = ctx.createLinearGradient(x, y, x, y + h);
        gradLocked.addColorStop(0, "#f1f5f9");
        gradLocked.addColorStop(1, "#d6dadd");

        ctx.globalAlpha = 0.86;
        ctx.fillStyle = gradLocked;
        roundedRect(ctx, x, y, w, h, 12);
        ctx.fill();

        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "#a8adb4";
        ctx.lineWidth = 2.4;
        roundedRect(ctx, x, y, w, h, 12);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, colorArea(materia.area, "bg"));
        grad.addColorStop(1, colorArea(materia.area, "bar"));

        ctx.fillStyle = grad;
        roundedRect(ctx, x, y, w, h, 12);
        ctx.fill();

        ctx.strokeStyle =
          estado === "cursada"
            ? colorCursada
            : estado === "cursando"
              ? "#2563eb"
              : colorArea(materia.area, "border");
        ctx.lineWidth = estado === "pendiente" ? 2 : 4;
        roundedRect(ctx, x, y, w, h, 12);
        ctx.stroke();
      }

      if (estado === "cursada" && datos.preferencias.marcaCursada !== "check") {
        ctx.globalAlpha = 1;
        ctx.fillStyle = colorCursada;
        roundedRect(ctx, x, y, w, h, 12);
        ctx.fill();

        if (datos.preferencias.marcaCursada === "rayado") {
          ctx.save();
          roundedRect(ctx, x, y, w, h, 12);
          ctx.clip();
          ctx.strokeStyle = "rgba(255,255,255,0.36)";
          ctx.lineWidth = 6;

          for (let offset = -h; offset < w + h; offset += 12) {
            ctx.beginPath();
            ctx.moveTo(x + offset, y + h);
            ctx.lineTo(x + offset + h, y);
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      ctx.textAlign = "center";

      if (estado === "cursada" && datos.preferencias.marcaCursada !== "check") {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("CURSADA", x + w / 2, y + h / 2 + 4);
      } else {
        ctx.fillStyle = bloqueada ? "#8b929a" : "#0f172a";
        ctx.font = "bold 12px system-ui, sans-serif";
        wrapCanvasText(ctx, nombreMateria(materia, datos), x + w / 2, y + 22, w - 14, 13, 2);
      }

      if (estado === "cursando") {
        ctx.fillStyle = "#2563eb";
        roundedRect(ctx, x, y + h - 14, w, 14, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText("CURSANDO", x + w / 2, y + h - 4);
      } else if (materia.creditos && !(estado === "cursada" && datos.preferencias.marcaCursada !== "check")) {
        ctx.fillStyle = bloqueada ? "#c4c7ca" : colorArea(materia.area, "bar");
        roundedRect(ctx, x, y + h - 14, w, 14, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText(`${materia.creditos} créditos`, x + w / 2, y + h - 4);
      }

      if (estado === "cursada" && datos.preferencias.marcaCursada === "check") {
        ctx.fillStyle = colorCursada;
        ctx.beginPath();
        ctx.arc(x + w - 14, y + 14, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillText("✓", x + w - 14, y + 18);
      }

      ctx.restore();
    });

    ctx.restore();

    const link = document.createElement("a");
    link.download = "mapa-curricular-fcc-academy.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (!carreraCompatible) {
    return (
      <div className={`curriculum-tool ${className}`}>
        <div className="curriculum-unavailable">
          <strong>Mapa curricular en preparación</strong>
          <span>
            Por ahora esta herramienta está disponible para Ingeniería en
            Ciencias de la Computación 2017.
          </span>
        </div>
        <EstilosMapa />
      </div>
    );
  }

  return (
    <div
      className={`curriculum-tool ${modo === "editor" ? "is-editor" : "is-preview"} ${className}`}
      style={{
        ["--curriculum-done-color" as keyof CSSProperties]: datos.preferencias.colorCursada,
      } as CSSProperties}
    >
      <div className="curriculum-toolbar">
        <div className="curriculum-heading-line">
          {modo === "editor" && <h2>Mapa curricular</h2>}
          <p className="curriculum-eyebrow">Ingeniería en Ciencias de la Computación 2017</p>
        </div>

        <div className="curriculum-progress">
          <span>{conteo.cursadas}/{conteo.total} cursadas</span>
          <span>{conteo.creditosCursados}/{CREDITOS_MINIMOS} créditos</span>
          <strong>{conteo.porcentaje}%</strong>
        </div>
      </div>

      <div className="curriculum-layout">
        {editable && (
          <aside className="curriculum-settings">
            <section>
              <h3>Materia cursada</h3>

              <div className="curriculum-options">
                {[
                  { key: "verde", label: "Color sólido" },
                  { key: "rayado", label: "Rayado" },
                  { key: "check", label: "Check" },
                ].map((opcion) => (
                  <button
                    key={opcion.key}
                    type="button"
                    onClick={() =>
                      cambiarPreferencia("marcaCursada", opcion.key as MarcaCursada)
                    }
                    className={
                      datos.preferencias.marcaCursada === opcion.key
                        ? "is-active"
                        : ""
                    }
                  >
                    {opcion.label}
                  </button>
                ))}
              </div>

              <label>
                <span>Color</span>
                <div className="curriculum-color-row">
                  <input
                    type="color"
                    value={datos.preferencias.colorCursada}
                    onChange={(e) =>
                      cambiarPreferencia("colorCursada", e.target.value)
                    }
                    aria-label="Color para marcar materias cursadas"
                  />
                  <strong>Cambiar color</strong>
                </div>
              </label>
            </section>

            {recomendadas.length > 0 && (
              <section>
                <h3>Siguiente recomendado</h3>

                <div className="curriculum-recommendations-list">
                  {recomendadas.map((materia) => (
                    <span key={materia.id}>{nombreMateria(materia, datos)}</span>
                  ))}
                </div>
              </section>
            )}

            {mostrarPanelOptativas && (
              <section className="is-optative-alert">
                {optativaCurricularPendiente ? (
                  <>
                    <h3>Plan de optativas</h3>
                    <p>
                      Primero elige la Optativa II que te interesa. Después se
                      mostrarán solo las Optativas I compatibles.
                    </p>

                    <label>
                      <span>Optativa II que te interesa</span>
                      <select
                        value={datos.optativas.optativa2}
                        onChange={(e) =>
                          cambiarOptativa("optativa2", e.target.value)
                        }
                      >
                        <option value="">Sin seleccionar</option>
                        {optativas.optativa2.map((nombre) => (
                          <option key={nombre} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    {datos.optativas.optativa2 && (
                      <>
                        <div className="curriculum-optative-note">
                          {optativa1NecesariaPara(datos.optativas.optativa2)
                            ? `Para esa opción necesitas: ${optativa1NecesariaPara(
                                datos.optativas.optativa2,
                              )}.`
                            : "Esta opción no exige una Optativa I específica."}
                        </div>

                        <label>
                          <span>Optativa I compatible</span>
                          <select
                            value={datos.optativas.optativa1}
                            onChange={(e) =>
                              cambiarOptativa("optativa1", e.target.value)
                            }
                          >
                            <option value="">Sin seleccionar</option>
                            {opcionesOptativa1Compatibles.map((nombre) => (
                              <option key={nombre} value={nombre}>
                                {nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h3>Optativa DESIT</h3>
                    <p>Selecciona la optativa complementaria que vas a tomar.</p>

                    <label>
                      <span>Optativa DESIT</span>
                      <select
                        value={datos.optativas.desit}
                        onChange={(e) =>
                          cambiarOptativa("desit", e.target.value)
                        }
                      >
                        <option value="">Sin seleccionar</option>
                        {optativas.desit.map((nombre) => (
                          <option key={nombre} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </section>
            )}
          </aside>
        )}

        <div className="curriculum-map-shell">
          <div className="curriculum-periods">
            <span>Semestre</span>
            {Array.from({ length: 10 }, (_, index) => (
              <strong key={index}>{index + 1}</strong>
            ))}
          </div>

          <div className="curriculum-map">
            <div className="curriculum-area area-basic">Ciencias Básicas</div>
            <div className="curriculum-area area-computing">Ingeniería en Computación</div>
            <div className="curriculum-area area-tech">Tecnología</div>
            <div className="curriculum-area area-general">Formación General Universitaria</div>

            {materiasICC.map((materia) => {
              const estado = datos.estados[materia.id] ?? "pendiente";
              const label = nombreMateria(materia, datos);
              const bloqueada =
                estado === "pendiente" && !prerequisitosCumplidos(materia.id);
              const recomendada = recomendadasIds.has(materia.id);

              return (
                <button
                  key={materia.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => cambiarEstadoMateria(materia.id)}
                  className={`curriculum-subject area-${materia.area} ${claseEstado(estado)} ${claseLargoNombre(label)} ${
                    bloqueada ? "is-locked" : ""
                  } ${recomendada ? "is-recommended" : ""} mark-${datos.preferencias.marcaCursada}`}
                  style={{
                    gridColumn: materia.semestre + 1,
                    gridRow: materia.fila,
                    ["--subject-done-color" as keyof CSSProperties]:
                      datos.preferencias.colorCursada,
                  } as CSSProperties}
                  title={`${label} · ${etiquetaEstado(estado)}${
                    bloqueada ? " · requiere prerrequisitos" : ""
                  }`}
                >
                  <strong>{label}</strong>
                  <small>
                    {estado === "cursando"
                      ? "CURSANDO"
                      : materia.creditos
                      ? `${materia.creditos} créditos`
                      : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mensaje && (
        <div className="curriculum-floating-toast" role="status">
          {mensaje}
        </div>
      )}

      <EstilosMapa />
    </div>
  );
}

function colorArea(area: AreaMateria, parte: "bg" | "border" | "bar") {
  const colores: Record<AreaMateria, Record<"bg" | "border" | "bar", string>> = {
    basicas: { bg: "#e7f7c9", border: "#8dbb46", bar: "#689f38" },
    computacion: { bg: "#dbeafe", border: "#4f86c6", bar: "#3b82c4" },
    tecnologia: { bg: "#eee3ff", border: "#7e62a8", bar: "#6b4c91" },
    formacion: { bg: "#fff8b5", border: "#c8bc45", bar: "#d6c72f" },
    optativa: { bg: "#f8fafc", border: "#4f86c6", bar: "#3b82c4" },
    desit: { bg: "#fed7aa", border: "#fb923c", bar: "#f97316" },
    proyecto: { bg: "#fed7aa", border: "#fb923c", bar: "#f97316" },
  };

  return colores[area][parte];
}

function roundedRect(
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = texto.split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });

  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((value, index) => {
    ctx.fillText(value, x, y + index * lineHeight);
  });
}

function EstilosMapa() {
  return (
    <style>{`
      .curriculum-tool {
        min-height: 0;
        color: var(--fcc-premium-text);
      }

      .curriculum-loading,
      .curriculum-unavailable {
        min-height: 260px;
        display: grid;
        place-items: center;
        text-align: center;
        border-radius: 24px;
        padding: 24px;
        color: var(--fcc-premium-muted);
        background: color-mix(in srgb, var(--fcc-premium-surface-strong) 84%, transparent);
        border: 1px dashed color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
        font-weight: 900;
      }

      .curriculum-unavailable {
        gap: 8px;
      }

      .curriculum-unavailable strong {
        color: var(--fcc-premium-text);
        font-size: 1.08rem;
        font-weight: 950;
      }

      .curriculum-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 10px;
      }

      .curriculum-heading-line {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 10px;
        min-width: 0;
      }

      .curriculum-eyebrow {
        margin: 0;
        color: var(--fcc-premium-accent);
        font-size: clamp(0.62rem, 0.9vw, 0.78rem);
        font-weight: 950;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }

      .curriculum-toolbar h2 {
        margin: 0;
        color: var(--fcc-premium-text);
        font-size: clamp(1.35rem, 2vw, 2.15rem);
        font-weight: 950;
        letter-spacing: -0.045em;
        line-height: 1;
      }

      .curriculum-progress {
        display: flex;
        align-items: flex-end;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
      }

      .curriculum-progress span,
      .curriculum-progress strong {
        border-radius: 999px;
        color: var(--fcc-premium-accent);
        background: color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
        font-weight: 900;
      }

      .curriculum-progress span {
        min-height: 28px;
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        font-size: 0.73rem;
        line-height: 1.1;
      }

      .curriculum-progress strong {
        min-width: 72px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        color: #ffffff;
        background: var(--fcc-premium-button);
        border-color: color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent);
        box-shadow: 0 12px 24px color-mix(in srgb, var(--fcc-premium-accent) 16%, transparent);
        font-size: clamp(1.04rem, 1.45vw, 1.28rem);
      }

      .theme-oscuro .curriculum-progress strong {
        color: #050505;
      }

      .curriculum-color-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
      }

      .curriculum-color-row input[type="color"] {
        width: 44px;
        height: 34px;
        flex: 0 0 auto;
        border: 1px solid var(--fcc-premium-border);
        border-radius: 12px;
        padding: 4px;
        background: color-mix(in srgb, var(--fcc-premium-surface-strong) 90%, transparent);
        cursor: pointer;
      }

      .curriculum-color-row strong {
        color: var(--fcc-premium-accent);
        font-size: 0.74rem;
        font-weight: 900;
      }

      .curriculum-recommendations-list {
        display: grid;
        gap: 8px;
      }

      .curriculum-recommendations-list span {
        min-height: 32px;
        display: flex;
        align-items: center;
        text-align: left;
        border-radius: 14px;
        padding: 7px 10px;
        color: var(--fcc-premium-text);
        background: color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, var(--fcc-premium-border));
        font-size: 0.76rem;
        font-weight: 900;
        line-height: 1.15;
      }

      .curriculum-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
        min-height: 0;
      }

      .curriculum-tool.is-editor .curriculum-layout {
        grid-template-columns: 248px minmax(0, 1fr);
        align-items: start;
        column-gap: 22px;
        overflow: hidden;
      }

      .curriculum-settings {
        position: sticky;
        top: 12px;
        z-index: 4;
        width: 248px;
        max-width: 248px;
        display: grid;
        gap: 10px;
        min-width: 0;
        overflow: hidden;
      }

      .curriculum-settings,
      .curriculum-settings * {
        box-sizing: border-box;
      }

      .curriculum-settings section {
        width: 100%;
        min-width: 0;
        overflow: hidden;
        border-radius: 20px;
        padding: 12px;
        background:
          radial-gradient(
            circle at 0% 0%,
            color-mix(in srgb, var(--fcc-premium-accent) 7%, transparent),
            transparent 62%
          ),
          color-mix(in srgb, var(--fcc-premium-surface-strong) 86%, transparent);
        border: 1px solid var(--fcc-premium-border);
      }

      .curriculum-settings h3 {
        margin: 0 0 8px;
        color: var(--fcc-premium-text);
        font-size: 0.96rem;
        font-weight: 950;
      }

      .curriculum-settings p,
      .curriculum-settings label span {
        color: var(--fcc-premium-muted);
        font-size: 0.76rem;
        font-weight: 780;
        line-height: 1.35;
      }

      .curriculum-settings label {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }

      .curriculum-settings select {
        width: 100%;
        min-height: 38px;
        border-radius: 14px;
        padding: 0 10px;
        color: var(--fcc-premium-text);
        background: color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent);
        border: 1px solid var(--fcc-premium-border);
        font-size: 0.78rem;
        font-weight: 850;
        outline: none;
      }

      .curriculum-legend,
      .curriculum-options {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
      }

      .curriculum-legend span,
      .curriculum-options button {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 0 10px;
        color: var(--fcc-premium-muted);
        background: color-mix(in srgb, var(--fcc-premium-surface-soft) 82%, transparent);
        border: 1px solid var(--fcc-premium-border);
        font-size: 0.72rem;
        font-weight: 850;
      }

      .curriculum-options button.is-active {
        color: var(--fcc-premium-accent);
        background: color-mix(in srgb, var(--fcc-premium-accent) 12%, transparent);
        border-color: color-mix(in srgb, var(--fcc-premium-accent) 30%, transparent);
      }

      .curriculum-settings label {
        min-width: 0;
      }

      .curriculum-legend i {
        width: 10px;
        height: 10px;
        border-radius: 999px;
      }

      .curriculum-legend .pending { background: #cbd5e1; }
      .curriculum-legend .current { background: #2563eb; }
      .curriculum-legend .done { background: #16a34a; }

      .curriculum-settings section.is-optative-alert {
        animation: curriculum-optative-pulse 1.7s ease-in-out infinite;
      }

      @keyframes curriculum-optative-pulse {
        0%,
        100% {
          box-shadow:
            0 0 0 0 color-mix(in srgb, var(--fcc-premium-accent) 0%, transparent),
            0 12px 24px rgba(15, 23, 42, 0.04);
        }

        50% {
          box-shadow:
            0 0 0 4px color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent),
            0 16px 28px color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
        }
      }

      .curriculum-optative-note {
        margin-top: 8px;
        border-radius: 14px;
        padding: 9px 10px;
        color: var(--fcc-premium-accent);
        background: color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
        font-size: 0.72rem;
        font-weight: 850;
        line-height: 1.32;
      }

      .curriculum-floating-toast {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 26000;
        max-width: min(420px, calc(100vw - 32px));
        border-radius: 18px;
        padding: 12px 14px;
        color: var(--fcc-premium-text);
        background:
          radial-gradient(
            circle at 0% 0%,
            color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
            transparent 68%
          ),
          color-mix(in srgb, var(--fcc-premium-surface-strong) 94%, transparent);
        border: 1px solid color-mix(in srgb, var(--fcc-premium-accent) 22%, var(--fcc-premium-border));
        box-shadow:
          0 18px 38px rgba(15, 23, 42, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.62);
        font-size: 0.84rem;
        font-weight: 900;
        line-height: 1.34;
        animation: curriculum-toast-in 180ms ease-out;
      }

      @keyframes curriculum-toast-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .curriculum-map-shell {
        position: relative;
        z-index: 1;
        min-width: 0;
        max-width: 100%;
        overflow: auto;
        border-radius: 24px;
        padding: 12px;
        background:
          radial-gradient(
            circle at 8% 0%,
            color-mix(in srgb, var(--fcc-premium-accent) 6%, transparent),
            transparent 34%
          ),
          color-mix(in srgb, var(--fcc-premium-surface-strong) 82%, transparent);
        border: 1px solid var(--fcc-premium-border);
        box-shadow:
          inset 0 1px 0 color-mix(in srgb, var(--fcc-premium-surface-strong) 68%, transparent),
          0 18px 34px rgba(15, 23, 42, 0.06);
      }

      .curriculum-periods {
        display: grid;
        grid-template-columns: 128px repeat(10, minmax(82px, 1fr));
        gap: 7px;
        margin-bottom: 7px;
        align-items: center;
      }

      .curriculum-periods span,
      .curriculum-periods strong {
        color: var(--fcc-premium-muted);
        font-size: 0.74rem;
        font-weight: 900;
        text-align: center;
      }

      .curriculum-map {
        display: grid;
        grid-template-columns: 128px repeat(10, minmax(82px, 1fr));
        grid-template-rows: repeat(10, minmax(50px, 1fr));
        gap: 7px;
        min-height: 560px;
      }

      .curriculum-tool.is-preview {
        min-height: 0;
      }

      .curriculum-tool.is-preview .curriculum-map-shell {
        max-height: min(760px, calc(100dvh - 118px));
      }

      .curriculum-tool.is-preview .curriculum-map {
        min-height: clamp(540px, calc(100dvh - 172px), 690px);
      }

      .curriculum-area {
        display: grid;
        place-items: center;
        border-radius: 16px;
        padding: 10px;
        text-align: center;
        font-size: clamp(0.62rem, 0.92vw, 0.92rem);
        font-weight: 920;
        line-height: 1.15;
        border: 2px solid;
      }

      .area-basic {
        grid-column: 1;
        grid-row: 1 / span 3;
        color: #4f6f1f;
        background: linear-gradient(180deg, #edffd3, #dbf99f);
        border-color: #8dbb46;
      }

      .area-computing {
        grid-column: 1;
        grid-row: 4 / span 3;
        color: #24456d;
        background: linear-gradient(180deg, #dbeafe, #a7c7fb);
        border-color: #4f86c6;
      }

      .area-tech {
        grid-column: 1;
        grid-row: 7 / span 2;
        color: #6b3fa0;
        background: linear-gradient(180deg, #f1e9ff, #cab2f0);
        border-color: #7e62a8;
      }

      .area-general {
        grid-column: 1;
        grid-row: 9 / span 2;
        color: #6b5f08;
        background: linear-gradient(180deg, #fffbd1, #fff176);
        border-color: #c8bc45;
      }

      .curriculum-subject {
        position: relative;
        overflow: hidden;
        border-radius: 13px;
        padding: 6px 5px 15px;
        text-align: center;
        color: #101827;
        background: color-mix(in srgb, var(--fcc-premium-surface-strong) 90%, transparent);
        border: 2px solid var(--fcc-premium-border);
        box-shadow:
          0 8px 16px rgba(15, 23, 42, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.44);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          filter 160ms ease;
      }

      .curriculum-tool.is-editor .curriculum-subject {
        cursor: pointer;
      }

      .curriculum-tool.is-editor .curriculum-subject:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
        box-shadow:
          0 12px 22px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.52);
      }

      .curriculum-subject strong {
        position: relative;
        z-index: 2;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        overflow: hidden;
        font-size: clamp(0.52rem, 0.68vw, 0.74rem);
        font-weight: 820;
        line-height: 1.04;
        text-transform: none;
      }

      .curriculum-subject.is-long strong {
        font-size: clamp(0.48rem, 0.58vw, 0.66rem);
        line-height: 1.02;
      }

      .curriculum-subject.is-very-long strong {
        font-size: clamp(0.43rem, 0.52vw, 0.6rem);
        line-height: 1;
        -webkit-line-clamp: 5;
      }

      .curriculum-subject small {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        min-height: 15px;
        display: grid;
        place-items: center;
        color: #ffffff;
        font-size: clamp(0.48rem, 0.6vw, 0.62rem);
        font-weight: 900;
      }

      .curriculum-subject.area-basicas {
        background: linear-gradient(180deg, #f0ffd7, #dbf99f);
        border-color: #8dbb46;
      }

      .curriculum-subject.area-basicas small { background: #689f38; }

      .curriculum-subject.area-computacion,
      .curriculum-subject.area-optativa {
        background: linear-gradient(180deg, #eaf3ff, #b8d7ff);
        border-color: #4f86c6;
      }

      .curriculum-subject.area-computacion small,
      .curriculum-subject.area-optativa small { background: #3b82c4; }

      .curriculum-subject.area-tecnologia {
        background: linear-gradient(180deg, #f4edff, #d8c6f5);
        border-color: #7e62a8;
      }

      .curriculum-subject.area-tecnologia small { background: #6b4c91; }

      .curriculum-subject.area-formacion {
        background: linear-gradient(180deg, #fffbd1, #fff176);
        border-color: #c8bc45;
      }

      .curriculum-subject.area-formacion small { background: #d6c72f; color: #1f2937; }

      .curriculum-subject.area-desit,
      .curriculum-subject.area-proyecto {
        background: linear-gradient(180deg, #ffedd5, #fdba74);
        border-color: #fb923c;
      }

      .curriculum-subject.area-desit small,
      .curriculum-subject.area-proyecto small { background: #f97316; }

      .curriculum-subject.is-locked {
        opacity: 0.48;
        filter: grayscale(0.76) saturate(0.42);
        border-style: dashed;
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, #e5e7eb 88%, transparent),
            color-mix(in srgb, #cbd5e1 82%, transparent)
          ) !important;
      }

      .curriculum-subject.is-locked small {
        background: #94a3b8 !important;
      }

      .curriculum-tool.is-editor .curriculum-subject.is-locked:hover {
        transform: none;
        box-shadow:
          0 8px 16px rgba(15, 23, 42, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.44);
      }

      .curriculum-subject.is-recommended:not(.is-current):not(.is-done):not(.is-locked) {
        border-color: color-mix(in srgb, var(--fcc-premium-accent) 62%, #16a34a);
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--fcc-premium-accent) 15%, transparent),
          0 14px 26px color-mix(in srgb, var(--fcc-premium-accent) 10%, transparent);
      }

      .curriculum-subject.is-current {
        border-color: #2563eb;
        box-shadow:
          0 0 0 4px color-mix(in srgb, #2563eb 20%, transparent),
          0 14px 28px rgba(37, 99, 235, 0.16);
      }

      .curriculum-subject.is-current small {
        background: #2563eb !important;
        letter-spacing: 0.08em;
        font-size: clamp(0.46rem, 0.58vw, 0.6rem);
      }

      .curriculum-subject.is-done {
        border-color: var(--subject-done-color, var(--curriculum-done-color, #16a34a));
      }

      .curriculum-subject.is-done.mark-verde {
        color: #ffffff;
        background: var(--subject-done-color, var(--curriculum-done-color, #16a34a)) !important;
        box-shadow:
          0 0 0 3px color-mix(
            in srgb,
            var(--subject-done-color, var(--curriculum-done-color, #16a34a)) 18%,
            transparent
          ),
          0 12px 24px color-mix(
            in srgb,
            var(--subject-done-color, var(--curriculum-done-color, #16a34a)) 16%,
            transparent
          );
      }

      .curriculum-subject.is-done.mark-verde strong,
      .curriculum-subject.is-done.mark-verde small,
      .curriculum-subject.is-done.mark-rayado strong,
      .curriculum-subject.is-done.mark-rayado small {
        opacity: 0;
      }

      .curriculum-subject.is-done.mark-verde::after,
      .curriculum-subject.is-done.mark-rayado::after {
        content: "CURSADA";
        position: absolute;
        inset: 0;
        z-index: 4;
        display: grid;
        place-items: center;
        color: #ffffff;
        font-size: clamp(0.62rem, 0.8vw, 0.86rem);
        font-weight: 950;
        letter-spacing: 0.08em;
      }

      .curriculum-subject.is-done.mark-rayado {
        color: #ffffff;
        background: var(--subject-done-color, var(--curriculum-done-color, #16a34a)) !important;
        box-shadow:
          0 0 0 3px color-mix(
            in srgb,
            var(--subject-done-color, var(--curriculum-done-color, #16a34a)) 18%,
            transparent
          ),
          0 12px 24px color-mix(
            in srgb,
            var(--subject-done-color, var(--curriculum-done-color, #16a34a)) 16%,
            transparent
          );
      }

      .curriculum-subject.is-done.mark-rayado::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 3;
        background:
          repeating-linear-gradient(
            -35deg,
            color-mix(
              in srgb,
              var(--subject-done-color, var(--curriculum-done-color, #16a34a)) 82%,
              rgba(255, 255, 255, 0.15)
            ) 0 10px,
            rgba(255, 255, 255, 0.22) 10px 15px
          );
        pointer-events: none;
      }

      .curriculum-subject.is-done.mark-check::after {
        content: "✓";
        position: absolute;
        right: 7px;
        top: 6px;
        z-index: 4;
        width: 19px;
        height: 19px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: #ffffff;
        background: #16a34a;
        font-size: 0.86rem;
        font-weight: 950;
        box-shadow: 0 8px 16px rgba(22, 163, 74, 0.22);
      }

      @media (max-width: 1180px) {
        .curriculum-tool.is-editor .curriculum-layout {
          grid-template-columns: 1fr;
        }

        .curriculum-settings {
          position: relative;
          top: auto;
          width: 100%;
          max-width: 100%;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          overflow: visible;
        }
      }

      @media (max-height: 760px) {
        .curriculum-tool.is-preview .curriculum-map-shell {
          max-height: calc(100dvh - 96px);
        }

        .curriculum-tool.is-preview .curriculum-map {
          min-height: clamp(500px, calc(100dvh - 142px), 640px);
        }
      }

      @media (max-width: 760px) {
        .curriculum-toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .curriculum-progress {
          justify-content: flex-start;
        }

        .curriculum-settings {
          grid-template-columns: 1fr;
          width: 100%;
          max-width: 100%;
        }

        .curriculum-periods,
        .curriculum-map {
          grid-template-columns: 86px repeat(10, minmax(50px, 1fr));
          gap: 5px;
        }

        .curriculum-map {
          min-height: 520px;
        }

        .curriculum-area {
          border-radius: 12px;
          padding: 6px;
          font-size: 0.62rem;
        }

        .curriculum-subject {
          border-radius: 10px;
          padding: 5px 3px 13px;
        }

        .curriculum-subject strong {
          font-size: 0.46rem;
          -webkit-line-clamp: 3;
        }

        .curriculum-subject small {
          font-size: 0.42rem;
        }
      }
    
        @media (max-width: 640px) {
          .curriculum-tool.is-preview {
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
          }

          .curriculum-tool.is-preview .curriculum-toolbar {
            flex: 0 0 auto;
          }

          .curriculum-tool.is-preview .curriculum-map-shell {
            max-height: min(560px, calc(100dvh - 300px));
            overflow: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            touch-action: pan-x pan-y;
          }

          .curriculum-tool.is-preview .curriculum-periods,
          .curriculum-tool.is-preview .curriculum-map {
            min-width: 1030px;
          }

          .curriculum-tool.is-preview .curriculum-map {
            min-height: 640px;
          }
        }

`}</style>
  );
}
