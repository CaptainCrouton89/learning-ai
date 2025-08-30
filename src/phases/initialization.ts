import chalk from "chalk";
import { promises as fs } from "fs";
import inquirer from "inquirer";
import ora from "ora";
import { AIService } from "../services/ai/index.js";
import { CourseManager } from "../services/courseManager.js";
import { Course } from "../types/course.js";

export class InitializationPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();

  async start(options: { file?: string; topic?: string }): Promise<{ course: Course; existingUnderstanding: string; timeAvailable: string }> {
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
          { name: "Micro-learning - Under 15 minutes", value: "<15min" },
          { name: "Quick session - 15-60 minutes", value: "15-60min" },
          { name: "Standard learning - 1-6 hours", value: "1-6hours" },
          { name: "Deep dive - 6-12 hours", value: "6-12hours" },
          { name: "Comprehensive mastery - 12+ hours", value: "12hours+" },
        ],
      },
    ]);

    const { existingUnderstanding } = await inquirer.prompt([
      {
        type: "list",
        name: "existingUnderstanding",
        message: "What's your current understanding of this topic?",
        choices: [
          { name: "None - Complete beginner", value: "None - Complete beginner" },
          {
            name: "Some - I know the basics",
            value: "Some - I know the basics",
          },
          { name: "Strong - I want advanced insights", value: "Strong - I want advanced insights" },
        ],
      },
    ]);

    // Topic refinement for better scoping, especially for short sessions
    if (timeAvailable === "<15min" || timeAvailable === "15-60min") {
      const topicAnalysis = await this.ai.analyzeTopic(
        topic,
        timeAvailable,
        existingUnderstanding
      );

      if (!topicAnalysis.is_appropriate) {
        console.log(chalk.yellow(`\n⚠️  ${topicAnalysis.reason}\n`));
        
        if (topicAnalysis.suggested_refinements.length > 0) {
          console.log(chalk.cyan("Here are some more focused options:"));
          topicAnalysis.suggested_refinements.forEach((refinement, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${refinement}`));
          });
        }

        if (topicAnalysis.clarifying_questions.length > 0) {
          const { refinementChoice } = await inquirer.prompt([
            {
              type: "list",
              name: "refinementChoice",
              message: topicAnalysis.clarifying_questions[0],
              choices: [
                ...topicAnalysis.suggested_refinements.map((r) => ({
                  name: r,
                  value: r,
                })),
                { name: "Keep my original topic", value: topic },
                { name: "Let me specify differently", value: "custom" },
              ],
            },
          ]);

          if (refinementChoice === "custom") {
            const { customRefinement } = await inquirer.prompt([
              {
                type: "input",
                name: "customRefinement",
                message: "Please specify your refined topic:",
                validate: (input) =>
                  input.length > 0 || "Please enter a topic",
              },
            ]);
            topic = await this.ai.refineTopic(
              topic,
              customRefinement,
              timeAvailable
            );
          } else if (refinementChoice !== topic) {
            topic = refinementChoice;
          }
        }
      }
    }

    console.log(chalk.cyan("\n📝 Tell me what you want to focus on"));
    if (timeAvailable === "<15min") {
      console.log(
        chalk.gray(
          'For a micro-session, be very specific: "I want to understand just the factory pattern"'
        )
      );
      console.log(
        chalk.gray('or: "Help me understand wine acidity basics"')
      );
    } else if (timeAvailable === "15-60min") {
      console.log(
        chalk.gray(
          'For a quick session, focus on core concepts: "I want to understand the main creational patterns"'
        )
      );
      console.log(
        chalk.gray('or: "Help me learn wine structure and food pairing basics"')
      );
    } else {
      console.log(
        chalk.gray(
          'For example: "I want to understand the basics and practical applications"'
        )
      );
      console.log(
        chalk.gray('or: "Help me master advanced techniques and edge cases"')
      );
    }
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
        existingUnderstanding,
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

      return { course, existingUnderstanding, timeAvailable };
    } catch (error) {
      spinner.fail("Failed to create course");
      throw error;
    }
  }
}
