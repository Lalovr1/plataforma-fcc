import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function obtenerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> }
) {
  try {
    const token = obtenerToken(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Sesión no disponible." },
        { status: 401 }
      );
    }

    const { quizId } = await context.params;
    const idQuiz = String(quizId ?? "").trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!idQuiz || !supabaseUrl || !supabaseKey || !serviceRoleKey) {
      throw new Error("Configuracion incompleta para revisar el quiz.");
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida." },
        { status: 401 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const { data: perfil } = await admin
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil?.rol === "profesor") {
      return NextResponse.json({ ok: true, pendientes: [] });
    }

    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id,materia_id,bloque_id")
      .eq("id", idQuiz)
      .maybeSingle();

    if (quizError) throw quizError;

    if (!quiz) {
      return NextResponse.json(
        { ok: false, error: "Quiz no encontrado." },
        { status: 404 }
      );
    }

    const { data: relaciones, error: relacionesError } = await admin
      .from("quiz_bloques_contexto")
      .select("bloque_id")
      .eq("quiz_id", idQuiz);

    if (relacionesError) throw relacionesError;

    const bloqueIds = Array.from(
      new Set((relaciones ?? []).map((fila) => String(fila.bloque_id)))
    );

    if (bloqueIds.length <= 1) {
      return NextResponse.json({ ok: true, pendientes: [] });
    }

    const { data: bloques, error: bloquesError } = await admin
      .from("curso_contenido_bloques")
      .select("id,titulo,orden")
      .in("id", bloqueIds)
      .order("orden", { ascending: true });

    if (bloquesError) throw bloquesError;

    const { data: quizzesRelacionados, error: quizzesError } = await admin
      .from("quizzes")
      .select("id,bloque_id")
      .eq("materia_id", quiz.materia_id)
      .in("bloque_id", bloqueIds);

    if (quizzesError) throw quizzesError;

    const quizzesDeContexto = quizzesRelacionados ?? [];
    const quizIdsDeContexto = quizzesDeContexto.map((item) => String(item.id));
    let intentos: Array<{ quiz_id: string | null }> = [];

    if (quizIdsDeContexto.length > 0) {
      const result = await admin
        .from("intentos_quiz")
        .select("quiz_id")
        .eq("usuario_id", user.id)
        .in("quiz_id", quizIdsDeContexto);

      if (result.error) throw result.error;
      intentos = result.data ?? [];
    }

    const quizzesRespondidos = new Set(
      intentos.map((intento) => String(intento.quiz_id ?? "")).filter(Boolean)
    );
    const pendientes = (bloques ?? [])
      .filter((bloque) => {
        const quizzesDelBloque = quizzesDeContexto.filter(
          (item) => item.bloque_id === bloque.id
        );

        if (quizzesDelBloque.length === 0) return true;

        return !quizzesDelBloque.some((item) =>
          quizzesRespondidos.has(String(item.id))
        );
      })
      .map((bloque) => ({
        id: String(bloque.id),
        titulo: String(bloque.titulo || "Tema sin título"),
      }));

    return NextResponse.json({
      ok: true,
      pendientes,
    });
  } catch (error) {
    console.error("Error revisando preparación del quiz:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo revisar la preparación del quiz.",
      },
      { status: 500 }
    );
  }
}
