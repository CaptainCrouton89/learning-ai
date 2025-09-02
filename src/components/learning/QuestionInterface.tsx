'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, SkipForward, Lightbulb } from 'lucide-react';

interface QuestionInterfaceProps {
  question: string;
  onSubmit: (answer: string) => Promise<void>;
  onSkip: () => Promise<void>;
  disabled?: boolean;
  phase: string;
}

export function QuestionInterface({
  question,
  onSubmit,
  onSkip,
  disabled = false,
  phase,
}: QuestionInterfaceProps) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(answer);
      setAnswer(''); // Clear the input after successful submission
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSkipping) return;
    
    setIsSkipping(true);
    try {
      await onSkip();
    } finally {
      setIsSkipping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    }
  };

  const getPhaseConfig = () => {
    switch (phase) {
      case 'high-level':
        return {
          title: 'High-Level Overview',
          description: 'Building foundational understanding',
          placeholder: 'Share your thoughts or ask a question...',
          inputType: 'textarea' as const,
          icon: <Lightbulb className="w-4 h-4" />,
          color: 'bg-blue-50 border-blue-200 text-blue-700',
        };
      case 'concept-learning':
        return {
          title: 'Concept Deep Dive',
          description: 'Exploring specific topics in detail',
          placeholder: 'Explain your understanding or ask for clarification...',
          inputType: 'textarea' as const,
          icon: <MessageCircle className="w-4 h-4" />,
          color: 'bg-purple-50 border-purple-200 text-purple-700',
        };
      case 'memorization':
        return {
          title: 'Memorization Practice',
          description: 'Flashcard-based learning',
          placeholder: 'Your answer...',
          inputType: 'input' as const,
          icon: <MessageCircle className="w-4 h-4" />,
          color: 'bg-green-50 border-green-200 text-green-700',
        };
      case 'drawing-connections':
        return {
          title: 'Making Connections',
          description: 'Applying knowledge to scenarios',
          placeholder: 'Describe your approach and reasoning...',
          inputType: 'textarea' as const,
          icon: <MessageCircle className="w-4 h-4" />,
          color: 'bg-orange-50 border-orange-200 text-orange-700',
        };
      default:
        return {
          title: 'Learning Session',
          description: 'Continue your learning journey',
          placeholder: 'Type your response...',
          inputType: 'textarea' as const,
          icon: <MessageCircle className="w-4 h-4" />,
          color: 'bg-gray-50 border-gray-200 text-gray-700',
        };
    }
  };

  const config = getPhaseConfig();

  if (!question) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Waiting for the next question...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Badge variant="secondary" className={`${config.color} font-medium`}>
            {config.icon}
            <span className="ml-2">{config.title}</span>
          </Badge>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6">
        {/* Current Question */}
        <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border-l-4 border-primary">
          <div className="flex items-start space-x-3">
            <div className="bg-primary/10 rounded-full p-2 mt-1 flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-2">Question</p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {question}
              </div>
            </div>
          </div>
        </div>

        {/* Answer Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="answer" className="text-sm font-medium">
              Your Response
            </label>
            {config.inputType === 'textarea' ? (
              <Textarea
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={config.placeholder}
                className="min-h-[100px] sm:min-h-[120px] resize-none text-base touch-manipulation focus:ring-2 focus:ring-primary"
                disabled={disabled || isSubmitting}
              />
            ) : (
              <Input
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={config.placeholder}
                className="h-12 text-base touch-manipulation focus:ring-2 focus:ring-primary"
                disabled={disabled || isSubmitting}
              />
            )}
            <p className="text-xs text-muted-foreground">
              <span className="hidden sm:inline">Press Ctrl+Enter (or Cmd+Enter on Mac) to submit quickly</span>
              <span className="sm:hidden">Tap submit when ready</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={disabled || isSubmitting || isSkipping}
              className="flex items-center gap-2 h-12 sm:h-10 touch-manipulation order-2 sm:order-1"
            >
              <SkipForward className="w-4 h-4" />
              <span className="hidden sm:inline">{isSkipping ? 'Skipping...' : 'Skip Topic'}</span>
              <span className="sm:hidden">{isSkipping ? 'Skip...' : 'Skip'}</span>
            </Button>

            <div className="flex items-center justify-between sm:justify-end gap-2 order-1 sm:order-2">
              <p className="text-xs text-muted-foreground">
                <span className="hidden sm:inline">{answer.length} characters</span>
                <span className="sm:hidden">{answer.length} chars</span>
              </p>
              <Button
                type="submit"
                disabled={!answer.trim() || disabled || isSubmitting}
                className="flex items-center gap-2 min-w-[100px] h-12 sm:h-10 touch-manipulation flex-1 sm:flex-none"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Thinking...</span>
                    <span className="sm:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      {/* Tips Section */}
      <CardFooter className="bg-muted/20 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium mb-1">Tips for better learning:</p>
            <ul className="space-y-1 text-xs">
              {phase === 'memorization' ? (
                <>
                  <li>• Be concise and accurate</li>
                  <li className="hidden sm:list-item">• Don't worry about perfect formatting</li>
                  <li>• Focus on key concepts</li>
                </>
              ) : (
                <>
                  <li>• Explain your reasoning</li>
                  <li className="hidden sm:list-item">• Ask questions if something is unclear</li>
                  <li>• Connect to what you know</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}