import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  AITextOptions,
  JSONSchema,
} from "./types";

export class GeminiProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private readonly models: string[];
  private ultimoModeloUtilizado: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada.");
    }

    this.ai = new GoogleGenAI({ apiKey });

    const modeloAnterior =
      process.env.GEMINI_MODEL?.trim();
    const modeloPrincipal =
      process.env.GEMINI_QUIZ_MODEL?.trim() ||
      (modeloAnterior &&
      modeloAnterior !== "gemini-3.7-flash"
        ? modeloAnterior
        : "gemini-3.5-flash");
    const modelosRespaldo = (
      process.env.GEMINI_FALLBACK_MODELS ||
      "gemini-3.5-flash-lite"
    )
      .split(",")
      .map((modelo) => modelo.trim())
      .filter(Boolean);

    this.models = Array.from(
      new Set([
        modeloPrincipal,
        ...modelosRespaldo,
      ])
    ).slice(0, 2);
    this.ultimoModeloUtilizado =
      this.models[0];
  }

  get modeloUtilizado() {
    return this.ultimoModeloUtilizado;
  }

  private esErrorTransitorio(
    error: any
  ) {
    const status = Number(
      error?.status ??
      error?.statusCode ??
      error?.cause?.statusCode ??
      0
    );
    const detalle = [
      error?.message,
      error?.body,
      error?.error?.error?.message,
      error?.cause?.message,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      status === 408 ||
      status === 429 ||
      status >= 500 ||
      /RESOURCE_EXHAUSTED|rate.?limit|quota|high demand|overload|temporar(?:y|ily)|timeout|timed out|UNAVAILABLE|INTERNAL/i.test(
        detalle
      )
    );
  }

  private esErrorConexion(
    error: any
  ) {
    const detalle = [
      error?.name,
      error?.message,
      error?.body,
      error?.error?.message,
      error?.error?.error?.message,
      error?.cause?.name,
      error?.cause?.message,
      error?.cause?.cause?.message,
    ]
      .filter(Boolean)
      .join(" ");

    return /APIConnectionError|UnexpectedClientError|Unexpected HTTP client error|fetch failed|network|socket|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|unusable/i.test(
      detalle
    );
  }

  private esperarAntesDeReintentar(
    numeroDeReintento: number
  ) {
    const base = 700 * 2 ** numeroDeReintento;
    const variacion = Math.floor(
      Math.random() * 250
    );

    return new Promise<void>((resolve) => {
      setTimeout(resolve, base + variacion);
    });
  }

  private async crearInteraccion(
    configuracion: Record<string, unknown>
  ) {
    let ultimoError: unknown = null;

    for (
      let indice = 0;
      indice < this.models.length;
      indice += 1
    ) {
      const modelo = this.models[indice];
      let errorDelModelo: unknown = null;

      for (
        let reintento = 0;
        reintento < 2;
        reintento += 1
      ) {
        try {
          const interaction =
            await this.ai.interactions.create({
              ...configuracion,
              model: modelo,
            } as any);

          this.ultimoModeloUtilizado =
            modelo;
          return interaction;
        } catch (error) {
          ultimoError = error;
          errorDelModelo = error;

          if (
            !this.esErrorConexion(error) ||
            reintento === 1
          ) {
            break;
          }

          console.warn(
            `La conexión con ${modelo} se interrumpió. FCC Academy abrirá una conexión nueva.`
          );
          await this.esperarAntesDeReintentar(
            reintento
          );
        }
      }

      const hayRespaldo =
        indice < this.models.length - 1;

      if (
        !hayRespaldo ||
        !(
          this.esErrorTransitorio(
            errorDelModelo
          ) ||
          this.esErrorConexion(errorDelModelo)
        )
      ) {
        throw errorDelModelo;
      }

      console.warn(
        `El modelo ${modelo} no está disponible temporalmente. FCC Academy probará el modelo de respaldo.`
      );
    }

    throw ultimoError;
  }

  async generateText(
    input: string,
    options: AITextOptions = {}
  ): Promise<string> {
    const interaction =
      await this.crearInteraccion({
        store: false,
        input,
        system_instruction:
          options.systemInstruction,
        generation_config: {
          thinking_level: "low",
        },
      });

    const text =
      interaction.output_text?.trim();

    if (!text) {
      throw new Error(
        "Gemini no devolvió contenido de texto."
      );
    }

    return text;
  }

  async generateJSON<T>(
    input: string,
    schema: JSONSchema,
    options: AITextOptions = {}
  ): Promise<T> {
    const interaction =
      await this.crearInteraccion({
        store: false,
        input,
        system_instruction:
          options.systemInstruction,
        generation_config: {
          thinking_level: "low",
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema,
        } as any,
      });

    const text =
      interaction.output_text?.trim();

    if (!text) {
      throw new Error(
        "Gemini no devolvió contenido estructurado."
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        "Gemini devolvió un JSON inválido."
      );
    }
  }
}
