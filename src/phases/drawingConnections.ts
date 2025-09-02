import inquirer from 'inquirer';
import chalk from 'chalk';
import { AIService } from '../services/ai/index.js';
import { getCourseManager } from '../config/storage.js';
import { Course, LearningSession } from '../types/course.js';

export class DrawingConnectionsPhase {
  private ai = new AIService();
  private questionsAsked: Array<{ question: string; answer: string }> = [];
  private maxQuestions = 10;

  async start(course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue('\n🔗 Final Phase: Drawing Connections\n'));
    console.log(chalk.gray('Now let\'s tie everything together with scenario-based questions.\n'));

    const courseManager = await getCourseManager();
    await courseManager.updateSessionPhase(session, 'drawing-connections');

    const connections = course['drawing-connections'];
    let questionCount = 0;

    while (questionCount < this.maxQuestions && questionCount < connections.length * 2) {
      const question = await this.ai.generateConnectionQuestion(
        connections,
        course,
        this.questionsAsked,
        session.existingUnderstanding || 'Some - I know the basics'
      );

      console.log(chalk.magenta(`\n${question}\n`));

      const { answer } = await inquirer.prompt([{
        type: 'editor',
        name: 'answer',
        message: 'Your response (press Enter to open editor):',
        validate: (input: string) => input.trim().length > 0 || 'Please provide a response'
      }]);

      await courseManager.addConversationEntry(session, 'user', answer);

      const evaluation = await this.ai.evaluateConnectionAnswer(
        question,
        answer,
        course,
        session.existingUnderstanding || 'Some - I know the basics'
      );

      console.log(chalk.green(`\n${evaluation.response}\n`));
      await courseManager.addConversationEntry(session, 'assistant', evaluation.response);

      this.questionsAsked.push({ question, answer });

      if (evaluation.followUp) {
        console.log(chalk.cyan('Follow-up challenge:\n'));
        console.log(chalk.cyan(evaluation.followUp + '\n'));

        const { followUpAnswer } = await inquirer.prompt([{
          type: 'input',
          name: 'followUpAnswer',
          message: 'Your response:',
          validate: (input: string) => input.length > 0 || 'Please provide a response'
        }]);

        await courseManager.addConversationEntry(session, 'user', followUpAnswer);

        const followUpFeedback = await this.ai.evaluateConnectionAnswer(
          evaluation.followUp,
          followUpAnswer,
          course,
          session.existingUnderstanding || 'Some - I know the basics'
        );

        console.log(chalk.green(`\n${followUpFeedback.response}\n`));
        await courseManager.addConversationEntry(session, 'assistant', followUpFeedback.response);

        this.questionsAsked.push({ 
          question: evaluation.followUp, 
          answer: followUpAnswer 
        });
      }

      questionCount++;

      if (questionCount % 3 === 0 && questionCount < this.maxQuestions) {
        const { continueQuestions } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueQuestions',
          message: 'Would you like to continue with more synthesis questions?',
          default: true
        }]);

        if (!continueQuestions) {
          break;
        }
      }
    }

    console.log(chalk.green.bold('\n🎉 Congratulations! You\'ve completed the course!\n'));
    console.log(chalk.yellow('Summary of your learning journey:'));
    console.log(chalk.gray(`  • Course: ${course.name}`));
    console.log(chalk.gray(`  • Concepts mastered: ${course.concepts.length}`));
    console.log(chalk.gray(`  • Total items memorized: ${course.concepts.reduce((sum, c) => sum + c.memorize.items.length, 0)}`));
    console.log(chalk.gray(`  • Connections explored: ${this.questionsAsked.length}`));

    const sessionTime = new Date().getTime() - session.startTime.getTime();
    const hours = Math.floor(sessionTime / (1000 * 60 * 60));
    const minutes = Math.floor((sessionTime % (1000 * 60 * 60)) / (1000 * 60));
    console.log(chalk.gray(`  • Total time: ${hours}h ${minutes}m`));

    console.log(chalk.blue('\n🚀 Keep practicing to reinforce your knowledge!'));
    console.log(chalk.gray('You can resume this course anytime with: learn resume\n'));
  }
}