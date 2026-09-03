import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TUTORIAL_LOGRO_ID = "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610";

function esLogroTutorial(logroId: string | null | undefined) {
  return logroId === TUTORIAL_LOGRO_ID || logroId === "tutorial";
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const admin = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const authorization = req.headers.get("authorization");
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : null;

    let user: { id: string } | null = null;
    let authError: unknown = null;
    let supabaseUsuario: any = null;

    if (bearerToken) {
      const resultadoAuth = await admin.auth.getUser(bearerToken);

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;

      supabaseUsuario = createClient(url, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } else {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(url, anonKey, {
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
      });

      const resultadoAuth = await supabaseAuth.auth.getUser();

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
      supabaseUsuario = supabaseAuth;
    }

    if (authError || !user || !supabaseUsuario) {
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

    async function consultarLogroTutorial() {
      const { data, error } = await admin
        .from("logros_usuarios")
        .select("logro_id")
        .eq("usuario_id", user!.id);

      if (error) throw error;

      return (data ?? []).some((logro) =>
        esLogroTutorial(logro.logro_id)
      );
    }

    if (await consultarLogroTutorial()) {
      return NextResponse.json({
        ok: true,
        ya_registrado: true,
        resultado: { logros: [] },
      });
    }

    let banderaTemporalActiva = false;

    async function escribirTutorialVisto(valor: boolean) {
      let ultimoError: any = null;

      for (let intento = 0; intento < 3; intento += 1) {
        const { error } = await admin
          .from("usuarios")
          .update({ tutorial_visto: valor })
          .eq("id", user!.id);

        if (!error) return;
        ultimoError = error;

        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      throw ultimoError ?? new Error("No se pudo actualizar el estado del tutorial.");
    }

    try {
      // Compatibilidad con la lógica actual de logros: algunas migraciones del
      // RPC comprueban tutorial_visto antes de registrar el logro. Activamos la
      // bandera sólo durante la ejecución del RPC y la restauramos antes de
      // devolver la respuesta. El tutorial NO queda finalizado aquí.
      if (!perfil.tutorial_visto) {
        await escribirTutorialVisto(true);
        banderaTemporalActiva = true;
      }

      const { data: resultado, error: errorRpc } = await supabaseUsuario.rpc(
        "verificar_y_otorgar_logros",
        { p_tipo: "tutorial" }
      );

      if (errorRpc) throw errorRpc;

      const logroRegistrado = await consultarLogroTutorial();

      if (!logroRegistrado) {
        throw new Error(
          "La verificación terminó sin registrar el logro del tutorial."
        );
      }

      if (banderaTemporalActiva) {
        await escribirTutorialVisto(false);
        banderaTemporalActiva = false;
      }

      return NextResponse.json({
        ok: true,
        ya_registrado: false,
        resultado: resultado ?? {},
      });
    } catch (error) {
      if (banderaTemporalActiva) {
        try {
          await escribirTutorialVisto(false);
          banderaTemporalActiva = false;
        } catch (restoreError) {
          console.error(
            "Error restaurando tutorial_visto después de preparar el logro:",
            restoreError
          );
        }
      }

      throw error;
    }
  } catch (error: any) {
    console.error("Error preparando logro del tutorial:", error);

    return NextResponse.json(
      {
        error: "No se pudo preparar el logro del tutorial",
        codigo: "TUTORIAL_PREPARACION_ERROR",
        ...(process.env.NODE_ENV === "development" && error?.message
          ? { detalle: error.message }
          : {}),
      },
      { status: 500 }
    );
  }
}
