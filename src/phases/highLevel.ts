import inquirer from 'inquirer';
import chalk from 'chalk';
import { AIService } from '../services/ai.js';
import { CourseManager } from '../services/courseManager.js';
import { Course, LearningSession } from '../types/course.js';

export class HighLevelPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();
  private questionCount = 0;
  private maxQuestions = 15;

  async start(course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue('\n📖 Let\'s start with a high-level overview\n'));
    console.log(chalk.gray('I\'ll ask you questions to build your foundational understanding.\n'));

    await this.courseManager.updateSessionPhase(session, 'high-level');

    while (this.questionCount < this.maxQuestions) {
      const question = await this.ai.generateHighLevelQuestion(
        course,
        session.conversationHistory.slice(-10)
      );

      console.log(chalk.cyan(`\n${question}\n`));
      await this.courseManager.addConversationEntry(session, 'assistant', question);

      const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: 'Your answer:',
        validate: (input) => input.length > 0 || 'Please provide an answer'
      }]);

      await this.courseManager.addConversationEntry(session, 'user', answer);

      const feedback = await this.ai.evaluateHighLevelAnswer(
        answer,
        course,
        session.conversationHistory.slice(-10)
      );

      console.log(chalk.green(`\n${feedback}\n`));
      await this.courseManager.addConversationEntry(session, 'assistant', feedback);

      this.questionCount++;

      if (this.questionCount % 5 === 0 && this.questionCount < this.maxQuestions) {
        const { continuePhase } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continuePhase',
          message: 'Would you like to continue with more high-level questions?',
          default: true
        }]);

        if (!continuePhase) {
          break;
        }
      }
    }

    console.log(chalk.yellow('\n🎯 Great job with the overview!\n'));

    const { hasQuestions } = await inquirer.prompt([{
      type: 'confirm',
      name: 'hasQuestions',
      message: 'Do you have any questions before we dive into specific topics?',
      default: false
    }]);

    if (hasQuestions) {
      await this.handleUserQuestions(course, session);
    }

    const { readyToContinue } = await inquirer.prompt([{
      type: 'confirm',
      name: 'readyToContinue',
      message: 'Ready to dive into more focused topics?',
      default: true
    }]);

    if (!readyToContinue) {
      console.log(chalk.gray('Take your time! Resume when you\'re ready.'));
      process.exit(0);
    }
  }

  private async handleUserQuestions(course: Course, session: LearningSession): Promise<void> {
    let askingQuestions = true;

    while (askingQuestions) {
      const { question } = await inquirer.prompt([{
        type: 'input',
        name: 'question',
        message: 'What would you like to know?',
        validate: (input) => input.length > 0 || 'Please ask a question'
      }]);

      await this.courseManager.addConversationEntry(session, 'user', question);

      console.log(chalk.gray('\nLet me explain...\n'));

      const answer = await this.ai.evaluateHighLevelAnswer(
        question,
        course,
        session.conversationHistory.slice(-10)
      );

      console.log(chalk.green(answer));
      await this.courseManager.addConversationEntry(session, 'assistant', answer);

      const { moreQuestions } = await inquirer.prompt([{
        type: 'confirm',
        name: 'moreQuestions',
        message: '\nDo you have more questions?',
        default: false
      }]);

      askingQuestions = moreQuestions;
    }
  }
}