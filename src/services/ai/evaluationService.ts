import { generateObject, generateText, tool } from "ai";
import { z } from "zod";
import { models } from '@/config/models';
import { Concept, Course } from '@/types/course';
import {
  conceptAwareHighLevelPrompts,
  conceptLearningPrompts,
  connectionPrompts,
  connectionQuestionPrompts,
  elaborationPrompts,
  flashcardPrompts,
  highLevelPrompts,
} from './prompts';
import {
  ConceptAnswerEvaluationSchema,
  FlashcardResponseSchema,
} from './schemas';

export class EvaluationService {
  async scoreComprehension(
    userAnswer: string,
    topics: string[],
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    contextType: "high-level" | "concept",
    conceptName?: string
  ): Promise<Array<{ topic: string; comprehension: number }>> {
    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: `You are evaluating comprehension of topics based on a user's response.
        
Context: ${contextType === "high-level" ? "Course overview" : `Learning ${conceptName}`}
User Level: ${existingUnderstanding}
Topics to evaluate: ${topics.join(", ")}

Scoring guidelines:
- 0-2: No or incorrect understanding
- 3: Basic understanding demonstrated
- 4: Good understanding with minor gaps
- 5: Full mastery demonstrated

IMPORTANT: Only score topics that the user ACTUALLY addressed in their response.
Do not score topics that weren't mentioned.`,
      },
    ];

    // Add conversation history for context
    conversationHistory.slice(-6).forEach((entry) => {
      messages.push({
        role: entry.role === "user" ? "user" : "assistant",
        content: entry.content,
      });
    });

    // Add the current user answer
    messages.push({
      role: "user",
      content: userAnswer,
    });

    const result = await generateText({
      model: models.fast,
      messages,
      tools: {
        update_comprehension: tool({
          description:
            "Update comprehension score for a specific topic the user addressed",
          inputSchema: z.object({
            topic: z.enum(topics as [string, ...string[]]),
            comprehension: z.number().min(0).max(5).describe("Score from 0-5"),
          }),
          execute: async ({ topic, comprehension }) => {
            const existing = comprehensionUpdates.find(
              (u) => u.topic === topic
            );
            if (!existing || comprehension > existing.comprehension) {
              if (existing) {
                existing.comprehension = comprehension;
              } else {
                comprehensionUpdates.push({ topic, comprehension });
              }
              return `Scored ${topic}: ${comprehension}/5`;
            }
            return `Kept ${topic} at ${existing.comprehension}/5`;
          },
        }),
      },
    });

    return comprehensionUpdates;
  }

  async generateHighLevelResponse(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    comprehensionProgress?: Map<string, number>
  ): Promise<string> {
    // Use backgroundKnowledge if available, otherwise fall back to concept names
    const topicsToTeach =
      course.backgroundKnowledge && course.backgroundKnowledge.length > 0
        ? course.backgroundKnowledge
        : course.concepts.map((c) => c.name);

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

    // Build messages array with conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content:
          highLevelPrompts.evaluationSystem(
            course.name,
            topicsToTeach,
            existingUnderstanding
          ) +
          `\n\nCurrent progress:\n${progressSummary}\n\n` +
          "REMEMBER: Always include response length guidance in your follow-up questions (e.g., 'In 2-3 sentences...', 'In a paragraph...', 'In a few words...').",
      },
    ];

    // Add the last 10 conversation history entries as proper messages
    conversationHistory.slice(-10).forEach((entry) => {
      messages.push({
        role: entry.role === "user" ? "user" : "assistant",
        content: entry.content,
      });
    });

    // Add the current user answer
    messages.push({
      role: "user",
      content: userAnswer,
    });

    const result = await generateText({
      model: models.fast,
      messages,
    });

    return result.text;
  }

  async generateConceptResponse(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    unmasteredTopics?: string[]
  ): Promise<string> {
    const highLevelTopics = concept["high-level"];

    // Build messages array with conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content:
          conceptLearningPrompts.evaluationSystem(
            concept.name,
            highLevelTopics,
            unmasteredTopics,
            existingUnderstanding
          ) +
          "\n\nREMEMBER: Always include response length guidance in your follow-up questions (e.g., 'In 2-3 sentences...', 'In a paragraph...', 'In a few words...').",
      },
    ];

    // Add the last 10 conversation history entries as proper messages
    conversationHistory.slice(-10).forEach((entry) => {
      messages.push({
        role: entry.role === "user" ? "user" : "assistant",
        content: entry.content,
      });
    });

    // Add the current user answer
    messages.push({
      role: "user",
      content: userAnswer,
    });

    const result = await generateText({
      model: models.standard,
      messages,
    });

    return result.text;
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[],
    existingUnderstanding: string = "Some - I know the basics"
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    const highLevelTopics = concept["high-level"];
    
    // Build messages array with conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: conceptLearningPrompts.evaluationSystem(
          concept.name,
          highLevelTopics,
          unmasteredTopics,
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

    // Add the current user answer
    messages.push({
      role: "user",
      content: userAnswer,
    });
    
    const { object } = await generateObject({
      model: models.fast,
      schema: ConceptAnswerEvaluationSchema(highLevelTopics),
      messages,
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
    // Build messages array with previous attempts as conversation history
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: flashcardPrompts
          .evaluationSystem(concept.name, fields, existingUnderstanding)
          .replace("{item}", item)
          .replace(
            otherConcepts[0] || "another concept",
            otherConcepts[0] || "another concept"
          ),
      },
    ];
    
    // Add previous attempts as conversation history
    previousAttempts.forEach((attempt) => {
      messages.push({
        role: "user",
        content: attempt.userAnswer,
      });
      messages.push({
        role: "assistant",
        content: attempt.aiResponse,
      });
    });
    
    // Add current user answer
    messages.push({
      role: "user",
      content: userAnswer,
    });
    
    const { object } = await generateObject({
      model: models.fast,
      schema: FlashcardResponseSchema,
      messages,
    });

    return object;
  }

  async evaluateConnectionAnswer(
    question: string,
    userAnswer: string,
    course: Course,
    existingUnderstanding: string
  ): Promise<{ response: string; followUp: string | null }> {
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: connectionPrompts.evaluationSystem(
          course.name,
          existingUnderstanding
        ),
      },
      {
        role: "assistant",
        content: question,
      },
      {
        role: "user",
        content: userAnswer,
      },
    ];
    
    const { text } = await generateText({
      model: models.fast,
      messages,
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
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: elaborationPrompts.evaluationSystem(item, concept.name),
      },
      {
        role: "assistant",
        content: question,
      },
      {
        role: "user",
        content: userAnswer,
      },
    ];
    
    const { text } = await generateText({
      model: models.fast,
      messages,
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
    // Build messages array
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: connectionQuestionPrompts.evaluationSystem(
          performingItem,
          strugglingItem,
          concept.name
        ),
      },
      {
        role: "assistant",
        content: question,
      },
      {
        role: "user",
        content: userAnswer,
      },
    ];
    
    const { text } = await generateText({
      model: models.fast,
      messages,
    });

    return text;
  }

  async evaluateHighLevelAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string = "Some - I know the basics",
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
        content: conceptAwareHighLevelPrompts.evaluationSystem(
          concept.name,
          existingUnderstanding,
          weakTopics || []
        ),
      },
      {
        role: "assistant",
        content: question,
      },
      {
        role: "user",
        content: userAnswer,
      },
    ];
    
    // Add context to the user message based on performance data
    if (weakTopics && strugglingItems) {
      messages[messages.length - 1].content += `\n\nContext: Items covered: ${itemsCovered.join(", ")}. High-level topics: ${concept["high-level"].join(", ")}. Weak topics: ${weakTopics.map(t => `${t.topic} (${t.comprehension}/5)`).join(", ")}. Struggling items: ${strugglingItems.map(i => i.item).join(", ")}.`;
    } else {
      messages[messages.length - 1].content += `\n\nContext: Items covered: ${itemsCovered.join(", ")}. High-level topics: ${concept["high-level"].join(", ")}.`;
    }
    
    const { text } = await generateText({
      model: models.fast,
      messages,
    });

    return text;
  }
}
