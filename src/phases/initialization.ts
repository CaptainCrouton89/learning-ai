import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import { AIService } from '../services/ai.js';
import { CourseManager } from '../services/courseManager.js';
import { Course } from '../types/course.js';

export class InitializationPhase {
  private ai = new AIService();
  private courseManager = new CourseManager();

  async start(options: { file?: string; topic?: string }): Promise<Course> {
    console.log(chalk.blue('\n📚 Welcome to AI Learning Tool!\n'));

    let documentContent: string | null = null;
    let topic: string;

    if (options.file) {
      const spinner = ora('Loading document...').start();
      try {
        documentContent = await fs.readFile(options.file, 'utf-8');
        spinner.succeed('Document loaded successfully');
        
        const { extractedTopic } = await inquirer.prompt([{
          type: 'input',
          name: 'extractedTopic',
          message: 'What topic from this document would you like to learn?',
          default: 'the main concepts in this document'
        }]);
        topic = extractedTopic;
      } catch (error) {
        spinner.fail('Failed to load document');
        throw error;
      }
    } else if (options.topic) {
      topic = options.topic;
    } else {
      const { selectedTopic } = await inquirer.prompt([{
        type: 'input',
        name: 'selectedTopic',
        message: 'What topic would you like to learn about?',
        validate: (input) => input.length > 0 || 'Please enter a topic'
      }]);
      topic = selectedTopic;
    }

    const { timeAvailable } = await inquirer.prompt([{
      type: 'list',
      name: 'timeAvailable',
      message: 'How much time do you have for learning?',
      choices: [
        { name: '15 minutes - Quick overview', value: '15min' },
        { name: '30 minutes - Standard session', value: '30min' },
        { name: '1 hour - Deep dive', value: '1hour' },
        { name: '2+ hours - Comprehensive', value: '2hours+' }
      ]
    }]);

    const { depth } = await inquirer.prompt([{
      type: 'list',
      name: 'depth',
      message: 'How in-depth would you like to go?',
      choices: [
        { name: 'Beginner - Start with basics', value: 'beginner' },
        { name: 'Intermediate - Some prior knowledge', value: 'intermediate' },
        { name: 'Advanced - Deep technical details', value: 'advanced' }
      ]
    }]);

    console.log(chalk.yellow('\n🤔 Let me suggest some focus areas...\n'));
    
    const suggestedTopics = await this.generateTopicSuggestions(topic, documentContent);
    
    // Display suggested topics
    console.log(chalk.cyan('Suggested topics:'));
    suggestedTopics.forEach((topic, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${topic}`));
    });
    console.log(chalk.gray('\nYou can select from the suggestions above (e.g., "1,3,5") or type your own topics.'));
    
    const { topicInput } = await inquirer.prompt([{
      type: 'input',
      name: 'topicInput',
      message: 'Which topics would you like to focus on? (comma-separated)',
      validate: (input) => input.trim().length > 0 || 'Please enter at least one topic'
    }]);
    
    // Parse the input - could be numbers referencing suggestions or custom text
    const selectedTopics = this.parseTopicInput(topicInput, suggestedTopics);

    const spinner = ora('Creating your personalized course...').start();
    
    try {
      const course = await this.ai.generateCourseStructure(
        topic,
        documentContent,
        timeAvailable,
        depth,
        selectedTopics
      );

      await this.courseManager.saveCourse(course);
      spinner.succeed('Course created successfully!');

      console.log(chalk.green(`\n✅ Course "${course.name}" has been created!`));
      console.log(chalk.gray(`Found ${course.concepts.length} concepts to learn:`));
      course.concepts.forEach(c => {
        console.log(chalk.gray(`  - ${c.name}`));
      });

      return course;
    } catch (error) {
      spinner.fail('Failed to create course');
      throw error;
    }
  }

  private async generateTopicSuggestions(topic: string, documentContent: string | null): Promise<string[]> {
    if (documentContent) {
      return [
        'Core concepts and definitions',
        'Practical applications',
        'Common patterns and best practices',
        'Advanced techniques',
        'Troubleshooting and edge cases'
      ];
    }

    switch (topic.toLowerCase()) {
      case 'wine':
        return [
          'Wine types and characteristics',
          'Wine regions and terroir',
          'Tasting and evaluation',
          'Food pairing principles',
          'Production methods'
        ];
      default:
        return [
          'Fundamental concepts',
          'Key terminology',
          'Practical applications',
          'Common examples',
          'Advanced topics'
        ];
    }
  }

  private parseTopicInput(input: string, suggestions: string[]): string[] {
    const parts = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const selectedTopics: string[] = [];
    
    for (const part of parts) {
      // Check if it's a number reference to a suggestion
      const num = parseInt(part);
      if (!isNaN(num) && num > 0 && num <= suggestions.length) {
        selectedTopics.push(suggestions[num - 1]);
      } else {
        // It's custom text
        selectedTopics.push(part);
      }
    }
    
    return selectedTopics;
  }
}