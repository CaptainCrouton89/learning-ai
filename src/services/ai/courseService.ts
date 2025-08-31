import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { Course } from "../../types/course.js";
import {
  conceptDetailPrompts,
  coursePrompts,
  topicRefinementPrompts,
} from "./prompts/index.js";
import { ConceptDetailSchema, CourseGenerationSchema } from "./schemas.js";

export class CourseService {
  private smartModel = openai("gpt-4.1");
  private fastModel = openai("gpt-5-mini");

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
      model: this.fastModel,
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
      model: this.fastModel,
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
      model: this.smartModel,
      schema: CourseGenerationSchema,
      system: coursePrompts.system,
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
          model: this.smartModel,
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
