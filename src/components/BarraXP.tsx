/**
 * Barra de experiencia del usuario.
 * Muestra el nivel actual y el progreso hacia el siguiente.
 */

interface BarraXPProps {
  xp?: number;
}

export default function BarraXP({ xp = 0 }: BarraXPProps) {
  const level = Math.floor(xp / 1000);
  const currentXP = xp % 1000;
  const progress = xp === 0 ? 0 : (currentXP / 1000) * 100;
  const xpToNextLevel = 1000 - currentXP;

  return (
    <div>
      <h3 className="font-bold mb-2" style={{ color: "var(--color-heading)" }}>
        Experiencia
      </h3>
      <p className="text-sm mb-2" style={{ color: "var(--color-muted)" }}>
        Nivel {level}
      </p>

      <div
        className="w-full h-4 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-border)" }}
      >
        <div
          className="h-4 transition-all"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--color-accent)",
          }}
        />
      </div>

      <p className="text-sm mt-2" style={{ color: "var(--color-muted)" }}>
        Siguiente nivel en{" "}
        <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>
          {xpToNextLevel} XP
        </span>
      </p>
    </div>
  );
}
