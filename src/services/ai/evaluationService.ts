import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, tool } from "ai";
import { z } from "zod";
import { Concept, Course } from "../../types/course.js";
import { conceptLearningPrompts, highLevelPrompts } from "./prompts.js";
import {
  ConceptAnswerEvaluationSchema,
  FlashcardResponseSchema,
} from "./schemas.js";

export class EvaluationService {
  private model = openai("gpt-4.1-mini");
  private nanoModel = openai("gpt-4.1-nano");

  async generateHighLevelResponse(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    includeFollowUp: boolean = false
  ): Promise<string> {
    const conceptNames = course.concepts.map((c) => c.name);
    const { text } = await generateText({
      model: this.model,
      system: highLevelPrompts.evaluationSystem(
        course.name,
        conceptNames,
        includeFollowUp
      ),
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory
  .slice(-4)
  .map((entry) => `${entry.role}: ${entry.content}`)
  .join("\n\n")}
</context>

${
  includeFollowUp
    ? "Provide substantive feedback on their response, then ask a follow-up question that builds on their understanding. Do not score comprehension - just provide feedback and continue the conversation."
    : "Provide substantive feedback on their response. Do not score comprehension - just provide feedback."
}`,
    });

    return text;
  }

  async evaluateHighLevelComprehension(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<Array<{ topic: string; comprehension: number }>> {
    const conceptNames = course.concepts.map((c) => c.name);

    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    const { text } = await generateText({
      model: this.nanoModel,
      system: `You are evaluating comprehension for the course "${course.name}".
Available topics: ${conceptNames.join(", ")}

Based on the user's response, determine which topics they demonstrated understanding of and score their comprehension (0-5).
- 0-1: No understanding or incorrect
- 2-3: Partial understanding
- 4-5: Good to excellent understanding

Call the update_comprehension tool for each topic the user addressed in their response.`,
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory
  .slice(-4)
  .map((entry) => `${entry.role}: ${entry.content}`)
  .join("\n\n")}
</context>

Analyze which topics the user addressed and their level of understanding for each.`,
      tools: {
        update_comprehension: tool({
          description: "Update comprehension score for a specific topic",
          inputSchema: z.object({
            topic: z.enum(conceptNames as [string, ...string[]]),
            comprehension: z.number().min(0).max(5),
          }),
          execute: async ({ topic, comprehension }) => {
            comprehensionUpdates.push({ topic, comprehension });
            return `Updated ${topic} comprehension to ${comprehension}`;
          },
        }),
      },
    });

    return comprehensionUpdates;
  }

  async evaluateHighLevelAnswer(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    includeFollowUp: boolean = false
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    const conceptNames = course.concepts.map((c) => c.name);
    const { object } = await generateObject({
      model: this.model,
      schema: ConceptAnswerEvaluationSchema(conceptNames),
      system: highLevelPrompts.evaluationSystem(
        course.name,
        conceptNames,
        includeFollowUp
      ),
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory
  .slice(-4)
  .map((entry) => `${entry.role}: ${entry.content}`)
  .join("\n\n")}
</context>

${
  includeFollowUp
    ? "Provide substantive feedback, then ask a follow-up question that builds on their understanding. Score their comprehension and identify the topic addressed."
    : "Provide substantive feedback on their response. Score their comprehension and identify the topic addressed."
}`,
    });

    return object;
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    includeFollowUp: boolean = false,
    unmasteredTopics?: string[]
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    const highLevelTopics = concept["high-level"];
    const { object } = await generateObject({
      model: this.model,
      schema: ConceptAnswerEvaluationSchema(highLevelTopics),
      system: conceptLearningPrompts.evaluationSystem(
        concept.name,
        highLevelTopics,
        unmasteredTopics,
        includeFollowUp
      ),
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory
  .slice(-4)
  .map((entry) => `${entry.role}: ${entry.content}`)
  .join("\n\n")}
</context>

${
  includeFollowUp
    ? "Provide substantive feedback that advances their understanding, then ask a specific follow-up question. Score their comprehension and identify the topic addressed."
    : "Provide substantive feedback that advances their understanding. Score their comprehension and identify the topic addressed."
}`,
    });

    return object;
  }

  async evaluateFlashcardAnswer(
    item: string,
    fields: string[],
    userAnswer: string,
    concept: Concept,
    otherConcepts: string[],
    previousAttempts: Array<{ question: string; answer: string }>
  ): Promise<{ comprehension: number; response: string }> {
    const { object } = await generateObject({
      model: this.model,
      schema: FlashcardResponseSchema,
      system: `You are evaluating flashcard answers for the concept "${
        concept.name
      }".
      The user needs to demonstrate knowledge of ALL fields: ${fields.join(
        ", "
      )}.
      Answers should be complete but not pretty - just demonstrating knowledge.
      Draw connections to other concepts: ${otherConcepts.join(", ")}.
      Be concise and draw new connections in your response.
      Score comprehension 0-5 (4+ counts as success).`,
      prompt: `Item: ${item}
      Required fields: ${fields.join(", ")}
      User answer: ${userAnswer}
      Previous attempts: ${JSON.stringify(previousAttempts)}
      Evaluate the answer and provide feedback.`,
    });

    return object;
  }

  async evaluateAbstractAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    allConcepts: Concept[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Evaluate the user's answer to an abstract question about ${concept.name}.
      Draw connections to other concepts and provide insightful feedback.`,
      prompt: `Question: ${question}
      User answer: ${userAnswer}
      Provide feedback that draws connections between concepts: ${allConcepts
        .map((c) => c.name)
        .join(", ")}`,
    });

    return text;
  }

  async evaluateConnectionAnswer(
    question: string,
    userAnswer: string,
    course: Course
  ): Promise<{ response: string; followUp: string | null }> {
    const { text } = await generateText({
      model: this.model,
      system: `Evaluate the user's synthesis of concepts in ${course.name}.
      Provide detailed feedback and optionally generate a challenging follow-up.`,
      prompt: `Question: ${question}
      User answer: ${userAnswer}
      Provide feedback and decide if a follow-up question would be valuable.`,
    });

    const lines = text.split("\n");
    const followUpIndex = lines.findIndex((line) =>
      line.toLowerCase().includes("follow-up:")
    );

    if (followUpIndex !== -1) {
      return {
        response: lines.slice(0, followUpIndex).join("\n"),
        followUp: lines.slice(followUpIndex + 1).join("\n"),
      };
    }

    return { response: text, followUp: null };
  }
}
