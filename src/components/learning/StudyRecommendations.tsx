'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Brain,
  Zap
} from 'lucide-react';
import { AdaptiveRecommendations } from '../../services/recommendations';

interface StudyRecommendationsProps {
  courseId: string;
  sessionId: string;
  className?: string;
}

interface RecommendationsResponse {
  recommendations: AdaptiveRecommendations;
  lastUpdated: string;
}

export default function StudyRecommendations({ 
  courseId, 
  sessionId, 
  className 
}: StudyRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['focus-areas']));

  useEffect(() => {
    fetchRecommendations();
  }, [courseId, sessionId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/recommendations?courseId=${courseId}&sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
      }
      
      const data: RecommendationsResponse = await response.json();
      setRecommendations(data.recommendations);
      setLastUpdated(new Date(data.lastUpdated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
    }
  };

  const formatTimeSlot = (timeSlot: string) => {
    return timeSlot;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Study Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchRecommendations} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with motivational message */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              Personalized Study Recommendations
            </span>
            <Button 
              onClick={fetchRecommendations}
              variant="ghost"
              size="sm"
              className="text-gray-500"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
          {lastUpdated && (
            <CardDescription>
              Last updated: {lastUpdated.toLocaleString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">{recommendations.motivationalMessage}</p>
            <div className="mt-2 text-sm text-blue-600">
              Estimated time to mastery: {recommendations.estimatedTimeToMastery}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Focus Areas */}
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('focus-areas')}
        >
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-600" />
            Priority Focus Areas
            <Badge variant="secondary">{recommendations.focusAreas.length}</Badge>
          </CardTitle>
          <CardDescription>
            Areas that need your immediate attention
          </CardDescription>
        </CardHeader>
        {expandedSections.has('focus-areas') && (
          <CardContent>
            <div className="space-y-4">
              {recommendations.focusAreas.slice(0, 5).map((area, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{area.name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {area.type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span className="text-xs text-gray-500">
                          Priority: {area.priority.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{area.reason}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      {area.suggestedApproach}
                    </span>
                    <span>{area.estimatedEffort}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Optimal Study Times */}
      {recommendations.optimalStudyTimes.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer"
            onClick={() => toggleSection('study-times')}
          >
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Optimal Study Times
            </CardTitle>
            <CardDescription>
              When you perform best based on your history
            </CardDescription>
          </CardHeader>
          {expandedSections.has('study-times') && (
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {recommendations.optimalStudyTimes.map((time, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{time.timeSlot}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Performance</span>
                        <span className="font-medium">
                          {Math.round(time.confidenceScore * 100)}%
                        </span>
                      </div>
                      <Progress value={time.confidenceScore * 100} className="h-2" />
                      <div className="text-xs text-gray-500">
                        <div>{time.reason}</div>
                        <div className="mt-1">
                          <span className="bg-gray-100 px-2 py-1 rounded mr-2">
                            {time.suggestedDuration}
                          </span>
                          <span className="capitalize">{time.activityType}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Next Review Schedule */}
      {recommendations.nextReviewSchedule.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer"
            onClick={() => toggleSection('review-schedule')}
          >
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Upcoming Reviews
              <Badge variant="secondary">{recommendations.nextReviewSchedule.length}</Badge>
            </CardTitle>
            <CardDescription>
              Items scheduled for review based on spaced repetition
            </CardDescription>
          </CardHeader>
          {expandedSections.has('review-schedule') && (
            <CardContent>
              <div className="space-y-3">
                {recommendations.nextReviewSchedule.slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{item.itemName}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.conceptName}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{item.reasonForReview}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {item.scheduledFor.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.scheduledFor.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                      <Badge 
                        className={`${getPriorityColor(item.priority)} flex items-center gap-1`}
                      >
                        {getPriorityIcon(item.priority)}
                        {item.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Difficulty Adjustments */}
      {recommendations.difficultyAdjustments.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer"
            onClick={() => toggleSection('difficulty-adjustments')}
          >
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-600" />
              Suggested Difficulty Adjustments
            </CardTitle>
            <CardDescription>
              Items that may benefit from difficulty changes
            </CardDescription>
          </CardHeader>
          {expandedSections.has('difficulty-adjustments') && (
            <CardContent>
              <div className="space-y-4">
                {recommendations.difficultyAdjustments.slice(0, 5).map((adjustment, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{adjustment.itemName}</h4>
                        <p className="text-xs text-gray-600">{adjustment.conceptName}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {adjustment.currentDifficulty}
                          </Badge>
                          <span className="text-gray-400">→</span>
                          <Badge className="text-xs bg-blue-100 text-blue-800">
                            {adjustment.suggestedDifficulty}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round(adjustment.confidence * 100)}% confidence
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{adjustment.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Learning Path */}
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('learning-path')}
        >
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            Personalized Learning Path
          </CardTitle>
          <CardDescription>
            Suggested progression based on your performance
          </CardDescription>
        </CardHeader>
        {expandedSections.has('learning-path') && (
          <CardContent>
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="font-medium text-indigo-900 mb-2">Strategy</h4>
                <p className="text-indigo-800 text-sm mb-3">{recommendations.learningPath.strategy}</p>
                <div className="flex items-center gap-4 text-sm text-indigo-700">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Est. Duration: {recommendations.learningPath.estimatedDuration}
                  </div>
                </div>
              </div>

              {recommendations.learningPath.nextConcepts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Next Concepts to Focus On</h4>
                  <div className="space-y-2">
                    {recommendations.learningPath.nextConcepts.map((concept, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="font-medium text-sm">{concept.name}</span>
                          <p className="text-xs text-gray-600 mt-1">{concept.reason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <span className="text-xs text-gray-500">
                            Priority: {concept.priority.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.learningPath.prerequisites && 
               recommendations.learningPath.prerequisites.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Prerequisites to Review</h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.learningPath.prerequisites.map((prereq, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {prereq}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}