"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Course, LearningSession, Concept } from "@/types/course";

interface LearningContextType {
  // Course state
  currentCourse: Course | null;
  setCurrentCourse: (course: Course | null) => void;
  
  // Session state
  currentSession: LearningSession | null;
  setCurrentSession: (session: LearningSession | null) => void;
  
  // Learning preferences
  existingUnderstanding: string;
  setExistingUnderstanding: (understanding: string) => void;
  timeAvailable: string;
  setTimeAvailable: (time: string) => void;
  
  // Current phase and progress
  currentPhase: LearningSession["phase"] | null;
  setCurrentPhase: (phase: LearningSession["phase"]) => void;
  currentConcept: Concept | null;
  setCurrentConcept: (concept: Concept | null) => void;
  
  // Conversation history
  conversationHistory: Array<{ role: string; content: string }>;
  addToConversation: (role: string, content: string) => void;
  clearConversation: () => void;
  
  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
}

const LearningContext = createContext<LearningContextType | undefined>(undefined);

export function LearningProvider({ children }: { children: ReactNode }) {
  // Core state
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  
  // Learning preferences
  const [existingUnderstanding, setExistingUnderstanding] = useState("Some - I know the basics");
  const [timeAvailable, setTimeAvailable] = useState("15-60min");
  
  // Phase and progress
  const [currentPhase, setCurrentPhase] = useState<LearningSession["phase"] | null>(null);
  const [currentConcept, setCurrentConcept] = useState<Concept | null>(null);
  
  // Conversation
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Conversation management
  const addToConversation = useCallback((role: string, content: string) => {
    setConversationHistory(prev => [...prev, { role, content }]);
  }, []);
  
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
  }, []);
  
  const value: LearningContextType = {
    currentCourse,
    setCurrentCourse,
    currentSession,
    setCurrentSession,
    existingUnderstanding,
    setExistingUnderstanding,
    timeAvailable,
    setTimeAvailable,
    currentPhase,
    setCurrentPhase,
    currentConcept,
    setCurrentConcept,
    conversationHistory,
    addToConversation,
    clearConversation,
    isLoading,
    setIsLoading,
    error,
    setError,
  };
  
  return (
    <LearningContext.Provider value={value}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (context === undefined) {
    throw new Error("useLearning must be used within a LearningProvider");
  }
  return context;
}