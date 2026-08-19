import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  AITextOptions,
  JSONSchema,
} from "./types";

export class GeminiProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada.");
    }

    this.ai = new GoogleGenAI({ apiKey });

    this.model =
      process.env.GEMINI_MODEL ||
      "gemini-3.7-flash";
  }

  async generateText(
    input: string,
    options: AITextOptions = {}
  ): Promise<string> {
    const interaction =
      await this.ai.interactions.create({
        model: this.model,
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
      await this.ai.interactions.create({
        model: this.model,
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