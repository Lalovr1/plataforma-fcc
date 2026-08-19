import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  try {
    const authHeader =
      request.headers.get(
        "authorization"
      );

    const token =
      authHeader?.startsWith(
        "Bearer "
      )
        ? authHeader
            .slice(7)
            .trim()
        : null;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey
    ) {
      throw new Error(
        "Configuración de Supabase incompleta."
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: { user },
      error: authError,
    } =
      await supabase
        .auth
        .getUser(token);

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sesión inválida.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const analisisId =
      typeof body?.analisisId ===
      "string"
        ? body.analisisId.trim()
        : "";

    const decisiones =
      Array.isArray(
        body?.decisiones
      )
        ? body.decisiones
        : null;

    if (!analisisId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el análisis.",
        },
        {
          status: 400,
        }
      );
    }

    if (!decisiones) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan las decisiones de la revisión.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "finalizar_revision_ia",
      {
        p_analisis_id:
          analisisId,

        p_decisiones:
          decisiones,
      }
    );

    if (error) {
      const mensaje =
        error.message ||
        "No se pudo finalizar la revisión.";

      const esCambioPosterior =
        /cambió después del análisis|cambio después del análisis/i.test(
          mensaje
        );

      return NextResponse.json(
        {
          ok: false,
          error:
            mensaje,
        },
        {
          status:
            esCambioPosterior
              ? 409
              : 400,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      resultado:
        data,
    });
  } catch (error) {
    console.error(
      "Error finalizando revisión IA:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudo finalizar la revisión.",
      },
      {
        status: 500,
      }
    );
  }
}