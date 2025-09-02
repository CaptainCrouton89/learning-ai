import { NextRequest, NextResponse } from 'next/server';
import { getCourseManager, STORAGE_TYPE } from '@/config/storage';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import { TopicProgress } from '@/types/course';
import { z } from 'zod';

// Helper function to load session with appropriate parameters
async function loadSessionSafely(courseManager: any, sessionId: string): Promise<any> {
  if (STORAGE_TYPE === 'mongodb' && courseManager instanceof MongoCourseManager) {
    // MongoDB version requires both courseId and userId - use sessionId as both for now
    return await courseManager.loadSession(sessionId, sessionId);
  } else {
    // File-based version only needs sessionId
    return await courseManager.loadSession(sessionId);
  }
}

// Schema for progress update requests
const ProgressUpdateSchema = z.object({
  phase: z.enum(['initialization', 'high-level', 'concept-learning', 'memorization', 'drawing-connections']).optional(),
  conceptName: z.string().optional(),
  itemProgress: z.array(z.object({
    itemName: z.string(),
    successCount: z.number(),
    comprehension: z.number().min(0).max(5)
  })).optional(),
  topicProgress: z.array(z.object({
    topicName: z.string(),
    comprehension: z.number().min(0).max(5)
  })).optional()
});

/**
 * GET /api/sessions/[id]/progress
 * Retrieve current progress and scores for a learning session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = (await params).id;
    const courseManager = await getCourseManager();

    // Load session
    const session = await loadSessionSafely(courseManager, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Load course
    const course = await courseManager.loadCourse(session.courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get current phase and concept
    const currentPhase = session.currentPhase;
    const currentConcept = session.currentConcept;

    // Collect progress data based on current phase
    const progressData: any = {
      sessionId,
      courseId: session.courseId,
      courseName: course.name,
      currentPhase,
      currentConcept,
      overallProgress: {
        totalConcepts: course.concepts.length,
        completedConcepts: 0,
        currentConceptProgress: 0
      },
      scores: {
        comprehension: new Map<string, number>(),
        itemProgress: new Map<string, { successCount: number; comprehension: number }>(),
        topicProgress: new Map<string, number>()
      }
    };

    // High-level progress
    if (currentPhase === 'high-level' || session.conceptsProgress.has('high-level')) {
      const highLevelTopics = course.backgroundKnowledge && course.backgroundKnowledge.length > 0
        ? course.backgroundKnowledge
        : course.concepts.map(c => c.name);

      const highLevelProgress = courseManager.getAllTopicsComprehension(
        session,
        'high-level',
        highLevelTopics
      );

      if (highLevelProgress) {
        for (const [topic, score] of highLevelProgress.entries()) {
          progressData.scores.topicProgress.set(`high-level:${topic}`, score);
        }
      }
    }

    // Concept-specific progress
    for (const concept of course.concepts) {
      const conceptProgress = session.conceptsProgress.get(concept.name);
      if (conceptProgress) {
        // Topic progress for this concept
        for (const [topicName, topicData] of conceptProgress.topicProgress.entries()) {
          progressData.scores.topicProgress.set(
            `${concept.name}:${topicName}`,
            topicData.currentComprehension
          );
        }

        // Item progress for this concept
        for (const [itemName, itemData] of conceptProgress.itemsProgress.entries()) {
          progressData.scores.itemProgress.set(
            `${concept.name}:${itemName}`,
            {
              successCount: itemData.successCount,
              comprehension: itemData.attempts.length > 0 
                ? itemData.attempts[itemData.attempts.length - 1].aiResponse.comprehension 
                : 0
            }
          );
        }

        // Calculate concept completion
        const masteredTopics = [...conceptProgress.topicProgress.values()]
          .filter((topicProgress: TopicProgress) => topicProgress.currentComprehension >= 5).length;
        const totalTopics = concept['high-level'].length;
        
        if (totalTopics > 0) {
          const conceptCompletionRate = masteredTopics / totalTopics;
          if (conceptCompletionRate >= 0.8) { // 80% mastery threshold
            progressData.overallProgress.completedConcepts++;
          }
          
          if (concept.name === currentConcept) {
            progressData.overallProgress.currentConceptProgress = conceptCompletionRate;
          }
        }
      }
    }

    // Convert Maps to Objects for JSON serialization
    const response = {
      ...progressData,
      scores: {
        comprehension: Object.fromEntries(progressData.scores.comprehension),
        itemProgress: Object.fromEntries(progressData.scores.itemProgress),
        topicProgress: Object.fromEntries(progressData.scores.topicProgress)
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error retrieving progress:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sessions/[id]/progress  
 * Update progress and scores for a learning session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = (await params).id;
    const body = await request.json();
    
    // Validate request body
    const updateData = ProgressUpdateSchema.parse(body);
    
    const courseManager = await getCourseManager();
    
    // Load session
    const session = await loadSessionSafely(courseManager, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update phase if provided
    if (updateData.phase) {
      await courseManager.updateSessionPhase(session, updateData.phase, updateData.conceptName);
    }

    // Update item progress if provided
    if (updateData.itemProgress && updateData.conceptName) {
      for (const item of updateData.itemProgress) {
        const attempt = {
          question: 'Progress update',
          userAnswer: 'Progress update',
          aiResponse: {
            comprehension: item.comprehension,
            response: 'Progress manually updated'
          },
          timestamp: new Date()
        };
        
        await courseManager.updateItemProgress(
          session,
          updateData.conceptName,
          item.itemName,
          attempt
        );
      }
    }

    // Update topic progress if provided  
    if (updateData.topicProgress) {
      for (const topic of updateData.topicProgress) {
        const conceptKey = updateData.conceptName || 'high-level';
        
        const attempt = {
          question: 'Progress update',
          userAnswer: 'Progress update',
          aiResponse: {
            comprehension: topic.comprehension,
            response: 'Progress manually updated',
            targetTopic: topic.topicName
          },
          timestamp: new Date()
        };
        
        await courseManager.updateConceptTopicProgress(session, conceptKey, attempt);
      }
    }

    // Return updated progress
    const updatedSession = await loadSessionSafely(courseManager, sessionId);
    return NextResponse.json({ 
      success: true, 
      message: 'Progress updated successfully',
      currentPhase: updatedSession?.currentPhase,
      currentConcept: updatedSession?.currentConcept
    });

  } catch (error) {
    console.error('Error updating progress:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}