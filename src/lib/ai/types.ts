export type JSONSchema = Record<string, unknown>;

export type AITextOptions = {
  systemInstruction?: string;
};

export interface AIProvider {
  generateText(
    input: string,
    options?: AITextOptions
  ): Promise<string>;

  generateJSON<T>(
    input: string,
    schema: JSONSchema,
    options?: AITextOptions
  ): Promise<T>;
}