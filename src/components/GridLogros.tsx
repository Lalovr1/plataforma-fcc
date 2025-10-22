/**
 * GridLogros.tsx
 * Muestra solo los iconos de logros; al pasar el mouse aparece
 * un recuadro flotante con el nombre y la descripción.
 * Si el logro está bloqueado, se pinta un candado semitransparente encima.
 */

"use client";

interface Logro {
  id: string;
  titulo: string;
  descripcion?: string;
  icono_url?: string | null;
  desbloqueado: boolean;
}

export default function GridLogros({
  logros,
}: {
  logros: Logro[];
}) {
  if (!logros || logros.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        No hay logros para mostrar.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {logros.map((l) => (
        <div
          key={`${l.id}-${l.desbloqueado ? "on" : "off"}`}
          className="p-2 rounded-lg text-center shadow relative group transition transform hover:scale-105"
          style={{
            backgroundColor: "var(--color-card)",
            opacity: l.desbloqueado ? 1 : 0.6,
            filter: l.desbloqueado ? "none" : "grayscale(100%)",
            border: l.desbloqueado
              ? "2px solid var(--color-accent)"
              : "1px solid var(--color-border)",
            width: "90px",
            height: "90px",
            margin: "auto",
          }}
        >
          {/* Imagen más pequeña */}
          <div className="flex items-center justify-center w-full h-full">
            <img
              src={l.icono_url || "/icons/trophy_default.png"}
              alt={l.titulo}
              className="w-[82px] h-[82px] object-contain transition-transform duration-200 group-hover:scale-110"
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

          {/* Tooltip flotante con nombre y descripción */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none"
            style={{
              backgroundColor: "var(--color-card)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              zIndex: 100,
            }}
          >
            <p
              className="font-semibold mb-1 text-center text-sm"
              style={{ color: "var(--color-heading)" }}
            >
              {l.titulo}
            </p>
            <p
              className="text-xs text-center"
              style={{ color: "var(--color-muted)" }}
            >
              {l.descripcion ?? ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
