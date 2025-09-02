'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  BookOpen, 
  Target, 
  Zap, 
  Trophy, 
  Brain,
  CheckCircle,
  Clock,
  Play,
  Pause
} from 'lucide-react';
import { Course } from '@/types/course';

interface PhaseTransitionProps {
  currentPhase: string;
  course: Course;
  onTransition: (proceed: boolean, concept?: string) => void;
}

export function PhaseTransition({ currentPhase, course, onTransition }: PhaseTransitionProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | undefined>();

  const getPhaseInfo = (phase: string) => {
    switch (phase) {
      case 'initialization':
        return {
          current: { 
            label: 'Getting Started', 
            icon: <BookOpen className="w-5 h-5" />, 
            color: 'bg-gray-100 text-gray-700',
            description: 'You\'ve set up your learning preferences and we understand your background.'
          },
          next: { 
            label: 'High-Level Overview', 
            icon: <Brain className="w-5 h-5" />, 
            color: 'bg-blue-100 text-blue-700',
            description: 'We\'ll build your foundational understanding with key concepts and background knowledge.',
            action: 'Start Overview'
          }
        };
      case 'high-level':
        return {
          current: { 
            label: 'High-Level Overview', 
            icon: <Brain className="w-5 h-5" />, 
            color: 'bg-blue-100 text-blue-700',
            description: 'You\'ve built a solid foundation and understanding of the core concepts.'
          },
          next: { 
            label: 'Concept Deep Dive', 
            icon: <Target className="w-5 h-5" />, 
            color: 'bg-purple-100 text-purple-700',
            description: 'Time to dive deep into specific concepts with focused questions and detailed exploration.',
            action: 'Start Deep Dive',
            requiresConceptSelection: true
          }
        };
      case 'concept-learning':
        return {
          current: { 
            label: 'Concept Deep Dive', 
            icon: <Target className="w-5 h-5" />, 
            color: 'bg-purple-100 text-purple-700',
            description: 'You\'ve explored the concepts in detail and have a thorough understanding.'
          },
          next: { 
            label: 'Memorization Practice', 
            icon: <Zap className="w-5 h-5" />, 
            color: 'bg-green-100 text-green-700',
            description: 'Let\'s reinforce your knowledge with flashcard practice and spaced repetition.',
            action: 'Start Practice'
          }
        };
      case 'memorization':
        return {
          current: { 
            label: 'Memorization Practice', 
            icon: <Zap className="w-5 h-5" />, 
            color: 'bg-green-100 text-green-700',
            description: 'You\'ve practiced key information and strengthened your recall abilities.'
          },
          next: { 
            label: 'Drawing Connections', 
            icon: <Trophy className="w-5 h-5" />, 
            color: 'bg-orange-100 text-orange-700',
            description: 'Now let\'s apply your knowledge to real scenarios and synthesize everything you\'ve learned.',
            action: 'Start Synthesis'
          }
        };
      default:
        return {
          current: { 
            label: 'Current Phase', 
            icon: <BookOpen className="w-5 h-5" />, 
            color: 'bg-gray-100 text-gray-700',
            description: 'You\'ve completed this phase successfully.'
          },
          next: { 
            label: 'Next Phase', 
            icon: <ArrowRight className="w-5 h-5" />, 
            color: 'bg-primary/10 text-primary',
            description: 'Ready to continue your learning journey.',
            action: 'Continue'
          }
        };
    }
  };

  const phaseInfo = getPhaseInfo(currentPhase);
  const requiresConceptSelection = phaseInfo.next.requiresConceptSelection && course.concepts.length > 1;

  const handleProceed = async () => {
    if (requiresConceptSelection && !selectedConcept) {
      return; // Don't proceed without concept selection
    }
    
    setIsProcessing(true);
    try {
      await onTransition(true, selectedConcept);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePause = async () => {
    setIsProcessing(true);
    try {
      await onTransition(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            Phase Complete!
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Phase Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <Badge className={`${phaseInfo.current.color} flex items-center gap-2`}>
                {phaseInfo.current.icon}
                {phaseInfo.current.label}
              </Badge>
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {phaseInfo.current.description}
            </p>
          </div>

          {/* Next Phase Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <Badge className={`${phaseInfo.next.color} flex items-center gap-2`}>
                {phaseInfo.next.icon}
                {phaseInfo.next.label}
              </Badge>
            </div>
            
            <p className="text-sm pl-8">
              {phaseInfo.next.description}
            </p>

            {/* Concept Selection */}
            {requiresConceptSelection && (
              <div className="pl-8 space-y-3">
                <p className="text-sm font-medium">Choose a concept to explore:</p>
                <div className="grid gap-2">
                  {course.concepts.map((concept) => (
                    <button
                      key={concept.name}
                      onClick={() => setSelectedConcept(concept.name)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedConcept === concept.name
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'
                      }`}
                    >
                      <div className="font-medium text-sm">{concept.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {concept['high-level'].length} topics to explore
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Learning Stats */}
          <div className="bg-primary/5 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Your Progress
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Course:</span>
                <div className="font-medium">{course.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Concepts:</span>
                <div className="font-medium">{course.concepts.length} total</div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePause}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            Take a Break
          </Button>

          <Button
            onClick={handleProceed}
            disabled={isProcessing || (requiresConceptSelection && !selectedConcept)}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {phaseInfo.next.action || 'Continue'}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}