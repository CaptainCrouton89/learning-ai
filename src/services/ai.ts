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
      system: `<role>
You are facilitating foundational understanding of "${course.name}".
</role>

<approach>
- Ask questions that reveal conceptual understanding
- Focus on "why" and "how" rather than "what"
- Build from fundamental principles
- Connect to real-world relevance
- One clear question at a time
</approach>`,
      prompt: `<context>
${conversationHistory.length > 0 ? `Previous discussion:\n${conversationHistory.slice(-4).map(entry => `${entry.role}: ${entry.content}`).join("\n\n")}` : 'Starting the conversation.'}
</context>

Ask a probing question about ${course.name} that explores foundational understanding.`,
    });

    return text;
  }

  async evaluateHighLevelAnswer(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    includeFollowUp: boolean = false
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are guiding foundational understanding of "${course.name}".
</role>

<objectives>
- Address misconceptions with clear explanations
- Build on correct understanding with additional context
- Focus on substantive content over evaluative comments
- Connect to broader principles
</objectives>

<guidelines>
1. Skip phrases like "good point", "exactly right", or "you're getting it"
2. Directly address any factual errors
3. Add specific details or examples that deepen understanding
4. Make connections explicit rather than implied
</guidelines>

${includeFollowUp ? `<follow-up>
After addressing their response, ask a question that:
- Builds directly on what they've said
- Explores implications or applications
- Challenges them to think deeper
</follow-up>` : ''}`,
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory.slice(-4).map(entry => `${entry.role}: ${entry.content}`).join("\n\n")}
</context>

${includeFollowUp ? 'Provide substantive feedback, then ask a follow-up question that builds on their understanding.' : 'Provide substantive feedback on their response.'}`,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are an expert educator facilitating deep learning of "${concept.name}".
</role>

<key-topics>
${concept["high-level"].map(topic => `• ${topic}`).join("\n")}
</key-topics>

<approach>
- Ask specific, thought-provoking questions
- Focus on one clear concept at a time
- Use concrete scenarios when applicable
- Build complexity gradually
- Encourage critical thinking over recall
</approach>`,
      prompt: `<context>
${conversationHistory.length > 0 ? `Recent discussion:\n${conversationHistory.slice(-3).map(entry => `${entry.role}: ${entry.content}`).join("\n\n")}` : 'This is the beginning of our discussion.'}
</context>

Generate a focused question or teaching point that explores a specific aspect of ${concept.name}.`,
    });

    return text;
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    includeFollowUp: boolean = false
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are an expert educator teaching "${concept.name}" through substantive dialogue.
</role>

<objectives>
- Provide specific, actionable insights that advance understanding
- Focus on content rather than evaluation
- Use concrete examples and analogies when helpful
- Build on what the learner knows to introduce new connections
</objectives>

<key-topics>
${concept["high-level"].map(topic => `• ${topic}`).join("\n")}
</key-topics>

<guidelines>
1. Address factual accuracy directly if needed
2. Expand on partial understanding with specific details
3. Connect ideas to practical applications or real examples
4. Introduce one new insight or perspective
5. Avoid phrases like "great job", "you're on the right track", or "that's correct"
6. Skip meta-commentary about the learner's progress or understanding level
</guidelines>

${includeFollowUp ? `<follow-up>
After addressing their response, pose a question that:
- Explores a specific aspect they haven't mentioned
- Challenges them to apply the concept differently
- Connects to a related idea naturally
</follow-up>` : ''}`,
      prompt: `<user-response>
${userAnswer}
</user-response>

<context>
Recent conversation:
${conversationHistory.slice(-4).map(entry => `${entry.role}: ${entry.content}`).join("\n\n")}
</context>

${includeFollowUp ? 'Provide substantive feedback that advances their understanding, then ask a specific follow-up question.' : 'Provide substantive feedback that advances their understanding.'}`,
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
