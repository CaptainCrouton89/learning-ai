'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionInterface } from '@/components/learning/QuestionInterface';
import { ProgressIndicator } from '@/components/learning/ProgressIndicator';
import { ConversationHistory, ConversationEntry } from '@/components/learning/ConversationHistory';
import { PhaseTransition } from '@/components/learning/PhaseTransition';
import { Course, LearningSession } from '@/types/course';

interface LearningSessionWithProgress extends Omit<LearningSession, 'conversationHistory'> {
  conversationHistory: ConversationEntry[];
  progress: {
    conceptsCompleted: number;
    totalConcepts: number;
    itemsMastered: number;
    totalItems: number;
    overallCompletion: number;
  };
}

export default function LearningPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [session, setSession] = useState<LearningSessionWithProgress | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuestionMode, setIsQuestionMode] = useState(true);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);

  useEffect(() => {
    const loadSessionAndCourse = async () => {
      try {
        setLoading(true);
        
        // Load session
        const sessionResponse = await fetch(`/api/sessions/${courseId}`);
        if (!sessionResponse.ok) {
          throw new Error(`Failed to load session: ${sessionResponse.statusText}`);
        }
        const sessionData = await sessionResponse.json();
        setSession(sessionData);
        
        // Load course
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (!courseResponse.ok) {
          throw new Error(`Failed to load course: ${courseResponse.statusText}`);
        }
        const courseData = await courseResponse.json();
        setCourse(courseData);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load learning session');
      } finally {
        setLoading(false);
      }
    };

    loadSessionAndCourse();
  }, [courseId]);

  const handleQuestionSubmitted = async (answer: string) => {
    if (!session) return;
    
    try {
      // Add user message to conversation
      const newHistory = [
        ...session.conversationHistory,
        {
          role: 'user' as const,
          content: answer,
          timestamp: new Date().toISOString(),
        },
      ];
      
      setSession(prev => prev ? {
        ...prev,
        conversationHistory: newHistory,
      } : null);

      // Submit answer to AI service
      const response = await fetch(`/api/sessions/${courseId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit answer: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update session with AI response and progress
      setSession(prev => prev ? {
        ...prev,
        conversationHistory: result.conversationHistory,
        progress: result.progress,
        currentPhase: result.currentPhase,
        currentConcept: result.currentConcept,
        lastActivityTime: result.lastActivityTime,
      } : null);

      // Check if phase transition is needed
      if (result.phaseComplete) {
        setShowPhaseTransition(true);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    }
  };

  const handleSkipTopic = async () => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/sessions/${courseId}/skip`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to skip topic: ${response.statusText}`);
      }

      const result = await response.json();
      
      setSession(prev => prev ? {
        ...prev,
        conversationHistory: result.conversationHistory,
        progress: result.progress,
        lastActivityTime: result.lastActivityTime,
      } : null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip topic');
    }
  };

  const handlePhaseTransition = async (proceed: boolean, concept?: string) => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/sessions/${courseId}/phase-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceed, concept }),
      });

      if (!response.ok) {
        throw new Error(`Failed to handle phase transition: ${response.statusText}`);
      }

      const result = await response.json();
      
      setSession(prev => prev ? {
        ...prev,
        currentPhase: result.currentPhase,
        currentConcept: result.currentConcept,
        conversationHistory: result.conversationHistory,
        lastActivityTime: result.lastActivityTime,
      } : null);
      
      setShowPhaseTransition(false);
      setIsQuestionMode(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to handle phase transition');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8 sm:py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 sm:h-12 w-8 sm:w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-muted-foreground">Loading your learning session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card>
          <CardContent className="py-8 sm:py-12">
            <div className="text-center text-red-600">
              <p className="text-base sm:text-lg font-medium mb-2">Error Loading Session</p>
              <p className="text-sm text-muted-foreground break-words">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4 h-12 sm:h-10 touch-manipulation"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session || !course) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card>
          <CardContent className="py-8 sm:py-12">
            <div className="text-center">
              <p className="text-base sm:text-lg font-medium mb-2">Session Not Found</p>
              <p className="text-sm text-muted-foreground">The learning session could not be loaded.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = session.conversationHistory
    .filter(entry => entry.role === 'assistant')
    .slice(-1)[0]?.content || '';

  return (
    <div className="container mx-auto p-3 sm:p-6">
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Main Learning Interface */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6 order-2 lg:order-1">
          {/* Course Header */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{course.name}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Phase: {session.currentPhase.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {session.currentConcept && (
                      <span className="block sm:inline"> 
                        <span className="hidden sm:inline"> • </span>
                        <span className="sm:hidden">Topic: </span>
                        {session.currentConcept}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuestionMode(!isQuestionMode)}
                  className="h-10 touch-manipulation whitespace-nowrap lg:hidden"
                >
                  <span className="sm:hidden">{isQuestionMode ? 'History' : 'Learn'}</span>
                  <span className="hidden sm:inline lg:hidden">{isQuestionMode ? 'View History' : 'Continue Learning'}</span>
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Progress Indicator */}
          <ProgressIndicator 
            session={session as any} 
            course={course} 
          />

          {/* Phase Transition Modal */}
          {showPhaseTransition && (
            <PhaseTransition
              currentPhase={session.currentPhase}
              course={course}
              onTransition={handlePhaseTransition}
            />
          )}

          {/* Main Content */}
          {isQuestionMode ? (
            <QuestionInterface
              question={currentQuestion}
              onSubmit={handleQuestionSubmitted}
              onSkip={handleSkipTopic}
              disabled={loading}
              phase={session.currentPhase}
            />
          ) : (
            <ConversationHistory
              history={session.conversationHistory}
              onReturnToQuestion={() => setIsQuestionMode(true)}
            />
          )}
        </div>

        {/* Sidebar - Hidden on mobile by default, shown on demand */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <div className="lg:block hidden">
            <ConversationHistory
              history={session.conversationHistory}
              compact={true}
              maxEntries={10}
            />
          </div>
          
          {/* Mobile conversation toggle */}
          <div className="lg:hidden">
            {!isQuestionMode && (
              <ConversationHistory
                history={session.conversationHistory}
                onReturnToQuestion={() => setIsQuestionMode(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}