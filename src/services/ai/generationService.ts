import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Concept, Course } from "../../types/course.js";
import {
  conceptLearningPrompts,
  connectionPrompts,
  connectionQuestionPrompts,
  elaborationPrompts,
  highLevelEvaluationPrompts,
  highLevelPrompts,
} from "./prompts/index.js";

export class GenerationService {
  private model = openai("gpt-5-mini");

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    const backgroundTopics = course.backgroundKnowledge || [];
    const { text } = await generateText({
      model: this.model,
      system: highLevelPrompts.questionSystem(
        course.name,
        backgroundTopics,
        existingUnderstanding
      ),
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

${
  isFirstQuestion
    ? `First, provide a brief 3-paragraph introduction to ${course.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then ask a probing question about ${course.name} that explores foundational understanding.`
    : `Ask a probing question about ${course.name} that explores foundational understanding.`
}`,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: conceptLearningPrompts.questionSystem(
        concept.name,
        concept["high-level"],
        existingUnderstanding
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

${
  isFirstQuestion
    ? `First, provide a brief 3-paragraph introduction to ${concept.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then generate a focused question or teaching point that explores a specific aspect of ${concept.name}.`
    : `Generate a focused question or teaching point that explores a specific aspect of ${concept.name}.`
}`,
    });

    return text;
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: connectionPrompts.generationSystem(
        course.name,
        connections,
        previousQuestions,
        existingUnderstanding
      ),
      prompt: connectionPrompts.generationPrompt(connections, previousQuestions),
    });

    return text;
  }

  // used during memorization to request deeper understanding on a struggling topic
  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: elaborationPrompts.generationSystem(item, concept.name),
      prompt: elaborationPrompts.generationPrompt(item, fields),
    });

    return text;
  }

  // used during memorization to request a connection between two items, triggered after an easy topic
  async generateConnectionToStruggling(
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: connectionQuestionPrompts.generationSystem(
        performingItem,
        strugglingItem,
        concept.name
      ),
      prompt: connectionQuestionPrompts.generationPrompt(
        performingItem,
        strugglingItem
      ),
    });

    return text;
  }

  // used during memorization to request a high-level synthesis question
  async generateHighLevelRecall(
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: highLevelEvaluationPrompts.generationSystem(
        concept.name,
        existingUnderstanding
      ),
      prompt: highLevelEvaluationPrompts.generationPrompt(
        concept,
        itemsCovered,
        existingUnderstanding
      ),
    });

    return text;
  }
}
