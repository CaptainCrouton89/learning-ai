import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  Course,
  LearningSession,
  ConceptAttempt,
  FlashcardAttempt,
  SpecialQuestion,
  Concept
} from '../../types/course';
import { cacheService, CACHE_PREFIXES, CACHE_TTL, generateSessionKey, generateCourseKey } from '../../lib/cache';

// API request/response types
interface CreateCourseRequest {
  topic: string;
  existingUnderstanding: string;
  timeAvailable: string;
  userId: string;
}

interface CreateCourseResponse {
  course: Course;
  session: LearningSession;
}

interface GenerateQuestionRequest {
  courseId: string;
  sessionId: string;
  phase: 'high-level' | 'concept-learning';
  conceptName?: string;
  topics: string[];
  isIntroduction: boolean;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface GenerateQuestionResponse {
  question: string;
  questionId: string;
}

interface EvaluateAnswerRequest {
  courseId: string;
  sessionId: string;
  questionId: string;
  answer: string;
  phase: 'high-level' | 'concept-learning';
  conceptName?: string;
  targetTopics: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface EvaluateAnswerResponse {
  response: string;
  comprehensionUpdates: Array<{
    topic: string;
    newScore: number;
    previousScore: number;
  }>;
  overallComprehension: number;
}

interface EvaluateFlashcardRequest {
  courseId: string;
  sessionId: string;
  item: string;
  fields: string[];
  answer: string;
  conceptName: string;
  previousAttempts: Array<{
    userAnswer: string;
    aiResponse: string;
  }>;
}

interface EvaluateFlashcardResponse {
  comprehension: number;
  response: string;
  easeFactor: number;
  interval: number;
  nextDuePosition: number;
}

interface GenerateSpecialQuestionRequest {
  courseId: string;
  sessionId: string;
  type: 'elaboration' | 'connection' | 'high-level';
  conceptName: string;
  currentItem?: string;
  strugglingItem?: string;
  lastEvaluation?: {
    comprehension: number;
    response: string;
    userAnswer: string;
  };
}

interface GenerateSpecialQuestionResponse {
  question: string;
  questionId: string;
}

interface SaveSessionRequest {
  session: LearningSession;
}

interface GetSessionResponse {
  session: LearningSession | null;
}

// Cache-aware base query with automatic cache invalidation
const cacheAwareBaseQuery = fetchBaseQuery({
  baseUrl: '/api/learning',
  prepareHeaders: (headers, { getState }) => {
    // Add authentication headers if needed
    headers.set('content-type', 'application/json');
    
    // Add cache control headers for better performance
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');
    
    return headers;
  },
});

// Cache key generators
const generateCacheKey = (endpoint: string, args: any): string => {
  return `${endpoint}:${JSON.stringify(args)}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
};

export const learningApi = createApi({
  reducerPath: 'learningApi',
  baseQuery: cacheAwareBaseQuery,
  tagTypes: ['Course', 'Session', 'Progress', 'Question', 'Flashcard'],
  endpoints: (builder) => ({
    // Course management
    createCourse: builder.mutation<CreateCourseResponse, CreateCourseRequest>({
      query: (courseData) => ({
        url: '/courses',
        method: 'POST',
        body: courseData,
      }),
      invalidatesTags: ['Course'],
      // Invalidate cache when course is created
      onQueryStarted: async (courseData, { queryFulfilled }) => {
        try {
          const result = await queryFulfilled;
          // Invalidate course list cache
          await cacheService.invalidatePattern(CACHE_PREFIXES.COURSE_DATA);
          await cacheService.invalidatePattern(CACHE_PREFIXES.USER_COURSES);
        } catch (error) {
          console.warn('Failed to invalidate cache after course creation:', error);
        }
      },
    }),

    getCourse: builder.query<Course, string>({
      query: (courseId) => `/courses/${courseId}`,
      providesTags: ['Course'],
      // Cache transformation with Redis fallback
      transformResponse: async (response: any, meta, courseId) => {
        const course = response.data || response;
        
        // Cache the course data
        if (course && courseId) {
          await cacheService.set(
            CACHE_PREFIXES.COURSE_DATA,
            generateCourseKey(courseId),
            course,
            CACHE_TTL.LONG
          );
        }
        
        return course;
      },
      // Note: Using queryFn would override the query function completely
      // Instead, we'll handle caching in transformResponse
    }),

    getUserCourses: builder.query<Course[], string>({
      query: (userId) => `/users/${userId}/courses`,
      providesTags: ['Course'],
      // Cache user courses list
      transformResponse: async (response: any, meta, userId) => {
        const courses = response.data || response;
        
        if (courses && userId) {
          await cacheService.set(
            CACHE_PREFIXES.USER_COURSES,
            userId,
            courses,
            CACHE_TTL.MEDIUM
          );
        }
        
        return courses;
      },
    }),

    // Session management
    getSession: builder.query<GetSessionResponse, { courseId: string; userId: string }>({
      query: ({ courseId, userId }) => `/sessions/${courseId}?userId=${userId}`,
      providesTags: ['Session'],
      // Cache sessions for faster access
      transformResponse: async (response: any, meta, { courseId, userId }) => {
        const sessionData = response.data || response;
        
        if (sessionData?.session) {
          const cacheKey = generateSessionKey(userId, courseId);
          await cacheService.set(
            CACHE_PREFIXES.SESSION_DATA,
            cacheKey,
            sessionData.session,
            CACHE_TTL.SHORT
          );
        }
        
        return sessionData;
      },
      // Note: Using queryFn would override the query function completely
      // Instead, we'll handle caching in transformResponse
    }),

    saveSession: builder.mutation<void, SaveSessionRequest>({
      query: ({ session }) => ({
        url: `/sessions/${session.courseId}`,
        method: 'PUT',
        body: { session },
      }),
      invalidatesTags: ['Session', 'Progress'],
      // Optimistic updates with cache invalidation
      onQueryStarted: async ({ session }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          learningApi.util.updateQueryData('getSession', 
            { courseId: session.courseId, userId: session.userId }, 
            (draft) => {
              draft.session = session;
            }
          )
        );
        
        try {
          await queryFulfilled;
          
          // Update cache with new session data
          const cacheKey = generateSessionKey(session.userId, session.courseId);
          await cacheService.set(
            CACHE_PREFIXES.SESSION_DATA,
            cacheKey,
            session,
            CACHE_TTL.SHORT
          );
          
          // Invalidate related progress cache
          await cacheService.invalidatePattern(
            `${CACHE_PREFIXES.PROGRESS_DATA}:${session.userId}:${session.courseId}*`
          );
          
        } catch (error) {
          patchResult.undo();
          console.warn('Failed to update session cache:', error);
        }
      },
    }),

    // Question generation and evaluation
    generateQuestion: builder.mutation<GenerateQuestionResponse, GenerateQuestionRequest>({
      query: (requestData) => ({
        url: '/questions/generate',
        method: 'POST',
        body: requestData,
      }),
      // Cache generated questions to avoid regenerating identical ones
      onQueryStarted: async (requestData, { queryFulfilled }) => {
        try {
          const result = await queryFulfilled;
          const cacheKey = generateCacheKey('question', {
            courseId: requestData.courseId,
            phase: requestData.phase,
            conceptName: requestData.conceptName,
            topics: requestData.topics,
            isIntroduction: requestData.isIntroduction,
          });
          
          await cacheService.set(
            CACHE_PREFIXES.QUESTION_GENERATION,
            cacheKey,
            result.data,
            CACHE_TTL.MEDIUM
          );
        } catch (error) {
          console.warn('Failed to cache generated question:', error);
        }
      },
    }),

    evaluateAnswer: builder.mutation<EvaluateAnswerResponse, EvaluateAnswerRequest>({
      query: (requestData) => ({
        url: '/questions/evaluate',
        method: 'POST',
        body: requestData,
      }),
      // Optimistic updates for better UX with caching
      onQueryStarted: async (requestData, { dispatch, queryFulfilled }) => {
        try {
          const result = await queryFulfilled;
          
          // Cache AI evaluation response
          const evaluationCacheKey = generateCacheKey('evaluation', {
            questionId: requestData.questionId,
            answer: requestData.answer,
            phase: requestData.phase,
          });
          
          await cacheService.set(
            CACHE_PREFIXES.AI_RESPONSES,
            evaluationCacheKey,
            result.data,
            CACHE_TTL.LONG
          );
          
          // Update local session state with comprehension updates
          const { courseId } = requestData;
          dispatch(
            learningApi.util.updateQueryData('getSession', 
              { courseId, userId: 'current' }, // TODO: Get actual userId
              (draft) => {
                if (draft.session && result.data.comprehensionUpdates) {
                  // Apply comprehension updates optimistically
                  result.data.comprehensionUpdates.forEach(update => {
                    // Update topic progress in session
                  });
                }
              }
            )
          );
        } catch (error) {
          console.warn('Failed to cache evaluation or update session:', error);
        }
      },
    }),

    // Flashcard evaluation
    evaluateFlashcard: builder.mutation<EvaluateFlashcardResponse, EvaluateFlashcardRequest>({
      query: (requestData) => ({
        url: '/flashcards/evaluate',
        method: 'POST',
        body: requestData,
      }),
      invalidatesTags: ['Progress'],
      // Cache flashcard evaluations for spaced repetition algorithm
      onQueryStarted: async (requestData, { queryFulfilled }) => {
        try {
          const result = await queryFulfilled;
          const cacheKey = generateCacheKey('flashcard', {
            courseId: requestData.courseId,
            conceptName: requestData.conceptName,
            item: requestData.item,
            answer: requestData.answer,
          });
          
          await cacheService.set(
            CACHE_PREFIXES.FLASHCARD_EVALUATION,
            cacheKey,
            result.data,
            CACHE_TTL.LONG
          );
        } catch (error) {
          console.warn('Failed to cache flashcard evaluation:', error);
        }
      },
    }),

    // Special questions
    generateSpecialQuestion: builder.mutation<GenerateSpecialQuestionResponse, GenerateSpecialQuestionRequest>({
      query: (requestData) => ({
        url: '/questions/special',
        method: 'POST',
        body: requestData,
      }),
    }),

    evaluateSpecialQuestion: builder.mutation<{ feedback: string }, {
      courseId: string;
      sessionId: string;
      questionId: string;
      type: 'elaboration' | 'connection' | 'high-level';
      question: string;
      answer: string;
      conceptName: string;
      currentItem?: string;
      strugglingItem?: string;
    }>({
      query: (requestData) => ({
        url: '/questions/special/evaluate',
        method: 'POST',
        body: requestData,
      }),
    }),

    // Progress tracking
    getProgress: builder.query<{
      courseId: string;
      conceptsProgress: Record<string, {
        conceptName: string;
        topicsProgress: Record<string, { comprehension: number; attempts: number }>;
        itemsProgress: Record<string, { successCount: number; easeFactor: number }>;
        masteredTopics: number;
        masteredItems: number;
      }>;
      overallProgress: number;
    }, { courseId: string; userId: string }>({
      query: ({ courseId, userId }) => `/progress/${courseId}?userId=${userId}`,
      providesTags: ['Progress'],
      // Cache progress data with shorter TTL since it changes frequently
      transformResponse: async (response: any, meta, { courseId, userId }) => {
        const progressData = response.data || response;
        
        if (progressData) {
          const cacheKey = generateSessionKey(userId, courseId, 'progress');
          await cacheService.set(
            CACHE_PREFIXES.PROGRESS_DATA,
            cacheKey,
            progressData,
            CACHE_TTL.SHORT
          );
        }
        
        return progressData;
      },
      // Note: Using queryFn would override the query function completely
      // Instead, we'll handle caching in transformResponse
    }),

    // Streaming endpoints for real-time AI responses
    streamResponse: builder.mutation<void, {
      courseId: string;
      sessionId: string;
      message: string;
      context: 'question' | 'flashcard' | 'special';
    }>({
      queryFn: async (args, _queryApi, _extraOptions, fetchWithBQ) => {
        // This would typically be handled by a separate streaming implementation
        // using Server-Sent Events or WebSocket
        return { data: undefined };
      },
    }),

    // Batch operations for offline sync
    syncOfflineChanges: builder.mutation<void, {
      courseId: string;
      userId: string;
      changes: Array<{
        type: 'topic_progress' | 'item_progress' | 'conversation' | 'special_question';
        data: any;
        timestamp: Date;
      }>;
    }>({
      query: (requestData) => ({
        url: '/sync',
        method: 'POST',
        body: requestData,
      }),
      invalidatesTags: ['Session', 'Progress'],
    }),
  }),
});

export const {
  useCreateCourseMutation,
  useGetCourseQuery,
  useGetUserCoursesQuery,
  useGetSessionQuery,
  useSaveSessionMutation,
  useGenerateQuestionMutation,
  useEvaluateAnswerMutation,
  useEvaluateFlashcardMutation,
  useGenerateSpecialQuestionMutation,
  useEvaluateSpecialQuestionMutation,
  useGetProgressQuery,
  useStreamResponseMutation,
  useSyncOfflineChangesMutation,
} = learningApi;