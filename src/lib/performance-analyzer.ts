import { Course, LearningSession, ConceptProgress, ItemProgress, TopicProgress } from '../types/course.js';

export interface StudyRecommendation {
  type: 'schedule' | 'content' | 'technique';
  title: string;
  description: string;
  priority: number; // 1-10
  confidence: number; // 0-1
  estimatedImpact: 'low' | 'medium' | 'high';
}

export interface OptimalStudyTime {
  timeSlot: string;
  confidenceScore: number;
  reason: string;
  suggestedDuration: string;
  activityType: 'review' | 'new-content' | 'mixed';
}

export interface FocusArea {
  type: 'concept' | 'topic' | 'item';
  name: string;
  priority: number;
  reason: string;
  suggestedApproach: string;
  estimatedEffort: string;
}

export interface LearningPathSuggestion {
  nextConcepts: Array<{
    name: string;
    priority: number;
    reason: string;
  }>;
  estimatedDuration: string;
  strategy: string;
  prerequisites?: string[];
}

export interface PerformanceMetrics {
  overallProgress: number;
  conceptMastery: Map<string, number>;
  averageComprehension: number;
  learningVelocity: number;
  retentionRate: number;
  strugglingAreas: Array<{
    name: string;
    type: 'concept' | 'topic' | 'item';
    score: number;
  }>;
  strengths: Array<{
    name: string;
    type: 'concept' | 'topic' | 'item';
    score: number;
  }>;
  studyPatterns: {
    preferredTimes: number[];
    averageSessionLength: number;
    consistencyScore: number;
  };
}

export class PerformanceAnalyzer {
  
  analyzePerformance(course: Course, session: LearningSession): PerformanceMetrics {
    const conceptMastery = this.calculateConceptMasteryLevels(session);
    const overallProgress = this.calculateOverallProgress(session);
    const averageComprehension = this.calculateAverageComprehension(session);
    const learningVelocity = this.calculateLearningVelocity(session);
    const retentionRate = this.calculateRetentionRate(session);
    const strugglingAreas = this.identifyStrugglingAreas(session);
    const strengths = this.identifyStrengths(session);
    const studyPatterns = this.analyzeStudyPatterns(session);

    return {
      overallProgress,
      conceptMastery,
      averageComprehension,
      learningVelocity,
      retentionRate,
      strugglingAreas,
      strengths,
      studyPatterns
    };
  }

  calculateConceptMasteryLevels(session: LearningSession): Map<string, number> {
    const conceptMastery = new Map<string, number>();

    for (const [conceptName, progress] of session.conceptsProgress) {
      const topicScores = Array.from(progress.topicProgress.values())
        .map(tp => tp.currentComprehension);
      
      const itemScores = Array.from(progress.itemsProgress.values())
        .map(ip => {
          if (ip.successCount >= 2) return 5; // Mastered
          return this.calculateAverageComprehension(ip);
        });

      const allScores = [...topicScores, ...itemScores];
      const masteryLevel = allScores.length > 0 
        ? allScores.reduce((sum, score) => sum + score, 0) / (allScores.length * 5)
        : 0;

      conceptMastery.set(conceptName, masteryLevel);
    }

    return conceptMastery;
  }

  calculateOverallProgress(session: LearningSession): number {
    const conceptMasteryLevels = this.calculateConceptMasteryLevels(session);
    if (conceptMasteryLevels.size === 0) return 0;

    const totalMastery = Array.from(conceptMasteryLevels.values())
      .reduce((sum, mastery) => sum + mastery, 0);
    
    return totalMastery / conceptMasteryLevels.size;
  }

  calculateAverageComprehension(target: LearningSession | ItemProgress): number {
    if ('conversationHistory' in target) {
      // It's a LearningSession
      const allAttempts: number[] = [];
      
      for (const progress of target.conceptsProgress.values()) {
        // Topic comprehension scores
        for (const topicProgress of progress.topicProgress.values()) {
          allAttempts.push(topicProgress.currentComprehension);
        }
        
        // Item comprehension scores
        for (const itemProgress of progress.itemsProgress.values()) {
          const itemAttempts = itemProgress.attempts.map(a => a.aiResponse.comprehension);
          allAttempts.push(...itemAttempts);
        }
      }
      
      return allAttempts.length > 0 
        ? allAttempts.reduce((sum, score) => sum + score, 0) / allAttempts.length
        : 0;
    } else {
      // It's an ItemProgress
      const attempts = target.attempts.map(a => a.aiResponse.comprehension);
      return attempts.length > 0 
        ? attempts.reduce((sum, score) => sum + score, 0) / attempts.length
        : 0;
    }
  }

  calculateLearningVelocity(session: LearningSession): number {
    const now = new Date();
    const sessionDurationHours = (now.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
    
    if (sessionDurationHours <= 0) return 0;
    
    const overallProgress = this.calculateOverallProgress(session);
    return overallProgress / sessionDurationHours; // Progress per hour
  }

  calculateRetentionRate(session: LearningSession): number {
    let retentionScores: number[] = [];
    
    for (const progress of session.conceptsProgress.values()) {
      for (const itemProgress of progress.itemsProgress.values()) {
        if (itemProgress.attempts.length >= 2) {
          // Compare first and most recent attempts
          const firstScore = itemProgress.attempts[0].aiResponse.comprehension;
          const lastScore = itemProgress.attempts[itemProgress.attempts.length - 1].aiResponse.comprehension;
          
          // Retention is how well knowledge is maintained or improved
          const retention = Math.min(1, lastScore / Math.max(firstScore, 1));
          retentionScores.push(retention);
        }
      }
    }
    
    return retentionScores.length > 0 
      ? retentionScores.reduce((sum, score) => sum + score, 0) / retentionScores.length
      : 0;
  }

  identifyStrugglingAreas(session: LearningSession): Array<{name: string, type: 'concept' | 'topic' | 'item', score: number}> {
    const strugglingAreas: Array<{name: string, type: 'concept' | 'topic' | 'item', score: number}> = [];
    
    for (const [conceptName, progress] of session.conceptsProgress) {
      // Check topics
      for (const [topicName, topicProgress] of progress.topicProgress) {
        if (topicProgress.currentComprehension < 3) {
          strugglingAreas.push({
            name: `${conceptName}: ${topicName}`,
            type: 'topic',
            score: topicProgress.currentComprehension
          });
        }
      }
      
      // Check items
      for (const [itemName, itemProgress] of progress.itemsProgress) {
        const avgComprehension = this.calculateAverageComprehension(itemProgress);
        if (avgComprehension < 3 || itemProgress.successCount < 1) {
          strugglingAreas.push({
            name: `${conceptName}: ${itemName}`,
            type: 'item',
            score: avgComprehension
          });
        }
      }
    }
    
    return strugglingAreas.sort((a, b) => a.score - b.score).slice(0, 10);
  }

  identifyStrengths(session: LearningSession): Array<{name: string, type: 'concept' | 'topic' | 'item', score: number}> {
    const strengths: Array<{name: string, type: 'concept' | 'topic' | 'item', score: number}> = [];
    
    for (const [conceptName, progress] of session.conceptsProgress) {
      // Check topics
      for (const [topicName, topicProgress] of progress.topicProgress) {
        if (topicProgress.currentComprehension >= 4.5) {
          strengths.push({
            name: `${conceptName}: ${topicName}`,
            type: 'topic',
            score: topicProgress.currentComprehension
          });
        }
      }
      
      // Check items
      for (const [itemName, itemProgress] of progress.itemsProgress) {
        const avgComprehension = this.calculateAverageComprehension(itemProgress);
        if (avgComprehension >= 4.5 && itemProgress.successCount >= 2) {
          strengths.push({
            name: `${conceptName}: ${itemName}`,
            type: 'item',
            score: avgComprehension
          });
        }
      }
    }
    
    return strengths.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  analyzeStudyPatterns(session: LearningSession): {
    preferredTimes: number[];
    averageSessionLength: number;
    consistencyScore: number;
  } {
    const activityTimes = this.extractActivityTimes(session);
    const preferredTimes = this.identifyPreferredStudyTimes(activityTimes);
    const averageSessionLength = this.calculateAverageSessionLength(session);
    const consistencyScore = this.calculateConsistencyScore(session);
    
    return {
      preferredTimes,
      averageSessionLength,
      consistencyScore
    };
  }

  extractActivityTimes(session: LearningSession): number[] {
    return session.conversationHistory.map(entry => entry.timestamp.getHours());
  }

  calculatePerformanceByTimeOfDay(session: LearningSession): Record<number, number> {
    const performanceByHour: Record<number, { total: number, count: number }> = {};
    
    // Analyze comprehension scores by time of day
    for (const progress of session.conceptsProgress.values()) {
      for (const itemProgress of progress.itemsProgress.values()) {
        for (const attempt of itemProgress.attempts) {
          const hour = attempt.timestamp.getHours();
          if (!performanceByHour[hour]) {
            performanceByHour[hour] = { total: 0, count: 0 };
          }
          performanceByHour[hour].total += attempt.aiResponse.comprehension;
          performanceByHour[hour].count += 1;
        }
      }
      
      for (const topicProgress of progress.topicProgress.values()) {
        for (const attempt of topicProgress.attempts) {
          const hour = attempt.timestamp.getHours();
          if (!performanceByHour[hour]) {
            performanceByHour[hour] = { total: 0, count: 0 };
          }
          performanceByHour[hour].total += attempt.aiResponse.comprehension;
          performanceByHour[hour].count += 1;
        }
      }
    }
    
    // Convert to averages
    const averagePerformance: Record<number, number> = {};
    for (const [hour, data] of Object.entries(performanceByHour)) {
      averagePerformance[parseInt(hour)] = data.count > 0 ? data.total / data.count : 0;
    }
    
    return averagePerformance;
  }

  private identifyPreferredStudyTimes(activityTimes: number[]): number[] {
    const hourCounts = activityTimes.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculateAverageSessionLength(session: LearningSession): number {
    const now = new Date();
    const totalMinutes = (now.getTime() - session.startTime.getTime()) / (1000 * 60);
    
    // Estimate number of distinct sessions based on gaps in conversation history
    const sessionBreaks = this.identifySessionBreaks(session.conversationHistory);
    const estimatedSessions = sessionBreaks + 1;
    
    return totalMinutes / estimatedSessions;
  }

  private identifySessionBreaks(conversationHistory: Array<{timestamp: Date}>): number {
    if (conversationHistory.length < 2) return 0;
    
    let breaks = 0;
    for (let i = 1; i < conversationHistory.length; i++) {
      const timeDiff = conversationHistory[i].timestamp.getTime() - conversationHistory[i-1].timestamp.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 4) { // Consider 4+ hour gaps as session breaks
        breaks++;
      }
    }
    
    return breaks;
  }

  private calculateConsistencyScore(session: LearningSession): number {
    const conversationHistory = session.conversationHistory;
    if (conversationHistory.length < 2) return 0;
    
    // Calculate consistency based on regular intervals between activities
    const intervals: number[] = [];
    for (let i = 1; i < conversationHistory.length; i++) {
      const interval = conversationHistory[i].timestamp.getTime() - conversationHistory[i-1].timestamp.getTime();
      intervals.push(interval);
    }
    
    if (intervals.length === 0) return 0;
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation relative to mean indicates higher consistency
    const coefficientOfVariation = standardDeviation / avgInterval;
    return Math.max(0, 1 - coefficientOfVariation);
  }

  calculateRecentImprovement(session: LearningSession): number {
    const recentAttempts: number[] = [];
    const olderAttempts: number[] = [];
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    for (const progress of session.conceptsProgress.values()) {
      for (const itemProgress of progress.itemsProgress.values()) {
        for (const attempt of itemProgress.attempts) {
          if (attempt.timestamp > cutoffTime) {
            recentAttempts.push(attempt.aiResponse.comprehension);
          } else {
            olderAttempts.push(attempt.aiResponse.comprehension);
          }
        }
      }
      
      for (const topicProgress of progress.topicProgress.values()) {
        for (const attempt of topicProgress.attempts) {
          if (attempt.timestamp > cutoffTime) {
            recentAttempts.push(attempt.aiResponse.comprehension);
          } else {
            olderAttempts.push(attempt.aiResponse.comprehension);
          }
        }
      }
    }
    
    if (recentAttempts.length === 0 || olderAttempts.length === 0) return 0;
    
    const recentAvg = recentAttempts.reduce((sum, score) => sum + score, 0) / recentAttempts.length;
    const olderAvg = olderAttempts.reduce((sum, score) => sum + score, 0) / olderAttempts.length;
    
    return (recentAvg - olderAvg) / 5; // Normalize to 0-1 scale
  }

  calculateLearningStreak(session: LearningSession): number {
    const conversationHistory = session.conversationHistory;
    if (conversationHistory.length === 0) return 0;
    
    // Count consecutive days with activity
    const activityDates = conversationHistory.map(entry => {
      const date = new Date(entry.timestamp);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    });
    
    const uniqueDates = Array.from(new Set(activityDates)).sort();
    
    if (uniqueDates.length === 0) return 0;
    
    // Count consecutive days from the most recent date
    let streak = 1;
    const today = new Date();
    let currentDate = new Date(today);
    
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      const activityDate = new Date(uniqueDates[i]);
      const daysDiff = Math.floor((currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        if (i < uniqueDates.length - 1) streak++;
        currentDate = activityDate;
      } else {
        break;
      }
    }
    
    return streak;
  }

  // Additional helper methods for spaced repetition integration
  calculateOptimalInterval(
    currentInterval: number,
    easeFactor: number,
    comprehension: number,
    previousAttempts: number
  ): number {
    // Enhanced spaced repetition algorithm with performance-based adjustments
    let newInterval = currentInterval;
    
    if (comprehension >= 4) {
      // Good performance - increase interval
      newInterval = Math.ceil(currentInterval * easeFactor);
    } else if (comprehension >= 3) {
      // Moderate performance - modest increase
      newInterval = Math.ceil(currentInterval * (easeFactor * 0.8));
    } else {
      // Poor performance - reset or reduce interval
      newInterval = Math.max(1, Math.floor(currentInterval * 0.5));
    }
    
    // Cap intervals based on mastery level
    const maxInterval = previousAttempts < 3 ? 7 : previousAttempts < 5 ? 21 : 60;
    return Math.min(newInterval, maxInterval);
  }

  suggestOptimalEaseFactor(
    currentEase: number,
    comprehension: number,
    responseTime?: number
  ): number {
    let newEase = currentEase;
    
    // Adjust based on comprehension
    if (comprehension >= 5) {
      newEase *= 1.1;
    } else if (comprehension >= 4) {
      newEase *= 1.05;
    } else if (comprehension <= 2) {
      newEase *= 0.8;
    } else if (comprehension <= 3) {
      newEase *= 0.9;
    }
    
    // Adjust based on response time if available
    if (responseTime !== undefined) {
      if (responseTime < 30) { // Quick response
        newEase *= 1.05;
      } else if (responseTime > 120) { // Slow response
        newEase *= 0.95;
      }
    }
    
    // Keep within reasonable bounds
    return Math.max(1.3, Math.min(4.0, newEase));
  }
}