import inquirer from 'inquirer';
import chalk from 'chalk';
import { AIService } from '../services/ai.js';
import { CourseManager } from '../services/courseManager.js';
import { Course, Concept, LearningSession } from '../types/course.js';

export class ConceptLearningPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();
  private questionCount = 0;
  private maxQuestionsPerConcept = 15;

  async start(course: Course, session: LearningSession): Promise<void> {
    console.log(chalk.blue('\n🎯 Time to dive into specific concepts!\n'));

    for (const concept of course.concepts) {
      const { ready } = await inquirer.prompt([{
        type: 'confirm',
        name: 'ready',
        message: `Ready to learn about "${concept.name}"?`,
        default: true
      }]);

      if (!ready) {
        console.log(chalk.gray('Skipping this concept for now...'));
        continue;
      }

      await this.learnConcept(concept, course, session);
      
      const { continueToNext } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueToNext',
        message: 'Ready to move to the next concept?',
        default: true
      }]);

      if (!continueToNext) {
        console.log(chalk.gray('Take a break! You can resume later.'));
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
    console.log(chalk.gray('Topics we\'ll cover:'));
    concept['high-level'].forEach(topic => {
      console.log(chalk.gray(`  • ${topic}`));
    });
    console.log();

    await this.courseManager.updateSessionPhase(session, 'concept-learning', concept.name);
    this.questionCount = 0;

    // Generate the first question to start the conversation
    const firstQuestion = await this.ai.generateConceptQuestion(
      concept,
      session.conversationHistory.slice(-10)
    );
    console.log(chalk.cyan(`\n${firstQuestion}\n`));
    await this.courseManager.addConversationEntry(session, 'assistant', firstQuestion);

    while (this.questionCount < this.maxQuestionsPerConcept) {
      const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: 'Your thoughts:',
        validate: (input) => input.length > 0 || 'Please share your thoughts'
      }]);

      await this.courseManager.addConversationEntry(session, 'user', answer);

      // Get feedback and next question in one AI call (except for last iteration)
      const isLastQuestion = this.questionCount === this.maxQuestionsPerConcept - 1;
      const feedbackWithFollowUp = await this.ai.evaluateConceptAnswer(
        answer,
        concept,
        session.conversationHistory.slice(-10),
        !isLastQuestion // Include follow-up question unless it's the last one
      );

      console.log(chalk.green(`\n${feedbackWithFollowUp}\n`));
      await this.courseManager.addConversationEntry(session, 'assistant', feedbackWithFollowUp);

      this.questionCount++;

      if (this.questionCount % 5 === 0 && this.questionCount < this.maxQuestionsPerConcept) {
        const { continueQuestions } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueQuestions',
          message: `Continue exploring "${concept.name}"?`,
          default: true
        }]);

        if (!continueQuestions) {
          break;
        }
      }
    }

    console.log(chalk.yellow(`\n✅ Great work on "${concept.name}"!\n`));
    console.log(chalk.gray('Now let\'s practice with flashcards to solidify your knowledge.\n'));

    const { readyForFlashcards } = await inquirer.prompt([{
      type: 'confirm',
      name: 'readyForFlashcards',
      message: 'Ready to start flashcard practice?',
      default: true
    }]);

    if (readyForFlashcards) {
      const { MemorizationPhase } = await import('./memorization.js');
      const memorizationPhase = new MemorizationPhase();
      await memorizationPhase.start(concept, course, session);
    }
  }
}