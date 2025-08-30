import chalk from 'chalk';

export interface ProgressBarOptions {
  current: number;
  max: number;
  filledChar?: string;
  emptyChar?: string;
  filledColor?: (text: string) => string;
  emptyColor?: (text: string) => string;
  showPercentage?: boolean;
  showRatio?: boolean;
  length?: number;
}

export function createProgressBar(options: ProgressBarOptions): string {
  const {
    current,
    max,
    filledChar = '█',
    emptyChar = '░',
    filledColor = chalk.cyan,
    emptyColor = chalk.gray,
    showPercentage = false,
    showRatio = true,
    length
  } = options;

  const actualLength = length || max;
  const fillAmount = Math.round((current / max) * actualLength);
  const emptyAmount = actualLength - fillAmount;

  const filled = filledChar.repeat(fillAmount);
  const empty = emptyChar.repeat(emptyAmount);
  const bar = filledColor(filled) + emptyColor(empty);

  if (showPercentage) {
    const percentage = Math.round((current / max) * 100);
    return `${bar} ${percentage}%`;
  }

  if (showRatio) {
    return `${bar} (${current}/${max})`;
  }

  return bar;
}

export interface TopicProgressOptions {
  topic: string;
  comprehension: number;
  maxComprehension?: number;
  masteredThreshold?: number;
  masteredIcon?: string;
  progressIcon?: string;
}

export function createTopicProgress(options: TopicProgressOptions): string {
  const {
    topic,
    comprehension,
    maxComprehension = 5,
    masteredThreshold = 5,
    masteredIcon = '✓',
    progressIcon = '○'
  } = options;

  const isMastered = comprehension >= masteredThreshold;
  const status = isMastered ? chalk.green(masteredIcon) : chalk.yellow(progressIcon);
  
  const progressBar = createProgressBar({
    current: comprehension,
    max: maxComprehension,
    showRatio: true
  });

  return `  ${status} ${topic}: ${progressBar}`;
}

export function displayProgressSection(
  title: string,
  items: Map<string, number>,
  options?: Partial<TopicProgressOptions>
): void {
  console.log(chalk.blue(`\n${title}`));
  
  items.forEach((comprehension, topic) => {
    const line = createTopicProgress({
      topic,
      comprehension,
      ...options
    });
    console.log(line);
  });
  
  console.log();
}