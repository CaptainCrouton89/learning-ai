import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  LearningSession, 
  ConceptProgress, 
  ItemProgress, 
  TopicProgress,
  ConceptAttempt,
  FlashcardAttempt,
  SpecialQuestion
} from '../../types/course';

interface SessionState {
  currentSession: LearningSession | null;
  sessions: LearningSession[];
  loading: boolean;
  error: string | null;
  autoSaveEnabled: boolean;
  lastSyncTime: Date | null;
  isDirty: boolean;
}

// Serialized versions for Redux state
interface SerializedConceptProgress {
  conceptName: string;
  itemsProgress: Array<{ key: string; value: ItemProgress }>;
  topicProgress: Array<{ key: string; value: TopicProgress }>;
  specialQuestionsAsked: Array<SpecialQuestion>;
  globalPositionCounter: number;
}

interface SerializedLearningSession extends Omit<LearningSession, 'conceptsProgress'> {
  conceptsProgress: Array<{ key: string; value: SerializedConceptProgress }>;
}

const initialState: SessionState = {
  currentSession: null,
  sessions: [],
  loading: false,
  error: null,
  autoSaveEnabled: true,
  lastSyncTime: null,
  isDirty: false,
};

// Helper functions for Map serialization
const serializeConceptProgress = (conceptProgress: ConceptProgress): SerializedConceptProgress => {
  return {
    conceptName: conceptProgress.conceptName,
    itemsProgress: Array.from(conceptProgress.itemsProgress.entries()).map(([key, value]) => ({
      key,
      value,
    })),
    topicProgress: Array.from(conceptProgress.topicProgress.entries()).map(([key, value]) => ({
      key,
      value,
    })),
    specialQuestionsAsked: conceptProgress.specialQuestionsAsked,
    globalPositionCounter: conceptProgress.globalPositionCounter,
  };
};

const deserializeConceptProgress = (serialized: SerializedConceptProgress): ConceptProgress => {
  const itemsProgress = new Map<string, ItemProgress>();
  serialized.itemsProgress.forEach(({ key, value }) => {
    itemsProgress.set(key, value);
  });

  const topicProgress = new Map<string, TopicProgress>();
  serialized.topicProgress.forEach(({ key, value }) => {
    topicProgress.set(key, value);
  });

  return {
    conceptName: serialized.conceptName,
    itemsProgress,
    topicProgress,
    specialQuestionsAsked: serialized.specialQuestionsAsked,
    globalPositionCounter: serialized.globalPositionCounter,
  };
};

const serializeLearningSession = (session: LearningSession): SerializedLearningSession => {
  return {
    ...session,
    conceptsProgress: Array.from(session.conceptsProgress.entries()).map(([key, value]) => ({
      key,
      value: serializeConceptProgress(value),
    })),
  };
};

const deserializeLearningSession = (serialized: SerializedLearningSession): LearningSession => {
  const conceptsProgress = new Map<string, ConceptProgress>();
  serialized.conceptsProgress.forEach(({ key, value }) => {
    conceptsProgress.set(key, deserializeConceptProgress(value));
  });

  return {
    ...serialized,
    conceptsProgress,
  };
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    // Session loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Session management
    setCurrentSession: (state, action: PayloadAction<LearningSession | null>) => {
      if (action.payload) {
        // Store as serialized version for Redux
        const serialized = serializeLearningSession(action.payload);
        state.currentSession = serialized as any;
      } else {
        state.currentSession = null;
      }
      state.isDirty = false;
    },

    updateSessionPhase: (state, action: PayloadAction<{
      phase: LearningSession['currentPhase'];
      currentConcept?: string;
    }>) => {
      if (state.currentSession) {
        state.currentSession.currentPhase = action.payload.phase;
        if (action.payload.currentConcept !== undefined) {
          state.currentSession.currentConcept = action.payload.currentConcept;
        }
        state.currentSession.lastActivityTime = new Date();
        state.isDirty = true;
      }
    },

    addConversationMessage: (state, action: PayloadAction<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: Date;
    }>) => {
      if (state.currentSession) {
        const message = {
          ...action.payload,
          timestamp: action.payload.timestamp || new Date(),
        };
        
        state.currentSession.conversationHistory.push(message);
        
        // Keep only last 20 messages for performance
        if (state.currentSession.conversationHistory.length > 20) {
          state.currentSession.conversationHistory = state.currentSession.conversationHistory.slice(-20);
        }
        
        state.currentSession.lastActivityTime = new Date();
        state.isDirty = true;
      }
    },

    updateTopicProgress: (state, action: PayloadAction<{
      conceptName: string;
      topicName: string;
      attempt: ConceptAttempt;
    }>) => {
      if (state.currentSession) {
        const { conceptName, topicName, attempt } = action.payload;
        
        // Find or create concept progress entry
        let conceptProgressEntry = (state.currentSession.conceptsProgress as any).find(
          (entry: any) => entry.key === conceptName
        );
        
        if (!conceptProgressEntry) {
          conceptProgressEntry = {
            key: conceptName,
            value: {
              conceptName,
              itemsProgress: [],
              topicProgress: [],
              specialQuestionsAsked: [],
              globalPositionCounter: 0,
            },
          };
          (state.currentSession.conceptsProgress as any).push(conceptProgressEntry);
        }
        
        // Find or create topic progress
        let topicProgressEntry = conceptProgressEntry.value.topicProgress.find(
          (entry: any) => entry.key === topicName
        );
        
        if (!topicProgressEntry) {
          topicProgressEntry = {
            key: topicName,
            value: {
              topicName,
              currentComprehension: 0,
              attempts: [],
            },
          };
          conceptProgressEntry.value.topicProgress.push(topicProgressEntry);
        }
        
        // Update progress
        topicProgressEntry.value.attempts.push(attempt);
        if (attempt.aiResponse.comprehension > topicProgressEntry.value.currentComprehension) {
          topicProgressEntry.value.currentComprehension = attempt.aiResponse.comprehension;
        }
        
        state.currentSession.lastActivityTime = new Date();
        state.isDirty = true;
      }
    },

    updateItemProgress: (state, action: PayloadAction<{
      conceptName: string;
      itemName: string;
      attempt: FlashcardAttempt;
      scheduling: {
        easeFactor: number;
        interval: number;
        nextDuePosition: number;
        successCount: number;
      };
    }>) => {
      if (state.currentSession) {
        const { conceptName, itemName, attempt, scheduling } = action.payload;
        
        // Find or create concept progress entry
        let conceptProgressEntry = (state.currentSession.conceptsProgress as any).find(
          (entry: any) => entry.key === conceptName
        );
        
        if (!conceptProgressEntry) {
          conceptProgressEntry = {
            key: conceptName,
            value: {
              conceptName,
              itemsProgress: [],
              topicProgress: [],
              specialQuestionsAsked: [],
              globalPositionCounter: 0,
            },
          };
          (state.currentSession.conceptsProgress as any).push(conceptProgressEntry);
        }
        
        // Find or create item progress
        let itemProgressEntry = conceptProgressEntry.value.itemsProgress.find(
          (entry: any) => entry.key === itemName
        );
        
        if (!itemProgressEntry) {
          itemProgressEntry = {
            key: itemName,
            value: {
              itemName,
              attempts: [],
              successCount: 0,
              easeFactor: 2.5,
              interval: 0,
              lastReviewPosition: 0,
              nextDuePosition: 0,
            },
          };
          conceptProgressEntry.value.itemsProgress.push(itemProgressEntry);
        }
        
        // Update progress
        itemProgressEntry.value.attempts.push(attempt);
        itemProgressEntry.value.successCount = scheduling.successCount;
        itemProgressEntry.value.easeFactor = scheduling.easeFactor;
        itemProgressEntry.value.interval = scheduling.interval;
        itemProgressEntry.value.nextDuePosition = scheduling.nextDuePosition;
        itemProgressEntry.value.lastReviewPosition = conceptProgressEntry.value.globalPositionCounter;
        
        state.currentSession.lastActivityTime = new Date();
        state.isDirty = true;
      }
    },

    incrementGlobalPosition: (state, action: PayloadAction<string>) => {
      if (state.currentSession) {
        const conceptName = action.payload;
        
        let conceptProgressEntry = (state.currentSession.conceptsProgress as any).find(
          (entry: any) => entry.key === conceptName
        );
        
        if (conceptProgressEntry) {
          conceptProgressEntry.value.globalPositionCounter++;
        }
        
        state.isDirty = true;
      }
    },

    addSpecialQuestion: (state, action: PayloadAction<{
      conceptName: string;
      question: SpecialQuestion;
    }>) => {
      if (state.currentSession) {
        const { conceptName, question } = action.payload;
        
        let conceptProgressEntry = (state.currentSession.conceptsProgress as any).find(
          (entry: any) => entry.key === conceptName
        );
        
        if (conceptProgressEntry) {
          conceptProgressEntry.value.specialQuestionsAsked.push(question);
          state.currentSession.lastActivityTime = new Date();
          state.isDirty = true;
        }
      }
    },

    // Auto-save and sync
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.autoSaveEnabled = action.payload;
    },

    markSynced: (state) => {
      state.lastSyncTime = new Date();
      state.isDirty = false;
    },

    markDirty: (state) => {
      state.isDirty = true;
    },

    // Reset state
    resetSessionState: (state) => {
      state.currentSession = null;
      state.sessions = [];
      state.loading = false;
      state.error = null;
      state.lastSyncTime = null;
      state.isDirty = false;
    },
  },
});

export const {
  setLoading,
  setError,
  setCurrentSession,
  updateSessionPhase,
  addConversationMessage,
  updateTopicProgress,
  updateItemProgress,
  incrementGlobalPosition,
  addSpecialQuestion,
  setAutoSave,
  markSynced,
  markDirty,
  resetSessionState,
} = sessionSlice.actions;

// Selectors with deserialization
export const selectCurrentSession = (state: { session: SessionState }): LearningSession | null => {
  if (!state.session.currentSession) return null;
  return deserializeLearningSession(state.session.currentSession as any);
};

export const selectConceptProgress = (
  state: { session: SessionState }, 
  conceptName: string
): ConceptProgress | null => {
  const session = selectCurrentSession(state);
  if (!session) return null;
  return session.conceptsProgress.get(conceptName) || null;
};

export default sessionSlice.reducer;