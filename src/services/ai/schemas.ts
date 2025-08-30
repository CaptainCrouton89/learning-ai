import { z } from "zod";

export const FlashcardResponseSchema = z.object({
  comprehension: z.number().min(0).max(5),
  response: z.string(),
});

export const ConceptAnswerEvaluationSchema = (targetTopicOptions: string[]) => 
  z.object({
    comprehension: z.number().min(0).max(5),
    response: z.string(),
    targetTopic: z
      .enum(targetTopicOptions as [string, ...string[]])
      .describe("The specific high-level topic this Q&A addressed"),
  });

export const ComprehensionUpdateSchema = (targetTopicOptions: string[]) =>
  z.object({
    updates: z.array(
      z.object({
        topic: z
          .enum(targetTopicOptions as [string, ...string[]])
          .describe("The topic to update comprehension for"),
        comprehension: z
          .number()
          .min(0)
          .max(5)
          .describe("The comprehension level for this topic (0-5)"),
      })
    ).describe("List of comprehension updates for different topics covered in the response"),
  });

export const CourseGenerationSchema = z.object({
  name: z.string(),
  concepts: z.array(
    z.object({
      name: z.string(),
    })
  ),
  "drawing-connections": z.array(z.string()),
});

export const ConceptDetailSchema = z.object({
  "high-level": z
    .array(z.string())
    .describe("List of high-level topics to understand about this concept"),
  memorize: z
    .object({
      fields: z
        .array(z.string())
        .describe(
          "Column headers for the flashcard table (e.g., 'Term', 'Definition', 'Example')"
        ),
      items: z
        .array(z.string())
        .describe(
          "List of item names/terms to memorize (e.g., 'Photosynthesis', 'Mitosis'). Just the names, not the full data"
        ),
    })
    .describe(
      "Flashcard structure with field headers and item names to memorize"
    ),
});