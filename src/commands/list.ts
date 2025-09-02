import chalk from 'chalk';
import { getCourseManager } from '../config/storage.js';

export async function listCourses(): Promise<void> {
  try {
    const courseManager = await getCourseManager();
    const courses = await courseManager.listCourses();

    if (courses.length === 0) {
      console.log(chalk.yellow('\n📚 No courses found.\n'));
      console.log(chalk.gray('Start a new learning session with:'));
      console.log(chalk.blue('  learn start\n'));
      return;
    }

    console.log(chalk.blue('\n📚 Available Courses:\n'));
    
    for (const courseName of courses) {
      const course = await courseManager.loadCourse(courseName);
      const session = await courseManager.loadSession(courseName, 'cli-user');
      
      console.log(chalk.bold(`  ${courseName}`));
      console.log(chalk.gray(`    Concepts: ${course.concepts.length}`));
      console.log(chalk.gray(`    Total items: ${course.concepts.reduce((sum, c) => sum + c.memorize.items.length, 0)}`));
      
      if (session) {
        console.log(chalk.gray(`    Status: ${session.currentPhase}`));
        const timeSince = new Date().getTime() - new Date(session.lastActivityTime).getTime();
        const daysSince = Math.floor(timeSince / (1000 * 60 * 60 * 24));
        const hoursSince = Math.floor((timeSince % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (daysSince > 0) {
          console.log(chalk.gray(`    Last activity: ${daysSince} days ago`));
        } else if (hoursSince > 0) {
          console.log(chalk.gray(`    Last activity: ${hoursSince} hours ago`));
        } else {
          console.log(chalk.gray(`    Last activity: recently`));
        }
      } else {
        console.log(chalk.gray(`    Status: Not started`));
      }
      console.log();
    }

    console.log(chalk.gray('Resume a course with:'));
    console.log(chalk.blue('  learn resume --course <name>\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error listing courses:'), error);
    if (error instanceof Error) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}