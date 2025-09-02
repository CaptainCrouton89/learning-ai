'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConceptMastery } from '@/components/analytics/ConceptMastery';
import { LearningTimeline } from '@/components/analytics/LearningTimeline';
import { StrengthsWeaknesses } from '@/components/analytics/StrengthsWeaknesses';
import { generateAnalyticsDashboard, type AnalyticsDashboardData } from '@/lib/analytics';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Clock, 
  Award, 
  BookOpen, 
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      
      // For demo purposes, we'll use mock data
      // In a real implementation, you would:
      // 1. Get the current user's session
      // 2. Load their course data
      // 3. Generate analytics from their learning data
      
      const mockSession = createMockSession();
      const mockCourse = createMockCourse();
      
      const analyticsData = generateAnalyticsDashboard(mockSession, mockCourse);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <div className="animate-pulse space-y-4 sm:space-y-6">
          <div className="h-6 sm:h-8 bg-muted rounded w-2/3 sm:w-1/3"></div>
          <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 sm:h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-48 sm:h-64 bg-muted rounded"></div>
            <div className="h-48 sm:h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="border-destructive">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center space-x-2 text-destructive">
              <Brain className="h-5 w-5" />
              <span className="font-semibold text-sm sm:text-base">Error Loading Analytics</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground break-words">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { overallProgress, conceptMastery, learningTimeline, strengthsWeaknesses, studyPatterns } = analytics;

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Learning Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Comprehensive insights into your learning progress and patterns
          </p>
        </div>
        <Badge variant="outline" className="flex items-center space-x-2 self-start sm:self-auto">
          <Calendar className="h-4 w-4" />
          <span className="text-xs sm:text-sm">{overallProgress.totalStudyDays} study days</span>
        </Badge>
      </div>

      <Separator />

      {/* Overview Cards */}
      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Course Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-2xl font-bold">
              {overallProgress.completedConcepts}/{overallProgress.totalConcepts}
            </div>
            <p className="text-xs text-muted-foreground">concepts completed</p>
            <Progress 
              value={(overallProgress.completedConcepts / overallProgress.totalConcepts) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Mastered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallProgress.masteredItems}/{overallProgress.totalItems}
            </div>
            <p className="text-xs text-muted-foreground">learning items</p>
            <Progress 
              value={(overallProgress.masteredItems / overallProgress.totalItems) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Comprehension</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallProgress.averageComprehension.toFixed(1)}/5
            </div>
            <p className="text-xs text-muted-foreground">understanding level</p>
            <Progress 
              value={(overallProgress.averageComprehension / 5) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(studyPatterns.totalStudyTime)}
            </div>
            <p className="text-xs text-muted-foreground">minutes total</p>
            <div className="flex items-center space-x-2 mt-2">
              <Award className="h-3 w-3 text-yellow-500" />
              <span className="text-xs">{overallProgress.studyStreak} day streak</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Concept Mastery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Concept Mastery Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConceptMastery data={conceptMastery} />
        </CardContent>
      </Card>

      {/* Learning Timeline and Strengths/Weaknesses */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Learning Timeline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LearningTimeline data={learningTimeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <span>Performance Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StrengthsWeaknesses data={strengthsWeaknesses} />
          </CardContent>
        </Card>
      </div>

      {/* Study Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Study Patterns & Retention</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            {/* Phase Distribution */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm sm:text-base">Time by Learning Phase</h4>
              <div className="space-y-2">
                {studyPatterns.phaseDistribution.map((phase, index) => (
                  <div key={phase.phase} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{phase.phase.replace('-', ' ')}</span>
                      <span>{Math.round(phase.timeSpent)}min ({phase.percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={phase.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Retention Rates */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm sm:text-base">Knowledge Retention</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Immediate (same session)</span>
                  <Badge variant={studyPatterns.retentionRates.immediate >= 0.8 ? 'default' : 'secondary'}>
                    {Math.round(studyPatterns.retentionRates.immediate * 100)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Short-term (1-3 days)</span>
                  <Badge variant={studyPatterns.retentionRates.shortTerm >= 0.7 ? 'default' : 'secondary'}>
                    {Math.round(studyPatterns.retentionRates.shortTerm * 100)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Medium-term (1-2 weeks)</span>
                  <Badge variant={studyPatterns.retentionRates.mediumTerm >= 0.6 ? 'default' : 'secondary'}>
                    {Math.round(studyPatterns.retentionRates.mediumTerm * 100)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Long-term (1+ months)</span>
                  <Badge variant={studyPatterns.retentionRates.longTerm >= 0.5 ? 'default' : 'secondary'}>
                    {Math.round(studyPatterns.retentionRates.longTerm * 100)}%
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data functions for demonstration
function createMockSession() {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  return {
    userId: 'user123',
    courseId: 'wine-course',
    currentPhase: 'memorization' as const,
    currentConcept: 'grape-varieties',
    conceptsProgress: new Map([
      [
        'grape-varieties',
        {
          conceptName: 'grape-varieties',
          itemsProgress: new Map([
            [
              'chardonnay',
              {
                itemName: 'chardonnay',
                attempts: [
                  {
                    question: 'What climate does Chardonnay prefer?',
                    userAnswer: 'Cool to moderate climates',
                    aiResponse: { comprehension: 4, response: 'Excellent! Chardonnay thrives in cool to moderate climates.' },
                    timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
                  },
                  {
                    question: 'Name two famous Chardonnay regions',
                    userAnswer: 'Burgundy and California',
                    aiResponse: { comprehension: 5, response: 'Perfect! Burgundy and California are indeed premier Chardonnay regions.' },
                    timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
                  }
                ],
                successCount: 2,
                easeFactor: 2.6,
                interval: 4,
                lastReviewPosition: 5,
                nextDuePosition: 9
              }
            ],
            [
              'cabernet-sauvignon',
              {
                itemName: 'cabernet-sauvignon',
                attempts: [
                  {
                    question: 'Describe Cabernet Sauvignon tannin levels',
                    userAnswer: 'High tannins',
                    aiResponse: { comprehension: 3, response: 'Good start, but can you be more specific about the character?' },
                    timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
                  }
                ],
                successCount: 0,
                easeFactor: 2.5,
                interval: 1,
                lastReviewPosition: 6,
                nextDuePosition: 7
              }
            ]
          ]),
          topicProgress: new Map([
            [
              'wine-structure',
              {
                topicName: 'wine-structure',
                currentComprehension: 4,
                attempts: [
                  {
                    question: 'Explain the relationship between tannins and aging potential',
                    userAnswer: 'Higher tannins generally mean better aging potential',
                    aiResponse: { 
                      comprehension: 4, 
                      response: 'Very good! Tannins do provide structure for aging.',
                      targetTopic: 'wine-structure'
                    },
                    timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
                  }
                ]
              }
            ]
          ]),
          specialQuestionsAsked: [
            {
              type: 'elaboration' as const,
              question: 'Can you elaborate on what makes Chardonnay so versatile?',
              answer: 'Chardonnay is versatile because it can be made in many styles...',
              targetItem: 'chardonnay',
              timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
            }
          ],
          globalPositionCounter: 7
        }
      ]
    ]),
    conversationHistory: [],
    startTime: twoWeeksAgo,
    lastActivityTime: now,
    existingUnderstanding: 'Some - I know the basics',
    timeAvailable: '30-60min'
  };
}

function createMockCourse() {
  return {
    name: 'Wine Fundamentals',
    concepts: [
      {
        name: 'grape-varieties',
        'high-level': ['wine-structure', 'regional-characteristics', 'food-pairing'],
        memorize: {
          fields: ['climate-preference', 'key-characteristics', 'famous-regions'],
          items: ['chardonnay', 'cabernet-sauvignon', 'pinot-noir', 'sauvignon-blanc']
        }
      },
      {
        name: 'wine-making-process',
        'high-level': ['fermentation-science', 'oak-influence', 'malolactic-conversion'],
        memorize: {
          fields: ['primary-fermentation', 'secondary-fermentation', 'aging-methods'],
          items: ['crushing-destemming', 'fermentation-temperature', 'barrel-aging', 'bottling']
        }
      }
    ]
  };
}