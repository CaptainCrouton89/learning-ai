import { useState, useCallback, useRef } from 'react';
// Note: useChat is not available in ai v5 for React, will use a simplified approach
// import { useChat } from 'ai';
import type { AITools } from '../lib/ai-tools.js';

// Simplified message interface to match expected structure
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// Define the expected tool result structure
type ToolResult = {
  toolName: keyof AITools;
  result: any;
  success?: boolean;
  error?: string;
};

// Progress data structure matching the API response
export interface ProgressData {
  sessionId: string;
  courseId: string;
  courseName: string;
  currentPhase: string;
  currentConcept?: string;
  overallProgress: {
    totalConcepts: number;
    completedConcepts: number;
    currentConceptProgress: number;
  };
  scores: {
    comprehension: Record<string, number>;
    itemProgress: Record<string, { successCount: number; comprehension: number }>;
    topicProgress: Record<string, number>;
  };
}

interface UseStreamingCompletionOptions {
  sessionId: string;
  phase?: 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections';
  conceptName?: string;
  existingUnderstanding?: string;
  onToolResult?: (result: ToolResult) => void;
  onProgressUpdate?: (progress: ProgressData) => void;
  onError?: (error: string) => void;
}

interface UseStreamingCompletionReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  reload: () => void;
  stop: () => void;
  scores: ProgressData | null;
  refreshScores: () => Promise<void>;
  toolResults: ToolResult[];
  clearMessages: () => void;
}

export function useStreamingCompletion(
  options: UseStreamingCompletionOptions
): UseStreamingCompletionReturn {
  const {
    sessionId,
    phase,
    conceptName,
    existingUnderstanding,
    onToolResult,
    onProgressUpdate,
    onError
  } = options;

  const [scores, setScores] = useState<ProgressData | null>(null);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingToolResults = useRef<ToolResult[]>([]);

  // Function to fetch updated scores
  const refreshScores = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/progress`);
      if (response.ok) {
        const progressData = await response.json();
        setScores(progressData);
        onProgressUpdate?.(progressData);
      } else {
        console.error('Failed to fetch scores:', response.statusText);
      }
    } catch (error) {
      console.error('Error refreshing scores:', error);
    }
  }, [sessionId, onProgressUpdate]);

  // State management for messages and streaming
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const streamController = useRef<AbortController | null>(null);

  // Function to send a message using fetch with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (isLoading || isStreaming) return;
    
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);

    // Create new user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };

    // Add user message to messages
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Prepare request body
    const requestBody = {
      messages: updatedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })),
      phase,
      conceptName,
      existingUnderstanding
    };

    try {
      // Create abort controller for this request
      streamController.current = new AbortController();

      const response = await fetch(`/api/sessions/${sessionId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: streamController.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Read streaming response
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text-delta' && data.textDelta) {
                  assistantMessage.content += data.textDelta;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantMessage.content;
                    }
                    return newMessages;
                  });
                }
                // Handle tool calls and other events here
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Refresh scores after completion
      await refreshScores();

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const errorMessage = `Streaming error: ${error.message}`;
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      streamController.current = null;
    }
  }, [messages, sessionId, phase, conceptName, existingUnderstanding, isLoading, isStreaming, refreshScores, onError]);

  // Function to stop streaming
  const stop = useCallback(() => {
    if (streamController.current) {
      streamController.current.abort();
      streamController.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  // Function to reload - not implemented in simplified version
  const reload = useCallback(() => {
    console.warn('Reload not implemented in simplified version');
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolResults([]);
    setError(null);
    pendingToolResults.current = [];
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    reload,
    stop,
    scores,
    refreshScores,
    toolResults,
    clearMessages
  };
}