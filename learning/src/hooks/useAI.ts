"use client";

import { useState, useCallback } from "react";
import { Course, Concept } from "@/types/course";

interface TopicAnalysis {
  is_appropriate: boolean;
  reason: string;
  suggested_refinements: string[];
  clarifying_questions: string[];
}

interface ConnectionResponse {
  response: string;
  followUp: string | null;
}

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeTopic = useCallback(async (
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ): Promise<TopicAnalysis | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/analyze-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, timeAvailable, existingUnderstanding })
      });
      
      if (!response.ok) throw new Error("Failed to analyze topic");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze topic");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateCourse = useCallback(async (
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    existingUnderstanding: string,
    learningGoals: string
  ): Promise<Course | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic, 
          documentContent, 
          timeAvailable, 
          existingUnderstanding, 
          learningGoals 
        })
      });
      
      if (!response.ok) throw new Error("Failed to generate course");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate course");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateLearningGoals = useCallback(async (
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ): Promise<string[] | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/learning-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, timeAvailable, existingUnderstanding })
      });
      
      if (!response.ok) throw new Error("Failed to generate learning goals");
      const data = await response.json();
      return data.goals;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate learning goals");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateHighLevelQuestion = useCallback(async (
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/high-level/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          course, 
          conversationHistory, 
          existingUnderstanding, 
          isFirstQuestion 
        })
      });
      
      if (!response.ok) throw new Error("Failed to generate question");
      const data = await response.json();
      return data.question;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate question");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const evaluateHighLevelAnswer = useCallback(async (
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    comprehensionProgress?: Map<string, number>
  ): Promise<{ response: string; comprehensionUpdates: Array<{ topic: string; comprehension: number }> } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/high-level/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userAnswer,
          course, 
          conversationHistory, 
          existingUnderstanding,
          comprehensionProgress: comprehensionProgress ? Array.from(comprehensionProgress.entries()) : []
        })
      });
      
      if (!response.ok) throw new Error("Failed to evaluate answer");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate answer");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateConceptQuestion = useCallback(async (
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/concept/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          concept, 
          conversationHistory, 
          existingUnderstanding, 
          isFirstQuestion 
        })
      });
      
      if (!response.ok) throw new Error("Failed to generate concept question");
      const data = await response.json();
      return data.question;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate concept question");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const evaluateConceptAnswer = useCallback(async (
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    unmasteredTopics?: string[]
  ): Promise<{ response: string; comprehensionUpdates: Array<{ topic: string; comprehension: number }> } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/concept/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userAnswer,
          concept, 
          conversationHistory, 
          existingUnderstanding,
          unmasteredTopics
        })
      });
      
      if (!response.ok) throw new Error("Failed to evaluate concept answer");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate concept answer");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const evaluateFlashcardAnswer = useCallback(async (
    item: string,
    fields: string[],
    userAnswer: string,
    concept: Concept,
    otherConcepts: string[],
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>,
    existingUnderstanding: string
  ): Promise<{ comprehension: number; response: string } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/flashcard/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          item,
          fields,
          userAnswer,
          concept,
          otherConcepts,
          previousAttempts,
          existingUnderstanding
        })
      });
      
      if (!response.ok) throw new Error("Failed to evaluate flashcard answer");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate flashcard answer");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateConnectionQuestion = useCallback(async (
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/connections/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          connections,
          course,
          previousQuestions,
          existingUnderstanding
        })
      });
      
      if (!response.ok) throw new Error("Failed to generate connection question");
      const data = await response.json();
      return data.question;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate connection question");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const evaluateConnectionAnswer = useCallback(async (
    question: string,
    userAnswer: string,
    course: Course,
    existingUnderstanding: string
  ): Promise<ConnectionResponse | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/connections/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question,
          userAnswer,
          course,
          existingUnderstanding
        })
      });
      
      if (!response.ok) throw new Error("Failed to evaluate connection answer");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate connection answer");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    analyzeTopic,
    generateCourse,
    generateLearningGoals,
    generateHighLevelQuestion,
    evaluateHighLevelAnswer,
    generateConceptQuestion,
    evaluateConceptAnswer,
    evaluateFlashcardAnswer,
    generateConnectionQuestion,
    evaluateConnectionAnswer,
  };
}