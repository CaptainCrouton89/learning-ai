import { promises as fs } from 'fs';
import path from 'path';
import { Course, LearningSession, ConceptProgress, ItemProgress, TopicProgress, ConceptAttempt, SpecialQuestion } from '../types/course.js';

export class CourseManager {
  private coursesDir = path.join(process.cwd(), 'courses');
  private sessionsDir = path.join(process.cwd(), 'sessions');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.coursesDir, { recursive: true });
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  async saveCourse(course: Course): Promise<void> {
    const coursePath = path.join(this.coursesDir, `${course.name}.json`);
    await fs.writeFile(coursePath, JSON.stringify(course, null, 2));
    console.log(`Course saved to ${coursePath}`);
  }

  async loadCourse(courseName: string): Promise<Course> {
    const coursePath = path.join(this.coursesDir, `${courseName}.json`);
    const data = await fs.readFile(coursePath, 'utf-8');
    return JSON.parse(data) as Course;
  }

  async listCourses(): Promise<string[]> {
    const files = await fs.readdir(this.coursesDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }

  async createSession(courseId: string): Promise<LearningSession> {
    const session: LearningSession = {
      courseId,
      currentPhase: 'initialization',
      conceptsProgress: new Map(),
      conversationHistory: [],
      startTime: new Date(),
      lastActivityTime: new Date(),
      existingUnderstanding: 'Some - I know the basics',
      timeAvailable: '15-60min'
    };

    await this.saveSession(session);
    return session;
  }

  async saveSession(session: LearningSession): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${session.courseId}-session.json`);
    
    const serializable = {
      ...session,
      conceptsProgress: Array.from(session.conceptsProgress.entries()).map(([key, value]) => ({
        key,
        value: {
          ...value,
          itemsProgress: Array.from(value.itemsProgress.entries()).map(([itemKey, itemValue]) => ({
            key: itemKey,
            value: itemValue
          })),
          topicProgress: Array.from(value.topicProgress.entries()).map(([topicKey, topicValue]) => ({
            key: topicKey,
            value: topicValue
          }))
        }
      }))
    };

    await fs.writeFile(sessionPath, JSON.stringify(serializable, null, 2));
  }

  async loadSession(courseId: string): Promise<LearningSession | null> {
    try {
      const sessionPath = path.join(this.sessionsDir, `${courseId}-session.json`);
      const data = await fs.readFile(sessionPath, 'utf-8');
      const parsed = JSON.parse(data);

      const conceptsProgress = new Map<string, ConceptProgress>();
      if (parsed.conceptsProgress) {
        parsed.conceptsProgress.forEach((entry: any) => {
          const itemsProgress = new Map<string, ItemProgress>();
          if (entry.value.itemsProgress) {
            entry.value.itemsProgress.forEach((itemEntry: any) => {
              itemsProgress.set(itemEntry.key, itemEntry.value);
            });
          }
          
          const topicProgress = new Map<string, TopicProgress>();
          if (entry.value.topicProgress) {
            entry.value.topicProgress.forEach((topicEntry: any) => {
              topicProgress.set(topicEntry.key, topicEntry.value);
            });
          }
          
          conceptsProgress.set(entry.key, {
            ...entry.value,
            itemsProgress,
            topicProgress
          });
        });
      }

      return {
        ...parsed,
        conceptsProgress,
        startTime: new Date(parsed.startTime),
        lastActivityTime: new Date(parsed.lastActivityTime)
      };
    } catch (error) {
      return null;
    }
  }

  async updateSessionPhase(
    session: LearningSession, 
    phase: LearningSession['currentPhase'],
    currentConcept?: string
  ): Promise<void> {
    session.currentPhase = phase;
    if (currentConcept) {
      session.currentConcept = currentConcept;
    }
    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  async addConversationEntry(
    session: LearningSession,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  async updateItemProgress(
    session: LearningSession,
    conceptName: string,
    itemName: string,
    attempt: {
      question: string;
      userAnswer: string;
      aiResponse: { comprehension: number; response: string };
    }
  ): Promise<void> {
    if (!session.conceptsProgress.has(conceptName)) {
      session.conceptsProgress.set(conceptName, {
        conceptName,
        itemsProgress: new Map(),
        topicProgress: new Map(),
        abstractQuestionsAsked: [],
        specialQuestionsAsked: []
      });
    }

    const conceptProgress = session.conceptsProgress.get(conceptName)!;
    
    if (!conceptProgress.itemsProgress.has(itemName)) {
      conceptProgress.itemsProgress.set(itemName, {
        itemName,
        attempts: [],
        successCount: 0
      });
    }

    const itemProgress = conceptProgress.itemsProgress.get(itemName)!;
    itemProgress.attempts.push({
      ...attempt,
      timestamp: new Date()
    });

    if (attempt.aiResponse.comprehension >= 4) {
      itemProgress.successCount++;
    }

    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  async addAbstractQuestion(
    session: LearningSession,
    conceptName: string,
    question: string,
    answer: string
  ): Promise<void> {
    if (!session.conceptsProgress.has(conceptName)) {
      session.conceptsProgress.set(conceptName, {
        conceptName,
        itemsProgress: new Map(),
        topicProgress: new Map(),
        abstractQuestionsAsked: [],
        specialQuestionsAsked: []
      });
    }

    const conceptProgress = session.conceptsProgress.get(conceptName)!;
    conceptProgress.abstractQuestionsAsked.push({
      question,
      answer,
      timestamp: new Date()
    });

    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  isItemMastered(session: LearningSession, conceptName: string, itemName: string): boolean {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return false;

    const itemProgress = conceptProgress.itemsProgress.get(itemName);
    return itemProgress ? itemProgress.successCount >= 2 : false;
  }

  getUnmasteredItems(session: LearningSession, conceptName: string): string[] {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return [];

    const unmasteredItems: string[] = [];
    conceptProgress.itemsProgress.forEach((progress, itemName) => {
      if (progress.successCount < 2) {
        unmasteredItems.push(itemName);
      }
    });

    return unmasteredItems;
  }

  async updateConceptTopicProgress(
    session: LearningSession,
    conceptName: string,
    attempt: ConceptAttempt
  ): Promise<void> {
    if (!session.conceptsProgress.has(conceptName)) {
      session.conceptsProgress.set(conceptName, {
        conceptName,
        itemsProgress: new Map(),
        topicProgress: new Map(),
        abstractQuestionsAsked: [],
        specialQuestionsAsked: []
      });
    }

    const conceptProgress = session.conceptsProgress.get(conceptName)!;
    const topicName = attempt.aiResponse.targetTopic;
    
    if (!conceptProgress.topicProgress.has(topicName)) {
      conceptProgress.topicProgress.set(topicName, {
        topicName,
        currentComprehension: 0,
        attempts: []
      });
    }

    const topicProgress = conceptProgress.topicProgress.get(topicName)!;
    topicProgress.attempts.push(attempt);
    topicProgress.currentComprehension = Math.max(
      topicProgress.currentComprehension,
      attempt.aiResponse.comprehension
    );

    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  isTopicMastered(session: LearningSession, conceptName: string, topicName: string): boolean {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return false;

    const topicProgress = conceptProgress.topicProgress.get(topicName);
    return topicProgress ? topicProgress.currentComprehension >= 5 : false;
  }

  getUnmasteredTopics(session: LearningSession, conceptName: string, allTopics: string[]): string[] {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return allTopics;

    // For high-level phase, score 3 is sufficient (ready to proceed)
    // For concept learning phase, keep score 5 as mastery
    const threshold = conceptName === "high-level" ? 3 : 5;

    return allTopics.filter(topic => {
      const topicProgress = conceptProgress.topicProgress.get(topic);
      return !topicProgress || topicProgress.currentComprehension < threshold;
    });
  }

  getAllTopicsComprehension(session: LearningSession, conceptName: string, allTopics: string[]): Map<string, number> {
    const result = new Map<string, number>();
    const conceptProgress = session.conceptsProgress.get(conceptName);
    
    allTopics.forEach(topic => {
      if (conceptProgress?.topicProgress.has(topic)) {
        result.set(topic, conceptProgress.topicProgress.get(topic)!.currentComprehension);
      } else {
        result.set(topic, 0);
      }
    });
    
    return result;
  }

  async addSpecialQuestion(
    session: LearningSession,
    conceptName: string,
    question: SpecialQuestion
  ): Promise<void> {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) {
      throw new Error(`Concept ${conceptName} not found in session`);
    }

    if (!conceptProgress.specialQuestionsAsked) {
      conceptProgress.specialQuestionsAsked = [];
    }

    conceptProgress.specialQuestionsAsked.push(question);
    await this.saveSession(session);
  }

  getStrugglingItems(
    session: LearningSession,
    conceptName: string,
    threshold: number = 2
  ): Array<{ item: string; averageComprehension: number }> {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return [];

    const strugglingItems: Array<{ item: string; averageComprehension: number }> = [];

    conceptProgress.itemsProgress.forEach((progress, item) => {
      if (progress.attempts.length > 0) {
        const avgComprehension = progress.attempts.reduce(
          (sum, attempt) => sum + attempt.aiResponse.comprehension,
          0
        ) / progress.attempts.length;

        if (avgComprehension <= threshold) {
          strugglingItems.push({ item, averageComprehension: avgComprehension });
        }
      }
    });

    return strugglingItems.sort((a, b) => a.averageComprehension - b.averageComprehension);
  }

  getWellPerformingItems(
    session: LearningSession,
    conceptName: string,
    threshold: number = 4
  ): Array<{ item: string; averageComprehension: number }> {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return [];

    const performingItems: Array<{ item: string; averageComprehension: number }> = [];

    conceptProgress.itemsProgress.forEach((progress, item) => {
      if (progress.attempts.length > 0) {
        const avgComprehension = progress.attempts.reduce(
          (sum, attempt) => sum + attempt.aiResponse.comprehension,
          0
        ) / progress.attempts.length;

        if (avgComprehension >= threshold) {
          performingItems.push({ item, averageComprehension: avgComprehension });
        }
      }
    });

    return performingItems.sort((a, b) => b.averageComprehension - a.averageComprehension);
  }

  getLastAttemptComprehension(
    session: LearningSession,
    conceptName: string,
    item: string
  ): number | null {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return null;

    const itemProgress = conceptProgress.itemsProgress.get(item);
    if (!itemProgress || itemProgress.attempts.length === 0) return null;

    return itemProgress.attempts[itemProgress.attempts.length - 1].aiResponse.comprehension;
  }
}