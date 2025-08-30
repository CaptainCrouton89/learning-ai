import chalk from "chalk";
import inquirer from "inquirer";
import { AIService } from "../services/ai/index.js";
import { CourseManager } from "../services/courseManager.js";
import {
  Concept,
  ConceptAttempt,
  Course,
  LearningSession,
} from "../types/course.js";
import { displayProgressSection } from "../utils/progressBar.js";

export class ConceptLearningPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();

  async start(course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue("\n🎯 Time to dive into specific concepts!\n"));

    for (const concept of course.concepts) {
      const { ready } = await inquirer.prompt([
        {
          type: "confirm",
          name: "ready",
          message: `Ready to learn about "${concept.name}"?`,
          default: true,
        },
      ]);

      if (!ready) {
        console.log(chalk.gray("Skipping this concept for now..."));
        continue;
      }

      await this.learnConcept(concept, course, session);

      const { continueToNext } = await inquirer.prompt([
        {
          type: "confirm",
          name: "continueToNext",
          message: "Ready to move to the next concept?",
          default: true,
        },
      ]);

      if (!continueToNext) {
        console.log(chalk.gray("Take a break! You can resume later."));
        break;
      }
    }
  }

  private async learnConcept(
    concept: Concept,
    course: Course,
    session: LearningSession
  ): Promise<void> {
    console.log(chalk.yellow(`\n📚 Learning: ${concept.name}\n`));
    console.log(chalk.gray("Topics we'll master:"));
    concept["high-level"].forEach((topic) => {
      console.log(chalk.gray(`  • ${topic}`));
    });
    console.log();

    await this.courseManager.updateSessionPhase(
      session,
      "concept-learning",
      concept.name
    );

    // Track which topics are mastered
    let unmasteredTopics = this.courseManager.getUnmasteredTopics(
      session,
      concept.name,
      concept["high-level"]
    );

    // Show initial progress
    this.displayTopicProgress(session, concept);

    // Generate the first question to start the conversation (with introduction)
    const firstQuestion = await this.ai.generateConceptQuestion(
      concept,
      session.conversationHistory.slice(-10),
      session.existingUnderstanding || "Some - I know the basics",
      true // isFirstQuestion flag for introduction
    );
    console.log(chalk.cyan(`\n${firstQuestion}\n`));
    await this.courseManager.addConversationEntry(
      session,
      "assistant",
      firstQuestion
    );

    let questionCount = 0;

    // Continue until all topics are mastered
    while (unmasteredTopics.length > 0) {
      const { answer } = await inquirer.prompt([
        {
          type: "input",
          name: "answer",
          message: "Your thoughts (or /skip to skip):",
          validate: (input) =>
            input.length > 0 || "Please share your thoughts or type /skip",
        },
      ]);

      // Handle skip command
      if (answer.toLowerCase() === "/skip") {
        console.log(chalk.yellow("\n⏭️  Skipping this topic..."));

        // Create a skip attempt with max comprehension
        const skipAttempt: ConceptAttempt = {
          question:
            session.conversationHistory[session.conversationHistory.length - 1]
              .content,
          userAnswer: "/skip",
          aiResponse: {
            comprehension: 5,
            response: "Topic skipped by user",
            targetTopic: unmasteredTopics[0], // Assign to first unmastered topic
          },
          timestamp: new Date(),
        };

        await this.courseManager.updateConceptTopicProgress(
          session,
          concept.name,
          skipAttempt
        );
        await this.courseManager.addConversationEntry(session, "user", "/skip");
        await this.courseManager.addConversationEntry(
          session,
          "assistant",
          "Topic marked as mastered (skipped)."
        );

        // Update unmastered topics list
        unmasteredTopics = this.courseManager.getUnmasteredTopics(
          session,
          concept.name,
          concept["high-level"]
        );

        // Generate next question if topics remain
        if (unmasteredTopics.length > 0) {
          const nextQuestion = await this.ai.generateConceptQuestion(
            concept,
            session.conversationHistory.slice(-10),
            session.existingUnderstanding
          );
          console.log(chalk.cyan(`\n${nextQuestion}\n`));
          await this.courseManager.addConversationEntry(
            session,
            "assistant",
            nextQuestion
          );
        }

        continue;
      }

      await this.courseManager.addConversationEntry(session, "user", answer);

      // Get feedback with comprehension scores in a single call
      const { response, comprehensionUpdates } =
        await this.ai.generateConceptResponse(
          answer,
          concept,
          session.conversationHistory.slice(-10),
          session.existingUnderstanding,
          unmasteredTopics
        );

      // Display feedback first
      console.log(chalk.green(`\n${response}\n`));
      await this.courseManager.addConversationEntry(
        session,
        "assistant",
        response
      );

      // Update comprehension for each topic addressed
      for (const update of comprehensionUpdates) {
        console.log(
          chalk.cyan(
            `Comprehension for "${update.topic}": ${update.comprehension}/5`
          )
        );

        // Create attempt record for each topic
        const attempt: ConceptAttempt = {
          question:
            session.conversationHistory[session.conversationHistory.length - 3]
              .content,
          userAnswer: answer,
          aiResponse: {
            comprehension: update.comprehension,
            response: response,
            targetTopic: update.topic,
          },
          timestamp: new Date(),
        };

        // Update topic progress
        await this.courseManager.updateConceptTopicProgress(
          session,
          concept.name,
          attempt
        );
      }

      // Update unmastered topics list
      unmasteredTopics = this.courseManager.getUnmasteredTopics(
        session,
        concept.name,
        concept["high-level"]
      );

      // The response already includes a follow-up question, so no need to generate another one

      questionCount++;

      // Show progress every 3 questions
      if (questionCount % 3 === 0) {
        this.displayTopicProgress(session, concept);

        if (unmasteredTopics.length > 0) {
          const { continueQuestions } = await inquirer.prompt([
            {
              type: "confirm",
              name: "continueQuestions",
              message: `Continue working on the remaining topics for "${concept.name}"?`,
              default: true,
            },
          ]);

          if (!continueQuestions) {
            console.log(
              chalk.yellow(
                "\nStopping early. You can resume to complete the remaining topics."
              )
            );
            break;
          }
        }
      }
    }

    if (unmasteredTopics.length === 0) {
      console.log(
        chalk.yellow(
          `\n✅ Excellent! You've mastered all topics in "${concept.name}"!\n`
        )
      );
      this.displayTopicProgress(session, concept);
    } else {
      console.log(chalk.yellow(`\n📝 Good progress on "${concept.name}".\n`));
      console.log(
        chalk.gray(`Topics still to master: ${unmasteredTopics.join(", ")}\n`)
      );
    }

    console.log(
      chalk.gray(
        "Now let's practice with flashcards to solidify your knowledge.\n"
      )
    );

    const { readyForFlashcards } = await inquirer.prompt([
      {
        type: "confirm",
        name: "readyForFlashcards",
        message: "Ready to start flashcard practice?",
        default: true,
      },
    ]);

    if (readyForFlashcards) {
      const { MemorizationPhase } = await import("./memorization.js");
      const memorizationPhase = new MemorizationPhase();
      await memorizationPhase.start(concept, course, session);
    }
  }

  private displayTopicProgress(
    session: LearningSession,
    concept: Concept
  ): void {
    const comprehensionMap = this.courseManager.getAllTopicsComprehension(
      session,
      concept.name,
      concept["high-level"]
    );

    displayProgressSection("📊 Topic Progress:", comprehensionMap);
  }
}
