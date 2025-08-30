import inquirer from 'inquirer';
import chalk from 'chalk';
import { AIService } from '../services/ai/index.js';
import { CourseManager } from '../services/courseManager.js';
import { Course, Concept, LearningSession } from '../types/course.js';

export class MemorizationPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();
  private questionCounter = 0;
  private abstractQuestionInterval = 10;

  async start(concept: Concept, course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue(`\n🧠 Flashcard Practice: ${concept.name}\n`));
    console.log(chalk.gray('You\'ll need to correctly answer each item twice to master it.\n'));

    await this.courseManager.updateSessionPhase(session, 'memorization', concept.name);

    const allItems = [...concept.memorize.items];
    const itemPool = new Map<string, number>();
    
    allItems.forEach(item => itemPool.set(item, 0));

    while (itemPool.size > 0) {
      const remainingItems = Array.from(itemPool.keys());
      const randomItem = remainingItems[Math.floor(Math.random() * remainingItems.length)];

      await this.askFlashcardQuestion(
        randomItem,
        concept,
        course,
        session,
        itemPool
      );

      this.questionCounter++;

      if (this.questionCounter % this.abstractQuestionInterval === 0 && itemPool.size > 0) {
        await this.askAbstractQuestion(concept, course, session);
      }

      if (itemPool.size > 0) {
        console.log(chalk.gray(`\n${itemPool.size} items remaining to master...\n`));
      }
    }

    console.log(chalk.green(`\n🎉 Excellent! You've mastered all items in "${concept.name}"!\n`));
  }

  private async askFlashcardQuestion(
    item: string,
    concept: Concept,
    course: Course,
    session: LearningSession,
    itemPool: Map<string, number>
  ): Promise<void> {
    const fields = concept.memorize.fields;
    
    console.log(chalk.cyan(`\nDescribe the following fields for ${chalk.bold(item)}:\n`));
    fields.forEach(field => {
      console.log(chalk.cyan(`  • ${field}`));
    });
    console.log();

    const { answer } = await inquirer.prompt([{
      type: 'input',
      name: 'answer',
      message: 'Your answer:',
      validate: (input) => input.trim().length > 0 || 'Please provide an answer'
    }]);

    const conceptProgress = session.conceptsProgress.get(concept.name);
    const previousAttempts = conceptProgress?.itemsProgress.get(item)?.attempts.map(a => ({
      userAnswer: a.userAnswer,
      aiResponse: a.aiResponse.response
    })) || [];

    const evaluation = await this.ai.evaluateFlashcardAnswer(
      item,
      fields,
      answer,
      concept,
      course.concepts.filter(c => c.name !== concept.name).map(c => c.name),
      previousAttempts
    );

    if (evaluation.comprehension >= 4) {
      console.log(chalk.green(`\n✅ ${evaluation.response}\n`));
      
      const currentSuccesses = itemPool.get(item) || 0;
      const newSuccesses = currentSuccesses + 1;
      
      if (newSuccesses >= 2) {
        itemPool.delete(item);
        console.log(chalk.bold.green(`🎯 "${item}" mastered!`));
      } else {
        itemPool.set(item, newSuccesses);
        console.log(chalk.yellow(`Good! One more correct answer needed for "${item}".`));
      }
    } else {
      console.log(chalk.yellow(`\n📝 ${evaluation.response}\n`));
      console.log(chalk.gray('Let\'s try this one again later.'));
    }

    await this.courseManager.updateItemProgress(
      session,
      concept.name,
      item,
      {
        question: `Describe fields for ${item}: ${fields.join(', ')}`,
        userAnswer: answer,
        aiResponse: evaluation
      }
    );
  }

  private async askAbstractQuestion(
    concept: Concept,
    course: Course,
    session: LearningSession
  ): Promise<void> {
    console.log(chalk.magenta('\n💭 Let\'s think about connections...\n'));

    const conceptProgress = session.conceptsProgress.get(concept.name);
    const previousQuestions = conceptProgress?.abstractQuestionsAsked.map(q => q.question) || [];

    const question = await this.ai.generateAbstractQuestion(
      concept,
      course.concepts,
      previousQuestions
    );

    console.log(chalk.magenta(question + '\n'));

    const { answer } = await inquirer.prompt([{
      type: 'input',
      name: 'answer',
      message: 'Your thoughts:',
      validate: (input) => input.length > 0 || 'Please share your thoughts'
    }]);

    const feedback = await this.ai.evaluateAbstractAnswer(
      question,
      answer,
      concept,
      course.concepts
    );

    console.log(chalk.blue(`\n${feedback}\n`));

    await this.courseManager.addAbstractQuestion(
      session,
      concept.name,
      question,
      answer
    );

    const { ready } = await inquirer.prompt([{
      type: 'confirm',
      name: 'ready',
      message: 'Ready to continue with flashcards?',
      default: true
    }]);

    if (!ready) {
      console.log(chalk.gray('Take your time! Press Enter when ready.'));
      await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }]);
    }
  }
}