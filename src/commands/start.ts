import chalk from 'chalk';
import { InitializationPhase } from '../phases/initialization.js';
import { HighLevelPhase } from '../phases/highLevel.js';
import { ConceptLearningPhase } from '../phases/conceptLearning.js';
import { DrawingConnectionsPhase } from '../phases/drawingConnections.js';
import { CourseManager } from '../services/courseManager.js';

export async function startLearningSession(options: { file?: string; topic?: string }): Promise<void> {
  try {
    console.log(chalk.bold.blue('\n🚀 Starting new learning session...\n'));

    const initPhase = new InitializationPhase();
    const course = await initPhase.start(options);

    const courseManager = new CourseManager();
    const session = await courseManager.createSession(course.name);

    const highLevelPhase = new HighLevelPhase();
    await highLevelPhase.start(course, session);

    const conceptLearningPhase = new ConceptLearningPhase();
    await conceptLearningPhase.start(course, session);

    const connectionsPhase = new DrawingConnectionsPhase();
    await connectionsPhase.start(course, session);

  } catch (error) {
    console.error(chalk.red('\n❌ Error in learning session:'), error);
    if (error instanceof Error) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}