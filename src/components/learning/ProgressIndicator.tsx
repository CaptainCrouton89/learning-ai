'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Target, 
  Trophy, 
  Clock, 
  Brain, 
  Zap,
  CheckCircle,
  Circle
} from 'lucide-react';
import { Course, LearningSession } from '@/types/course';

interface ProgressIndicatorProps {
  session: LearningSession & {
    progress: {
      conceptsCompleted: number;
      totalConcepts: number;
      itemsMastered: number;
      totalItems: number;
      overallCompletion: number;
    };
  };
  course: Course;
}

export function ProgressIndicator({ session, course }: ProgressIndicatorProps) {
  const { progress } = session;
  
  const getPhaseInfo = (phase: string) => {
    switch (phase) {
      case 'initialization':
        return { 
          label: 'Getting Started', 
          icon: <BookOpen className="w-4 h-4" />, 
          color: 'bg-gray-100 text-gray-700',
          description: 'Setting up your learning preferences'
        };
      case 'high-level':
        return { 
          label: 'Overview', 
          icon: <Brain className="w-4 h-4" />, 
          color: 'bg-blue-100 text-blue-700',
          description: 'Building foundational understanding'
        };
      case 'concept-learning':
        return { 
          label: 'Deep Dive', 
          icon: <Target className="w-4 h-4" />, 
          color: 'bg-purple-100 text-purple-700',
          description: 'Mastering specific concepts'
        };
      case 'memorization':
        return { 
          label: 'Practice', 
          icon: <Zap className="w-4 h-4" />, 
          color: 'bg-green-100 text-green-700',
          description: 'Reinforcing key information'
        };
      case 'drawing-connections':
        return { 
          label: 'Synthesis', 
          icon: <Trophy className="w-4 h-4" />, 
          color: 'bg-orange-100 text-orange-700',
          description: 'Applying knowledge in context'
        };
      default:
        return { 
          label: 'Learning', 
          icon: <BookOpen className="w-4 h-4" />, 
          color: 'bg-gray-100 text-gray-700',
          description: 'In progress'
        };
    }
  };

  const currentPhaseInfo = getPhaseInfo(session.currentPhase);
  
  const getConceptProgress = (conceptName: string) => {
    const conceptProgress = session.conceptsProgress.get(conceptName);
    if (!conceptProgress) return { completion: 0, topicsCount: 0, masteredTopics: 0 };
    
    const concept = course.concepts.find(c => c.name === conceptName);
    const totalTopics = concept?.['high-level']?.length || 0;
    let masteredTopics = 0;
    
    if (concept && conceptProgress.topicProgress) {
      for (const topic of concept['high-level']) {
        const topicProgress = conceptProgress.topicProgress.get(topic);
        if (topicProgress && topicProgress.currentComprehension >= 4) {
          masteredTopics++;
        }
      }
    }
    
    const completion = totalTopics > 0 ? (masteredTopics / totalTopics) * 100 : 0;
    return { completion, topicsCount: totalTopics, masteredTopics };
  };

  const phases = [
    'initialization',
    'high-level', 
    'concept-learning',
    'memorization',
    'drawing-connections'
  ];

  const currentPhaseIndex = phases.indexOf(session.currentPhase);
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Overall Progress */}
      <Card className="col-span-2 sm:col-span-1 touch-manipulation">
        <CardHeader className="pb-2 p-3 sm:p-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Trophy className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
            <span className="hidden sm:inline">Overall Progress</span>
            <span className="sm:hidden">Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-bold">{Math.round(progress.overallCompletion)}%</span>
              <Badge variant="secondary" className="text-xs">
                {progress.itemsMastered}/{progress.totalItems}
              </Badge>
            </div>
            <Progress value={progress.overallCompletion} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {progress.conceptsCompleted}/{progress.totalConcepts} concepts
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Phase */}
      <Card className="touch-manipulation">
        <CardHeader className="pb-2 p-3 sm:p-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
            <span className="hidden sm:inline">Current Phase</span>
            <span className="sm:hidden">Phase</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-2">
            <Badge className={`${currentPhaseInfo.color} flex items-center gap-1 w-fit text-xs`}>
              <span className="w-3 h-3 flex items-center justify-center">{currentPhaseInfo.icon}</span>
              <span className="hidden sm:inline">{currentPhaseInfo.label}</span>
              <span className="sm:hidden">{currentPhaseInfo.label.split(' ')[0]}</span>
            </Badge>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {currentPhaseInfo.description}
            </p>
            {session.currentConcept && (
              <p className="text-xs font-medium text-primary truncate">
                <span className="hidden sm:inline">Working on: </span>
                {session.currentConcept}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      <Card className="touch-manipulation">
        <CardHeader className="pb-2 p-3 sm:p-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
            <span className="hidden sm:inline">Learning Path</span>
            <span className="sm:hidden">Path</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-1">
            {phases.map((phase, index) => {
              const phaseInfo = getPhaseInfo(phase);
              const isCompleted = index < currentPhaseIndex;
              const isCurrent = index === currentPhaseIndex;
              
              return (
                <div key={phase} className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse flex-shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <span className={`text-xs truncate ${
                    isCurrent ? 'font-medium text-primary' : 
                    isCompleted ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                    <span className="hidden sm:inline">{phaseInfo.label}</span>
                    <span className="sm:hidden">{phaseInfo.label.split(' ')[0]}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Concept Breakdown */}
      <Card className="touch-manipulation">
        <CardHeader className="pb-2 p-3 sm:p-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Brain className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
            Concepts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-2 max-h-20 sm:max-h-24 overflow-y-auto">
            {course.concepts.map((concept) => {
              const conceptProgress = getConceptProgress(concept.name);
              const isActive = session.currentConcept === concept.name;
              
              return (
                <div key={concept.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium truncate flex-1 pr-2 ${
                      isActive ? 'text-primary' : 'text-foreground'
                    }`}>
                      {concept.name}
                      {isActive && <span className="ml-1 text-primary">•</span>}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conceptProgress.masteredTopics}/{conceptProgress.topicsCount}
                    </span>
                  </div>
                  <Progress 
                    value={conceptProgress.completion} 
                    className="h-1" 
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}