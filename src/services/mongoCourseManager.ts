import { Collection, Db } from "mongodb";
import {
  ConceptAttempt,
  ConceptProgress,
  Course,
  ItemProgress,
  LearningSession,
  SpecialQuestion,
  TopicProgress,
} from '../types/course.js';
import { mongoConnection } from './database/mongoClient.js';
import { CourseDocument, SessionDocument } from './database/schemas.js';

export class MongoCourseManager {
  private db: Db | null = null;
  private coursesCollection: Collection<CourseDocument> | null = null;
  private sessionsCollection: Collection<SessionDocument> | null = null;

  async initialize(): Promise<void> {
    this.db = await mongoConnection.connect();
    this.coursesCollection = this.db.collection<CourseDocument>("courses");
    this.sessionsCollection = this.db.collection<SessionDocument>("sessions");

    // Create indexes for better performance
    await this.coursesCollection.createIndex({ name: 1 }, { unique: true });
    await this.sessionsCollection.createIndex({ userId: 1 });
    await this.sessionsCollection.createIndex({ userId: 1, courseId: 1 }, { unique: true });
    await this.sessionsCollection.createIndex({ userId: 1, updatedAt: -1 });
  }

  private ensureConnection(): void {
    if (!this.coursesCollection || !this.sessionsCollection) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }

  async saveCourse(course: Course): Promise<void> {
    this.ensureConnection();

    const document: CourseDocument = {
      ...course,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.coursesCollection!.replaceOne({ name: course.name }, document, {
      upsert: true,
    });

    console.log(`Course ${course.name} saved to MongoDB`);
  }

  async loadCourse(courseName: string): Promise<Course> {
    this.ensureConnection();

    const document = await this.coursesCollection!.findOne({
      name: courseName,
    });
    if (!document) {
      throw new Error(`Course ${courseName} not found`);
    }

    const { _id, createdAt, updatedAt, ...course } = document;
    return course as Course;
  }

  async listCourses(): Promise<string[]> {
    this.ensureConnection();

    const courses = await this.coursesCollection!.find(
      {},
      { projection: { name: 1 } }
    ).toArray();

    return courses.map((c) => c.name);
  }

  async createSession(courseId: string, userId: string): Promise<LearningSession> {
    this.ensureConnection();

    const session: LearningSession = {
      userId,
      courseId,
      currentPhase: "initialization",
      conceptsProgress: new Map(),
      conversationHistory: [],
      startTime: new Date(),
      lastActivityTime: new Date(),
      existingUnderstanding: "Some - I know the basics",
      timeAvailable: "15-60min",
    };

    await this.saveSession(session);
    return session;
  }

  private sessionToDocument(session: LearningSession): SessionDocument {
    const conceptsProgressArray = Array.from(
      session.conceptsProgress.entries()
    ).map(([key, value]) => ({
      conceptName: key,
      itemsProgress: Array.from(value.itemsProgress.entries()).map(
        ([, itemValue]) => ({
          ...itemValue,
        })
      ),
      topicProgress: Array.from(value.topicProgress.entries()).map(
        ([, topicValue]) => ({
          ...topicValue,
        })
      ),
      specialQuestionsAsked: value.specialQuestionsAsked || [],
      globalPositionCounter: value.globalPositionCounter || 0,
    }));

    return {
      userId: session.userId,
      courseId: session.courseId,
      currentPhase: session.currentPhase,
      currentConcept: session.currentConcept,
      conceptsProgress: conceptsProgressArray,
      conversationHistory: session.conversationHistory,
      startTime: session.startTime,
      lastActivityTime: session.lastActivityTime,
      existingUnderstanding: session.existingUnderstanding,
      timeAvailable: session.timeAvailable,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private documentToSession(document: SessionDocument): LearningSession {
    const conceptsProgress = new Map<string, ConceptProgress>();

    document.conceptsProgress.forEach((conceptDoc) => {
      const itemsProgress = new Map<string, ItemProgress>();
      conceptDoc.itemsProgress.forEach((item) => {
        const { itemName, ...rest } = item;
        itemsProgress.set(itemName, { itemName, ...rest });
      });

      const topicProgress = new Map<string, TopicProgress>();
      conceptDoc.topicProgress.forEach((topic) => {
        const { topicName, ...rest } = topic;
        topicProgress.set(topicName, { topicName, ...rest });
      });

      conceptsProgress.set(conceptDoc.conceptName, {
        conceptName: conceptDoc.conceptName,
        itemsProgress,
        topicProgress,
        specialQuestionsAsked: conceptDoc.specialQuestionsAsked,
        globalPositionCounter: conceptDoc.globalPositionCounter,
      });
    });

    return {
      userId: document.userId,
      courseId: document.courseId,
      currentPhase: document.currentPhase,
      currentConcept: document.currentConcept,
      conceptsProgress,
      conversationHistory: document.conversationHistory,
      startTime: document.startTime,
      lastActivityTime: document.lastActivityTime,
      existingUnderstanding: document.existingUnderstanding,
      timeAvailable: document.timeAvailable,
    };
  }

  async saveSession(session: LearningSession): Promise<void> {
    this.ensureConnection();

    const document = this.sessionToDocument(session);

    await this.sessionsCollection!.replaceOne(
      { userId: session.userId, courseId: session.courseId },
      document,
      { upsert: true }
    );
  }

  async loadSession(courseId: string, userId: string): Promise<LearningSession | null> {
    this.ensureConnection();

    const document = await this.sessionsCollection!.findOne(
      { userId, courseId },
      { sort: { updatedAt: -1 } }
    );

    if (!document) {
      return null;
    }

    return this.documentToSession(document);
  }

  async updateSessionPhase(
    session: LearningSession,
    phase: LearningSession["currentPhase"],
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
    role: "user" | "assistant",
    content: string
  ): Promise<void> {
    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
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
    },
    scheduling?: {
      easeFactor: number;
      interval: number;
      nextDuePosition: number;
      successCount: number;
    }
  ): Promise<void> {
    if (!session.conceptsProgress.has(conceptName)) {
      session.conceptsProgress.set(conceptName, {
        conceptName,
        itemsProgress: new Map(),
        topicProgress: new Map(),
        specialQuestionsAsked: [],
        globalPositionCounter: 0,
      });
    }

    const conceptProgress = session.conceptsProgress.get(conceptName)!;

    if (!conceptProgress.itemsProgress.has(itemName)) {
      conceptProgress.itemsProgress.set(itemName, {
        itemName,
        attempts: [],
        successCount: 0,
        easeFactor: 2.5,
        interval: 0,
        lastReviewPosition: 0,
        nextDuePosition: 0,
      });
    }

    const itemProgress = conceptProgress.itemsProgress.get(itemName)!;
    itemProgress.attempts.push({
      ...attempt,
      timestamp: new Date(),
    });

    if (scheduling) {
      itemProgress.easeFactor = scheduling.easeFactor;
      itemProgress.interval = scheduling.interval;
      itemProgress.lastReviewPosition = conceptProgress.globalPositionCounter;
      itemProgress.nextDuePosition = scheduling.nextDuePosition;
      itemProgress.successCount = scheduling.successCount;
    } else if (attempt.aiResponse.comprehension >= 4) {
      itemProgress.successCount++;
    }

    session.lastActivityTime = new Date();
    await this.saveSession(session);
  }

  isItemMastered(
    session: LearningSession,
    conceptName: string,
    itemName: string
  ): boolean {
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
        specialQuestionsAsked: [],
        globalPositionCounter: 0,
      });
    }

    const conceptProgress = session.conceptsProgress.get(conceptName)!;
    const topicName = attempt.aiResponse.targetTopic;

    if (!conceptProgress.topicProgress.has(topicName)) {
      conceptProgress.topicProgress.set(topicName, {
        topicName,
        currentComprehension: 0,
        attempts: [],
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

  isTopicMastered(
    session: LearningSession,
    conceptName: string,
    topicName: string
  ): boolean {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return false;

    const topicProgress = conceptProgress.topicProgress.get(topicName);
    return topicProgress ? topicProgress.currentComprehension >= 5 : false;
  }

  getUnmasteredTopics(
    session: LearningSession,
    conceptName: string,
    allTopics: string[]
  ): string[] {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return allTopics;

    const threshold = 5;

    return allTopics.filter((topic) => {
      const topicProgress = conceptProgress.topicProgress.get(topic);
      return !topicProgress || topicProgress.currentComprehension < threshold;
    });
  }

  getAllTopicsComprehension(
    session: LearningSession,
    conceptName: string,
    allTopics: string[]
  ): Map<string, number> {
    const result = new Map<string, number>();
    const conceptProgress = session.conceptsProgress.get(conceptName);

    allTopics.forEach((topic) => {
      if (conceptProgress?.topicProgress.has(topic)) {
        result.set(
          topic,
          conceptProgress.topicProgress.get(topic)!.currentComprehension
        );
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

    const strugglingItems: Array<{
      item: string;
      averageComprehension: number;
    }> = [];

    conceptProgress.itemsProgress.forEach((progress, item) => {
      if (progress.attempts.length > 0) {
        const avgComprehension =
          progress.attempts.reduce(
            (sum, attempt) => sum + attempt.aiResponse.comprehension,
            0
          ) / progress.attempts.length;

        if (avgComprehension <= threshold) {
          strugglingItems.push({
            item,
            averageComprehension: avgComprehension,
          });
        }
      }
    });

    return strugglingItems.sort(
      (a, b) => a.averageComprehension - b.averageComprehension
    );
  }

  getWellPerformingItems(
    session: LearningSession,
    conceptName: string,
    threshold: number = 4
  ): Array<{ item: string; averageComprehension: number }> {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return [];

    const performingItems: Array<{
      item: string;
      averageComprehension: number;
    }> = [];

    conceptProgress.itemsProgress.forEach((progress, item) => {
      if (progress.attempts.length > 0) {
        const avgComprehension =
          progress.attempts.reduce(
            (sum, attempt) => sum + attempt.aiResponse.comprehension,
            0
          ) / progress.attempts.length;

        if (avgComprehension >= threshold) {
          performingItems.push({
            item,
            averageComprehension: avgComprehension,
          });
        }
      }
    });

    return performingItems.sort(
      (a, b) => b.averageComprehension - a.averageComprehension
    );
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

    return itemProgress.attempts[itemProgress.attempts.length - 1].aiResponse
      .comprehension;
  }

  getItemScheduling(
    session: LearningSession,
    conceptName: string,
    itemName: string
  ): {
    easeFactor: number;
    interval: number;
    nextDuePosition: number;
    successCount: number;
  } | null {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return null;

    const itemProgress = conceptProgress.itemsProgress.get(itemName);
    if (!itemProgress) return null;

    return {
      easeFactor: itemProgress.easeFactor,
      interval: itemProgress.interval,
      nextDuePosition: itemProgress.nextDuePosition,
      successCount: itemProgress.successCount,
    };
  }

  incrementGlobalPosition(
    session: LearningSession,
    conceptName: string
  ): number {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) {
      throw new Error(`Concept ${conceptName} not found in session`);
    }

    conceptProgress.globalPositionCounter++;
    return conceptProgress.globalPositionCounter;
  }

  getGlobalPosition(session: LearningSession, conceptName: string): number {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    return conceptProgress?.globalPositionCounter || 0;
  }

  async disconnect(): Promise<void> {
    await mongoConnection.disconnect();
  }
}
