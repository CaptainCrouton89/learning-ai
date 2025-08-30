import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Concept, Course } from "../../types/course.js";
import { conceptLearningPrompts, highLevelPrompts } from "./prompts.js";

export class GenerationService {
  private model = openai("gpt-4.1-mini");

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: highLevelPrompts.questionSystem(course.name),
      prompt: `<context>
${
  conversationHistory.length > 0
    ? `Previous discussion:\n${conversationHistory
        .slice(-4)
        .map((entry) => `${entry.role}: ${entry.content}`)
        .join("\n\n")}`
    : "Starting the conversation."
}
</context>

Ask a probing question about ${
        course.name
      } that explores foundational understanding.`,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: conceptLearningPrompts.questionSystem(
        concept.name,
        concept["high-level"]
      ),
      prompt: `<context>
${
  conversationHistory.length > 0
    ? `Recent discussion:\n${conversationHistory
        .slice(-3)
        .map((entry) => `${entry.role}: ${entry.content}`)
        .join("\n\n")}`
    : "This is the beginning of our discussion."
}
</context>

Generate a focused question or teaching point that explores a specific aspect of ${
        concept.name
      }.`,
    });

    return text;
  }

  async generateAbstractQuestion(
    concept: Concept,
    allConcepts: Concept[],
    previousQuestions: string[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate abstract/connection questions about ${concept.name}.
      These should probe deeper understanding and connections between concepts.
      Avoid repeating previous questions.`,
      prompt: `Concept: ${concept.name}
      All concepts in course: ${allConcepts.map((c) => c.name).join(", ")}
      Previous questions asked: ${previousQuestions.join(", ")}
      Generate a new abstract question that explores connections or trends.`,
    });

    return text;
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate open-ended questions that tie together all concepts in ${course.name}.
      Focus on practical applications and deeper understanding.
      Questions should be longer-form and scenario-based.`,
      prompt: `Drawing connections: ${connections.join(", ")}
      Previous Q&A: ${JSON.stringify(previousQuestions)}
      Generate a scenario-based question that requires synthesizing multiple concepts.`,
    });

    return text;
  }
}