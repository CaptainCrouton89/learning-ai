import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Course } from "../../types/course.js";
import { ConceptDetailSchema, CourseGenerationSchema } from "./schemas.js";
import { conceptDetailPrompts, coursePrompts } from "./prompts.js";

export class CourseService {
  private smartModel = openai("gpt-4.1");

  async generateCourseStructure(
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    depth: string,
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
        depth,
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
            depth
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
      concepts: conceptDetails,
      "drawing-connections": courseBase["drawing-connections"],
    };
  }
}