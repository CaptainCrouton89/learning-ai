import { generateText } from "ai";
import { models } from "../../config/models.js";
import { Concept, Course } from "../../types/course.js";
import {
  conceptAwareHighLevelPrompts,
  conceptLearningPrompts,
  connectionPrompts,
  connectionQuestionPrompts,
  elaborationPrompts,
  highLevelPrompts,
} from "./prompts/index.js";

export class GenerationService {
  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    const backgroundTopics = course.backgroundKnowledge || [];
    const { text } = await generateText({
      model: models.standard,
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
Then ask a probing question about ${course.name} that explores foundational understanding.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
    : `Ask a probing question about ${course.name} that explores foundational understanding.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
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
      model: models.standard,
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
Then generate a focused question or teaching point that explores a specific aspect of ${concept.name}.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
    : `Generate a focused question or teaching point that explores a specific aspect of ${concept.name}.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
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
      model: models.standard,
      system: connectionPrompts.generationSystem(
        course.name,
        connections,
        previousQuestions,
        existingUnderstanding
      ),
      prompt: connectionPrompts.generationPrompt(
        connections,
        previousQuestions
      ),
    });

    return text;
  }

  // used during memorization to request deeper understanding on a struggling topic
  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept,
    userAnswer?: string,
    evaluation?: string
  ): Promise<string> {
    const { text } = await generateText({
      model: models.standard,
      system: elaborationPrompts.generationSystem(item, concept.name),
      prompt: elaborationPrompts.generationPrompt(
        item,
        fields,
        userAnswer,
        evaluation
      ),
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
      model: models.standard,
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
    existingUnderstanding: string,
    weakTopics?: Array<{ topic: string; comprehension: number }>,
    strugglingItems?: Array<{ item: string; averageComprehension: number }>
  ): Promise<string> {
    // Use concept-aware prompts when we have performance data
    if (weakTopics && strugglingItems) {
      const { text } = await generateText({
        model: models.standard,
        system: conceptAwareHighLevelPrompts.generationSystem(
          concept.name,
          existingUnderstanding,
          weakTopics,
          strugglingItems
        ),
        prompt: conceptAwareHighLevelPrompts.generationPrompt(
          concept,
          itemsCovered,
          existingUnderstanding,
          weakTopics,
          strugglingItems
        ),
      });
      return text;
    }

    // Fallback to basic high-level prompts (shouldn't happen in practice)
    const { text } = await generateText({
      model: models.standard,
      system: conceptAwareHighLevelPrompts.generationSystem(
        concept.name,
        existingUnderstanding,
        [],
        []
      ),
      prompt: conceptAwareHighLevelPrompts.generationPrompt(
        concept,
        itemsCovered,
        existingUnderstanding,
        [],
        []
      ),
    });

    return text;
  }
}
