import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TUTORIAL_LOGRO_ID = "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610";

export async function POST(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const authorization = req.headers.get("authorization");
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : null;

    let user: { id: string } | null = null;
    let authError: unknown = null;

    if (bearerToken) {
      const resultadoAuth = await admin.auth.getUser(bearerToken);

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    } else {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              } catch {}
            },
          },
        }
      );
      const resultadoAuth = await supabaseAuth.auth.getUser();

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const { data: perfil, error: errorPerfil } = await admin
      .from("usuarios")
      .select("rol,tutorial_visto")
      .eq("id", user.id)
      .single();

    if (errorPerfil || !perfil) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (perfil.rol !== "estudiante") {
      return NextResponse.json(
        { error: "El tutorial sólo aplica a estudiantes" },
        { status: 403 }
      );
    }

    if (perfil.tutorial_visto) {
      return NextResponse.json({ ok: true, ya_finalizado: true });
    }

    const { data: logros, error: errorLogros } = await admin
      .from("logros_usuarios")
      .select("logro_id")
      .eq("usuario_id", user.id);

    if (errorLogros) throw errorLogros;

    const logroTutorialRegistrado = (logros ?? []).some(
      (logro) =>
        logro.logro_id === TUTORIAL_LOGRO_ID ||
        logro.logro_id === "tutorial"
    );

    if (!logroTutorialRegistrado) {
      return NextResponse.json(
        {
          error: "El logro del tutorial todavía no está registrado",
          codigo: "TUTORIAL_NO_COMPLETADO",
        },
        { status: 409 }
      );
    }

    const { error: errorActualizacion } = await admin
      .from("usuarios")
      .update({ tutorial_visto: true })
      .eq("id", user.id);

    if (errorActualizacion) throw errorActualizacion;

    return NextResponse.json({ ok: true, ya_finalizado: false });
  } catch (error: any) {
    console.error("Error finalizando tutorial:", error);

    return NextResponse.json(
      {
        error: "No se pudo confirmar la finalización del tutorial",
        codigo: "TUTORIAL_FINALIZACION_ERROR",
        ...(process.env.NODE_ENV === "development" && error?.message
          ? { detalle: error.message }
          : {}),
      },
      { status: 500 }
    );
  }
}
