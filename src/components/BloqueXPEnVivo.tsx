"use client";
import { useEffect, useState } from "react";
import BarraXP from "./BarraXP";
import { supabase } from "@/utils/supabaseClient";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";

export default function BloqueXPEnVivo({ userId, initialXp }: { userId: string; initialXp: number; }) {
  const [xp, setXp] = useState<number>(initialXp ?? 0);
  const [confirmado, setConfirmado] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let mounted = true;
    setErrorCarga(false);
    setConfirmado(false);

    async function refrescar() {
      const { data, error } = await supabase
        .from("usuarios")
        .select("puntos")
        .eq("id", userId)
        .single();

      if (!mounted) return;

      if (error || !data) {
        setErrorCarga(true);
        setConfirmado(false);
        return;
      }

      setXp(data.puntos ?? 0);
      setErrorCarga(false);
      setConfirmado(true);
    }

    function onXpActualizada() { refrescar(); }

    window.addEventListener("xpActualizada", onXpActualizada);

    const channel = supabase.channel(`xp-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "usuarios", filter: `id=eq.${userId}` }, (payload) => {
        const puntos = (payload.new as any)?.puntos;
        if (typeof puntos === "number") {
          setXp(puntos);
          setErrorCarga(false);
          setConfirmado(true);
        }
      })
      .subscribe();

    refrescar();

    return () => {
      mounted = false;
      window.removeEventListener("xpActualizada", onXpActualizada);
      supabase.removeChannel(channel);
    };
  }, [userId, reintento]);

  if (!confirmado && !errorCarga) {
    return <CargadorFCC compacto mensaje="Confirmando experiencia" />;
  }

  if (errorCarga) {
    return (
      <EstadoErrorCargaFCC
        compacto
        titulo="No se pudo confirmar tu experiencia"
        detalle="El valor anterior se mantuvo oculto para evitar un salto incorrecto."
        onRetry={() => setReintento((valor) => valor + 1)}
      />
    );
  }

  return <BarraXP xp={xp} />;
}
