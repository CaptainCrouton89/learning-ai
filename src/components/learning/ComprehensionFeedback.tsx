'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  Target,
  CheckCircle2,
  AlertCircle,
  Brain,
  Zap,
  Award,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComprehensionScore {
  score: number;
  timestamp: Date;
  context?: string;
}

interface ComprehensionFeedbackProps {
  /** Current comprehension score (0-5) */
  currentScore: number;
  /** Historical scores for trend analysis */
  scoreHistory?: ComprehensionScore[];
  /** Maximum possible score */
  maxScore?: number;
  /** Item or topic name for context */
  itemName?: string;
  /** Whether this is a success (score >= 4) */
  isSuccess?: boolean;
  /** Additional context about the scoring */
  context?: 'flashcard' | 'concept' | 'high-level';
  /** Detailed feedback text */
  feedbackText?: string;
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Custom color scheme */
  colorScheme?: 'default' | 'compact';
}

export function ComprehensionFeedback({
  currentScore,
  scoreHistory = [],
  maxScore = 5,
  itemName,
  isSuccess,
  context = 'flashcard',
  feedbackText,
  showDetails = true,
  colorScheme = 'default'
}: ComprehensionFeedbackProps) {

  const scoreAnalysis = useMemo(() => {
    const percentage = (currentScore / maxScore) * 100;
    
    // Determine score category
    let category: 'excellent' | 'good' | 'fair' | 'poor' | 'failing';
    let categoryColor: string;
    let categoryBg: string;
    let categoryIcon: React.ReactNode;
    let categoryLabel: string;

    if (currentScore >= 5) {
      category = 'excellent';
      categoryColor = 'text-emerald-700';
      categoryBg = 'bg-emerald-50 border-emerald-200';
      categoryIcon = <Award className="w-5 h-5 text-emerald-600" />;
      categoryLabel = 'Excellent Mastery';
    } else if (currentScore >= 4) {
      category = 'good';
      categoryColor = 'text-green-700';
      categoryBg = 'bg-green-50 border-green-200';
      categoryIcon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
      categoryLabel = 'Good Understanding';
    } else if (currentScore >= 3) {
      category = 'fair';
      categoryColor = 'text-yellow-700';
      categoryBg = 'bg-yellow-50 border-yellow-200';
      categoryIcon = <Target className="w-5 h-5 text-yellow-600" />;
      categoryLabel = 'Basic Understanding';
    } else if (currentScore >= 2) {
      category = 'poor';
      categoryColor = 'text-orange-700';
      categoryBg = 'bg-orange-50 border-orange-200';
      categoryIcon = <AlertCircle className="w-5 h-5 text-orange-600" />;
      categoryLabel = 'Needs Improvement';
    } else {
      category = 'failing';
      categoryColor = 'text-red-700';
      categoryBg = 'bg-red-50 border-red-200';
      categoryIcon = <AlertCircle className="w-5 h-5 text-red-600" />;
      categoryLabel = 'Requires Review';
    }

    // Calculate trend if we have history
    let trend: 'improving' | 'declining' | 'stable' | null = null;
    let trendIcon: React.ReactNode = null;
    let trendColor = '';
    
    if (scoreHistory.length >= 2) {
      const recentScores = scoreHistory.slice(-3);
      const oldestRecent = recentScores[0].score;
      const newestRecent = recentScores[recentScores.length - 1].score;
      
      if (newestRecent > oldestRecent + 0.5) {
        trend = 'improving';
        trendIcon = <TrendingUp className="w-4 h-4" />;
        trendColor = 'text-green-600';
      } else if (newestRecent < oldestRecent - 0.5) {
        trend = 'declining';
        trendIcon = <TrendingDown className="w-4 h-4" />;
        trendColor = 'text-red-600';
      } else {
        trend = 'stable';
        trendIcon = <Minus className="w-4 h-4" />;
        trendColor = 'text-gray-600';
      }
    }

    // Performance insights
    const insights: string[] = [];
    if (currentScore === maxScore) {
      insights.push('Perfect score achieved!');
    } else if (isSuccess && currentScore >= 4) {
      insights.push('Success threshold met');
    } else if (currentScore >= 3) {
      insights.push('On track for mastery');
    } else if (currentScore >= 2) {
      insights.push('Improvement needed');
    } else {
      insights.push('Requires immediate attention');
    }

    if (trend === 'improving') {
      insights.push('Showing positive progress');
    } else if (trend === 'declining') {
      insights.push('May need review of fundamentals');
    }

    return {
      percentage,
      category,
      categoryColor,
      categoryBg,
      categoryIcon,
      categoryLabel,
      trend,
      trendIcon,
      trendColor,
      insights
    };
  }, [currentScore, maxScore, scoreHistory, isSuccess]);

  const getContextIcon = (context: string) => {
    switch (context) {
      case 'flashcard':
        return <Zap className="w-4 h-4" />;
      case 'concept':
        return <Target className="w-4 h-4" />;
      case 'high-level':
        return <Brain className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getContextLabel = (context: string) => {
    switch (context) {
      case 'flashcard':
        return 'Flashcard Practice';
      case 'concept':
        return 'Concept Learning';
      case 'high-level':
        return 'High-Level Understanding';
      default:
        return 'Comprehension';
    }
  };

  if (colorScheme === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
        <div className={cn("p-2 rounded-full", scoreAnalysis.categoryBg)}>
          {scoreAnalysis.categoryIcon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{scoreAnalysis.categoryLabel}</span>
            <div className="flex items-center gap-2">
              <span className={cn("font-bold", scoreAnalysis.categoryColor)}>
                {currentScore}/{maxScore}
              </span>
              {scoreAnalysis.trend && (
                <div className={cn("flex items-center gap-1", scoreAnalysis.trendColor)}>
                  {scoreAnalysis.trendIcon}
                </div>
              )}
            </div>
          </div>
          <Progress 
            value={scoreAnalysis.percentage} 
            className={cn(
              "h-2",
              scoreAnalysis.category === 'excellent' ? 'bg-emerald-100' :
              scoreAnalysis.category === 'good' ? 'bg-green-100' :
              scoreAnalysis.category === 'fair' ? 'bg-yellow-100' :
              scoreAnalysis.category === 'poor' ? 'bg-orange-100' : 'bg-red-100'
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Score Display */}
      <Card className={cn("border-2", scoreAnalysis.categoryBg)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getContextIcon(context)}
              <span className="text-lg">{getContextLabel(context)} Score</span>
              {itemName && (
                <Badge variant="outline" className="text-xs">
                  {itemName}
                </Badge>
              )}
            </div>
            {scoreAnalysis.trend && (
              <div className={cn("flex items-center gap-2 text-sm", scoreAnalysis.trendColor)}>
                {scoreAnalysis.trendIcon}
                <span className="capitalize">{scoreAnalysis.trend}</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score Visualization */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center">
              <div className={cn("p-4 rounded-full", scoreAnalysis.categoryBg)}>
                {scoreAnalysis.categoryIcon}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className={cn("text-4xl font-bold", scoreAnalysis.categoryColor)}>
                {currentScore}
                <span className="text-xl text-muted-foreground">/{maxScore}</span>
              </div>
              <div className={cn("text-sm font-medium", scoreAnalysis.categoryColor)}>
                {scoreAnalysis.categoryLabel}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress 
                value={scoreAnalysis.percentage} 
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>{Math.round(scoreAnalysis.percentage)}%</span>
                <span>{maxScore}</span>
              </div>
            </div>
          </div>

          {/* Success Indicator */}
          {isSuccess !== undefined && (
            <>
              <Separator />
              <div className="flex items-center justify-center">
                <Badge 
                  className={cn(
                    "text-sm px-4 py-2",
                    isSuccess 
                      ? "bg-green-100 text-green-700 border-green-200" 
                      : "bg-red-100 text-red-700 border-red-200"
                  )}
                >
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Success! (≥4 required)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Needs improvement (≥4 required)
                    </>
                  )}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detailed Feedback */}
      {showDetails && (
        <div className="space-y-4">
          {/* Performance Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scoreAnalysis.insights.map((insight, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Score History */}
          {scoreHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Recent Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scoreHistory.slice(-5).map((score, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span className="text-muted-foreground">
                          {score.timestamp.toLocaleDateString()}
                        </span>
                        {score.context && (
                          <Badge variant="secondary" className="text-xs">
                            {score.context}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{score.score}/{maxScore}</span>
                        <div className="w-16">
                          <Progress 
                            value={(score.score / maxScore) * 100} 
                            className="h-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Feedback Text */}
          {feedbackText && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  Detailed Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed text-muted-foreground p-3 rounded-lg bg-muted/30">
                  {feedbackText}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}