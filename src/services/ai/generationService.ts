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
    
    // Build messages array with conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: highLevelPrompts.questionSystem(
          course.name,
          backgroundTopics,
          existingUnderstanding
        ),
      },
    ];

    // Add the last 10 conversation history entries as proper messages
    conversationHistory.slice(-10).forEach((entry) => {
      messages.push({
        role: entry.role === "user" ? "user" : "assistant",
        content: entry.content,
      });
    });

    // Add a user message to trigger question generation
    const userPrompt = isFirstQuestion
      ? `First, provide a brief 3-paragraph introduction to ${course.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then ask a probing question about ${course.name} that explores foundational understanding.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
      : `Ask a probing question about ${course.name} that explores foundational understanding.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`;
    
    messages.push({
      role: "user",
      content: conversationHistory.length > 0 
        ? "Continue the discussion with a new question."
        : userPrompt,
    });
    
    const { text } = await generateText({
      model: models.standard,
      messages,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    // Build messages array with conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: conceptLearningPrompts.questionSystem(
          concept.name,
          concept["high-level"],
          existingUnderstanding
        ),
      },
    ];

    // Add the last 10 conversation history entries as proper messages
    conversationHistory.slice(-10).forEach((entry) => {
      messages.push({
        role: entry.role === "user" ? "user" : "assistant",
        content: entry.content,
      });
    });

    // Add a user message to trigger question generation
    const userPrompt = isFirstQuestion
      ? `First, provide a brief 3-paragraph introduction to ${concept.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then generate a focused question or teaching point that explores a specific aspect of ${concept.name}.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`
      : `Generate a focused question or teaching point that explores a specific aspect of ${concept.name}.
IMPORTANT: Include clear guidance on expected response length (e.g., "In 2-3 sentences...", "In a paragraph...", "In a few words...") based on the complexity of what you're asking.`;
    
    messages.push({
      role: "user",
      content: conversationHistory.length > 0 
        ? "Continue the discussion with a new question."
        : userPrompt,
    });
    
    const { text } = await generateText({
      model: models.standard,
      messages,
    });

    return text;
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ): Promise<string> {
    // Build messages array with previous questions as conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: connectionPrompts.generationSystem(
          course.name,
          connections,
          previousQuestions,
          existingUnderstanding
        ),
      },
    ];
    
    // Add previous questions as conversation history
    previousQuestions.forEach((qa) => {
      messages.push({
        role: "assistant",
        content: qa.question,
      });
      messages.push({
        role: "user",
        content: qa.answer,
      });
    });
    
    // Add prompt to generate new question
    messages.push({
      role: "user",
      content: `Generate a scenario-based question that explores the connections between: ${connections.join(", ")}. Make it practical and thought-provoking.`,
    });
    
    const { text } = await generateText({
      model: models.standard,
      messages,
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
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: elaborationPrompts.generationSystem(item, concept.name),
      },
    ];
    
    // Add previous interaction if available
    if (userAnswer && evaluation) {
      messages.push({
        role: "user",
        content: userAnswer,
      });
      messages.push({
        role: "assistant",
        content: evaluation,
      });
    }
    
    // Add prompt to generate elaboration question
    messages.push({
      role: "user",
      content: `Generate a deeper question about "${item}" with fields: ${fields.join(", ")}. Focus on understanding and application.`,
    });
    
    const { text } = await generateText({
      model: models.standard,
      messages,
    });

    return text;
  }

  // used during memorization to request a connection between two items, triggered after an easy topic
  async generateConnectionToStruggling(
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: connectionQuestionPrompts.generationSystem(
          performingItem,
          strugglingItem,
          concept.name
        ),
      },
      {
        role: "user",
        content: `Generate a question that helps connect "${performingItem}" (which the user understands well) to "${strugglingItem}" (which they're struggling with). Make the connection clear and helpful.`,
      },
    ];
    
    const { text } = await generateText({
      model: models.standard,
      messages,
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
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: conceptAwareHighLevelPrompts.generationSystem(
          concept.name,
          existingUnderstanding,
          weakTopics || [],
          strugglingItems || []
        ),
      },
    ];
    
    // Build context-aware user prompt
    let userPrompt = `Generate a high-level synthesis question about ${concept.name}.\nItems covered: ${itemsCovered.join(", ")}.\nHigh-level topics: ${concept["high-level"].join(", ")}.`;
    
    if (weakTopics && weakTopics.length > 0) {
      userPrompt += `\nWeak topics: ${weakTopics.map(t => `${t.topic} (${t.comprehension}/5)`).join(", ")}.`;
    }
    
    if (strugglingItems && strugglingItems.length > 0) {
      userPrompt += `\nStruggling items: ${strugglingItems.map(i => i.item).join(", ")}.`;
    }
    
    userPrompt += `\nCreate a question that helps synthesize understanding across these areas.`;
    
    messages.push({
      role: "user",
      content: userPrompt,
    });
    
    const { text } = await generateText({
      model: models.standard,
      messages,
    });

    return text;
  }
}
