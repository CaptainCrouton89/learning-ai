import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Concept } from '../../types/course';

interface QuestionState {
  id: string;
  question: string;
  userAnswer: string;
  aiResponse: string | null;
  comprehensionScore: number | null;
  timestamp: Date;
  isAnswered: boolean;
  isEvaluating: boolean;
}

interface FlashcardState {
  item: string;
  fields: string[];
  userAnswer: string;
  comprehensionScore: number | null;
  feedback: string | null;
  easeFactor: number;
  interval: number;
  successCount: number;
  isAnswered: boolean;
  isEvaluating: boolean;
  difficulty: 'easy' | 'medium' | 'difficult';
}

export interface LearningState {
  // Current learning context
  currentPhase: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections' | null;
  currentConcept: Concept | null;
  currentTopic: string | null;
  
  // Question state
  currentQuestion: QuestionState | null;
  questionHistory: QuestionState[];
  
  // Flashcard state
  currentFlashcard: FlashcardState | null;
  flashcardQueue: Array<{
    item: string;
    fields: string[];
    easeFactor: number;
    interval: number;
    duePosition: number;
    successCount: number;
  }>;
  masteredItems: string[];
  
  // Special questions
  specialQuestionActive: boolean;
  specialQuestionType: 'elaboration' | 'connection' | 'high-level' | null;
  
  // UI state
  isStreaming: boolean;
  streamingText: string;
  showProgress: boolean;
  showHints: boolean;
  
  // Performance tracking
  streakCount: number;
  sessionStartTime: Date | null;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  
  // Conversation
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    comprehensionScore?: number;
  }>;
  
  // Error handling
  error: string | null;
}

const initialState: LearningState = {
  currentPhase: null,
  currentConcept: null,
  currentTopic: null,
  currentQuestion: null,
  questionHistory: [],
  currentFlashcard: null,
  flashcardQueue: [],
  masteredItems: [],
  specialQuestionActive: false,
  specialQuestionType: null,
  isStreaming: false,
  streamingText: '',
  showProgress: false,
  showHints: false,
  streakCount: 0,
  sessionStartTime: null,
  totalQuestionsAnswered: 0,
  totalCorrectAnswers: 0,
  conversationHistory: [],
  error: null,
};

const learningSlice = createSlice({
  name: 'learning',
  initialState,
  reducers: {
    // Phase and context management
    setCurrentPhase: (state, action: PayloadAction<LearningState['currentPhase']>) => {
      state.currentPhase = action.payload;
    },

    setCurrentConcept: (state, action: PayloadAction<Concept | null>) => {
      state.currentConcept = action.payload;
    },

    setCurrentTopic: (state, action: PayloadAction<string | null>) => {
      state.currentTopic = action.payload;
    },

    // Question management
    setCurrentQuestion: (state, action: PayloadAction<{
      id: string;
      question: string;
    }>) => {
      state.currentQuestion = {
        ...action.payload,
        userAnswer: '',
        aiResponse: null,
        comprehensionScore: null,
        timestamp: new Date(),
        isAnswered: false,
        isEvaluating: false,
      };
    },

    updateUserAnswer: (state, action: PayloadAction<string>) => {
      if (state.currentQuestion) {
        state.currentQuestion.userAnswer = action.payload;
      }
    },

    startQuestionEvaluation: (state) => {
      if (state.currentQuestion) {
        state.currentQuestion.isEvaluating = true;
      }
    },

    completeQuestionEvaluation: (state, action: PayloadAction<{
      aiResponse: string;
      comprehensionScore: number;
    }>) => {
      if (state.currentQuestion) {
        state.currentQuestion.aiResponse = action.payload.aiResponse;
        state.currentQuestion.comprehensionScore = action.payload.comprehensionScore;
        state.currentQuestion.isAnswered = true;
        state.currentQuestion.isEvaluating = false;
        
        // Add to history
        state.questionHistory.push({ ...state.currentQuestion });
        
        // Update statistics
        state.totalQuestionsAnswered++;
        if (action.payload.comprehensionScore >= 4) {
          state.totalCorrectAnswers++;
          state.streakCount++;
        } else {
          state.streakCount = 0;
        }
        
        // Add to conversation history
        state.conversationHistory.push(
          {
            role: 'user',
            content: state.currentQuestion.userAnswer,
            timestamp: new Date(),
          },
          {
            role: 'assistant',
            content: action.payload.aiResponse,
            timestamp: new Date(),
            comprehensionScore: action.payload.comprehensionScore,
          }
        );
        
        // Keep conversation history bounded
        if (state.conversationHistory.length > 40) {
          state.conversationHistory = state.conversationHistory.slice(-40);
        }
      }
    },

    clearCurrentQuestion: (state) => {
      state.currentQuestion = null;
    },

    // Flashcard management
    setCurrentFlashcard: (state, action: PayloadAction<{
      item: string;
      fields: string[];
      easeFactor: number;
      interval: number;
      successCount: number;
    }>) => {
      const difficulty = action.payload.easeFactor < 2 ? 'difficult' : 
                        action.payload.easeFactor > 3 ? 'easy' : 'medium';
      
      state.currentFlashcard = {
        ...action.payload,
        userAnswer: '',
        comprehensionScore: null,
        feedback: null,
        isAnswered: false,
        isEvaluating: false,
        difficulty,
      };
    },

    updateFlashcardAnswer: (state, action: PayloadAction<string>) => {
      if (state.currentFlashcard) {
        state.currentFlashcard.userAnswer = action.payload;
      }
    },

    startFlashcardEvaluation: (state) => {
      if (state.currentFlashcard) {
        state.currentFlashcard.isEvaluating = true;
      }
    },

    completeFlashcardEvaluation: (state, action: PayloadAction<{
      comprehensionScore: number;
      feedback: string;
      newEaseFactor: number;
      newInterval: number;
      newSuccessCount: number;
    }>) => {
      if (state.currentFlashcard) {
        state.currentFlashcard.comprehensionScore = action.payload.comprehensionScore;
        state.currentFlashcard.feedback = action.payload.feedback;
        state.currentFlashcard.easeFactor = action.payload.newEaseFactor;
        state.currentFlashcard.interval = action.payload.newInterval;
        state.currentFlashcard.successCount = action.payload.newSuccessCount;
        state.currentFlashcard.isAnswered = true;
        state.currentFlashcard.isEvaluating = false;
        
        // Update statistics
        state.totalQuestionsAnswered++;
        if (action.payload.comprehensionScore >= 4) {
          state.totalCorrectAnswers++;
          state.streakCount++;
        } else {
          state.streakCount = 0;
        }
        
        // Check if item is mastered
        if (action.payload.newSuccessCount >= 2) {
          if (!state.masteredItems.includes(state.currentFlashcard.item)) {
            state.masteredItems.push(state.currentFlashcard.item);
          }
        }
      }
    },

    setFlashcardQueue: (state, action: PayloadAction<LearningState['flashcardQueue']>) => {
      state.flashcardQueue = action.payload;
    },

    removeFromFlashcardQueue: (state, action: PayloadAction<string>) => {
      state.flashcardQueue = state.flashcardQueue.filter(card => card.item !== action.payload);
    },

    clearCurrentFlashcard: (state) => {
      state.currentFlashcard = null;
    },

    // Special questions
    startSpecialQuestion: (state, action: PayloadAction<{
      type: 'elaboration' | 'connection' | 'high-level';
    }>) => {
      state.specialQuestionActive = true;
      state.specialQuestionType = action.payload.type;
    },

    endSpecialQuestion: (state) => {
      state.specialQuestionActive = false;
      state.specialQuestionType = null;
    },

    // Streaming state
    startStreaming: (state) => {
      state.isStreaming = true;
      state.streamingText = '';
    },

    updateStreamingText: (state, action: PayloadAction<string>) => {
      state.streamingText = action.payload;
    },

    endStreaming: (state) => {
      state.isStreaming = false;
      state.streamingText = '';
    },

    // UI state
    setShowProgress: (state, action: PayloadAction<boolean>) => {
      state.showProgress = action.payload;
    },

    setShowHints: (state, action: PayloadAction<boolean>) => {
      state.showHints = action.payload;
    },

    // Session management
    startLearningSession: (state) => {
      state.sessionStartTime = new Date();
      state.streakCount = 0;
      state.totalQuestionsAnswered = 0;
      state.totalCorrectAnswers = 0;
      state.conversationHistory = [];
      state.questionHistory = [];
      state.masteredItems = [];
    },

    endLearningSession: (state) => {
      state.currentPhase = null;
      state.currentConcept = null;
      state.currentTopic = null;
      state.currentQuestion = null;
      state.currentFlashcard = null;
      state.specialQuestionActive = false;
      state.specialQuestionType = null;
      state.isStreaming = false;
      state.streamingText = '';
    },

    // Error handling
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },

    // Reset state
    resetLearningState: () => initialState,
  },
});

export const {
  setCurrentPhase,
  setCurrentConcept,
  setCurrentTopic,
  setCurrentQuestion,
  updateUserAnswer,
  startQuestionEvaluation,
  completeQuestionEvaluation,
  clearCurrentQuestion,
  setCurrentFlashcard,
  updateFlashcardAnswer,
  startFlashcardEvaluation,
  completeFlashcardEvaluation,
  setFlashcardQueue,
  removeFromFlashcardQueue,
  clearCurrentFlashcard,
  startSpecialQuestion,
  endSpecialQuestion,
  startStreaming,
  updateStreamingText,
  endStreaming,
  setShowProgress,
  setShowHints,
  startLearningSession,
  endLearningSession,
  setError,
  clearError,
  resetLearningState,
} = learningSlice.actions;

// Selectors
export const selectCurrentPhase = (state: { learning: LearningState }) => state.learning.currentPhase;
export const selectCurrentConcept = (state: { learning: LearningState }) => state.learning.currentConcept;
export const selectCurrentQuestion = (state: { learning: LearningState }) => state.learning.currentQuestion;
export const selectCurrentFlashcard = (state: { learning: LearningState }) => state.learning.currentFlashcard;
export const selectIsStreaming = (state: { learning: LearningState }) => state.learning.isStreaming;
export const selectStreamingText = (state: { learning: LearningState }) => state.learning.streamingText;
export const selectConversationHistory = (state: { learning: LearningState }) => state.learning.conversationHistory;
export const selectLearningStats = (state: { learning: LearningState }) => ({
  streakCount: state.learning.streakCount,
  totalQuestionsAnswered: state.learning.totalQuestionsAnswered,
  totalCorrectAnswers: state.learning.totalCorrectAnswers,
  accuracy: state.learning.totalQuestionsAnswered > 0 
    ? (state.learning.totalCorrectAnswers / state.learning.totalQuestionsAnswered) * 100 
    : 0,
  sessionDuration: state.learning.sessionStartTime 
    ? Date.now() - state.learning.sessionStartTime.getTime()
    : 0,
});

export default learningSlice.reducer;