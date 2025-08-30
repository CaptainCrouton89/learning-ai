import chalk from "chalk";
import { promises as fs } from "fs";
import inquirer from "inquirer";
import ora from "ora";
import { AIService } from "../services/ai.js";
import { CourseManager } from "../services/courseManager.js";
import { Course } from "../types/course.js";

export class InitializationPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();

  async start(options: { file?: string; topic?: string }): Promise<Course> {
    console.log(chalk.blue("\n📚 Welcome to AI Learning Tool!\n"));

    let documentContent: string | null = null;
    let topic: string;

    if (options.file) {
      const spinner = ora("Loading document...").start();
      try {
        documentContent = await fs.readFile(options.file, "utf-8");
        spinner.succeed("Document loaded successfully");

        const { extractedTopic } = await inquirer.prompt([
          {
            type: "input",
            name: "extractedTopic",
            message: "What topic from this document would you like to learn?",
            default: "the main concepts in this document",
          },
        ]);
        topic = extractedTopic;
      } catch (error) {
        spinner.fail("Failed to load document");
        throw error;
      }
    } else if (options.topic) {
      topic = options.topic;
    } else {
      const { selectedTopic } = await inquirer.prompt([
        {
          type: "input",
          name: "selectedTopic",
          message: "What topic would you like to learn about?",
          validate: (input) => input.length > 0 || "Please enter a topic",
        },
      ]);
      topic = selectedTopic;
    }

    const { timeAvailable } = await inquirer.prompt([
      {
        type: "list",
        name: "timeAvailable",
        message: "How much time do you have for learning?",
        choices: [
          { name: "Quick overview - 15 minutes", value: "15min" },
          { name: "Standard session - 30 minutes", value: "30min" },
          { name: "Deep dive - 1 hour", value: "1hour" },
          { name: "Comprehensive - As long as it takes", value: "2hours+" },
        ],
      },
    ]);

    const { depth } = await inquirer.prompt([
      {
        type: "list",
        name: "depth",
        message: "How in-depth would you like to go?",
        choices: [
          { name: "Beginner - Start with basics", value: "beginner" },
          {
            name: "Intermediate - Some prior knowledge",
            value: "intermediate",
          },
          { name: "Advanced - Deep technical details", value: "advanced" },
        ],
      },
    ]);

    console.log(chalk.cyan("\n📝 Tell me what you want to focus on"));
    console.log(
      chalk.gray(
        'For example: "I want to understand the basics and practical applications"'
      )
    );
    console.log(
      chalk.gray('or: "Help me master advanced techniques and edge cases"')
    );
    console.log(
      chalk.gray('or: "I need to learn how to troubleshoot common problems"\n')
    );

    const { focusDescription } = await inquirer.prompt([
      {
        type: "input",
        name: "focusDescription",
        message: "What aspects of " + topic + " do you want to focus on?",
        validate: (input) =>
          input.trim().length > 10 || "Please describe what you want to learn",
      },
    ]);

    const spinner = ora("Creating your personalized course...").start();

    try {
      const course = await this.ai.generateCourseStructure(
        topic,
        documentContent,
        timeAvailable,
        depth,
        focusDescription
      );

      await this.courseManager.saveCourse(course);
      spinner.succeed("Course created successfully!");

      console.log(
        chalk.green(`\n✅ Course "${course.name}" has been created!`)
      );
      console.log(
        chalk.gray(`Found ${course.concepts.length} concepts to learn:`)
      );
      course.concepts.forEach((c) => {
        console.log(chalk.gray(`  - ${c.name}`));
      });

      return course;
    } catch (error) {
      spinner.fail("Failed to create course");
      throw error;
    }
  }
}
