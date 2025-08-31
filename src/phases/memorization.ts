import chalk from "chalk";
import inquirer from "inquirer";
import { AIService } from "../services/ai/index.js";
import { getCourseManager } from "../config/storage.js";
import {
  Concept,
  Course,
  FlashcardSchedule,
  LearningSession,
} from "../types/course.js";

export class MemorizationPhase {
  private ai = new AIService();
  private readonly MIN_EASE = 1.3;
  private readonly MAX_EASE = 4.0;
  private readonly INITIAL_EASE = 2.5;
  private itemsCovered: string[] = [];

  async start(
    concept: Concept,
    course: Course,
    session: LearningSession
  ): Promise<void> {
    console.log(chalk.blue(`\n🧠 Flashcard Practice: ${concept.name}\n`));
    console.log(
      chalk.gray(
        "Using spaced repetition - harder cards will appear more frequently.\n"
      )
    );
    console.log(
      chalk.gray(
        "You'll need to correctly answer each item twice to master it.\n"
      )
    );

    const courseManager = await getCourseManager();
    await courseManager.updateSessionPhase(
      session,
      "memorization",
      concept.name
    );

    const scheduleQueue: FlashcardSchedule[] = [];

    for (const item of concept.memorize.items) {
      const existingSchedule = courseManager.getItemScheduling(
        session,
        concept.name,
        item
      );

      if (existingSchedule && existingSchedule.successCount >= 2) {
        continue;
      }

      scheduleQueue.push({
        item,
        easeFactor: existingSchedule?.easeFactor || this.INITIAL_EASE,
        interval: existingSchedule?.interval || 0,
        duePosition: existingSchedule?.nextDuePosition || 0,
        successCount: existingSchedule?.successCount || 0,
      });
    }

    if (scheduleQueue.length === 0) {
      console.log(
        chalk.green(
          `\n🎉 All items in "${concept.name}" have already been mastered!\n`
        )
      );
      return;
    }

    while (scheduleQueue.length > 0) {
      const nextCard = await this.selectNextCard(
        scheduleQueue,
        session,
        concept.name
      );
      if (!nextCard) break;

      const evaluation = await this.askFlashcardQuestion(
        nextCard,
        concept,
        course,
        session,
        scheduleQueue
      );

      const currentPosition = courseManager.incrementGlobalPosition(
        session,
        concept.name
      );

      const specialQuestionType = await this.determineSpecialQuestion(
        evaluation.comprehension,
        nextCard.item,
        concept,
        session
      );

      if (specialQuestionType && scheduleQueue.length > 0) {
        await this.askSpecialQuestion(
          specialQuestionType,
          nextCard.item,
          concept,
          course,
          session,
          evaluation
        );
      }

      const remaining = scheduleQueue.filter(
        (card) => card.successCount < 2
      ).length;
      if (remaining > 0) {
        console.log(
          chalk.gray(`\n${remaining} items remaining to master...\n`)
        );
      }
    }

    console.log(
      chalk.green(
        `\n🎉 Excellent! You've mastered all items in "${concept.name}"!\n`
      )
    );
  }

  private async selectNextCard(
    queue: FlashcardSchedule[],
    session: LearningSession,
    conceptName: string
  ): Promise<FlashcardSchedule | null> {
    const activeCards = queue.filter((card) => card.successCount < 2);
    if (activeCards.length === 0) return null;

    const courseManager = await getCourseManager();
    const currentPosition = courseManager.getGlobalPosition(
      session,
      conceptName
    );
    const overdueCards = activeCards.filter(
      (card) => card.duePosition <= currentPosition
    );

    if (overdueCards.length > 0) {
      overdueCards.sort((a, b) => a.duePosition - b.duePosition);
      return overdueCards[0];
    }

    activeCards.sort((a, b) => a.duePosition - b.duePosition);
    return activeCards[0];
  }

  private calculateInterval(comprehension: number, easeFactor: number): number {
    if (comprehension <= 1) {
      return 1;
    } else if (comprehension <= 3) {
      return Math.max(2, Math.floor(easeFactor * 0.8));
    } else if (comprehension === 4) {
      return Math.ceil(easeFactor * 3);
    } else {
      return Math.ceil(easeFactor * 5);
    }
  }

  private updateEaseFactor(comprehension: number, currentEase: number): number {
    let newEase = currentEase;

    if (comprehension <= 1) {
      newEase *= 0.8;
    } else if (comprehension <= 3) {
      newEase *= 0.85;
    } else if (comprehension === 5) {
      newEase *= 1.15;
    }

    return Math.max(this.MIN_EASE, Math.min(this.MAX_EASE, newEase));
  }

  private async askFlashcardQuestion(
    schedule: FlashcardSchedule,
    concept: Concept,
    course: Course,
    session: LearningSession,
    scheduleQueue: FlashcardSchedule[]
  ): Promise<{ comprehension: number; response: string; userAnswer: string }> {
    const { item } = schedule;
    const fields = concept.memorize.fields;

    console.log(
      chalk.cyan(`\nDescribe the following fields for ${chalk.bold(item)}:\n`)
    );
    fields.forEach((field) => {
      console.log(chalk.cyan(`  • ${field}`));
    });

    if (schedule.easeFactor !== this.INITIAL_EASE) {
      const difficulty =
        schedule.easeFactor < 2
          ? chalk.red("Difficult")
          : schedule.easeFactor > 3
          ? chalk.green("Easy")
          : chalk.yellow("Medium");
      console.log(
        chalk.gray(
          `\n[${difficulty}${chalk.gray(
            ` card - Ease: ${schedule.easeFactor.toFixed(1)}]`
          )}`
        )
      );
    }
    console.log();

    const { answer } = await inquirer.prompt([
      {
        type: "input",
        name: "answer",
        message: "Your answer:",
        validate: (input) =>
          input.trim().length > 0 || "Please provide an answer",
      },
    ]);

    const conceptProgress = session.conceptsProgress.get(concept.name);
    const previousAttempts =
      conceptProgress?.itemsProgress.get(item)?.attempts.map((a) => ({
        userAnswer: a.userAnswer,
        aiResponse: a.aiResponse.response,
      })) || [];

    const evaluation = await this.ai.evaluateFlashcardAnswer(
      item,
      fields,
      answer,
      concept,
      course.concepts.filter((c) => c.name !== concept.name).map((c) => c.name),
      previousAttempts,
      session.existingUnderstanding
    );

    const courseManager = await getCourseManager();
    const currentGlobalPosition = courseManager.getGlobalPosition(
      session,
      concept.name
    );
    const newEase = this.updateEaseFactor(
      evaluation.comprehension,
      schedule.easeFactor
    );
    const newInterval = this.calculateInterval(
      evaluation.comprehension,
      newEase
    );

    schedule.easeFactor = newEase;
    schedule.interval = newInterval;
    schedule.duePosition = currentGlobalPosition + newInterval;

    if (evaluation.comprehension >= 4) {
      console.log(chalk.green(`\n✅ ${evaluation.response}\n`));

      schedule.successCount++;

      if (schedule.successCount >= 2) {
        const index = scheduleQueue.indexOf(schedule);
        if (index > -1) {
          scheduleQueue.splice(index, 1);
        }
        console.log(chalk.bold.green(`🎯 "${item}" mastered!`));
      } else {
        console.log(
          chalk.yellow(`Good! One more correct answer needed for "${item}".`)
        );
        console.log(
          chalk.gray(
            `Will review after ${newInterval} more card${
              newInterval > 1 ? "s" : ""
            }.`
          )
        );
      }
    } else {
      console.log(chalk.yellow(`\n📝 ${evaluation.response}\n`));

      if (evaluation.comprehension <= 1) {
        console.log(chalk.red("This card needs immediate review."));
      } else {
        console.log(
          chalk.gray(
            `Will review after ${newInterval} more card${
              newInterval > 1 ? "s" : ""
            }.`
          )
        );
      }

      schedule.successCount = 0;
    }

    await courseManager.updateItemProgress(
      session,
      concept.name,
      item,
      {
        question: `Describe fields for ${item}: ${fields.join(", ")}`,
        userAnswer: answer,
        aiResponse: evaluation,
      },
      {
        easeFactor: schedule.easeFactor,
        interval: schedule.interval,
        nextDuePosition: schedule.duePosition,
        successCount: schedule.successCount,
      }
    );

    if (!this.itemsCovered.includes(item)) {
      this.itemsCovered.push(item);
    }

    return { ...evaluation, userAnswer: answer };
  }

  private async determineSpecialQuestion(
    comprehension: number,
    currentItem: string,
    concept: Concept,
    session: LearningSession
  ): Promise<"elaboration" | "connection" | "high-level" | null> {
    const random = Math.random();

    if (comprehension <= 2) {
      if (random < 0.4) return "elaboration";
      if (random < 0.6) return "high-level";
    } else if (comprehension === 5) {
      const courseManager = await getCourseManager();
      const strugglingItems = courseManager.getStrugglingItems(
        session,
        concept.name
      );
      if (strugglingItems.length > 0 && random < 0.3) return "connection";
      if (random < 0.5) return "high-level";
    } else {
      if (random < 0.2) return "high-level";
    }

    return null;
  }

  private async askSpecialQuestion(
    type: "elaboration" | "connection" | "high-level",
    currentItem: string,
    concept: Concept,
    course: Course,
    session: LearningSession,
    lastEvaluation: {
      comprehension: number;
      response: string;
      userAnswer: string;
    }
  ): Promise<void> {
    let question: string;
    let questionData: any = { type, timestamp: new Date() };

    if (type === "elaboration") {
      console.log(chalk.yellow("\n🤔 Let's understand why...\n"));
      question = await this.ai.generateElaborationQuestion(
        currentItem,
        concept.memorize.fields,
        concept,
        lastEvaluation.userAnswer,
        lastEvaluation.response
      );
      questionData.targetItem = currentItem;
    } else if (type === "connection") {
      console.log(chalk.cyan("\n🔗 Let's make connections...\n"));
      const courseManager = await getCourseManager();
      const strugglingItems = courseManager.getStrugglingItems(
        session,
        concept.name
      );
      const strugglingItem = strugglingItems[0]?.item;

      if (!strugglingItem) {
        return;
      }

      question = await this.ai.generateConnectionToStruggling(
        currentItem,
        strugglingItem,
        concept
      );
      questionData.targetItem = strugglingItem;
      questionData.connectedItem = currentItem;
    } else {
      console.log(chalk.magenta("\n💭 Let's see the bigger picture...\n"));

      // Gather weak topics from concept learning phase
      const courseManager = await getCourseManager();
      const topicComprehension = courseManager.getAllTopicsComprehension(
        session,
        concept.name,
        concept["high-level"]
      );
      const weakTopics = Array.from(topicComprehension.entries())
        .filter(([_, comprehension]) => comprehension < 5)
        .map(([topic, comprehension]) => ({ topic, comprehension }))
        .sort((a, b) => a.comprehension - b.comprehension);

      // Gather struggling flashcard items
      const strugglingItems = courseManager.getStrugglingItems(
        session,
        concept.name
      );

      question = await this.ai.generateHighLevelRecall(
        concept,
        this.itemsCovered,
        session.existingUnderstanding,
        weakTopics,
        strugglingItems
      );

      questionData.weakTopics = weakTopics;
      questionData.strugglingItems = strugglingItems.map((i) => i.item);
    }

    console.log(chalk.bold(question + "\n"));
    questionData.question = question;

    const { answer } = await inquirer.prompt([
      {
        type: "input",
        name: "answer",
        message: "Your thoughts:",
        validate: (input) => input.length > 0 || "Please share your thoughts",
      },
    ]);

    questionData.answer = answer;

    let feedback: string;
    if (type === "elaboration") {
      feedback = await this.ai.evaluateElaborationAnswer(
        question,
        answer,
        currentItem,
        concept
      );
    } else if (type === "connection") {
      feedback = await this.ai.evaluateConnectionQuestionAnswer(
        question,
        answer,
        currentItem,
        questionData.targetItem,
        concept
      );
    } else {
      // Get weak topics for evaluation context
      const courseManager = await getCourseManager();
      const topicComprehension = courseManager.getAllTopicsComprehension(
        session,
        concept.name,
        concept["high-level"]
      );
      const weakTopics = Array.from(topicComprehension.entries())
        .filter(([_, comprehension]) => comprehension < 5)
        .map(([topic, comprehension]) => ({ topic, comprehension }))
        .sort((a, b) => a.comprehension - b.comprehension);

      const strugglingItems = courseManager.getStrugglingItems(
        session,
        concept.name
      );

      feedback = await this.ai.evaluateHighLevelAnswer(
        question,
        answer,
        concept,
        this.itemsCovered,
        session.existingUnderstanding,
        weakTopics,
        strugglingItems
      );
    }

    console.log(chalk.blue(`\n${feedback}\n`));

    const courseManager = await getCourseManager();
    await courseManager.addSpecialQuestion(
      session,
      concept.name,
      questionData
    );

    const { ready } = await inquirer.prompt([
      {
        type: "confirm",
        name: "ready",
        message: "Ready to continue with flashcards?",
        default: true,
      },
    ]);

    if (!ready) {
      console.log(chalk.gray("Take your time! Press Enter when ready."));
      await inquirer.prompt([
        {
          type: "input",
          name: "continue",
          message: "Press Enter to continue...",
        },
      ]);
    }
  }
}
