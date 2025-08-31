export interface MemorizeField {
  fields: string[];
  items: string[];
}

export interface Concept {
  name: string;
  'high-level': string[];
  memorize: MemorizeField;
}

export interface Course {
  name: string;
  backgroundKnowledge?: string[];
  concepts: Concept[];
  'drawing-connections': string[];
}

export interface FlashcardAttempt {
  question: string;
  userAnswer: string;
  aiResponse: {
    comprehension: number;
    response: string;
  };
  timestamp: Date;
}

export interface ItemProgress {
  itemName: string;
  attempts: FlashcardAttempt[];
  successCount: number;
  easeFactor: number;
  interval: number;
  lastReviewPosition: number;
  nextDuePosition: number;
}

export interface ConceptAttempt {
  question: string;
  userAnswer: string;
  aiResponse: {
    comprehension: number;
    response: string;
    targetTopic: string;
  };
  timestamp: Date;
}

export interface TopicProgress {
  topicName: string;
  currentComprehension: number;
  attempts: ConceptAttempt[];
}

export interface SpecialQuestion {
  type: 'elaboration' | 'connection' | 'high-level';
  question: string;
  answer: string;
  targetItem?: string;
  connectedItem?: string;
  timestamp: Date;
}

export interface ConceptProgress {
  conceptName: string;
  itemsProgress: Map<string, ItemProgress>;
  topicProgress: Map<string, TopicProgress>;
  specialQuestionsAsked: Array<SpecialQuestion>;
  globalPositionCounter: number;
}

export interface FlashcardSchedule {
  item: string;
  easeFactor: number;
  interval: number;
  duePosition: number;
  successCount: number;
}

export interface LearningSession {
  courseId: string;
  currentPhase: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections';
  currentConcept?: string;
  conceptsProgress: Map<string, ConceptProgress>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  startTime: Date;
  lastActivityTime: Date;
  existingUnderstanding: string;
  timeAvailable: string;
}