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
          const status = score >= 3 ? "✓" : score >= 2 ? "◐" : "○";
          if (score < 3) topicsNeedingWork.push(topic);
          return `${topic}: ${score}/5 ${status}`;
        })
        .join("\n");

      if (topicsNeedingWork.length > 0) {
        progressSummary += `\n\nTopics to explore (< 3/5): ${topicsNeedingWork.join(
          ", "
        )}`;
      } else {
        progressSummary += `\n\nGreat foundation! Ready to dive into the main content.`;
      }
    }

    const result = await generateText({
      model: this.model,
      stopWhen: stepCountIs(5), // stop after 5 steps if tools were called
      system: `${highLevelPrompts.evaluationSystem(
        course.name,
        topicsToTeach,
        existingUnderstanding
      )}

You must follow these steps:
1. Call update_comprehension for topics the user addressed. Be GENEROUS with scoring:
   - 0-2: Needs teaching (provide it immediately!)
   - 3: Basic understanding - GOOD ENOUGH to continue
   - 4: Solid grasp
   - 5: Impressive depth
2. Provide ENCOURAGING, TEACHING-focused feedback
3. Ask an ENGAGING follow-up that explores new aspects

Current progress:
${progressSummary}

REMEMBER: This is overview/teaching phase. Score 3 = ready to proceed. Be supportive!`,
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
      system: `${conceptLearningPrompts.evaluationSystem(
        concept.name,
        highLevelTopics,
        unmasteredTopics,
        existingUnderstanding
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
      system: `You are evaluating flashcard answers for the concept "${
        concept.name
      }".
      The user needs to demonstrate knowledge of ALL fields: ${fields.join(
        ", "
      )}.
      
      User's Existing Understanding: ${existingUnderstanding}
      
      Score comprehension 0-5 (4+ counts as success, adjusted for their level).
      
      CRITICAL FORMATTING REQUIREMENTS:
      YOU MUST use this exact structure with proper spacing between sections:
      
      For CORRECT answers (score 4+):
      ✓ Correct.
      
      **Additional insight:** {One specific fact or connection they didn't mention}
      
      For INCORRECT/PARTIAL answers (score 0-3):
      ❌ Incorrect/Incomplete.
      
      **The correct answer requires:**
      • **${fields[0]}**: {Precise facts/values for this field}
      • **${fields[1]}**: {Precise facts/values for this field}
      {Continue for ALL fields, even if user got some right}
      
      **Why this matters:** {1-2 sentences on practical importance}
      
      **Remember this connection:** {Specific link to ${
        otherConcepts[0] || "another concept"
      } with concrete example}
      
      STRICT RULES:
      - Be DIRECT - start with "Incorrect" or "Correct", not what they said
      - List the ACTUAL FACTS for each field, not vague descriptions
      - Use specific numbers, names, examples - not generalizations
      - Maximum 1 line per field - just the essential facts
      - Don't soften feedback - be precise about what's wrong
      - Focus on memorizable facts, not explanations
      ${
        existingUnderstanding === "None - Complete beginner"
          ? "- Provide simple memory aids or mnemonics when helpful"
          : existingUnderstanding === "Some - I know the basics"
          ? "- Focus on connections to existing knowledge"
          : "- Use technical language and expect precise terminology"
      }`,
      prompt: `Item: ${item}
      Required fields: ${fields.join(", ")}
      Current user answer: ${userAnswer}
      
      Previous attempts for this item:
      ${
        previousAttempts.length > 0
          ? previousAttempts
              .map(
                (attempt, i) =>
                  `Attempt ${i + 1}:
        User: ${attempt.userAnswer}
        AI Feedback: ${attempt.aiResponse}`
              )
              .join("\n\n")
          : "None"
      }
      
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
      Be DIRECT about correctness.
      Focus on concrete connections between concepts.
      
      STRUCTURE:
      ✓ or ❌ assessment
      Bullet points of correct understanding
      Specific connections to other concepts`,
      prompt: `Question: ${question}
      User answer: ${userAnswer}
      Concepts to connect: ${allConcepts.map((c) => c.name).join(", ")}
      
      Format:
      **✓ Correct:** or **❌ Incorrect/Incomplete:**
      
      **Key points:**
      • {Specific fact or relationship}
      • {Another specific fact}
      
      **Connection:** {How this relates to another concept with specific example}`,
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
      system: `Evaluate the user's synthesis of concepts in ${course.name}.
      Be DIRECT and specific about their understanding.
      Provide concrete feedback with facts.
      
      User's Existing Understanding: ${existingUnderstanding}
      
      STRUCTURE:
      1. ✓ Correct or ❌ Incorrect/Incomplete assessment
      2. Bullet points of what they should understand
      3. Key insight or principle
      4. Optional follow-up if answer was particularly weak`,
      prompt: `Question: ${question}
      User answer: ${userAnswer}
      
      Provide direct feedback:
      - Start with ✓ or ❌
      - List specific facts they missed
      - End with key principle
      - Only add follow-up if score < 3`,
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
      system: `Evaluate the user's understanding of the "why" or "what causes" behind ${item} in ${concept.name}.
      Be DIRECT about what's wrong and what's right.
      NO follow-up questions - just provide feedback.
      
      STRUCTURE:
      Start with ✓ Correct or ❌ Incorrect/Incomplete
      Then provide the actual facts in bullet points
      End with one key principle to remember`,
      prompt: `Elaboration question: ${question}
      About item: ${item}
      User answer: ${userAnswer}
      
      Provide feedback following this structure:
      - ✓ or ❌ with brief assessment
      - Bullet points with the correct facts about causes/mechanisms
      - One memorable principle or pattern
      - NO softening, be direct about errors`,
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
      system: `Evaluate how well the user connected ${performingItem} to ${strugglingItem} in ${concept.name}.
      Be DIRECT and precise about connections.
      NO follow-up questions.
      
      STRUCTURE:
      ✓ or ❌ assessment
      Bullet points of correct connections
      One key distinction to remember`,
      prompt: `Connection question: ${question}
      Linking: ${performingItem} (known) to ${strugglingItem} (struggling)
      User answer: ${userAnswer}
      
      Format:
      **✓ Correct connections:** or **❌ Missing connections:**
      
      **The actual connections:**
      • Similarity: {specific shared attribute with values}
      • Difference: {specific contrasting attribute with values}
      • Pattern: {underlying principle that links them}
      
      **Remember:** {Key distinction between the two items}`,
    });

    return text;
  }

  async evaluateHighLevelAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    itemsCovered: string[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Evaluate the user's high-level synthesis for ${concept.name}.
      Be DIRECT about gaps and errors.
      Focus on patterns and relationships.
      NO follow-up questions.
      
      STRUCTURE:
      ✓ or ❌ with main assessment
      Bullet points of key patterns/facts
      One overarching principle`,
      prompt: `High-level question: ${question}
      Items covered: ${itemsCovered.join(", ")}
      Topics: ${concept["high-level"].join(", ")}
      User answer: ${userAnswer}
      
      Format:
      **✓ Correct synthesis:** or **❌ Incomplete synthesis:**
      
      **Key patterns across all items:**
      • Pattern 1: {specific relationship with examples}
      • Pattern 2: {specific trend with values}
      • Pattern 3: {specific distinction or grouping}
      
      **Overarching principle:** {The main takeaway that unifies everything}`,
    });

    return text;
  }
}
