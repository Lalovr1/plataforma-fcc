import { NextResponse } from "next/server";
import { autenticarProfesorDeCurso } from "@/lib/cursoStorageServidor";

export const runtime = "nodejs";

function textoSeguro(value: unknown, maximo = 100) {
  return String(value ?? "").trim().slice(0, maximo);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const materiaId = textoSeguro(body?.materiaId);
    const quizId = textoSeguro(body?.quizId);
    const origen = textoSeguro(body?.origen, 20);

    if (!materiaId || !quizId || !["generacion", "analisis"].includes(origen)) {
      return NextResponse.json(
        { ok: false, error: "No se recibió un contexto válido para el quiz." },
        { status: 400 }
      );
    }

    const auth = await autenticarProfesorDeCurso(request, materiaId);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { data: quiz, error: quizError } = await auth.admin
      .from("quizzes")
      .select("id,materia_id,bloque_id")
      .eq("id", quizId)
      .eq("materia_id", materiaId)
      .maybeSingle();

    if (quizError) throw quizError;

    if (!quiz?.bloque_id) {
      return NextResponse.json(
        { ok: false, error: "El quiz no tiene un bloque principal válido." },
        { status: 400 }
      );
    }

    const bloqueIdsRecibidos = Array.isArray(body?.bloqueIds)
      ? body.bloqueIds.map((id: unknown) => textoSeguro(id)).filter(Boolean)
      : [];
    const bloqueIds = Array.from(new Set([quiz.bloque_id, ...bloqueIdsRecibidos]));

    if (bloqueIds.length > 8) {
      return NextResponse.json(
        { ok: false, error: "Puedes registrar como máximo 8 bloques de contexto." },
        { status: 400 }
      );
    }

    const { data: bloques, error: bloquesError } = await auth.admin
      .from("curso_contenido_bloques")
      .select("id,unidad_id,orden")
      .eq("materia_id", materiaId)
      .in("id", bloqueIds);

    if (bloquesError) throw bloquesError;

    if (!bloques || bloques.length !== bloqueIds.length) {
      return NextResponse.json(
        { ok: false, error: "Uno o más bloques no pertenecen al curso." },
        { status: 400 }
      );
    }

    const principal = bloques.find((bloque) => bloque.id === quiz.bloque_id);

    if (!principal) {
      return NextResponse.json(
        { ok: false, error: "No se encontró el bloque principal." },
        { status: 400 }
      );
    }

    const ordenPrincipal = Number(principal.orden ?? 0);
    const invalido = bloques.some(
      (bloque) =>
        bloque.unidad_id !== principal.unidad_id ||
        Number(bloque.orden ?? 0) > ordenPrincipal
    );

    if (invalido) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sólo puedes registrar el bloque principal y bloques anteriores de la misma unidad.",
        },
        { status: 400 }
      );
    }

    const { error: eliminarError } = await auth.admin
      .from("quiz_bloques_contexto")
      .delete()
      .eq("quiz_id", quizId)
      .eq("origen", origen);

    if (eliminarError) throw eliminarError;

    const { error: insertarError } = await auth.admin
      .from("quiz_bloques_contexto")
      .insert(
        bloques.map((bloque) => ({
          quiz_id: quizId,
          bloque_id: bloque.id,
          origen,
        }))
      );

    if (insertarError) throw insertarError;

    return NextResponse.json({
      ok: true,
      bloques_registrados: bloques.length,
    });
  } catch (error) {
    console.error("Error registrando contexto del quiz:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el contexto del quiz.",
      },
      { status: 500 }
    );
  }
}
