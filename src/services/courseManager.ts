import { promises as fs } from 'fs';
import path from 'path';
import { Course, LearningSession, ConceptProgress, ItemProgress } from '../types/course.js';

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
      lastActivityTime: new Date()
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
          conceptsProgress.set(entry.key, {
            ...entry.value,
            itemsProgress
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
        abstractQuestionsAsked: []
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
        abstractQuestionsAsked: []
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
}