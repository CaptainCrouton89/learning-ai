import { Course, LearningSession, ConceptProgress, ItemProgress, TopicProgress } from '../types/course.js';
import { PerformanceAnalyzer, StudyRecommendation, FocusArea, OptimalStudyTime, LearningPathSuggestion } from '../lib/performance-analyzer.js';

export interface RecommendationOptions {
  includeStudyTimes?: boolean;
  includeFocusAreas?: boolean;
  includeDifficultyAdjustments?: boolean;
  includeLearningPaths?: boolean;
}

export interface AdaptiveRecommendations {
  optimalStudyTimes: OptimalStudyTime[];
  focusAreas: FocusArea[];
  difficultyAdjustments: DifficultyAdjustment[];
  learningPath: LearningPathSuggestion;
  nextReviewSchedule: NextReviewItem[];
  motivationalMessage: string;
  estimatedTimeToMastery: string;
}

export interface DifficultyAdjustment {
  itemName: string;
  conceptName: string;
  currentDifficulty: 'easy' | 'medium' | 'hard';
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  reason: string;
  confidence: number; // 0-1
}

export interface NextReviewItem {
  itemName: string;
  conceptName: string;
  scheduledFor: Date;
  priority: 'high' | 'medium' | 'low';
  reasonForReview: string;
}

export class RecommendationEngine {
  private analyzer: PerformanceAnalyzer;

  constructor() {
    this.analyzer = new PerformanceAnalyzer();
  }

  async generateRecommendations(
    course: Course,
    session: LearningSession,
    options: RecommendationOptions = {}
  ): Promise<AdaptiveRecommendations> {
    const performanceData = this.analyzer.analyzePerformance(course, session);
    
    const recommendations: AdaptiveRecommendations = {
      optimalStudyTimes: options.includeStudyTimes !== false 
        ? this.generateStudyTimeRecommendations(performanceData, session)
        : [],
      focusAreas: options.includeFocusAreas !== false
        ? this.generateFocusAreaRecommendations(performanceData, session)
        : [],
      difficultyAdjustments: options.includeDifficultyAdjustments !== false
        ? this.generateDifficultyAdjustments(performanceData, session)
        : [],
      learningPath: options.includeLearningPaths !== false
        ? this.generatePersonalizedLearningPath(course, session, performanceData)
        : { nextConcepts: [], estimatedDuration: '', strategy: '' },
      nextReviewSchedule: this.generateNextReviewSchedule(course, session),
      motivationalMessage: this.generateMotivationalMessage(performanceData, session),
      estimatedTimeToMastery: this.estimateTimeToMastery(course, session, performanceData)
    };

    return recommendations;
  }

  private generateStudyTimeRecommendations(
    performanceData: any,
    session: LearningSession
  ): OptimalStudyTime[] {
    const recommendations: OptimalStudyTime[] = [];
    
    // Analyze activity patterns from session history
    const activityTimes = this.analyzer.extractActivityTimes(session);
    const performanceByTime = this.analyzer.calculatePerformanceByTimeOfDay(session);
    
    // Find optimal time slots based on performance
    const optimalTimes = Object.entries(performanceByTime)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, performance]) => ({
        timeSlot: this.formatTimeSlot(parseInt(hour)),
        confidenceScore: performance,
        reason: this.getTimeRecommendationReason(parseInt(hour), performance),
        suggestedDuration: this.getSuggestedDuration(performance, session.timeAvailable),
        activityType: this.getOptimalActivityType(performance)
      }));

    return optimalTimes;
  }

  private generateFocusAreaRecommendations(
    performanceData: any,
    session: LearningSession
  ): FocusArea[] {
    const focusAreas: FocusArea[] = [];

    // Identify struggling concepts and topics
    for (const [conceptName, progress] of session.conceptsProgress) {
      const strugglingTopics = Array.from(progress.topicProgress.entries())
        .filter(([_, topicProgress]) => topicProgress.currentComprehension < 4)
        .sort(([,a], [,b]) => a.currentComprehension - b.currentComprehension);

      const strugglingItems = Array.from(progress.itemsProgress.entries())
        .filter(([_, itemProgress]) => {
          const avgComprehension = this.analyzer.calculateAverageComprehension(itemProgress);
          return avgComprehension < 4 || itemProgress.successCount < 2;
        });

      if (strugglingTopics.length > 0 || strugglingItems.length > 0) {
        focusAreas.push({
          type: 'concept',
          name: conceptName,
          priority: this.calculatePriority(strugglingTopics, strugglingItems),
          reason: this.getFocusAreaReason(strugglingTopics, strugglingItems),
          suggestedApproach: this.getSuggestedApproach(strugglingTopics, strugglingItems),
          estimatedEffort: this.estimateEffortRequired(strugglingTopics, strugglingItems)
        });
      }
    }

    // Sort by priority
    return focusAreas.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }

  private generateDifficultyAdjustments(
    performanceData: any,
    session: LearningSession
  ): DifficultyAdjustment[] {
    const adjustments: DifficultyAdjustment[] = [];

    for (const [conceptName, progress] of session.conceptsProgress) {
      for (const [itemName, itemProgress] of progress.itemsProgress) {
        const currentDifficulty = this.getDifficultyFromEaseFactor(itemProgress.easeFactor);
        const suggestedDifficulty = this.calculateOptimalDifficulty(itemProgress);
        
        if (currentDifficulty !== suggestedDifficulty) {
          adjustments.push({
            itemName,
            conceptName,
            currentDifficulty,
            suggestedDifficulty,
            reason: this.getDifficultyAdjustmentReason(itemProgress, currentDifficulty, suggestedDifficulty),
            confidence: this.calculateAdjustmentConfidence(itemProgress)
          });
        }
      }
    }

    return adjustments.sort((a, b) => b.confidence - a.confidence);
  }

  private generatePersonalizedLearningPath(
    course: Course,
    session: LearningSession,
    performanceData: any
  ): LearningPathSuggestion {
    // Analyze mastery levels and dependencies
    const conceptMastery = this.analyzer.calculateConceptMasteryLevels(session);
    const unlockedConcepts = this.getUnlockedConcepts(course, conceptMastery);
    const nextConcepts = this.prioritizeNextConcepts(unlockedConcepts, session, performanceData);

    return {
      nextConcepts: nextConcepts.slice(0, 3),
      estimatedDuration: this.estimatePathDuration(nextConcepts, session.timeAvailable),
      strategy: this.determineOptimalStrategy(performanceData, session),
      prerequisites: this.identifyPrerequisites(nextConcepts, conceptMastery)
    };
  }

  private generateNextReviewSchedule(
    course: Course,
    session: LearningSession
  ): NextReviewItem[] {
    const reviewItems: NextReviewItem[] = [];
    const now = new Date();

    for (const [conceptName, progress] of session.conceptsProgress) {
      for (const [itemName, itemProgress] of progress.itemsProgress) {
        if (itemProgress.successCount < 2) {
          const nextReviewDate = new Date(now.getTime() + (itemProgress.interval * 24 * 60 * 60 * 1000));
          const priority = this.calculateReviewPriority(itemProgress, now);
          
          reviewItems.push({
            itemName,
            conceptName,
            scheduledFor: nextReviewDate,
            priority,
            reasonForReview: this.getReviewReason(itemProgress, priority)
          });
        }
      }
    }

    return reviewItems.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority] || 
             a.scheduledFor.getTime() - b.scheduledFor.getTime();
    });
  }

  private generateMotivationalMessage(
    performanceData: any,
    session: LearningSession
  ): string {
    const totalProgress = this.analyzer.calculateOverallProgress(session);
    const recentImprovement = this.analyzer.calculateRecentImprovement(session);
    const streak = this.analyzer.calculateLearningStreak(session);

    if (totalProgress > 0.8) {
      return `🎉 Outstanding progress! You've mastered ${Math.round(totalProgress * 100)}% of the material. You're almost there!`;
    } else if (recentImprovement > 0.1) {
      return `📈 Great momentum! Your comprehension has improved significantly in recent sessions. Keep it up!`;
    } else if (streak > 3) {
      return `🔥 Impressive consistency! You've been learning for ${streak} consecutive sessions. Consistency is key to mastery!`;
    } else if (totalProgress > 0.5) {
      return `💪 You're halfway there! Focus on your weaker areas and you'll see even faster progress.`;
    } else {
      return `🌟 Every expert was once a beginner. Keep practicing and stay curious - you're building valuable knowledge!`;
    }
  }

  private estimateTimeToMastery(
    course: Course,
    session: LearningSession,
    performanceData: any
  ): string {
    const currentProgress = this.analyzer.calculateOverallProgress(session);
    const learningVelocity = this.analyzer.calculateLearningVelocity(session);
    
    if (learningVelocity <= 0 || currentProgress >= 0.95) {
      return "Course nearly complete!";
    }

    const remainingProgress = 1 - currentProgress;
    const estimatedSessions = Math.ceil(remainingProgress / learningVelocity);
    
    // Convert to time based on user's availability
    const sessionTime = this.getSessionTimeMinutes(session.timeAvailable);
    const totalMinutes = estimatedSessions * sessionTime;
    
    if (totalMinutes < 60) {
      return `${Math.ceil(totalMinutes)} minutes`;
    } else if (totalMinutes < 1440) { // Less than a day
      return `${Math.ceil(totalMinutes / 60)} hours`;
    } else {
      const days = Math.ceil(totalMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  }

  // Helper methods
  private formatTimeSlot(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  private getTimeRecommendationReason(hour: number, performance: number): string {
    if (performance > 0.8) {
      return `Peak performance time - ${Math.round(performance * 100)}% average comprehension`;
    } else if (hour >= 9 && hour <= 11) {
      return "Morning focus period - typically optimal for learning";
    } else if (hour >= 14 && hour <= 16) {
      return "Afternoon productivity window";
    } else {
      return "Based on your learning patterns";
    }
  }

  private getSuggestedDuration(performance: number, timeAvailable: string): string {
    const baseTime = this.getSessionTimeMinutes(timeAvailable);
    if (performance > 0.8) {
      return `${Math.min(baseTime + 15, 90)} minutes`; // Extend high-performance sessions
    } else if (performance < 0.4) {
      return `${Math.max(baseTime - 15, 15)} minutes`; // Shorten low-performance sessions
    }
    return `${baseTime} minutes`;
  }

  private getOptimalActivityType(performance: number): 'review' | 'new-content' | 'mixed' {
    if (performance > 0.7) return 'new-content';
    if (performance < 0.4) return 'review';
    return 'mixed';
  }

  private calculatePriority(strugglingTopics: any[], strugglingItems: any[]): number {
    const topicWeight = strugglingTopics.length * 0.6;
    const itemWeight = strugglingItems.length * 0.4;
    return Math.min(topicWeight + itemWeight, 10);
  }

  private getFocusAreaReason(strugglingTopics: any[], strugglingItems: any[]): string {
    if (strugglingTopics.length > strugglingItems.length) {
      return `${strugglingTopics.length} concept${strugglingTopics.length > 1 ? 's' : ''} need attention`;
    } else if (strugglingItems.length > 0) {
      return `${strugglingItems.length} item${strugglingItems.length > 1 ? 's' : ''} require practice`;
    }
    return "Needs reinforcement";
  }

  private getSuggestedApproach(strugglingTopics: any[], strugglingItems: any[]): string {
    if (strugglingTopics.length > strugglingItems.length) {
      return "Focus on conceptual understanding through Q&A";
    } else if (strugglingItems.length > 0) {
      return "Increase spaced repetition frequency";
    }
    return "Mixed approach with emphasis on weak areas";
  }

  private estimateEffortRequired(strugglingTopics: any[], strugglingItems: any[]): string {
    const totalWork = strugglingTopics.length + strugglingItems.length;
    if (totalWork <= 3) return "Low effort (15-30 min)";
    if (totalWork <= 6) return "Medium effort (30-60 min)";
    return "High effort (60+ min)";
  }

  private getDifficultyFromEaseFactor(easeFactor: number): 'easy' | 'medium' | 'hard' {
    if (easeFactor >= 3.0) return 'easy';
    if (easeFactor >= 2.0) return 'medium';
    return 'hard';
  }

  private calculateOptimalDifficulty(itemProgress: ItemProgress): 'easy' | 'medium' | 'hard' {
    const avgComprehension = this.analyzer.calculateAverageComprehension(itemProgress);
    const recentAttempts = itemProgress.attempts.slice(-3);
    const recentAvg = recentAttempts.length > 0 
      ? recentAttempts.reduce((sum, attempt) => sum + attempt.aiResponse.comprehension, 0) / recentAttempts.length
      : avgComprehension;

    if (recentAvg >= 4.5) return 'easy';
    if (recentAvg >= 3.0) return 'medium';
    return 'hard';
  }

  private getDifficultyAdjustmentReason(
    itemProgress: ItemProgress,
    current: string,
    suggested: string
  ): string {
    const avgComprehension = this.analyzer.calculateAverageComprehension(itemProgress);
    
    if (suggested === 'easy' && current !== 'easy') {
      return `Consistently high performance (${avgComprehension.toFixed(1)}/5) - ready for longer intervals`;
    } else if (suggested === 'hard' && current !== 'hard') {
      return `Struggling with retention (${avgComprehension.toFixed(1)}/5) - needs more frequent review`;
    } else {
      return `Performance suggests ${suggested} difficulty is optimal`;
    }
  }

  private calculateAdjustmentConfidence(itemProgress: ItemProgress): number {
    const attempts = itemProgress.attempts.length;
    if (attempts < 3) return 0.3;
    if (attempts < 5) return 0.6;
    return Math.min(0.9, 0.6 + (attempts - 5) * 0.05);
  }

  private getUnlockedConcepts(course: Course, conceptMastery: Map<string, number>): string[] {
    // Simple implementation - in practice, this would consider dependencies
    return course.concepts
      .filter(concept => (conceptMastery.get(concept.name) || 0) < 0.8)
      .map(concept => concept.name);
  }

  private prioritizeNextConcepts(
    concepts: string[],
    session: LearningSession,
    performanceData: any
  ): Array<{name: string, priority: number, reason: string}> {
    return concepts.map(conceptName => ({
      name: conceptName,
      priority: Math.random(), // Simplified - would use actual prioritization logic
      reason: "Based on learning progression and difficulty analysis"
    })).sort((a, b) => b.priority - a.priority);
  }

  private estimatePathDuration(nextConcepts: any[], timeAvailable: string): string {
    const sessionTime = this.getSessionTimeMinutes(timeAvailable);
    const estimatedSessions = nextConcepts.length * 3; // Rough estimate
    const totalMinutes = estimatedSessions * sessionTime;
    
    if (totalMinutes < 60) {
      return `${Math.ceil(totalMinutes)} minutes`;
    } else {
      return `${Math.ceil(totalMinutes / 60)} hours`;
    }
  }

  private determineOptimalStrategy(performanceData: any, session: LearningSession): string {
    const overallProgress = this.analyzer.calculateOverallProgress(session);
    
    if (overallProgress < 0.3) {
      return "Foundation building - Focus on core concepts before advancing";
    } else if (overallProgress < 0.7) {
      return "Balanced approach - Mix new content with review of weak areas";
    } else {
      return "Mastery focus - Intensive practice and knowledge integration";
    }
  }

  private identifyPrerequisites(nextConcepts: any[], conceptMastery: Map<string, number>): string[] {
    // Simplified implementation
    return Array.from(conceptMastery.entries())
      .filter(([_, mastery]) => mastery < 0.5)
      .map(([concept, _]) => concept)
      .slice(0, 2);
  }

  private calculateReviewPriority(itemProgress: ItemProgress, now: Date): 'high' | 'medium' | 'low' {
    const avgComprehension = this.analyzer.calculateAverageComprehension(itemProgress);
    const daysSinceLastReview = Math.floor((now.getTime() - (itemProgress.attempts[itemProgress.attempts.length - 1]?.timestamp.getTime() || 0)) / (1000 * 60 * 60 * 24));
    
    if (avgComprehension < 2 || daysSinceLastReview > itemProgress.interval * 2) {
      return 'high';
    } else if (avgComprehension < 3.5 || daysSinceLastReview > itemProgress.interval) {
      return 'medium';
    }
    return 'low';
  }

  private getReviewReason(itemProgress: ItemProgress, priority: 'high' | 'medium' | 'low'): string {
    const avgComprehension = this.analyzer.calculateAverageComprehension(itemProgress);
    
    if (priority === 'high') {
      return `Low comprehension (${avgComprehension.toFixed(1)}/5) - immediate review needed`;
    } else if (priority === 'medium') {
      return `Moderate comprehension - regular review recommended`;
    }
    return 'Maintenance review for retention';
  }

  private getSessionTimeMinutes(timeAvailable: string): number {
    switch (timeAvailable) {
      case '<15min': return 15;
      case '15-60min': return 45;
      case '60-90min': return 75;
      case '90min+': return 120;
      default: return 45;
    }
  }
}