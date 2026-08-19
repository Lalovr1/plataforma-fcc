import type { AIProvider } from "./types";
import { GeminiProvider } from "./geminiProvider";

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  switch (provider) {
    case "gemini":
      return new GeminiProvider();

    default:
      throw new Error(`Proveedor de IA no soportado: ${provider}`);
  }
}