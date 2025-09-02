import { LearningSession, ConceptProgress, FlashcardAttempt, ConceptAttempt } from '@/types/course';

// Analytics Data Types
export interface ConceptMasteryData {
  conceptName: string;
  totalItems: number;
  masteredItems: number;
  totalTopics: number;
  masteredTopics: number;
  averageComprehension: number;
  progressPercentage: number;
  lastActivityTime: Date;
}

export interface LearningTimelineEntry {
  date: Date;
  phase: string;
  concept: string;
  activityType: 'flashcard' | 'concept_question' | 'special_question';
  comprehensionScore: number;
  itemOrTopic: string;
  timeSpent?: number;
}

export interface StrengthWeaknessData {
  strengths: {
    concept: string;
    item: string;
    averageScore: number;
    attempts: number;
  }[];
  weaknesses: {
    concept: string;
    item: string;
    averageScore: number;
    attempts: number;
    strugglingArea: string;
  }[];
  topPerformingConcepts: {
    concept: string;
    masteryPercentage: number;
    averageScore: number;
  }[];
  strugglingConcepts: {
    concept: string;
    masteryPercentage: number;
    averageScore: number;
    recommendedActions: string[];
  }[];
}

export interface StudyPatternData {
  totalStudyTime: number;
  averageSessionLength: number;
  studyFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  phaseDistribution: {
    phase: string;
    timeSpent: number;
    percentage: number;
  }[];
  comprehensionTrend: {
    date: Date;
    averageScore: number;
    conceptsActive: number;
  }[];
  retentionRates: {
    immediate: number; // Same session success rate
    shortTerm: number; // 1-3 days later
    mediumTerm: number; // 1-2 weeks later
    longTerm: number; // 1+ months later
  };
}

export interface AnalyticsDashboardData {
  conceptMastery: ConceptMasteryData[];
  learningTimeline: LearningTimelineEntry[];
  strengthsWeaknesses: StrengthWeaknessData;
  studyPatterns: StudyPatternData;
  overallProgress: {
    totalConcepts: number;
    completedConcepts: number;
    totalItems: number;
    masteredItems: number;
    averageComprehension: number;
    studyStreak: number;
    totalStudyDays: number;
  };
}

// Utility Functions
export function calculateConceptMastery(
  session: LearningSession,
  conceptName: string,
  allItems: string[],
  allTopics: string[]
): ConceptMasteryData {
  const conceptProgress = session.conceptsProgress.get(conceptName);
  
  if (!conceptProgress) {
    return {
      conceptName,
      totalItems: allItems.length,
      masteredItems: 0,
      totalTopics: allTopics.length,
      masteredTopics: 0,
      averageComprehension: 0,
      progressPercentage: 0,
      lastActivityTime: session.startTime,
    };
  }

  // Calculate mastered items (2+ successful attempts)
  const masteredItems = Array.from(conceptProgress.itemsProgress.values())
    .filter(item => item.successCount >= 2).length;

  // Calculate mastered topics (comprehension >= 5)
  const masteredTopics = Array.from(conceptProgress.topicProgress.values())
    .filter(topic => topic.currentComprehension >= 5).length;

  // Calculate average comprehension across all attempts
  const allAttempts: (FlashcardAttempt | ConceptAttempt)[] = [];
  
  conceptProgress.itemsProgress.forEach(item => {
    allAttempts.push(...item.attempts);
  });
  
  conceptProgress.topicProgress.forEach(topic => {
    allAttempts.push(...topic.attempts);
  });

  const averageComprehension = allAttempts.length > 0
    ? allAttempts.reduce((sum, attempt) => sum + attempt.aiResponse.comprehension, 0) / allAttempts.length
    : 0;

  // Find last activity time
  const lastActivityTime = allAttempts.length > 0
    ? new Date(Math.max(...allAttempts.map(a => a.timestamp.getTime())))
    : session.startTime;

  // Calculate overall progress percentage
  const totalElements = allItems.length + allTopics.length;
  const masteredElements = masteredItems + masteredTopics;
  const progressPercentage = totalElements > 0 ? (masteredElements / totalElements) * 100 : 0;

  return {
    conceptName,
    totalItems: allItems.length,
    masteredItems,
    totalTopics: allTopics.length,
    masteredTopics,
    averageComprehension,
    progressPercentage,
    lastActivityTime,
  };
}

export function generateLearningTimeline(session: LearningSession): LearningTimelineEntry[] {
  const timeline: LearningTimelineEntry[] = [];

  // Process all concept progress
  session.conceptsProgress.forEach((conceptProgress, conceptName) => {
    // Add flashcard attempts
    conceptProgress.itemsProgress.forEach((itemProgress, itemName) => {
      itemProgress.attempts.forEach(attempt => {
        timeline.push({
          date: attempt.timestamp,
          phase: 'memorization',
          concept: conceptName,
          activityType: 'flashcard',
          comprehensionScore: attempt.aiResponse.comprehension,
          itemOrTopic: itemName,
        });
      });
    });

    // Add concept question attempts
    conceptProgress.topicProgress.forEach((topicProgress, topicName) => {
      topicProgress.attempts.forEach(attempt => {
        timeline.push({
          date: attempt.timestamp,
          phase: determinePhaseFromActivity('concept-learning'),
          concept: conceptName,
          activityType: 'concept_question',
          comprehensionScore: attempt.aiResponse.comprehension,
          itemOrTopic: topicName,
        });
      });
    });

    // Add special questions
    conceptProgress.specialQuestionsAsked.forEach(specialQuestion => {
      timeline.push({
        date: specialQuestion.timestamp,
        phase: determinePhaseFromActivity('high-level'),
        concept: conceptName,
        activityType: 'special_question',
        comprehensionScore: 4, // Assume good performance for special questions
        itemOrTopic: specialQuestion.targetItem || 'general',
      });
    });
  });

  // Sort by date
  return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function analyzeStrengthsWeaknesses(session: LearningSession): StrengthWeaknessData {
  const strengths: StrengthWeaknessData['strengths'] = [];
  const weaknesses: StrengthWeaknessData['weaknesses'] = [];
  const conceptPerformance: Map<string, { scores: number[]; mastered: number; total: number }> = new Map();

  // Analyze item performance across all concepts
  session.conceptsProgress.forEach((conceptProgress, conceptName) => {
    const conceptScores: number[] = [];
    let masteredInConcept = 0;
    let totalInConcept = 0;

    // Analyze flashcard items
    conceptProgress.itemsProgress.forEach((itemProgress, itemName) => {
      if (itemProgress.attempts.length === 0) return;
      
      totalInConcept++;
      const scores = itemProgress.attempts.map(a => a.aiResponse.comprehension);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      conceptScores.push(averageScore);
      
      if (itemProgress.successCount >= 2) {
        masteredInConcept++;
      }

      // Categorize as strength or weakness
      if (averageScore >= 4 && itemProgress.attempts.length >= 2) {
        strengths.push({
          concept: conceptName,
          item: itemName,
          averageScore,
          attempts: itemProgress.attempts.length,
        });
      } else if (averageScore <= 2.5 && itemProgress.attempts.length >= 1) {
        weaknesses.push({
          concept: conceptName,
          item: itemName,
          averageScore,
          attempts: itemProgress.attempts.length,
          strugglingArea: determineStruggleArea(itemProgress),
        });
      }
    });

    // Analyze topic performance
    conceptProgress.topicProgress.forEach((topicProgress) => {
      if (topicProgress.attempts.length === 0) return;
      
      const scores = topicProgress.attempts.map(a => a.aiResponse.comprehension);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      conceptScores.push(averageScore);
      
      if (topicProgress.currentComprehension >= 5) {
        masteredInConcept++;
      }
      totalInConcept++;
    });

    // Store concept-level performance
    if (conceptScores.length > 0) {
      conceptPerformance.set(conceptName, {
        scores: conceptScores,
        mastered: masteredInConcept,
        total: totalInConcept,
      });
    }
  });

  // Analyze concept-level performance
  const topPerformingConcepts: StrengthWeaknessData['topPerformingConcepts'] = [];
  const strugglingConcepts: StrengthWeaknessData['strugglingConcepts'] = [];

  conceptPerformance.forEach((performance, conceptName) => {
    const averageScore = performance.scores.reduce((sum, score) => sum + score, 0) / performance.scores.length;
    const masteryPercentage = performance.total > 0 ? (performance.mastered / performance.total) * 100 : 0;

    if (averageScore >= 4 && masteryPercentage >= 70) {
      topPerformingConcepts.push({
        concept: conceptName,
        masteryPercentage,
        averageScore,
      });
    } else if (averageScore <= 2.5 || masteryPercentage <= 30) {
      strugglingConcepts.push({
        concept: conceptName,
        masteryPercentage,
        averageScore,
        recommendedActions: generateRecommendations(averageScore, masteryPercentage),
      });
    }
  });

  // Sort results
  strengths.sort((a, b) => b.averageScore - a.averageScore);
  weaknesses.sort((a, b) => a.averageScore - b.averageScore);
  topPerformingConcepts.sort((a, b) => b.masteryPercentage - a.masteryPercentage);
  strugglingConcepts.sort((a, b) => a.masteryPercentage - b.masteryPercentage);

  return {
    strengths: strengths.slice(0, 10), // Top 10 strengths
    weaknesses: weaknesses.slice(0, 10), // Top 10 weaknesses
    topPerformingConcepts,
    strugglingConcepts,
  };
}

export function calculateStudyPatterns(session: LearningSession): StudyPatternData {
  const timeline = generateLearningTimeline(session);
  
  // Calculate total study time (approximation based on activity frequency)
  const sessionDuration = session.lastActivityTime.getTime() - session.startTime.getTime();
  const totalStudyTime = sessionDuration / (1000 * 60); // Convert to minutes

  // Calculate phase distribution
  const phaseActivity: Map<string, number> = new Map();
  timeline.forEach(entry => {
    phaseActivity.set(entry.phase, (phaseActivity.get(entry.phase) || 0) + 1);
  });

  const totalActivities = timeline.length;
  const phaseDistribution = Array.from(phaseActivity.entries()).map(([phase, count]) => ({
    phase,
    timeSpent: (count / totalActivities) * totalStudyTime,
    percentage: (count / totalActivities) * 100,
  }));

  // Calculate comprehension trend over time
  const comprehensionTrend = calculateComprehensionTrend(timeline);

  // Calculate retention rates
  const retentionRates = calculateRetentionRates(session);

  // Calculate study frequency (simplified - based on session data)
  const studyDays = Math.ceil(sessionDuration / (1000 * 60 * 60 * 24));

  return {
    totalStudyTime,
    averageSessionLength: totalStudyTime, // Single session for now
    studyFrequency: {
      daily: studyDays >= 1 ? 1 : 0,
      weekly: Math.ceil(studyDays / 7),
      monthly: Math.ceil(studyDays / 30),
    },
    phaseDistribution,
    comprehensionTrend,
    retentionRates,
  };
}

// Helper Functions
function determinePhaseFromActivity(defaultPhase: string): string {
  return defaultPhase; // Simplified - could be enhanced with more logic
}

function determineStruggleArea(itemProgress: any): string {
  const latestAttempts = itemProgress.attempts.slice(-3);
  const averageScore = latestAttempts.reduce((sum: number, attempt: FlashcardAttempt) => sum + attempt.aiResponse.comprehension, 0) / latestAttempts.length;
  
  if (averageScore <= 1) return 'Fundamental misunderstanding';
  if (averageScore <= 2) return 'Concept confusion';
  if (averageScore <= 3) return 'Memory recall issues';
  return 'Minor gaps in understanding';
}

function generateRecommendations(averageScore: number, masteryPercentage: number): string[] {
  const recommendations: string[] = [];
  
  if (averageScore <= 2) {
    recommendations.push('Review fundamental concepts');
    recommendations.push('Seek additional explanations or examples');
  }
  
  if (masteryPercentage <= 20) {
    recommendations.push('Focus more time on this concept');
    recommendations.push('Break down complex topics into smaller parts');
  }
  
  if (averageScore <= 3 && masteryPercentage <= 50) {
    recommendations.push('Practice active recall techniques');
    recommendations.push('Use spaced repetition more frequently');
  }
  
  return recommendations;
}

function calculateComprehensionTrend(timeline: LearningTimelineEntry[]): StudyPatternData['comprehensionTrend'] {
  const dailyScores: Map<string, { scores: number[]; concepts: Set<string> }> = new Map();
  
  timeline.forEach(entry => {
    const dateKey = entry.date.toDateString();
    if (!dailyScores.has(dateKey)) {
      dailyScores.set(dateKey, { scores: [], concepts: new Set() });
    }
    
    const dayData = dailyScores.get(dateKey)!;
    dayData.scores.push(entry.comprehensionScore);
    dayData.concepts.add(entry.concept);
  });
  
  return Array.from(dailyScores.entries()).map(([dateStr, data]) => ({
    date: new Date(dateStr),
    averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
    conceptsActive: data.concepts.size,
  })).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function calculateRetentionRates(session: LearningSession): StudyPatternData['retentionRates'] {
  // Simplified retention calculation based on success patterns
  let totalAttempts = 0;
  let successfulAttempts = 0;
  let earlySuccesses = 0;
  let laterSuccesses = 0;
  
  session.conceptsProgress.forEach(conceptProgress => {
    conceptProgress.itemsProgress.forEach(itemProgress => {
      totalAttempts += itemProgress.attempts.length;
      successfulAttempts += itemProgress.attempts.filter(a => a.aiResponse.comprehension >= 4).length;
      
      // Early success (first 2 attempts)
      const earlyAttempts = itemProgress.attempts.slice(0, 2);
      earlySuccesses += earlyAttempts.filter(a => a.aiResponse.comprehension >= 4).length;
      
      // Later success (after 2nd attempt)
      const laterAttempts = itemProgress.attempts.slice(2);
      laterSuccesses += laterAttempts.filter(a => a.aiResponse.comprehension >= 4).length;
    });
  });
  
  const immediateRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) : 0;
  const shortTermRate = totalAttempts > 2 ? (earlySuccesses / Math.min(totalAttempts, totalAttempts * 2)) : immediateRate;
  const mediumTermRate = laterSuccesses > 0 ? (laterSuccesses / Math.max(1, totalAttempts - 2)) : shortTermRate;
  
  return {
    immediate: Math.round(immediateRate * 100) / 100,
    shortTerm: Math.round(shortTermRate * 100) / 100,
    mediumTerm: Math.round(mediumTermRate * 100) / 100,
    longTerm: Math.round(mediumTermRate * 0.85 * 100) / 100, // Estimate based on medium-term
  };
}

export function generateAnalyticsDashboard(session: LearningSession, courseData: any): AnalyticsDashboardData {
  // Extract concept data from course
  const allConcepts = courseData?.concepts || [];
  const conceptMastery: ConceptMasteryData[] = [];
  
  allConcepts.forEach((concept: any) => {
    const masteryData = calculateConceptMastery(
      session,
      concept.name,
      concept.memorize?.items || [],
      concept['high-level'] || []
    );
    conceptMastery.push(masteryData);
  });
  
  const learningTimeline = generateLearningTimeline(session);
  const strengthsWeaknesses = analyzeStrengthsWeaknesses(session);
  const studyPatterns = calculateStudyPatterns(session);
  
  // Calculate overall progress
  const totalConcepts = allConcepts.length;
  const completedConcepts = conceptMastery.filter(c => c.progressPercentage >= 80).length;
  const totalItems = conceptMastery.reduce((sum, c) => sum + c.totalItems + c.totalTopics, 0);
  const masteredItems = conceptMastery.reduce((sum, c) => sum + c.masteredItems + c.masteredTopics, 0);
  const averageComprehension = conceptMastery.length > 0
    ? conceptMastery.reduce((sum, c) => sum + c.averageComprehension, 0) / conceptMastery.length
    : 0;
  
  const overallProgress = {
    totalConcepts,
    completedConcepts,
    totalItems,
    masteredItems,
    averageComprehension,
    studyStreak: 1, // Simplified
    totalStudyDays: Math.ceil((session.lastActivityTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60 * 24)),
  };
  
  return {
    conceptMastery,
    learningTimeline,
    strengthsWeaknesses,
    studyPatterns,
    overallProgress,
  };
}