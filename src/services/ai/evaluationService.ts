import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { Concept, Course } from "../../types/course.js";
import {
  conceptLearningPrompts,
  highLevelPrompts,
  flashcardPrompts,
  abstractPrompts,
  connectionPrompts,
  elaborationPrompts,
  connectionQuestionPrompts,
  highLevelEvaluationPrompts,
} from "./prompts.js";
import {
  ConceptAnswerEvaluationSchema,
  FlashcardResponseSchema,
} from "./schemas.js";

export class EvaluationService {
  private model = openai("gpt-5-mini");

  async generateHighLevelResponse(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    comprehensionProgress?: Map<string, number>
  ): Promise<{
    response: string;
    comprehensionUpdates: Array<{ topic: string; comprehension: number }>;
  }> {
    // Use backgroundKnowledge if available, otherwise fall back to concept names
    const topicsToTeach = course.backgroundKnowledge && course.backgroundKnowledge.length > 0
      ? course.backgroundKnowledge
      : course.concepts.map((c) => c.name);
    
    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    // Format progress for the prompt with emphasis on what needs work
    let progressSummary = "No prior progress";
    let topicsNeedingWork: string[] = [];

    if (comprehensionProgress) {
      const entries = Array.from(comprehensionProgress.entries());
      progressSummary = entries
        .map(([topic, score]) => {
          const status = score >= 5 ? "✓" : score >= 3 ? "◐" : "○";
          if (score < 5) topicsNeedingWork.push(topic);
          return `${topic}: ${score}/5 ${status}`;
        })
        .join("\n");

      if (topicsNeedingWork.length > 0) {
        progressSummary += `\n\nTopics needing mastery (< 5/5): ${topicsNeedingWork.join(
          ", "
        )}`;
      } else {
        progressSummary += `\n\nAll topics mastered! Ready to dive into the main content.`;
      }
    }

    const result = await generateText({
      model: this.model,
      stopWhen: stepCountIs(5), // stop after 5 steps if tools were called
      system: highLevelPrompts.evaluationSystemExtended(
        course.name,
        topicsToTeach,
        existingUnderstanding,
        progressSummary
      ),
      prompt: highLevelPrompts.evaluationPrompt(
        userAnswer,
        conversationHistory,
        progressSummary
      ),
      tools: {
        update_comprehension: tool({
          description:
            "Update comprehension score for a specific topic the user addressed",
          inputSchema: z.object({
            topic: z.enum(topicsToTeach as [string, ...string[]]),
            comprehension: z.number().min(0).max(5).describe("Score from 0-5"),
          }),
          execute: async ({ topic, comprehension }) => {
            // Only update if new score is higher than existing
            const existing = comprehensionUpdates.find(
              (u) => u.topic === topic
            );
            if (!existing || comprehension > existing.comprehension) {
              if (existing) {
                existing.comprehension = comprehension;
              } else {
                comprehensionUpdates.push({ topic, comprehension });
              }
              return `Updated ${topic} comprehension to ${comprehension}/5`;
            }
            return `Kept ${topic} comprehension at ${existing.comprehension}/5 (new score ${comprehension} not higher)`;
          },
        }),
      },
    });

    return { response: result.text, comprehensionUpdates };
  }

  async generateConceptResponse(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    unmasteredTopics?: string[]
  ): Promise<{
    response: string;
    comprehensionUpdates: Array<{ topic: string; comprehension: number }>;
  }> {
    const highLevelTopics = concept["high-level"];
    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    const result = await generateText({
      model: this.model,
      system: conceptLearningPrompts.evaluationSystemExtended(
        concept.name,
        highLevelTopics,
        unmasteredTopics,
        existingUnderstanding
      ),
      prompt: conceptLearningPrompts.evaluationPrompt(
        userAnswer,
        conversationHistory
      ),
      stopWhen: stepCountIs(5),
      tools: {
        update_comprehension: tool({
          description:
            "Update comprehension score for a specific topic the user addressed",
          inputSchema: z.object({
            topic: z.enum(highLevelTopics as [string, ...string[]]),
            comprehension: z.number().min(0).max(5).describe("Score from 0-5"),
          }),
          execute: async ({ topic, comprehension }) => {
            // Only update if new score is higher than existing
            const existing = comprehensionUpdates.find(
              (u) => u.topic === topic
            );
            if (!existing || comprehension > existing.comprehension) {
              if (existing) {
                existing.comprehension = comprehension;
              } else {
                comprehensionUpdates.push({ topic, comprehension });
              }
              return `Updated ${topic} comprehension to ${comprehension}/5`;
            }
            return `Kept ${topic} comprehension at ${existing.comprehension}/5 (new score ${comprehension} not higher)`;
          },
        }),
      },
    });

    return { response: result.text, comprehensionUpdates };
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[],
    existingUnderstanding: string = "Some - I know the basics"
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    const highLevelTopics = concept["high-level"];
    const { object } = await generateObject({
      model: this.model,
      schema: ConceptAnswerEvaluationSchema(highLevelTopics),
      system: conceptLearningPrompts.evaluationSystem(
        concept.name,
        highLevelTopics,
        unmasteredTopics,
        existingUnderstanding
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

Provide substantive feedback that advances their understanding, then ask a specific follow-up question. Score their comprehension and identify the topic addressed.`,
    });

    return object;
  }

  async evaluateFlashcardAnswer(
    item: string,
    fields: string[],
    userAnswer: string,
    concept: Concept,
    otherConcepts: string[],
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>,
    existingUnderstanding: string
  ): Promise<{ comprehension: number; response: string }> {
    const { object } = await generateObject({
      model: this.model,
      schema: FlashcardResponseSchema,
      system: flashcardPrompts.evaluationSystem(
        concept.name,
        fields,
        existingUnderstanding
      ).replace("{item}", item).replace(
        otherConcepts[0] || "another concept",
        otherConcepts[0] || "another concept"
      ),
      prompt: flashcardPrompts.userPrompt(
        item,
        fields,
        userAnswer,
        previousAttempts
      ),
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
      system: abstractPrompts.evaluationSystem(concept.name),
      prompt: abstractPrompts.userPrompt(
        question,
        userAnswer,
        allConcepts.map((c) => c.name)
      ),
    });

    return text;
  }

  async evaluateConnectionAnswer(
    question: string,
    userAnswer: string,
    course: Course,
    existingUnderstanding: string
  ): Promise<{ response: string; followUp: string | null }> {
    const { text } = await generateText({
      model: this.model,
      system: connectionPrompts.evaluationSystem(
        course.name,
        existingUnderstanding
      ),
      prompt: connectionPrompts.userPrompt(question, userAnswer),
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

  async evaluateElaborationAnswer(
    question: string,
    userAnswer: string,
    item: string,
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: elaborationPrompts.evaluationSystem(item, concept.name),
      prompt: elaborationPrompts.userPrompt(question, item, userAnswer),
    });

    return text;
  }

  async evaluateConnectionQuestionAnswer(
    question: string,
    userAnswer: string,
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: connectionQuestionPrompts.evaluationSystem(
        performingItem,
        strugglingItem,
        concept.name
      ),
      prompt: connectionQuestionPrompts.userPrompt(
        question,
        performingItem,
        strugglingItem,
        userAnswer
      ),
    });

    return text;
  }

  async evaluateHighLevelAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string = "Some - I know the basics"
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: highLevelEvaluationPrompts.evaluationSystem(
        concept.name,
        existingUnderstanding
      ),
      prompt: highLevelEvaluationPrompts.userPrompt(
        question,
        itemsCovered,
        concept["high-level"],
        userAnswer
      ),
    });

    return text;
  }
}
