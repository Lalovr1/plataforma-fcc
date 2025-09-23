/**
 * Círculo de progreso usado en cursos u otras secciones.
 * Muestra el avance como porcentaje dentro de un círculo animado.
 */

interface Props {
  progress: number;
  size?: number;
}

export default function CirculoProgreso({ progress, size = 80 }: Props) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="6"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#3b82f6"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-600">
        {progress}%
      </span>
    </div>
  );
}
