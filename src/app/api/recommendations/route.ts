import { NextRequest, NextResponse } from 'next/server';
import { getCourseManager } from '../../../config/storage.js';
import { RecommendationEngine, RecommendationOptions } from '../../../services/recommendations.js';
import { Course, LearningSession } from '../../../types/course.js';

export async function GET(request: NextRequest) {
  try {
    // For now, skip authentication in development
    // TODO: Implement proper authentication when NextAuth is set up
    const userId = 'demo-user'; // Temporary user ID

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const sessionId = searchParams.get('sessionId');
    
    // Parse recommendation options
    const includeStudyTimes = searchParams.get('includeStudyTimes') !== 'false';
    const includeFocusAreas = searchParams.get('includeFocusAreas') !== 'false';
    const includeDifficultyAdjustments = searchParams.get('includeDifficultyAdjustments') !== 'false';
    const includeLearningPaths = searchParams.get('includeLearningPaths') !== 'false';

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Get course manager and load data
    const courseManager = await getCourseManager();
    
    // Load course data
    let course: Course;
    try {
      course = await courseManager.loadCourse(courseId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Load or create session
    let learningSession: LearningSession;
    
    if (sessionId) {
      // Load existing session - handle both storage types
      let existingSession: LearningSession | null;
      if ('loadSession' in courseManager && courseManager.constructor.name === 'MongoCourseManager') {
        // MongoDB manager requires userId
        existingSession = await (courseManager as any).loadSession(sessionId, userId);
      } else {
        // File manager only needs courseId/sessionId
        existingSession = await (courseManager as any).loadSession(sessionId);
      }
      
      if (!existingSession) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      
      learningSession = existingSession;
    } else {
      // Try to find an active session for this course and user
      let courseSession: LearningSession | null;
      if ('loadSession' in courseManager && courseManager.constructor.name === 'MongoCourseManager') {
        // MongoDB manager requires userId
        courseSession = await (courseManager as any).loadSession(courseId, userId);
      } else {
        // File manager uses courseId-session format
        const sessionId = courseId + '-session';
        courseSession = await (courseManager as any).loadSession(sessionId);
      }
      
      if (!courseSession) {
        return NextResponse.json(
          { error: 'No active session found for this course. Please start a learning session first.' },
          { status: 404 }
        );
      }
      
      learningSession = courseSession;
    }

    // Validate that session has some progress data
    if (learningSession.conceptsProgress.size === 0) {
      return NextResponse.json({
        recommendations: {
          optimalStudyTimes: [],
          focusAreas: [],
          difficultyAdjustments: [],
          learningPath: {
            nextConcepts: course.concepts.slice(0, 3).map((concept, index) => ({
              name: concept.name,
              priority: 10 - index,
              reason: "Initial concept to explore"
            })),
            estimatedDuration: "2-4 hours",
            strategy: "Start with foundational concepts and build understanding gradually"
          },
          nextReviewSchedule: [],
          motivationalMessage: "🌟 Ready to start your learning journey? Begin with the first concept to build your foundation!",
          estimatedTimeToMastery: "Just getting started!"
        },
        lastUpdated: new Date().toISOString()
      });
    }

    // Configure recommendation options
    const options: RecommendationOptions = {
      includeStudyTimes,
      includeFocusAreas,
      includeDifficultyAdjustments,
      includeLearningPaths
    };

    // Generate recommendations
    const recommendationEngine = new RecommendationEngine();
    const recommendations = await recommendationEngine.generateRecommendations(
      course,
      learningSession,
      options
    );

    // Return recommendations with metadata
    return NextResponse.json({
      recommendations,
      lastUpdated: new Date().toISOString(),
      metadata: {
        courseId,
        sessionId: learningSession.courseId + '-session',
        userId: userId,
        currentPhase: learningSession.currentPhase,
        progressSummary: {
          conceptsStarted: learningSession.conceptsProgress.size,
          totalConcepts: course.concepts.length,
          overallProgress: calculateOverallProgress(learningSession),
          sessionDuration: Math.round((Date.now() - learningSession.startTime.getTime()) / (1000 * 60)) // minutes
        }
      }
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    
    // Return error response with details for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations',
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // For now, skip authentication in development
    const userId = 'demo-user';

    // Parse request body
    const body = await request.json();
    const { courseId, sessionId, options, forceRefresh } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Get course manager and load data
    const courseManager = await getCourseManager();
    
    // Load course data
    let course: Course;
    try {
      course = await courseManager.loadCourse(courseId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Load session
    let learningSession: LearningSession;
    
    if (sessionId) {
      // Load existing session - handle both storage types
      let existingSession: LearningSession | null;
      if ('loadSession' in courseManager && courseManager.constructor.name === 'MongoCourseManager') {
        existingSession = await (courseManager as any).loadSession(sessionId, userId);
      } else {
        existingSession = await (courseManager as any).loadSession(sessionId);
      }
      
      if (!existingSession) {
        return NextResponse.json(
          { error: 'Session not found or access denied' },
          { status: 404 }
        );
      }
      learningSession = existingSession;
    } else {
      // Find active session
      let courseSession: LearningSession | null;
      if ('loadSession' in courseManager && courseManager.constructor.name === 'MongoCourseManager') {
        courseSession = await (courseManager as any).loadSession(courseId, userId);
      } else {
        const sessionId = courseId + '-session';
        courseSession = await (courseManager as any).loadSession(sessionId);
      }
      
      if (!courseSession) {
        return NextResponse.json(
          { error: 'No active session found' },
          { status: 404 }
        );
      }
      
      learningSession = courseSession;
    }

    // Generate recommendations with custom options
    const recommendationEngine = new RecommendationEngine();
    const recommendations = await recommendationEngine.generateRecommendations(
      course,
      learningSession,
      options || {}
    );

    return NextResponse.json({
      recommendations,
      lastUpdated: new Date().toISOString(),
      generatedWith: options,
      metadata: {
        courseId,
        sessionId: learningSession.courseId + '-session',
        userId: userId,
        currentPhase: learningSession.currentPhase,
        forceRefresh: !!forceRefresh
      }
    });

  } catch (error) {
    console.error('Error generating custom recommendations:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate overall progress
function calculateOverallProgress(session: LearningSession): number {
  if (session.conceptsProgress.size === 0) return 0;
  
  let totalProgress = 0;
  let conceptCount = 0;
  
  for (const [_, progress] of session.conceptsProgress) {
    conceptCount++;
    
    // Calculate topic progress
    const topicScores = Array.from(progress.topicProgress.values())
      .map(tp => tp.currentComprehension / 5);
    
    // Calculate item progress
    const itemScores = Array.from(progress.itemsProgress.values())
      .map(ip => {
        if (ip.successCount >= 2) return 1; // Mastered
        const attempts = ip.attempts;
        if (attempts.length === 0) return 0;
        const avgComprehension = attempts.reduce((sum, a) => sum + a.aiResponse.comprehension, 0) / attempts.length;
        return avgComprehension / 5;
      });
    
    const allScores = [...topicScores, ...itemScores];
    const conceptProgress = allScores.length > 0 
      ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
      : 0;
      
    totalProgress += conceptProgress;
  }
  
  return Math.round((totalProgress / conceptCount) * 100) / 100; // Round to 2 decimal places
}