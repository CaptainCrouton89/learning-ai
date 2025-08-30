import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { Concept, Course } from "../types/course.js";

const FlashcardResponseSchema = z.object({
  comprehension: z.number().min(0).max(5),
  response: z.string(),
});

const CourseGenerationSchema = z.object({
  name: z.string(),
  concepts: z.array(
    z.object({
      name: z.string(),
    })
  ),
  "drawing-connections": z.array(z.string()),
});

const ConceptDetailSchema = z.object({
  "high-level": z.array(z.string()).describe("List of high-level topics to understand about this concept"),
  memorize: z.object({
    fields: z.array(z.string()).describe("Column headers for the flashcard table (e.g., 'Term', 'Definition', 'Example')"),
    items: z.array(z.string()).describe("List of item names/terms to memorize (e.g., 'Photosynthesis', 'Mitosis'). Just the names, not the full data"),
  }).describe("Flashcard structure with field headers and item names to memorize"),
});

export class AIService {
  private smartModel = openai("gpt-4.1");
  private model = openai("gpt-4.1-mini");

  async generateCourseStructure(
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    depth: string,
    learningGoals: string
  ): Promise<Course> {
    console.log("Generating course structure...");

    const basePrompt = `Create a course structure for learning about ${topic}.
    Time available: ${timeAvailable}
    Depth level: ${depth}
    
    The learner has described their goals as:
    ${learningGoals}
    
    ${documentContent ? `Reference document content: ${documentContent}` : ""}`;

    const { object: courseBase } = await generateObject({
      model: this.smartModel,
      schema: CourseGenerationSchema,
      prompt: basePrompt,
    });

    const conceptDetails = await Promise.all(
      courseBase.concepts.map(async (concept) => {
        const { object: details } = await generateObject({
          model: this.smartModel,
          schema: ConceptDetailSchema,
          prompt: `Generate detailed learning structure for the concept "${concept.name}" in the course "${courseBase.name}".
          Include high-level topics to understand and items to memorize.
          For memorize.items, provide ONLY the item names/terms as strings (e.g., ["Photosynthesis", "Mitosis", "Cell Division"]).
          For memorize.fields, provide the column headers that describe what aspects to learn about each item (e.g., ["Term", "Definition", "Example"]).`,
        });
        return {
          name: concept.name,
          ...details,
        };
      })
    );

    return {
      name: courseBase.name,
      concepts: conceptDetails,
      "drawing-connections": courseBase["drawing-connections"],
    };
  }

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `You are teaching the high-level concepts of ${course.name}.
      Ask probing questions to build foundational understanding.
      Keep questions focused on understanding rather than memorization.`,
      prompt: `Based on the conversation so far, ask the next question to probe understanding of ${
        course.name
      }.
      Conversation history: ${JSON.stringify(conversationHistory)}`,
    });

    return text;
  }

  async evaluateHighLevelAnswer(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `You are teaching ${course.name}. 
      Provide feedback on the user's answer, correct if necessary.
      Be encouraging but accurate.`,
      prompt: `User answered: ${userAnswer}
      Conversation history: ${JSON.stringify(conversationHistory)}
      Provide feedback on this answer.`,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `You are teaching the concept "${concept.name}".
      Focus on: ${concept["high-level"].join(", ")}
      Use analogies and break things down. Ask questions to check understanding.`,
      prompt: `Generate the next teaching point or question for ${concept.name}.
      Conversation history: ${JSON.stringify(conversationHistory)}`,
    });

    return text;
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
