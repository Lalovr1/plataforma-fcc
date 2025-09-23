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
    <div className="bg-gray-900 p-4 rounded-xl shadow">
      <h3 className="font-bold mb-2">Experiencia</h3>
      <p className="text-sm text-gray-400 mb-2">Nivel {level}</p>

      <div className="w-full bg-gray-800 h-4 rounded-full overflow-hidden">
        <div
          className="bg-blue-500 h-4 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-gray-400 mt-2">
        Siguiente nivel en{" "}
        <span className="text-blue-400 font-semibold">{xpToNextLevel} XP</span>
      </p>
    </div>
  );
}
