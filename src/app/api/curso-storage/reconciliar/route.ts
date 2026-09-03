import { NextResponse } from "next/server";
import {
  autenticarProfesorDeCurso,
  reconciliarStorageMateria,
} from "@/lib/cursoStorageServidor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const materiaId = String(body?.materiaId ?? "").trim();

    if (!materiaId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Curso no especificado.",
        },
        { status: 400 }
      );
    }

    const auth = await autenticarProfesorDeCurso(
      request,
      materiaId
    );

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        { status: auth.status }
      );
    }

    const resumen = await reconciliarStorageMateria(
      auth.admin,
      materiaId
    );

    return NextResponse.json({
      ok: true,
      materiaId,
      ...resumen,
    });
  } catch (error: any) {
    console.error(
      "[FCC Academy] Error reconciliando Storage:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudo reconciliar el almacenamiento del curso.",
      },
      { status: 500 }
    );
  }
}
