import inquirer from 'inquirer';
import chalk from 'chalk';
import { getCourseManager } from '../config/storage.js';
import { HighLevelPhase } from '../phases/highLevel.js';
import { ConceptLearningPhase } from '../phases/conceptLearning.js';
import { DrawingConnectionsPhase } from '../phases/drawingConnections.js';

export async function resumeLearningSession(options: { course?: string }): Promise<void> {
  try {
    const courseManager = await getCourseManager();
    
    let courseName: string;
    
    if (options.course) {
      courseName = options.course;
    } else {
      const availableCourses = await courseManager.listCourses();
      
      if (availableCourses.length === 0) {
        console.log(chalk.yellow('\n📚 No courses found. Start a new session with: learn start\n'));
        return;
      }

      const { selectedCourse } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedCourse',
        message: 'Which course would you like to resume?',
        choices: availableCourses
      }]);
      
      courseName = selectedCourse;
    }

    const session = await courseManager.loadSession(courseName, 'cli-user');
    
    if (!session) {
      console.log(chalk.yellow(`\n⚠️ No saved session found for "${courseName}".\n`));
      const { startNew } = await inquirer.prompt([{
        type: 'confirm',
        name: 'startNew',
        message: 'Would you like to start a new session for this course?',
        default: true
      }]);

      if (startNew) {
        const course = await courseManager.loadCourse(courseName);
        const newSession = await courseManager.createSession(courseName, 'cli-user');
        await continueFromPhase(course, newSession, 'high-level');
      }
      return;
    }

    const course = await courseManager.loadCourse(courseName);
    
    console.log(chalk.green(`\n✅ Resuming course: ${courseName}`));
    console.log(chalk.gray(`Current phase: ${session.currentPhase}`));
    if (session.currentConcept) {
      console.log(chalk.gray(`Current concept: ${session.currentConcept}`));
    }
    
    const timeSinceLastActivity = new Date().getTime() - new Date(session.lastActivityTime).getTime();
    const minutesSince = Math.floor(timeSinceLastActivity / (1000 * 60));
    console.log(chalk.gray(`Last activity: ${minutesSince} minutes ago\n`));

    await continueFromPhase(course, session, session.currentPhase);

  } catch (error) {
    console.error(chalk.red('\n❌ Error resuming session:'), error);
    if (error instanceof Error) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

async function continueFromPhase(
  course: any,
  session: any,
  phase: string
): Promise<void> {
  switch (phase) {
    case 'high-level':
      const highLevelPhase = new HighLevelPhase();
      await highLevelPhase.start(course, session);
      
      const conceptLearningPhase = new ConceptLearningPhase();
      await conceptLearningPhase.start(course, session);
      
      const connectionsPhase = new DrawingConnectionsPhase();
      await connectionsPhase.start(course, session);
      break;

    case 'concept-learning':
    case 'memorization':
      const conceptPhase = new ConceptLearningPhase();
      await conceptPhase.start(course, session);
      
      const drawingPhase = new DrawingConnectionsPhase();
      await drawingPhase.start(course, session);
      break;

    case 'drawing-connections':
      const finalPhase = new DrawingConnectionsPhase();
      await finalPhase.start(course, session);
      break;

    default:
      console.log(chalk.yellow('\n⚠️ Unknown phase. Starting from the beginning.\n'));
      const restartPhase = new HighLevelPhase();
      await restartPhase.start(course, session);
      break;
  }
}