import { NextResponse } from "next/server";
import {
  autenticarProfesorDeCurso,
  eliminarRutasStorage,
  listarArchivosStorageCurso,
} from "@/lib/cursoStorageServidor";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
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

    // Capturamos las rutas antes de borrar la materia.
    const rutasStorage = await listarArchivosStorageCurso(
      auth.admin,
      materiaId
    );

    // Primero BD. Si esta operación falla, el curso conserva sus archivos
    // y no queda visualmente roto.
    const { error: deleteError } = await auth.admin
      .from("materias")
      .delete()
      .eq("id", materiaId)
      .eq("profesor_id", auth.userId);

    if (deleteError) {
      throw deleteError;
    }

    let storageEliminados = 0;
    let advertencia: string | null = null;

    try {
      storageEliminados = await eliminarRutasStorage(
        auth.admin,
        rutasStorage
      );
    } catch (storageError: any) {
      // La materia ya se eliminó. Devolvemos éxito con advertencia para que
      // la UI no diga que el curso sigue existiendo. La herramienta de
      // huérfanos puede limpiar este caso excepcional después.
      advertencia =
        storageError?.message ||
        "El curso se eliminó, pero algunos archivos de Storage requieren limpieza.";
    }

    return NextResponse.json({
      ok: true,
      materiaId,
      storageEliminados,
      advertencia,
    });
  } catch (error: any) {
    console.error(
      "[FCC Academy] Error eliminando curso completo:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudo eliminar el curso.",
      },
      { status: 500 }
    );
  }
}
