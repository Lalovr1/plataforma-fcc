/**
 * GridLogros.tsx
 * Muestra solo los iconos de logros; al pasar el mouse aparece
 * un recuadro flotante con el nombre y la descripción.
 * Si el logro está bloqueado, se pinta un candado semitransparente encima.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CargadorFCC from "@/components/CargadorFCC";
import {
  obtenerUrlImagenOptimizada,
  precargarImagenes,
} from "@/lib/imagenes";

interface Logro {
  id: string;
  titulo: string;
  descripcion?: string;
  icono_url?: string | null;
  desbloqueado: boolean;
}

type TooltipState = {
  titulo: string;
  descripcion: string;
  x: number;
  y: number;
};

const prepararIconoLogro = (src?: string | null) =>
  obtenerUrlImagenOptimizada(src || "/ui/trophy-default.svg", 256, 75);

async function esperarImagenLogroDOM(img: HTMLImageElement) {
  if (!img.complete) {
    await new Promise<void>((resolve) => {
      const terminar = () => {
        limpiar();
        resolve();
      };
      const limpiar = () => {
        img.removeEventListener("load", terminar);
        img.removeEventListener("error", terminar);
      };

      img.addEventListener("load", terminar, { once: true });
      img.addEventListener("error", terminar, { once: true });
    });
  }

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      // naturalWidth/naturalHeight siguen siendo la comprobacion final.
    }
  }
}

function siguienteFrameLogros() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export default function GridLogros({
  logros,
  onReady,
}: {
  logros: Logro[];
  onReady?: () => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [imagenesListas, setImagenesListas] = useState(false);
  const [usarIconoRespaldo, setUsarIconoRespaldo] = useState(false);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const fuentesIconos = useMemo(
    () =>
      Array.from(
        new Set(
          (logros ?? []).map(
            (logro) => prepararIconoLogro(logro.icono_url)
          )
        )
      ),
    [logros]
  );
  const claveIconos = fuentesIconos.join("|");

  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }

    setTooltip(null);
  };

  useEffect(() => {
    const cerrarTooltip = () => {
      hideTooltip();
    };

    window.addEventListener("scroll", cerrarTooltip, true);
    window.addEventListener("wheel", cerrarTooltip, { passive: true });
    window.addEventListener("touchmove", cerrarTooltip, { passive: true });
    window.addEventListener("resize", cerrarTooltip);

    return () => {
      window.removeEventListener("scroll", cerrarTooltip, true);
      window.removeEventListener("wheel", cerrarTooltip);
      window.removeEventListener("touchmove", cerrarTooltip);
      window.removeEventListener("resize", cerrarTooltip);

      if (tooltipTimeoutRef.current) {
        window.clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let activo = true;

    if (fuentesIconos.length === 0) {
      setImagenesListas(true);
      setUsarIconoRespaldo(false);
      return;
    }

    setImagenesListas(false);
    setUsarIconoRespaldo(false);

    void precargarImagenes(
      [...fuentesIconos, prepararIconoLogro(null)],
      20_000
    ).then((completo) => {
      if (!activo) return;

      setUsarIconoRespaldo(!completo);
      setImagenesListas(true);
    });

    return () => {
      activo = false;
    };
  }, [claveIconos]);

  useEffect(() => {
    if (!imagenesListas) return;

    let activo = true;

    const confirmarDOM = async () => {
      await siguienteFrameLogros();

      const imagenes = Array.from(
        gridRef.current?.querySelectorAll<HTMLImageElement>("img") ?? []
      );

      await Promise.all(
        imagenes.map((img) => esperarImagenLogroDOM(img))
      );
      await siguienteFrameLogros();

      if (activo) {
        onReadyRef.current?.();
      }
    };

    void confirmarDOM();

    return () => {
      activo = false;
    };
  }, [imagenesListas, claveIconos, usarIconoRespaldo]);

  if (!logros || logros.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        No hay logros para mostrar.
      </p>
    );
  }

  if (!imagenesListas) {
    return <CargadorFCC compacto mensaje="Preparando logros" />;
  }

  const showTooltip = (logro: Logro, element: HTMLElement) => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }

    const rect = element.getBoundingClientRect();

    const tooltipWidth = 220;
    const margin = 12;

    const rawX = rect.left + rect.width / 2;
    const safeX = Math.min(
      Math.max(rawX, tooltipWidth / 2 + margin),
      window.innerWidth - tooltipWidth / 2 - margin
    );

    const rawY = rect.top - 10;
    const safeY = Math.max(rawY, 12);

    setTooltip({
      titulo: logro.titulo,
      descripcion: logro.descripcion ?? "",
      x: safeX,
      y: safeY,
    });
  };

  const showTooltipOnTouch = (logro: Logro, element: HTMLElement) => {
    showTooltip(logro, element);

    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltip(null);
      tooltipTimeoutRef.current = null;
    }, 2600);
  };

  return (
    <>
      <div
        ref={gridRef}
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-visible min-w-0"
      >
        {logros.map((l) => (
          <div
            key={`${l.id}-${l.desbloqueado ? "on" : "off"}`}
            className="p-2 rounded-lg text-center shadow relative transition hover:scale-105"
            onMouseEnter={(e) => showTooltip(l, e.currentTarget)}
            onMouseLeave={hideTooltip}
            onFocus={(e) => showTooltip(l, e.currentTarget)}
            onBlur={hideTooltip}
            onTouchStart={(e) => showTooltipOnTouch(l, e.currentTarget)}
            style={{
              backgroundColor: "var(--color-card)",
              opacity: l.desbloqueado ? 1 : 0.6,
              filter: l.desbloqueado ? "none" : "grayscale(100%)",
              border: l.desbloqueado
                ? "2px solid var(--color-accent)"
                : "1px solid var(--color-border)",
              width: "clamp(76px, 24vw, 90px)",
              height: "clamp(76px, 24vw, 90px)",
              margin: "auto",
            }}
            tabIndex={0}
          >
            {/* Imagen */}
            <div className="flex items-center justify-center w-full h-full">
              <img
                src={
                  usarIconoRespaldo
                    ? prepararIconoLogro(null)
                    : prepararIconoLogro(l.icono_url)
                }
                alt={l.titulo}
                decoding="async"
                className="w-[70px] h-[70px] sm:w-[82px] sm:h-[82px] object-contain transition-transform duration-200"
              />
            </div>

            {/* Overlay de candado para bloqueados */}
            {!l.desbloqueado && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-full h-full rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.18)",
                    borderRadius: "8px",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-white opacity-90"
                    fill="currentColor"
                  >
                    <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {tooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed w-[220px] p-2 rounded-lg shadow-lg pointer-events-none text-center"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              zIndex: 10050,
            }}
          >
            <p
              className="font-semibold mb-1 text-sm"
              style={{ color: "var(--color-heading)" }}
            >
              {tooltip.titulo}
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              {tooltip.descripcion}
            </p>
          </div>,
          document.body
        )}
    </>
  );
}
