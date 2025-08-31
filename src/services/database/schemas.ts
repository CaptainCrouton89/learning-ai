import { ObjectId } from 'mongodb';

export interface CourseDocument {
  _id?: ObjectId;
  name: string;
  backgroundKnowledge?: string[];
  concepts: Array<{
    name: string;
    'high-level': string[];
    memorize: {
      fields: string[];
      items: string[];
    };
  }>;
  'drawing-connections': string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id?: ObjectId;
  courseId: string;
  currentPhase: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections';
  currentConcept?: string;
  conceptsProgress: Array<{
    conceptName: string;
    itemsProgress: Array<{
      itemName: string;
      attempts: Array<{
        question: string;
        userAnswer: string;
        aiResponse: {
          comprehension: number;
          response: string;
        };
        timestamp: Date;
      }>;
      successCount: number;
      easeFactor: number;
      interval: number;
      lastReviewPosition: number;
      nextDuePosition: number;
    }>;
    topicProgress: Array<{
      topicName: string;
      currentComprehension: number;
      attempts: Array<{
        question: string;
        userAnswer: string;
        aiResponse: {
          comprehension: number;
          response: string;
          targetTopic: string;
        };
        timestamp: Date;
      }>;
    }>;
    specialQuestionsAsked: Array<{
      type: 'elaboration' | 'connection' | 'high-level';
      question: string;
      answer: string;
      targetItem?: string;
      connectedItem?: string;
      timestamp: Date;
    }>;
    globalPositionCounter: number;
  }>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  startTime: Date;
  lastActivityTime: Date;
  existingUnderstanding: string;
  timeAvailable: string;
  createdAt: Date;
  updatedAt: Date;
}