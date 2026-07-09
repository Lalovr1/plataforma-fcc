export type Tema =
  | "claro"
  | "blanco"
  | "oscuro"
  | "gris"
  | "esmeralda"
  | "morado"
  | "indigo"
  | "rojo"
  | "rosa";

export type TipoTema = "base" | "variante";

export type TemaConfig = {
  id: Tema;
  nombre: string;
  descripcion: string;
  tipo: TipoTema;
  previewBg: string;
  previewAccent: string;
  previewSoft: string;
  previewText: string;
};

export const TEMA_PREDETERMINADO: Tema = "claro";

export const TEMAS_DISPONIBLES: TemaConfig[] = [
  {
    id: "claro",
    nombre: "Azul",
    descripcion: "El color principal de FCC Academy.",
    tipo: "base",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #f4f8ff 52%, #eaf6ff 100%)",
    previewAccent: "#2563eb",
    previewSoft: "#dbeafe",
    previewText: "#10213f",
  },
  {
    id: "blanco",
    nombre: "Blanco",
    descripcion: "Una versión clara, limpia y más neutral.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #f1f5f9 100%)",
    previewAccent: "#2563eb",
    previewSoft: "#e2e8f0",
    previewText: "#111827",
  },
  {
    id: "oscuro",
    nombre: "Negro",
    descripcion: "Una versión oscura con contraste más fuerte.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #020617 0%, #050505 58%, #111827 100%)",
    previewAccent: "#f8fafc",
    previewSoft: "#1f2937",
    previewText: "#ffffff",
  },
  {
    id: "gris",
    nombre: "Gris",
    descripcion: "Una variante neutral, sobria y profesional.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #e2e8f0 100%)",
    previewAccent: "#475569",
    previewSoft: "#e2e8f0",
    previewText: "#111827",
  },
  {
    id: "esmeralda",
    nombre: "Esmeralda",
    descripcion: "Una variante fresca y equilibrada.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #f0fdf9 52%, #ccfbf1 100%)",
    previewAccent: "#059669",
    previewSoft: "#ccfbf1",
    previewText: "#06251f",
  },
  {
    id: "morado",
    nombre: "Morado",
    descripcion: "Una variante moderna y académica.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #faf5ff 52%, #ede9fe 100%)",
    previewAccent: "#7c3aed",
    previewSoft: "#ede9fe",
    previewText: "#251044",
  },
  {
    id: "indigo",
    nombre: "Índigo",
    descripcion: "Una variante tecnológica y sobria.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #eef2ff 52%, #dbeafe 100%)",
    previewAccent: "#4f46e5",
    previewSoft: "#e0e7ff",
    previewText: "#111947",
  },
  {
    id: "rojo",
    nombre: "Rojo",
    descripcion: "Una variante intensa y fuerte.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #fff5f5 52%, #fee2e2 100%)",
    previewAccent: "#dc2626",
    previewSoft: "#fee2e2",
    previewText: "#230f0f",
  },
  {
    id: "rosa",
    nombre: "Rosa",
    descripcion: "Una variante suave y cálida.",
    tipo: "variante",
    previewBg:
      "linear-gradient(135deg, #ffffff 0%, #fff5fb 52%, #ffe4f2 100%)",
    previewAccent: "#d9468f",
    previewSoft: "#fce7f3",
    previewText: "#261326",
  },
];

export const TEMAS_VALIDOS: Tema[] = TEMAS_DISPONIBLES.map((tema) => tema.id);

export const CLASES_TEMA = TEMAS_VALIDOS.map((tema) => `theme-${tema}`);

export function esTemaValido(valor: unknown): valor is Tema {
  return typeof valor === "string" && TEMAS_VALIDOS.includes(valor as Tema);
}

export function normalizarTema(valor: unknown): Tema | null {
  if (esTemaValido(valor)) return valor;
  return null;
}

export function obtenerTemaConfig(tema: Tema): TemaConfig {
  return (
    TEMAS_DISPONIBLES.find((temaItem) => temaItem.id === tema) ??
    TEMAS_DISPONIBLES[0]
  );
}