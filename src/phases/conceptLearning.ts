import inquirer from 'inquirer';
import chalk from 'chalk';
import { AIService } from '../services/ai.js';
import { CourseManager } from '../services/courseManager.js';
import { Course, Concept, LearningSession, ConceptAttempt } from '../types/course.js';

export class ConceptLearningPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();

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
    console.log(chalk.gray('Topics we\'ll master:'));
    concept['high-level'].forEach(topic => {
      console.log(chalk.gray(`  • ${topic}`));
    });
    console.log();

    await this.courseManager.updateSessionPhase(session, 'concept-learning', concept.name);
    
    // Track which topics are mastered
    let unmasteredTopics = this.courseManager.getUnmasteredTopics(
      session,
      concept.name,
      concept['high-level']
    );

    // Show initial progress
    this.displayTopicProgress(session, concept);

    // Generate the first question to start the conversation
    const firstQuestion = await this.ai.generateConceptQuestion(
      concept,
      session.conversationHistory.slice(-10)
    );
    console.log(chalk.cyan(`\n${firstQuestion}\n`));
    await this.courseManager.addConversationEntry(session, 'assistant', firstQuestion);

    let questionCount = 0;
    
    // Continue until all topics are mastered
    while (unmasteredTopics.length > 0) {
      const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: 'Your thoughts:',
        validate: (input) => input.length > 0 || 'Please share your thoughts'
      }]);

      await this.courseManager.addConversationEntry(session, 'user', answer);

      // Get feedback with comprehension score
      const evaluation = await this.ai.evaluateConceptAnswer(
        answer,
        concept,
        session.conversationHistory.slice(-10),
        true, // Always include follow-up while topics remain unmastered
        unmasteredTopics
      );

      // Create attempt record
      const attempt: ConceptAttempt = {
        question: session.conversationHistory[session.conversationHistory.length - 2].content,
        userAnswer: answer,
        aiResponse: evaluation,
        timestamp: new Date()
      };

      // Update topic progress
      await this.courseManager.updateConceptTopicProgress(session, concept.name, attempt);

      // Display feedback with comprehension score
      console.log(chalk.green(`\n${evaluation.response}\n`));
      console.log(chalk.cyan(`Comprehension for "${evaluation.targetTopic}": ${evaluation.comprehension}/5`));
      
      await this.courseManager.addConversationEntry(session, 'assistant', evaluation.response);

      // Update unmastered topics list
      unmasteredTopics = this.courseManager.getUnmasteredTopics(
        session,
        concept.name,
        concept['high-level']
      );

      questionCount++;

      // Show progress every 3 questions
      if (questionCount % 3 === 0) {
        this.displayTopicProgress(session, concept);
        
        if (unmasteredTopics.length > 0) {
          const { continueQuestions } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continueQuestions',
            message: `Continue working on the remaining topics for "${concept.name}"?`,
            default: true
          }]);

          if (!continueQuestions) {
            console.log(chalk.yellow('\nStopping early. You can resume to complete the remaining topics.'));
            break;
          }
        }
      }
    }

    if (unmasteredTopics.length === 0) {
      console.log(chalk.yellow(`\n✅ Excellent! You've mastered all topics in "${concept.name}"!\n`));
      this.displayTopicProgress(session, concept);
    } else {
      console.log(chalk.yellow(`\n📝 Good progress on "${concept.name}".\n`));
      console.log(chalk.gray(`Topics still to master: ${unmasteredTopics.join(', ')}\n`));
    }
    
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

  private displayTopicProgress(session: LearningSession, concept: Concept): void {
    console.log(chalk.blue('\n📊 Topic Progress:'));
    const comprehensionMap = this.courseManager.getAllTopicsComprehension(
      session,
      concept.name,
      concept['high-level']
    );
    
    comprehensionMap.forEach((comprehension, topic) => {
      const progressBar = this.getProgressBar(comprehension);
      const status = comprehension >= 5 ? chalk.green('✓') : chalk.yellow('○');
      console.log(`  ${status} ${topic}: ${progressBar} (${comprehension}/5)`);
    });
    console.log();
  }

  private getProgressBar(comprehension: number): string {
    const filled = '█'.repeat(comprehension);
    const empty = '░'.repeat(5 - comprehension);
    return chalk.cyan(filled) + chalk.gray(empty);
  }
}