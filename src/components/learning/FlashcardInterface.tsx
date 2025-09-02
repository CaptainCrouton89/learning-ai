'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Send, 
  Eye, 
  EyeOff,
  Clock,
  Zap,
  Target,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlashcardSchedule } from '@/types/course';

interface FlashcardInterfaceProps {
  /** The flashcard item to display */
  item: string;
  /** Fields to describe for the item */
  fields: string[];
  /** Current flashcard schedule information */
  schedule: FlashcardSchedule;
  /** User's answer */
  userAnswer: string;
  /** AI response after evaluation */
  aiResponse?: {
    comprehension: number;
    response: string;
  };
  /** Whether the card is flipped to show feedback */
  isFlipped: boolean;
  /** Whether evaluation is in progress */
  isEvaluating: boolean;
  /** Total cards in the queue */
  totalCards: number;
  /** Current card position */
  currentCard: number;
  /** Number of mastered items */
  masteredCount: number;
  /** Callback when user answer changes */
  onAnswerChange: (answer: string) => void;
  /** Callback when user submits answer */
  onSubmit: () => void;
  /** Callback when user flips the card */
  onFlip: () => void;
  /** Callback when user moves to next card */
  onNext: () => void;
}

export function FlashcardInterface({
  item,
  fields,
  schedule,
  userAnswer,
  aiResponse,
  isFlipped,
  isEvaluating,
  totalCards,
  currentCard,
  masteredCount,
  onAnswerChange,
  onSubmit,
  onFlip,
  onNext
}: FlashcardInterfaceProps) {
  const [showHint, setShowHint] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Touch gesture handlers for mobile swipe interactions
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!e.changedTouches[0]) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Minimum swipe distance (50px)
    const minSwipeDistance = 50;
    
    // Check if horizontal swipe is greater than vertical (to avoid interfering with scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0 && isFlipped) {
        // Swipe right: go back to question (if showing feedback)
        onFlip();
      } else if (deltaX < 0 && isFlipped && aiResponse) {
        // Swipe left: go to next card (if showing feedback)
        onNext();
      }
    } else if (Math.abs(deltaY) > minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY > 0 && !isFlipped) {
        // Swipe down: show hint
        setShowHint(true);
      } else if (deltaY < 0 && !isFlipped) {
        // Swipe up: flip card (if answer is provided)
        if (userAnswer.trim()) {
          onSubmit();
        }
      }
    }
  }, [isFlipped, aiResponse, userAnswer, onFlip, onNext, onSubmit]);

  const getDifficultyInfo = useCallback((easeFactor: number) => {
    if (easeFactor < 2) {
      return {
        label: 'Difficult',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <TrendingUp className="w-3 h-3" />
      };
    } else if (easeFactor > 3) {
      return {
        label: 'Easy',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle className="w-3 h-3" />
      };
    } else {
      return {
        label: 'Medium',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Target className="w-3 h-3" />
      };
    }
  }, []);

  const difficultyInfo = getDifficultyInfo(schedule.easeFactor);

  const getComprehensionColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComprehensionBgColor = (score: number) => {
    if (score >= 4) return 'bg-green-50 border-green-200';
    if (score >= 3) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const progressPercentage = totalCards > 0 ? (currentCard / totalCards) * 100 : 0;
  const masteryPercentage = totalCards > 0 ? (masteredCount / totalCards) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Progress Header */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 text-sm text-muted-foreground">
          <span className="font-medium">Card {currentCard} of {totalCards}</span>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              {masteredCount} mastered
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              {totalCards - masteredCount} remaining
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Progress</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2 sm:h-3" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mastery Rate</span>
            <span className="font-medium">{Math.round(masteryPercentage)}%</span>
          </div>
          <Progress value={masteryPercentage} className="h-2 sm:h-3 bg-green-50" />
        </div>
      </div>

      {/* Main Flashcard */}
      <Card 
        ref={cardRef}
        className={cn(
          "relative min-h-80 sm:min-h-96 transition-all duration-500 transform-gpu touch-manipulation select-none",
          isFlipped && "scale-105"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card Front */}
        <div className={cn(
          "absolute inset-0 backface-hidden transition-transform duration-500 transform-gpu",
          isFlipped && "rotate-y-180"
        )}>
          <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col justify-between">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-medium">
                  <Zap className="w-3 h-3 mr-1" />
                  Flashcard Practice
                </Badge>
                
                {schedule.easeFactor !== 2.5 && (
                  <Badge className={cn("text-xs", difficultyInfo.color)}>
                    {difficultyInfo.icon}
                    <span className="ml-1">
                      {difficultyInfo.label} (Ease: {schedule.easeFactor.toFixed(1)})
                    </span>
                  </Badge>
                )}
              </div>

              {/* Item and Fields */}
              <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-bold text-center text-primary leading-tight">
                  {item}
                </h2>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground text-center">
                    Describe the following fields:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {fields.map((field, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/30 touch-manipulation">
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-sm font-medium break-words">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Input */}
            <div className="space-y-4">
              {showHint && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-700">
                    💡 Try to be specific and comprehensive. Consider how each field relates to the concept and its practical applications.
                  </p>
                </div>
              )}
              
              {/* Mobile gesture hints */}
              <div className="sm:hidden">
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>📱 Swipe up to submit • Swipe down for hints</p>
                  {isFlipped && <p>👆 Swipe right to review • Swipe left for next card</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Textarea
                  value={userAnswer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="Type your answer here... Be specific and comprehensive."
                  className="min-h-24 sm:min-h-32 resize-none text-base touch-manipulation focus:ring-2 focus:ring-primary"
                  disabled={isEvaluating}
                />
                
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(!showHint)}
                    className="text-xs h-8 touch-manipulation"
                  >
                    {showHint ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    <span className="hidden sm:inline">{showHint ? 'Hide Hint' : 'Show Hint'}</span>
                    <span className="sm:hidden">{showHint ? 'Hide' : 'Hint'}</span>
                  </Button>
                  
                  <div className="text-xs text-muted-foreground">
                    {userAnswer.length} chars
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onSubmit}
                  disabled={!userAnswer.trim() || isEvaluating}
                  className="flex-1 h-12 touch-manipulation"
                  size="lg"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Answer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </div>

        {/* Card Back - Feedback */}
        <div className={cn(
          "absolute inset-0 backface-hidden transition-transform duration-500 transform-gpu rotate-y-180",
          isFlipped && "rotate-y-0"
        )}>
          <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            {aiResponse && (
              <div className="space-y-6 flex-1">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-medium">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Evaluation Results
                  </Badge>
                  
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium border",
                    getComprehensionBgColor(aiResponse.comprehension)
                  )}>
                    <span className={getComprehensionColor(aiResponse.comprehension)}>
                      Score: {aiResponse.comprehension}/5
                    </span>
                  </div>
                </div>

                {/* Feedback Content */}
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-base sm:text-lg">AI Feedback</h3>
                    <div className="p-3 sm:p-4 rounded-lg bg-muted/30 text-sm leading-relaxed max-h-40 sm:max-h-none overflow-y-auto">
                      {aiResponse.response}
                    </div>
                  </div>

                  {/* Success/Mastery Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {schedule.successCount >= 2 ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="font-medium text-green-600">Item Mastered!</span>
                            </>
                          ) : aiResponse.comprehension >= 4 ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="font-medium text-green-600">
                                Success! {2 - schedule.successCount} more needed for mastery
                              </span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-5 h-5 text-yellow-500" />
                              <span className="font-medium text-yellow-600">Needs Review</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {schedule.successCount >= 2 ? 
                            'This item has been fully mastered!' :
                            `Success count: ${schedule.successCount}/2 • Will review after ${schedule.interval} more cards`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button 
                    onClick={onNext} 
                    className="w-full h-12 touch-manipulation"
                    size="lg"
                  >
                    <span className="hidden sm:inline">Continue to Next Card</span>
                    <span className="sm:hidden">Next Card</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={onFlip} 
                    className="w-full h-10 touch-manipulation"
                    size="sm"
                  >
                    <span className="hidden sm:inline">Review Question</span>
                    <span className="sm:hidden">Review</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  );
}