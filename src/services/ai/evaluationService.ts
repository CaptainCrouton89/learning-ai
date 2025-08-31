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
      system: `${highLevelPrompts.evaluationSystem(
        course.name,
        topicsToTeach,
        existingUnderstanding
      )}

You must follow these steps:
1. Call update_comprehension ONLY for topics the user ACTUALLY addressed. Score accurately:
   - 0-2: Needs comprehensive teaching
   - 3-4: Partial understanding - needs more depth
   - 5: Full mastery demonstrated
   DO NOT score topics that weren't mentioned in their response.
2. Provide SUBSTANTIVE, DETAILED teaching feedback (minimum 2-3 paragraphs)
   - Include mechanisms, examples, and connections
   - Expand on what they said with additional context
   - Teach missing pieces comprehensively
3. Ask an ENGAGING follow-up that explores new aspects

Current progress:
${progressSummary}

REMEMBER: Score 5 = ready to proceed. Provide comprehensive teaching content!`,
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
CRITICAL: If the user says "no idea" or shows low comprehension:
1. Look at the conversation history to find the EXACT question that was asked
2. Answer that SPECIFIC question directly - don't give generic background
3. Teach the particular concept/mechanism that was asked about

Evaluate comprehension, provide targeted feedback addressing their specific question, then ask a NEW question that:
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

CRITICAL SCORING RULES:
1. ONLY call update_comprehension for topics the user ACTUALLY addressed in their response
2. Do NOT score topics that weren't mentioned or addressed
3. Focus evaluation on what the user discussed, not what they didn't
4. Score understanding from 0-5:
   - 0-1: No understanding or incorrect
   - 2-3: Partial understanding  
   - 4-5: Good to excellent understanding

After updating comprehension scores for addressed topics only, provide your feedback response.`,
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

IMPORTANT: The user was asked a specific question (found in the conversation history above).
If they say "no idea" or show low understanding, you MUST:
1. Identify the exact question that was asked
2. Answer that specific question directly - not generic information
3. Teach the specific mechanism/concept that was asked about

First, evaluate and update comprehension for topics actually addressed. Then provide targeted feedback that answers their specific question and advances understanding.`,
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
      system: `You are a patient educator helping learners master "${
        concept.name
      }" through flashcard practice.
      The user needs to understand ALL fields: ${fields.join(
        ", "
      )}.
      
      User's Existing Understanding: ${existingUnderstanding}
      
      Score comprehension 0-5 (4+ counts as success, adjusted for their level).
      
      EDUCATIONAL RESPONSE FORMATS:
      
      For EXCELLENT answers (score 5):
      ✓ Perfect understanding!
      
      **Advanced insight:** {Share something deeper they might not know}
      
      **Interesting connection:** {Link to related concept with example}
      
      For GOOD answers (score 4):
      ✓ Good grasp!
      
      **One clarification:** {Add the small detail they missed}
      
      **This connects to:** {Relate to another concept}
      
      For PARTIAL understanding (score 2-3):
      ✓ You're getting there!
      
      **Let me help you understand completely:**
      • **${fields[0]}**: {Explain this field clearly with context}
      • **${fields[1]}**: {Explain this field with examples}
      {Continue for ALL fields, teaching not just listing}
      
      **Think of it this way:** {Analogy or memory aid}
      
      **How this connects:** {Link to ${
        otherConcepts[0] || "another concept"
      } with explanation}
      
      For MINIMAL/NO understanding (score 0-1):
      Let me teach you this step by step:
      
      **What "${item}" means:**
      {Full explanatory paragraph about the concept}
      
      **Breaking down each aspect:**
      • **${fields[0]}**: {Thorough explanation with examples}
      • **${fields[1]}**: {Clear teaching with context}
      {Continue for ALL fields with educational explanations}
      
      **Memory tip:** {Mnemonic or pattern to remember}
      
      **Why this matters:** {Real-world relevance and application}
      
      For "NO IDEA" or similar:
      No worries! Let me teach you about ${item}:
      
      **The concept:** {Engaging introduction to what this is}
      
      **Understanding each part:**
      • **${fields[0]}**: {Patient, clear explanation with examples}
      • **${fields[1]}**: {Build understanding progressively}
      {Teach ALL fields thoroughly}
      
      **How to remember:** {Memory technique or pattern}
      
      **Real example:** {Concrete example showing all fields}
      
      **Key takeaway:** {Simple summary to cement understanding}
      
      TEACHING PRINCIPLES:
      - Be encouraging and patient, especially with "no idea" responses
      - TEACH concepts, don't just list facts
      - Use analogies and examples to make abstract ideas concrete
      - Build understanding progressively
      - Provide memory aids and patterns
      - Connect to real-world applications
      ${
        existingUnderstanding === "None - Complete beginner"
          ? "- Use simple language and everyday examples"
          : existingUnderstanding === "Some - I know the basics"
          ? "- Build on their foundation with intermediate concepts"
          : "- Explore nuanced aspects and edge cases"
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
      system: `You are evaluating the user's synthesis and understanding of ${concept.name}.
      Your goal is to encourage deeper thinking and make connections clear.
      Be supportive while teaching important concepts.
      
      APPROACH:
      - Acknowledge what they understood correctly
      - Teach missing connections through explanation
      - Use examples to illustrate abstract relationships
      - Build on their existing knowledge`,
      prompt: `Question: ${question}
      User answer: ${userAnswer}
      Concepts to connect: ${allConcepts.map((c) => c.name).join(", ")}
      
      Response format based on understanding level:
      
      For strong answers:
      **✓ Excellent synthesis!**
      
      **What you captured well:**
      • {Specific insight they demonstrated}
      • {Another good connection they made}
      
      **Additional perspective:** {Deeper connection or implication they might not have considered}
      
      For partial understanding:
      **✓ Good thinking!**
      
      **What you got right:**
      • {Acknowledge correct elements}
      
      **Let me expand on this:**
      {Paragraph explaining the deeper connections and relationships}
      
      **Key insight:** {The critical connection explained clearly with example}
      
      For minimal understanding or "I don't know":
      **Let me help you see these connections:**
      
      **The relationship here:**
      {Full paragraph teaching how these concepts connect}
      
      **Think about it this way:**
      {Analogy or example that makes the abstract concrete}
      
      **In practice:** {Real-world application showing the connection}
      
      **Key takeaway:** {Simple summary of the main relationship}`,
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
      system: `You are an expert educator helping learners understand the deeper "why" behind ${item} in ${concept.name}.
      
      CRITICAL: If the user says "I'm not sure" or shows uncertainty:
      1. DIRECTLY ANSWER the specific question asked
      2. Explain the reasoning and mechanisms clearly
      3. Use concrete examples to illustrate
      4. Teach, don't just evaluate
      
      RESPONSE STRUCTURE:
      For uncertain/incorrect answers:
      **Let me explain this clearly:**
      {Direct answer to the exact question}
      
      **Here's why this works this way:**
      • {Specific mechanism or cause}
      • {Supporting evidence or example}
      • {Deeper principle at play}
      
      **Think of it like this:** {Helpful analogy}
      
      **Key insight:** {The crucial takeaway}
      
      For correct answers:
      **✓ Excellent understanding!**
      {Acknowledge what they got right}
      
      **Let me add:** {Additional depth or nuance}`,
      prompt: `Elaboration question: ${question}
      About item: ${item}
      User answer: ${userAnswer}
      
      If they're uncertain, ANSWER THE QUESTION DIRECTLY first.
      Then explain the mechanisms and reasoning clearly.
      Be educational and helpful, not just evaluative.`,
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
      system: `Help the user understand how ${performingItem} connects to ${strugglingItem} in ${concept.name}.
      
      For uncertain answers:
      - DIRECTLY explain the connection asked about
      - Use the known item to illuminate the struggling one
      - Make the relationship clear and memorable
      
      STRUCTURE for uncertain answers:
      **Let me show you the connection:**
      
      **Direct answer:** {How these two items actually relate}
      
      **The key similarity:** {What they share and why it matters}
      
      **The crucial difference:** {What distinguishes them}
      
      **Think of it this way:** {Analogy using the known item to explain the struggling one}
      
      **Remember:** {Simple rule to distinguish them}`,
      prompt: `Connection question: ${question}
      Linking: ${performingItem} (known) to ${strugglingItem} (struggling)
      User answer: ${userAnswer}
      
      If uncertain, EXPLAIN THE CONNECTION clearly.
      Use their knowledge of ${performingItem} to help them understand ${strugglingItem}.
      Be educational and helpful, showing how the items relate.`,
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
      system: `You are helping learners synthesize their understanding of ${concept.name}.
      
      <user-level>
      Existing Understanding: ${existingUnderstanding}
      </user-level>
      
      CRITICAL for uncertain answers ("I'm not sure", "I don't know"):
      1. DIRECTLY ANSWER the specific question asked
      2. Don't just list patterns - explain the actual answer
      3. If asked "which is more critical", say which and why
      4. If asked about trade-offs, explain the specific trade-offs
      5. Teach the concept, don't just summarize
      
      <difficulty-adjusted-evaluation>
      ${
        existingUnderstanding === 'None - Complete beginner'
          ? `**For Beginners:**
      - Accept simpler pattern recognition as good synthesis
      - Praise basic comparisons and groupings
      - Provide more guidance and examples
      - Use everyday analogies to explain concepts
      - Break down complex ideas into simple parts`
          : existingUnderstanding === 'Some - I know the basics'
          ? `**For Intermediate Learners:**
      - Expect pattern analysis and trade-off recognition
      - Look for cause-and-effect understanding
      - Provide balanced feedback with some depth
      - Use domain-specific examples
      - Connect to broader concepts`
          : `**For Advanced Learners:**
      - Expect sophisticated analysis and counter-intuitive insights
      - Look for nuanced understanding of edge cases
      - Provide minimal guidance, more challenging perspectives
      - Use complex, professional examples
      - Explore second-order effects and systems thinking`
      }
      </difficulty-adjusted-evaluation>
      
      RESPONSE STRUCTURE for uncertain answers:
      **Let me help you understand this:**
      
      **Direct answer:** {Answer the exact question - e.g., "X is more critical because..."}
      
      **Here's the reasoning:**
      • {Specific explanation of why this answer is correct}
      • {Evidence or examples supporting this}
      • {Trade-offs or conditions mentioned in the question}
      
      **The key principle:** {Core insight that answers their question}
      
      **In practice:** {Real example showing this principle}
      
      For good answers:
      **✓ Good synthesis!**
      {What they understood well}
      
      **Let me add:** {Additional insight or nuance}`,
      prompt: `High-level question: ${question}
      Items covered: ${itemsCovered.join(", ")}
      Topics: ${concept["high-level"].join(", ")}
      User answer: ${userAnswer}
      
      IMPORTANT: If they're uncertain, ANSWER THE SPECIFIC QUESTION.
      Don't give generic patterns - address what was actually asked.
      For example, if asked "which is more critical", say which one and explain why.
      If asked about trade-offs, explain the actual trade-offs.`,
    });

    return text;
  }
}
