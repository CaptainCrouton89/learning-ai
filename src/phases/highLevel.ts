import chalk from "chalk";
import inquirer from "inquirer";
import { AIService } from "../services/ai/index.js";
import { getCourseManager } from "../config/storage.js";
import { ConceptAttempt, Course, LearningSession } from "../types/course.js";
import { createProgressBar, displayProgressSection } from "../utils/progressBar.js";

export class HighLevelPhase {
  private ai = new AIService();

  async start(course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue("\n📖 Let's start with a high-level overview\n"));
    console.log(
      chalk.gray(
        "I'll introduce key concepts and build your foundational understanding.\n"
      )
    );
    console.log(
      chalk.gray("Type /skip at any time if you're already familiar with a topic.\n")
    );

    const courseManager = await getCourseManager();
    await courseManager.updateSessionPhase(session, "high-level");

    // Use backgroundKnowledge if available, otherwise use concept names as fallback
    const highLevelTopics = course.backgroundKnowledge && course.backgroundKnowledge.length > 0
      ? course.backgroundKnowledge
      : course.concepts.map((c) => c.name);
    
    let unmasteredTopics = courseManager.getUnmasteredTopics(
      session,
      "high-level",
      highLevelTopics
    );

    // Show initial progress
    await this.displayHighLevelProgress(session, highLevelTopics);

    // Check if user has existing progress in high-level phase
    const conceptProgress = session.conceptsProgress.get("high-level");
    const hasExistingProgress = conceptProgress && conceptProgress.topicProgress.size > 0;
    
    // Determine if we should show introduction based on existing progress
    const isFirstQuestion = !hasExistingProgress;
    
    // Generate appropriate question (with or without introduction)
    const firstQuestion = await this.ai.generateHighLevelQuestion(
      course,
      session.conversationHistory.slice(-10),
      session.existingUnderstanding || "Some - I know the basics",
      isFirstQuestion
    );
    
    // Add context message if resuming with progress
    if (hasExistingProgress && unmasteredTopics.length > 0) {
      console.log(chalk.gray("\n📚 Resuming where we left off...\n"));
    }
    
    console.log(chalk.cyan(`\n${firstQuestion}\n`));
    await courseManager.addConversationEntry(
      session,
      "assistant",
      firstQuestion
    );

    let questionCount = 0;
    const maxQuestions = 15; // Safety limit

    while (unmasteredTopics.length > 0 && questionCount < maxQuestions) {
      const { answer } = await inquirer.prompt([
        {
          type: "input",
          name: "answer",
          message: "Your answer (or /skip to skip):",
          validate: (input) =>
            input.length > 0 || "Please provide an answer or type /skip",
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

        await courseManager.updateConceptTopicProgress(
          session,
          "high-level",
          skipAttempt
        );
        await courseManager.addConversationEntry(session, "user", "/skip");
        await courseManager.addConversationEntry(
          session,
          "assistant",
          "Topic marked as understood (skipped)."
        );

        // Update unmastered topics list
        unmasteredTopics = courseManager.getUnmasteredTopics(
          session,
          "high-level",
          highLevelTopics
        );

        // Generate a new question after skip since there's no follow-up in the response
        if (unmasteredTopics.length > 0) {
          const nextQuestion = await this.ai.generateHighLevelQuestion(
            course,
            session.conversationHistory.slice(-10),
            session.existingUnderstanding
          );
          console.log(chalk.cyan(`\n${nextQuestion}\n`));
          await courseManager.addConversationEntry(
            session,
            "assistant",
            nextQuestion
          );
        }

        continue;
      }

      await courseManager.addConversationEntry(session, "user", answer);

      // Get current comprehension progress for all topics
      const comprehensionProgress =
        courseManager.getAllTopicsComprehension(
          session,
          "high-level",
          highLevelTopics
        );

      // Get feedback with comprehension scores in a single call
      const { response, comprehensionUpdates } =
        await this.ai.generateHighLevelResponse(
          answer,
          course,
          session.conversationHistory.slice(-10),
          session.existingUnderstanding || "Some - I know the basics",
          comprehensionProgress
        );

      // Display feedback first
      console.log(chalk.green(`\n${response}\n`));
      await courseManager.addConversationEntry(
        session,
        "assistant",
        response
      );

      // Update comprehension for each topic addressed
      const improvedTopics: Array<{ topic: string; oldScore: number; newScore: number }> = [];
      
      for (const update of comprehensionUpdates) {
        // Get current comprehension before update
        const conceptProgress = session.conceptsProgress.get("high-level");
        const currentComprehension = conceptProgress?.topicProgress.get(update.topic)?.currentComprehension ?? 0;
        
        // Only update if the new score is higher (never decrease)
        const finalComprehension = Math.max(currentComprehension, update.comprehension);
        
        // Track improvements for display
        if (finalComprehension > currentComprehension) {
          improvedTopics.push({
            topic: update.topic,
            oldScore: currentComprehension,
            newScore: finalComprehension
          });
        }

        // Create attempt record for each topic
        const attempt: ConceptAttempt = {
          question:
            session.conversationHistory[session.conversationHistory.length - 3]
              .content,
          userAnswer: answer,
          aiResponse: {
            comprehension: finalComprehension,
            response: response,
            targetTopic: update.topic,
          },
          timestamp: new Date(),
        };

        // Update topic progress
        await courseManager.updateConceptTopicProgress(
          session,
          "high-level",
          attempt
        );
      }
      
      // Display progress for improved topics only
      if (improvedTopics.length > 0) {
        console.log();
        for (const improved of improvedTopics) {
          const progressBar = createProgressBar({
            current: improved.newScore,
            max: 5,
            filledChar: '█',
            emptyChar: '░',
            filledColor: improved.newScore === 5 ? chalk.green : chalk.cyan,
            emptyColor: chalk.gray,
            showRatio: true,
            length: 10
          });
          
          const icon = improved.newScore === 5 ? chalk.green('✓') : chalk.yellow('↑');
          console.log(
            `  ${icon} ${chalk.white(improved.topic)}: ${progressBar}`
          );
        }
        console.log();
      }

      // Update unmastered topics list
      unmasteredTopics = courseManager.getUnmasteredTopics(
        session,
        "high-level",
        highLevelTopics
      );

      // The response already includes a follow-up question, so no need to generate another one

      questionCount++;

      // Continue phase check every 3 questions (without progress display)
      if (questionCount % 3 === 0) {
        if (unmasteredTopics.length > 0 && questionCount < maxQuestions - 3) {
          const { continuePhase } = await inquirer.prompt([
            {
              type: "confirm",
              name: "continuePhase",
              message:
                "Would you like to continue with more high-level questions?",
              default: true,
            },
          ]);

          if (!continuePhase) {
            console.log(
              chalk.yellow(
                "\nStopping early. You can resume to complete the overview."
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
          "\n🎯 Great! You have a solid foundation for the course!\n"
        )
      );
      await this.displayHighLevelProgress(session, highLevelTopics);
    } else {
      console.log(chalk.yellow("\n📝 Good progress with the overview!\n"));
      if (questionCount >= maxQuestions) {
        console.log(
          chalk.gray(
            "Let's move forward - you have enough foundation to continue.\n"
          )
        );
      } else {
        console.log(
          chalk.gray(`Topics we touched on: ${unmasteredTopics.join(", ")}\n`)
        );
      }
    }

    const { hasQuestions } = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasQuestions",
        message:
          "Do you have any questions before we dive into specific topics?",
        default: false,
      },
    ]);

    if (hasQuestions) {
      await this.handleUserQuestions(course, session);
    }

    const { readyToContinue } = await inquirer.prompt([
      {
        type: "confirm",
        name: "readyToContinue",
        message: "Ready to dive into more focused topics?",
        default: true,
      },
    ]);

    if (!readyToContinue) {
      console.log(chalk.gray("Take your time! Resume when you're ready."));
      process.exit(0);
    }
  }

  private async handleUserQuestions(
    course: Course,
    session: LearningSession
  ): Promise<void> {
    let askingQuestions = true;

    while (askingQuestions) {
      const { question } = await inquirer.prompt([
        {
          type: "input",
          name: "question",
          message: "What would you like to know?",
          validate: (input) => input.length > 0 || "Please ask a question",
        },
      ]);

      const courseManager = await getCourseManager();
      await courseManager.addConversationEntry(session, "user", question);

      console.log(chalk.gray("\nLet me explain...\n"));

      // Get current comprehension progress for context
      const highLevelTopics = course.concepts.map((c) => c.name);
      const comprehensionProgress =
        courseManager.getAllTopicsComprehension(
          session,
          "high-level",
          highLevelTopics
        );

      const { response } = await this.ai.generateHighLevelResponse(
        question,
        course,
        session.conversationHistory.slice(-10),
        session.existingUnderstanding || "Some - I know the basics",
        comprehensionProgress
      );

      console.log(chalk.green(response));
      await courseManager.addConversationEntry(
        session,
        "assistant",
        response
      );

      const { moreQuestions } = await inquirer.prompt([
        {
          type: "confirm",
          name: "moreQuestions",
          message: "\nDo you have more questions?",
          default: false,
        },
      ]);

      askingQuestions = moreQuestions;
    }
  }

  private async displayHighLevelProgress(
    session: LearningSession,
    topics: string[]
  ): Promise<void> {
    console.log(chalk.blue("\n📊 Overview Progress:"));
    const courseManager = await getCourseManager();
    const comprehensionMap = courseManager.getAllTopicsComprehension(
      session,
      "high-level",
      topics
    );

    displayProgressSection("📊 Overview Progress:", comprehensionMap);
  }
}
