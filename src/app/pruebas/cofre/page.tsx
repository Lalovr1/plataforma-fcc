"use client";

import { useState, useEffect } from "react";
import AnimacionCofre from "@/components/AnimacionCofre";
import { obtenerRecompensasAleatorias } from "@/lib/obtenerRecompensas";
import { Rareza } from "@/lib/rarezaConfig";

interface Recompensa {
  nombre: string;
  imagen: string;
  rareza: Rareza;
}

export default function TestCofrePage() {
  const [mostrarCofre, setMostrarCofre] = useState(false);
  const [recompensas, setRecompensas] = useState<Recompensa[] | null>(null);

  useEffect(() => {
    obtenerRecompensasAleatorias("demo-user").then((r) =>
      setRecompensas(r.recompensas)
    );
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a]">
      {!mostrarCofre ? (
        <button
          onClick={() => setMostrarCofre(true)}
          className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 transition-all"
        >
          🎁 Abrir Cofre de Prueba
        </button>
      ) : recompensas ? (
        <AnimacionCofre
          userId="demo-user"
          recompensas={recompensas}
          onFinish={() => console.log("Animación finalizada")}
        />
      ) : (
        <p className="text-white text-lg mt-4">Cargando recompensas...</p>
      )}
    </div>
  );
}
