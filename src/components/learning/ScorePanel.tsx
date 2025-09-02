'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { CheckCircle, Circle, Brain, Target, Trophy } from 'lucide-react';
import type { ProgressData } from '../../hooks/useStreamingCompletion';

interface ScorePanelProps {
  scores: ProgressData | null;
  isLoading?: boolean;
  className?: string;
}

export function ScorePanel({ scores, isLoading = false, className = '' }: ScorePanelProps) {
  if (isLoading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scores) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No progress data available</p>
        </CardContent>
      </Card>
    );
  }

  // Process topic progress data
  const topicEntries = Object.entries(scores.scores.topicProgress);
  const highLevelTopics = topicEntries.filter(([key]) => key.startsWith('high-level:'));
  const conceptTopics = topicEntries.filter(([key]) => !key.startsWith('high-level:'));

  // Process item progress data
  const itemEntries = Object.entries(scores.scores.itemProgress);
  
  // Calculate overall progress
  const overallProgressPercent = Math.round(
    (scores.overallProgress.completedConcepts / scores.overallProgress.totalConcepts) * 100
  );
  
  const currentConceptProgressPercent = Math.round(scores.overallProgress.currentConceptProgress * 100);

  // Helper function to get comprehension color
  const getComprehensionColor = (score: number) => {
    if (score >= 5) return 'text-green-600 bg-green-100';
    if (score >= 4) return 'text-blue-600 bg-blue-100';
    if (score >= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Helper function to get comprehension icon
  const getComprehensionIcon = (score: number) => {
    return score >= 4 ? (
      <CheckCircle className="h-3 w-3 text-green-600" />
    ) : (
      <Circle className="h-3 w-3 text-muted-foreground" />
    );
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Progress
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          {scores.courseName} • {scores.currentPhase.replace('-', ' ')}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ScrollArea className="h-96">
          <div className="space-y-4">
            
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-medium">Overall Progress</span>
              </div>
              <Progress value={overallProgressPercent} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {scores.overallProgress.completedConcepts} of {scores.overallProgress.totalConcepts} concepts completed ({overallProgressPercent}%)
              </div>
            </div>

            {/* Current Concept Progress */}
            {scores.currentConcept && currentConceptProgressPercent > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Current: {scores.currentConcept}</span>
                </div>
                <Progress value={currentConceptProgressPercent} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {currentConceptProgressPercent}% mastery
                </div>
              </div>
            )}

            <Separator />

            {/* High-Level Topics */}
            {highLevelTopics.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-3 w-3" />
                  Foundation Topics
                </h4>
                <div className="space-y-2">
                  {highLevelTopics.map(([key, score]) => {
                    const topicName = key.split(':')[1];
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getComprehensionIcon(score)}
                          <span className="text-xs truncate" title={topicName}>
                            {topicName}
                          </span>
                        </div>
                        <Badge variant="secondary" className={`text-xs ${getComprehensionColor(score)}`}>
                          {score}/5
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Concept-Specific Topics */}
            {conceptTopics.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Concept Topics</h4>
                <div className="space-y-2">
                  {conceptTopics.map(([key, score]) => {
                    const [conceptName, topicName] = key.split(':');
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getComprehensionIcon(score)}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate" title={topicName}>
                              {topicName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={conceptName}>
                              {conceptName}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className={`text-xs ${getComprehensionColor(score)}`}>
                          {score}/5
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Memorization Items */}
            {itemEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Memorization Items</h4>
                  <div className="space-y-2">
                    {itemEntries.map(([key, item]) => {
                      const [conceptName, itemName] = key.split(':');
                      const isMastered = item.successCount >= 2; // Mastery threshold
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isMastered ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <Circle className="h-3 w-3 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate" title={itemName}>
                                {itemName}
                              </div>
                              <div className="text-xs text-muted-foreground truncate" title={conceptName}>
                                {conceptName}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getComprehensionColor(item.comprehension)}`}
                            >
                              {item.comprehension}/5
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${isMastered ? 'text-green-600' : 'text-muted-foreground'}`}
                            >
                              {item.successCount}/2
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Phase Information */}
            <Separator />
            <div className="pt-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Phase: <span className="font-medium">{scores.currentPhase.replace('-', ' ')}</span></div>
                {scores.currentConcept && (
                  <div>Focus: <span className="font-medium">{scores.currentConcept}</span></div>
                )}
                <div>Session: <span className="font-mono">{scores.sessionId.slice(-8)}</span></div>
              </div>
            </div>
            
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}