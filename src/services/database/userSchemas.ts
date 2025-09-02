import { ObjectId } from 'mongodb';

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  name: string;
  image?: string;
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;
  subscription?: SubscriptionInfo;
}

export interface UserPreferences {
  defaultExistingUnderstanding: string;
  defaultTimeAvailable: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  difficultyPreference: 'easy' | 'medium' | 'hard' | 'adaptive';
  reminderSettings: NotificationSettings;
  theme?: 'light' | 'dark' | 'system';
}

export interface NotificationSettings {
  email: boolean;
  reminder: boolean;
  progress: boolean;
  weeklyReports: boolean;
}

export interface SubscriptionInfo {
  plan: 'free' | 'premium' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface UserCourseDocument {
  _id?: ObjectId;
  userId: string;
  courseId: string;
  enrolledAt: Date;
  lastAccessedAt: Date;
  completionPercentage: number;
  overallProgress: CourseProgress;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseProgress {
  conceptsCompleted: number;
  totalConcepts: number;
  itemsMastered: number;
  totalItems: number;
  topicsMastered: number;
  totalTopics: number;
  currentPhase: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections' | 'completed';
  timeSpent: number; // milliseconds
}

// NextAuth.js MongoDB adapter schemas
export interface AccountDocument {
  _id?: ObjectId;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTokenDocument {
  _id?: ObjectId;
  sessionToken: string;
  userId: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationTokenDocument {
  _id?: ObjectId;
  identifier: string;
  token: string;
  expires: Date;
  createdAt: Date;
}

// User activity tracking
export interface UserActivityDocument {
  _id?: ObjectId;
  userId: string;
  type: 'login' | 'logout' | 'course_start' | 'course_complete' | 'session_start' | 'session_end' | 'question_answer' | 'concept_master';
  details: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  courseId?: string;
  conceptName?: string;
  ipAddress?: string;
  userAgent?: string;
}

// User progress analytics
export interface UserAnalyticsDocument {
  _id?: ObjectId;
  userId: string;
  date: Date; // Aggregated by day
  stats: {
    sessionsStarted: number;
    questionsAnswered: number;
    conceptsCompleted: number;
    itemsMastered: number;
    timeSpent: number; // milliseconds
    averageComprehension: number;
  };
  createdAt: Date;
  updatedAt: Date;
}