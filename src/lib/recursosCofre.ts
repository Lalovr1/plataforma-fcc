import {
  obtenerUrlImagenOptimizada,
  precargarImagenes,
} from "@/lib/imagenes";

export const FRAMES_COFRE_FCC = [
  "/ui/cofre/frame1.webp",
  "/ui/cofre/frame2.webp",
  "/ui/cofre/frame3.webp",
  "/ui/cofre/frame4.webp",
  "/ui/cofre/frame5.webp",
];

type RecompensaConImagen = {
  imagen?: string | null;
};

export function obtenerRecursosCofreFCC(
  recompensas: RecompensaConImagen[]
) {
  return [
    ...FRAMES_COFRE_FCC,
    ...recompensas.map((recompensa) =>
      obtenerUrlImagenOptimizada(
        recompensa.imagen || "/ui/trophy-default.svg",
        256,
        75
      )
    ),
  ];
}

export function prepararRecursosCofreFCC(
  recompensas: RecompensaConImagen[],
  timeoutMs = 30_000
) {
  return precargarImagenes(
    obtenerRecursosCofreFCC(recompensas),
    timeoutMs
  );
}
