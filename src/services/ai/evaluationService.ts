import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, stepCountIs, tool } from "ai";
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
    comprehensionProgress?: Map<string, number>
  ): Promise<{
    response: string;
    comprehensionUpdates: Array<{ topic: string; comprehension: number }>;
  }> {
    const conceptNames = course.concepts.map((c) => c.name);
    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    // Format progress for the prompt with emphasis on what needs work
    let progressSummary = 'No prior progress';
    let topicsNeedingWork: string[] = [];
    
    if (comprehensionProgress) {
      const entries = Array.from(comprehensionProgress.entries());
      progressSummary = entries
        .map(([topic, score]) => {
          const status = score >= 4 ? '✓' : score >= 2 ? '◐' : '○';
          if (score < 4) topicsNeedingWork.push(topic);
          return `${topic}: ${score}/5 ${status}`;
        })
        .join('\n');
        
      if (topicsNeedingWork.length > 0) {
        progressSummary += `\n\nTopics needing more exploration (< 4/5): ${topicsNeedingWork.join(', ')}`;
      } else {
        progressSummary += `\n\nAll topics well understood! Focus on synthesis and connections.`;
      }
    }

    const result = await generateText({
      model: this.model,
      stopWhen: stepCountIs(5), // stop after 5 steps if tools were called
      system: `${highLevelPrompts.evaluationSystem(course.name, conceptNames)}

You must follow these steps in order:
1. First, call the update_comprehension tool for EACH topic that the user addressed in their response. Score their understanding from 0-5:
   - 0-1: No understanding or incorrect
   - 2-3: Partial understanding  
   - 4-5: Good to excellent understanding
2. After updating all relevant comprehension scores, provide substantive feedback on their response.
3. End with a NEW follow-up question that:
   - Explores a DIFFERENT aspect than what was just discussed
   - Focuses on topics with scores below 4 (from progress below)
   - Does NOT directly repeat or rephrase the topic just answered
   - Builds knowledge progressively without redundancy
   - If all topics are mastered (4+), ask synthesis questions connecting multiple topics

Current topic progress:
${progressSummary}

IMPORTANT: Avoid asking about the same specific information the user just addressed. Move to unexplored aspects of low-scoring topics.`,
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

<current-progress>
${progressSummary}
</current-progress>

<instruction>
Evaluate comprehension, provide feedback, then ask a NEW question that:
1. Covers a different aspect than what was just discussed
2. Targets topics scoring below 4/5
3. Avoids repeating information from the last 2-3 exchanges
4. Progressively builds understanding without redundancy
</instruction>`,
      tools: {
        update_comprehension: tool({
          description:
            "Update comprehension score for a specific topic the user addressed",
          inputSchema: z.object({
            topic: z.enum(conceptNames as [string, ...string[]]),
            comprehension: z.number().min(0).max(5).describe("Score from 0-5"),
          }),
          execute: async ({ topic, comprehension }) => {
            // Only update if new score is higher than existing
            const existing = comprehensionUpdates.find(u => u.topic === topic);
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
      system: `${conceptLearningPrompts.evaluationSystem(
        concept.name,
        highLevelTopics,
        unmasteredTopics
      )}

IMPORTANT: Before providing your response, you MUST first call the update_comprehension tool for EACH topic that the user addressed in their response. Score their understanding of each topic from 0-5:
- 0-1: No understanding or incorrect
- 2-3: Partial understanding  
- 4-5: Good to excellent understanding

After updating comprehension scores, provide your feedback response.`,
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

First, evaluate and update comprehension for each topic addressed. Then provide substantive feedback that advances their understanding, and ask a specific follow-up question.`,
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
            const existing = comprehensionUpdates.find(u => u.topic === topic);
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

  async evaluateConceptComprehension(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<Array<{ topic: string; comprehension: number }>> {
    const highLevelTopics = concept["high-level"];

    const comprehensionUpdates: Array<{
      topic: string;
      comprehension: number;
    }> = [];

    await generateText({
      model: this.nanoModel,
      system: `You are evaluating comprehension for the concept "${
        concept.name
      }".
Available topics: ${highLevelTopics.join(", ")}

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
      stopWhen: stepCountIs(5),
      tools: {
        update_comprehension: tool({
          description: "Update comprehension score for a specific topic",
          inputSchema: z.object({
            topic: z.enum(highLevelTopics as [string, ...string[]]),
            comprehension: z.number().min(0).max(5),
          }),
          execute: async ({ topic, comprehension }) => {
            // Only update if new score is higher than existing
            const existing = comprehensionUpdates.find(u => u.topic === topic);
            if (!existing || comprehension > existing.comprehension) {
              if (existing) {
                existing.comprehension = comprehension;
              } else {
                comprehensionUpdates.push({ topic, comprehension });
              }
              return `Updated ${topic} comprehension to ${comprehension}`;
            }
            return `Kept ${topic} comprehension at ${existing.comprehension} (new score ${comprehension} not higher)`;
          },
        }),
      },
    });

    return comprehensionUpdates;
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[]
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    const highLevelTopics = concept["high-level"];
    const { object } = await generateObject({
      model: this.model,
      schema: ConceptAnswerEvaluationSchema(highLevelTopics),
      system: conceptLearningPrompts.evaluationSystem(
        concept.name,
        highLevelTopics,
        unmasteredTopics
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
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>
  ): Promise<{ comprehension: number; response: string }> {
    const { object } = await generateObject({
      model: this.model,
      schema: FlashcardResponseSchema,
      system: `You are evaluating flashcard answers for the concept "${concept.name}".
      The user needs to demonstrate knowledge of ALL fields: ${fields.join(", ")}.
      
      Score comprehension 0-5 (4+ counts as success).
      
      RESPONSE GUIDELINES:
      • Use bullet points for clarity and organization
      • Keep responses concise but insightful
      • Focus on corrections and connections, not just listing definitions
      • Draw meaningful connections to other concepts: ${otherConcepts.join(", ")}
      • Explain WHY things matter, not just WHAT they are
      
      For CORRECT answers (score 4+):
      • Briefly acknowledge success
      • Add ONE interesting insight or connection they didn't mention
      • Keep it to 1-2 sentences
      
      For INCORRECT/PARTIAL answers (score 0-3):
      • Focus on what they missed or misunderstood
      • Provide corrections with context
      • Make connections that deepen understanding
      • Don't just list the fields - explain their significance`,
      prompt: `Item: ${item}
      Required fields: ${fields.join(", ")}
      Current user answer: ${userAnswer}
      
      Previous attempts for this item:
      ${previousAttempts.length > 0 ? previousAttempts.map((attempt, i) => 
        `Attempt ${i + 1}:
        User: ${attempt.userAnswer}
        AI Feedback: ${attempt.aiResponse}`
      ).join('\n\n') : 'None'}
      
      Evaluate the current answer and provide insightful feedback that deepens understanding. Consider the previous attempts to avoid repeating feedback.`,
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
