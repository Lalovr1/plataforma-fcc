import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { obtenerRecompensasInicialesAvatar } from "@/lib/avatarCatalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function obtenerSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST() {
  try {
    const iniciales = obtenerRecompensasInicialesAvatar();

    if (iniciales.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          codigo: "STARTER_PACK_VACIO",
          mensaje:
            "El catalogo nuevo no contiene recompensas iniciales. Supabase no fue modificado.",
        },
        { status: 409 }
      );
    }

    const items = iniciales.map((item) => ({
      recompensa_id: item.id,
      tipo: item.section,
    }));

    const supabaseAdmin = obtenerSupabaseAdmin();

    const { data, error } = await supabaseAdmin.rpc(
      "fcc_reemplazar_catalogo_recompensas_iniciales",
      {
        p_items: items,
      }
    );

    if (error) {
      console.error(
        "[FCC Academy] Error sincronizando starter pack:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          codigo: "ERROR_SUPABASE",
          mensaje: "No se pudo sincronizar el starter pack.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      total: iniciales.length,
      resultado: data,
    });
  } catch (error) {
    console.error(
      "[FCC Academy] Error preparando starter pack:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        codigo: "ERROR_CONFIGURACION",
        mensaje: "No se pudo preparar la sincronizacion del starter pack.",
      },
      { status: 500 }
    );
  }
}