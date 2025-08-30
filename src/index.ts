#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { startLearningSession } from './commands/start.js';
import { resumeLearningSession } from './commands/resume.js';
import { listCourses } from './commands/list.js';

const program = new Command();

program
  .name('learn')
  .description('AI-powered learning CLI tool')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new learning session')
  .option('-f, --file <path>', 'Path to document to learn from')
  .option('-t, --topic <topic>', 'Topic to learn using GPT knowledge base')
  .action(async (options) => {
    try {
      await startLearningSession(options);
    } catch (error) {
      console.error(chalk.red('Error starting session:'), error);
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume a previous learning session')
  .option('-c, --course <name>', 'Course name to resume')
  .action(async (options) => {
    try {
      await resumeLearningSession(options);
    } catch (error) {
      console.error(chalk.red('Error resuming session:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all available courses')
  .action(async () => {
    try {
      await listCourses();
    } catch (error) {
      console.error(chalk.red('Error listing courses:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);