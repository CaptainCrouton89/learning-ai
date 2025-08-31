import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export const models: Record<
  "fast" | "standard" | "reasoningMini" | "reasoningHigh",
  LanguageModel
> = {
  fast: openai("gpt-4.1-mini"),
  standard: openai("gpt-4.1"),
  reasoningMini: openai("gpt-5-mini"),
  reasoningHigh: openai("gpt-5"),
};
