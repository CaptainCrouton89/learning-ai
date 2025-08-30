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

  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate an elaboration question about ${item} from ${concept.name}.
      The user struggled with this item. Ask "why" or "what causes" questions to deepen understanding.
      Focus on the underlying reasons, mechanisms, or causes.
      Keep the question concise and focused.`,
      prompt: `Item: ${item}
      Fields: ${fields.join(", ")}
      Generate a question like "Why is X true?" or "What causes Y?" or "How does X lead to Y?"
      Make it specific to this item and help the user understand the deeper reasoning.`,
    });

    return text;
  }

  async generateConnectionToStruggling(
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate a connection question linking two items from ${concept.name}.
      The user knows ${performingItem} well but struggles with ${strugglingItem}.
      Create a question that helps them understand ${strugglingItem} by comparing or relating it to ${performingItem}.`,
      prompt: `Well-known item: ${performingItem}
      Struggling item: ${strugglingItem}
      
      Generate a question like:
      - "How does ${performingItem} compare to ${strugglingItem}?"
      - "What similarities/differences exist between these two?"
      - "How does understanding ${performingItem} help you understand ${strugglingItem}?"
      
      Be specific and help build connections between what they know and what they're learning.`,
    });

    return text;
  }

  async generateHighLevelRecall(
    concept: Concept,
    itemsCovered: string[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate a high-level synthesis question about ${concept.name}.
      This should require recall and explanation of multiple items covered.
      Focus on overall understanding and ability to synthesize information.`,
      prompt: `Concept: ${concept.name}
      Items covered so far: ${itemsCovered.join(", ")}
      Topics: ${concept["high-level"].join(", ")}
      
      Generate a question that:
      - Requires synthesis of multiple items
      - Tests overall understanding of the concept
      - Encourages explanation and recall
      - Is open-ended but focused
      
      Examples:
      - "Explain the key characteristics that define..."
      - "How do the various types of X relate to each other?"
      - "What patterns do you see across all the X we've covered?"`,
    });

    return text;
  }
}