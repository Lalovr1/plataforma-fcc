import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Ruta no disponible." },
      { status: 404 }
    );
  }

  try {
    const ai = getAIProvider();

    const respuesta = await ai.generateText(
      "Responde únicamente con la frase: FCC Academy IA funcionando",
      {
        systemInstruction:
          "Eres una prueba técnica interna de FCC Academy. Sigue exactamente la instrucción recibida.",
      }
    );

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error) {
    console.error("Error probando IA:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido al conectar con la IA.",
      },
      { status: 500 }
    );
  }
}