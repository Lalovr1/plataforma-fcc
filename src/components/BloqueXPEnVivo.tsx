"use client";
import { useEffect, useState } from "react";
import BarraXP from "./BarraXP";
import { supabase } from "@/utils/supabaseClient";

export default function BloqueXPEnVivo({ userId, initialXp }: { userId: string; initialXp: number; }) {
  const [xp, setXp] = useState<number>(initialXp ?? 0);

  useEffect(() => {
    let mounted = true;

    async function refrescar() {
      const { data } = await supabase.from("usuarios").select("puntos").eq("id", userId).single();
      if (mounted && data) setXp(data.puntos ?? 0);
    }

    function onXpActualizada() { refrescar(); }

    window.addEventListener("xpActualizada", onXpActualizada);

    const channel = supabase.channel(`xp-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "usuarios", filter: `id=eq.${userId}` }, (payload) => {
        const puntos = (payload.new as any)?.puntos;
        if (typeof puntos === "number") setXp(puntos);
      })
      .subscribe();

    refrescar();

    return () => {
      mounted = false;
      window.removeEventListener("xpActualizada", onXpActualizada);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <BarraXP xp={xp} />;
}
