export type Rareza = "comun" | "raro" | "epico" | "legendario";

export const rarezaConfig: Record<Rareza, {
  probabilidad: number;
  color: string;
  aura: string;
}> = {
  comun: {
    probabilidad: 0.4,
    color: "#44bd32",
    aura: "rgba(68, 189, 50, 0.45)",
  },
  raro: {
    probabilidad: 0.3,
    color: "#0097e6",
    aura: "rgba(0, 151, 230, 0.5)",
  },
  epico: {
    probabilidad: 0.2,
    color: "#8c7ae6",
    aura: "rgba(140, 122, 230, 0.6)",
  },
  legendario: {
    probabilidad: 0.1,
    color: "#fbc531",
    aura: "rgba(251, 197, 49, 0.65)",
  },
};
