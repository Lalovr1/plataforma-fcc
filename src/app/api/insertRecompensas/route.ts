import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
      }
    );

    const recompensasIniciales = [
      { user_id: userId, tipo: "cabello", nombre: "Cabello1.png", rareza: "comun" },
      { user_id: userId, tipo: "cabello", nombre: "Cabello2.png", rareza: "comun" },
      { user_id: userId, tipo: "cabello", nombre: "Cabello3.png", rareza: "comun" },
      { user_id: userId, tipo: "cabello", nombre: "Cabello4.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos1.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos2.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos3.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos4.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos5.png", rareza: "comun" },
      { user_id: userId, tipo: "ojos", nombre: "Ojos6.png", rareza: "comun" },
      { user_id: userId, tipo: "nariz", nombre: "Nariz1.png", rareza: "comun" },
      { user_id: userId, tipo: "nariz", nombre: "Nariz2.png", rareza: "comun" },
      { user_id: userId, tipo: "nariz", nombre: "Nariz3.png", rareza: "comun" },
      { user_id: userId, tipo: "nariz", nombre: "Nariz4.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca1.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca2.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca3.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca4.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca5.png", rareza: "comun" },
      { user_id: userId, tipo: "boca", nombre: "Boca6.png", rareza: "comun" },
      { user_id: userId, tipo: "ropa", nombre: "Playera1", rareza: "comun" },
      { user_id: userId, tipo: "ropa", nombre: "Playera2", rareza: "comun" },
      { user_id: userId, tipo: "ropa", nombre: "Sueter1", rareza: "comun" },
      { user_id: userId, tipo: "ropa", nombre: "Sueter2", rareza: "comun" },
      { user_id: userId, tipo: "accesorios", nombre: "Lentes1.png", rareza: "comun" },
      { user_id: userId, tipo: "accesorios", nombre: "Lentes2.png", rareza: "comun" },
    ];

    const { error } = await supabaseServer
      .from("recompensas_usuario")
      .insert(recompensasIniciales);

    if (error) {
      console.error("Error insertando recompensas:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
