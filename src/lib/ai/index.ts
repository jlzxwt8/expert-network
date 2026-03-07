import type { AIProvider } from "./types";

export type { ProfileInput, ProfileOutput, ImageInput, MatchResult, ServiceItem } from "./types";

function createProvider(): AIProvider {
  if (process.env.AI_PROVIDER === "qwen") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { QwenProvider } = require("./qwen") as typeof import("./qwen");
    return new QwenProvider();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GeminiProvider } = require("./gemini") as typeof import("./gemini");
  return new GeminiProvider();
}

let _provider: AIProvider | null = null;

function provider(): AIProvider {
  if (!_provider) _provider = createProvider();
  return _provider;
}

export function generateExpertProfile(
  ...args: Parameters<AIProvider["generateExpertProfile"]>
) {
  return provider().generateExpertProfile(...args);
}

export function generateProfileImage(
  ...args: Parameters<AIProvider["generateProfileImage"]>
) {
  return provider().generateProfileImage(...args);
}

export function improveWriting(
  ...args: Parameters<AIProvider["improveWriting"]>
) {
  return provider().improveWriting(...args);
}

export function matchExperts(
  ...args: Parameters<AIProvider["matchExperts"]>
) {
  return provider().matchExperts(...args);
}

export function extractTextFromPdf(
  ...args: Parameters<AIProvider["extractTextFromPdf"]>
) {
  return provider().extractTextFromPdf(...args);
}
