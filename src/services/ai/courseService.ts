import { generateObject, generateText } from "ai";
import { z } from "zod";
import { models } from '@/config/models';
import { Course } from '@/types/course';
import {
  conceptDetailPrompts,
  coursePrompts,
  topicRefinementPrompts,
} from './prompts';
import { ConceptDetailSchema, CourseGenerationSchema } from './schemas';

export class CourseService {
  async analyzeTopic(
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ): Promise<{
    is_appropriate: boolean;
    reason: string;
    suggested_refinements: string[];
    clarifying_questions: string[];
  }> {
    const { object } = await generateObject({
      model: models.fast,
      schema: z.object({
        is_appropriate: z.boolean(),
        reason: z.string(),
        suggested_refinements: z.array(z.string()),
        clarifying_questions: z.array(z.string()),
      }),
      system: topicRefinementPrompts.system,
      prompt: topicRefinementPrompts.analyzeTopicPrompt(
        topic,
        timeAvailable,
        existingUnderstanding
      ),
    });

    return object;
  }

  async refineTopic(
    originalTopic: string,
    userResponse: string,
    timeAvailable: string
  ): Promise<string> {
    const { text } = await generateText({
      model: models.fast,
      system: topicRefinementPrompts.system,
      prompt: topicRefinementPrompts.generateFollowUpPrompt(
        originalTopic,
        userResponse,
        timeAvailable
      ),
    });

    return text;
  }

  async generateCourseStructure(
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    existingUnderstanding: string,
    learningGoals: string
  ): Promise<Course> {
    console.log("Generating course structure...");

    const { object: courseBase } = await generateObject({
      model: models.reasoningHigh,
      schema: CourseGenerationSchema,
      system: coursePrompts.system,
      providerOptions: {
        openai: {
          reasoning_effort: "medium",
        },
      },
      prompt: coursePrompts.userPrompt(
        topic,
        documentContent,
        timeAvailable,
        existingUnderstanding,
        learningGoals
      ),
    });

    const conceptDetails = await Promise.all(
      courseBase.concepts.map(async (concept) => {
        const { object: details } = await generateObject({
          model: models.reasoningMini,
          schema: ConceptDetailSchema,
          system: conceptDetailPrompts.system,
          prompt: conceptDetailPrompts.userPrompt(
            courseBase.name,
            concept.name,
            courseBase.concepts
              .map((c) => c.name)
              .filter((n) => n !== concept.name),
            timeAvailable,
            existingUnderstanding
          ),
        });
        return {
          name: concept.name,
          ...details,
        };
      })
    );

    return {
      name: courseBase.name,
      backgroundKnowledge: courseBase.backgroundKnowledge,
      concepts: conceptDetails,
      "drawing-connections": courseBase["drawing-connections"],
    };
  }
}
