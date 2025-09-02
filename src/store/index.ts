import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { learningApi } from './api/learningApi';
import courseSlice from './slices/courseSlice';
import sessionSlice from './slices/sessionSlice';
import learningSlice from './slices/learningSlice';

export const store = configureStore({
  reducer: {
    course: courseSlice,
    session: sessionSlice,
    learning: learningSlice,
    [learningApi.reducerPath]: learningApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for Date objects and Map serialization
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore Date objects and Maps in state paths
        ignoredPaths: [
          'session.currentSession.startTime',
          'session.currentSession.lastActivityTime',
          'session.currentSession.conversationHistory',
          'session.currentSession.conceptsProgress',
          'learning.conversationHistory',
        ],
      },
    }).concat(learningApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout the app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;