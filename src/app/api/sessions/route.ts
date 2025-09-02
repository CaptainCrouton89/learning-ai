import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIService } from '../../../services/ai/index.js';
import { MongoCourseManager } from '../../../services/mongoCourseManager.js';
import {
  withErrorHandling,
  createSuccessResponse,
  validateRequestBody,
  validateQueryParams,
  getUserIdFromRequest,
  requestSchemas,
  commonSchemas,
  ApiErrorResponse,
  ApiTypes,
} from '../../../lib/api-utils.js';
import { LearningSession } from '../../../types/course.js';

const aiService = new AIService();
let courseManager: MongoCourseManager;

// Initialize course manager
async function getCourseManager(): Promise<MongoCourseManager> {
  if (!courseManager) {
    courseManager = new MongoCourseManager();
    await courseManager.initialize();
  }
  return courseManager;
}

/**
 * Helper function to calculate session progress
 */
function calculateSessionProgress(session: LearningSession, course: any): ApiTypes.SessionResponse['progress'] {
  const totalConcepts = course?.concepts?.length || 0;
  let conceptsCompleted = 0;
  let itemsMastered = 0;
  let totalItems = 0;

  if (course?.concepts) {
    for (const concept of course.concepts) {
      totalItems += concept.memorize.items.length;
      
      const conceptProgress = session.conceptsProgress.get(concept.name);
      if (conceptProgress) {
        let conceptItemsMastered = 0;
        
        for (const item of concept.memorize.items) {
          const itemProgress = conceptProgress.itemsProgress.get(item);
          if (itemProgress && itemProgress.successCount >= 2) {
            conceptItemsMastered++;
            itemsMastered++;
          }
        }
        
        // Consider concept complete if all items are mastered
        if (conceptItemsMastered === concept.memorize.items.length) {
          conceptsCompleted++;
        }
      }
    }
  }

  const overallCompletion = totalItems > 0 ? (itemsMastered / totalItems) * 100 : 0;

  return {
    conceptsCompleted,
    totalConcepts,
    itemsMastered,
    totalItems,
    overallCompletion: Math.round(overallCompletion * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Helper function to convert session to API response format
 */
async function sessionToApiResponse(session: LearningSession): Promise<ApiTypes.SessionResponse> {
  const manager = await getCourseManager();
  let course = null;
  
  try {
    course = await manager.loadCourse(session.courseId);
  } catch (error) {
    console.warn(`Failed to load course ${session.courseId} for progress calculation`);
  }

  const progress = calculateSessionProgress(session, course);

  return {
    userId: session.userId,
    courseId: session.courseId,
    currentPhase: session.currentPhase,
    currentConcept: session.currentConcept,
    startTime: session.startTime.toISOString(),
    lastActivityTime: session.lastActivityTime.toISOString(),
    existingUnderstanding: session.existingUnderstanding,
    timeAvailable: session.timeAvailable,
    conversationHistory: session.conversationHistory.map(entry => ({
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp.toISOString(),
    })),
    progress,
  };
}

/**
 * GET /api/sessions - List user's sessions with optional filtering
 */
export const GET = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  const { searchParams } = new URL(request.url);
  
  const queryParams = validateQueryParams(
    searchParams,
    z.object({
      courseId: z.string().optional(),
      phase: commonSchemas.learningPhase.optional(),
      active: z.string().optional().transform(val => val === 'true'),
      ...commonSchemas.pagination.shape,
    })
  );

  const manager = await getCourseManager();
  
  // Note: Current MongoCourseManager doesn't have a method to list all user sessions
  // For now, we'll return an empty list with a note about implementation
  
  // TODO: Implement getUserSessions in MongoCourseManager
  return createSuccessResponse({
    sessions: [],
    total: 0,
    page: queryParams.page,
    limit: queryParams.limit,
    message: 'Session listing not yet implemented - use specific course endpoints',
  });
});

/**
 * POST /api/sessions - Create a new learning session
 */
export const POST = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, requestSchemas.createSession);
  const manager = await getCourseManager();

  // Verify course exists
  try {
    await manager.loadCourse(body.courseId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(
        `Course with ID "${body.courseId}" not found`,
        404,
        'COURSE_NOT_FOUND'
      );
    }
    throw error;
  }

  // Check if user already has an active session for this course
  const existingSession = await manager.loadSession(body.courseId, userId);
  if (existingSession) {
    throw new ApiErrorResponse(
      `Active session already exists for course "${body.courseId}". Use PUT to update or DELETE to end it.`,
      409,
      'SESSION_ALREADY_EXISTS'
    );
  }

  // Create new session
  const session = await manager.createSession(body.courseId, userId);
  
  if (body.existingUnderstanding) {
    session.existingUnderstanding = body.existingUnderstanding;
  }
  if (body.timeAvailable) {
    session.timeAvailable = body.timeAvailable;
  }

  await manager.saveSession(session);

  const apiResponse = await sessionToApiResponse(session);

  return createSuccessResponse(
    apiResponse,
    `Session created for course "${body.courseId}"`,
    201
  );
});

/**
 * PUT /api/sessions - Update multiple sessions (bulk operation)
 */
export const PUT = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, z.object({
    sessions: z.array(z.object({
      courseId: z.string(),
      ...requestSchemas.updateSession.shape,
    })),
  }));

  const manager = await getCourseManager();
  const results = [];

  for (const sessionUpdate of body.sessions) {
    try {
      const existingSession = await manager.loadSession(sessionUpdate.courseId, userId);
      
      if (!existingSession) {
        results.push({
          courseId: sessionUpdate.courseId,
          success: false,
          error: `Session not found for course "${sessionUpdate.courseId}"`,
        });
        continue;
      }

      // Apply updates
      if (sessionUpdate.currentPhase) {
        await manager.updateSessionPhase(
          existingSession,
          sessionUpdate.currentPhase,
          sessionUpdate.currentConcept
        );
      }

      if (sessionUpdate.existingUnderstanding) {
        existingSession.existingUnderstanding = sessionUpdate.existingUnderstanding;
      }

      if (sessionUpdate.timeAvailable) {
        existingSession.timeAvailable = sessionUpdate.timeAvailable;
      }

      await manager.saveSession(existingSession);

      results.push({
        courseId: sessionUpdate.courseId,
        success: true,
        message: `Session for course "${sessionUpdate.courseId}" updated successfully`,
      });
    } catch (error) {
      results.push({
        courseId: sessionUpdate.courseId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return createSuccessResponse(
    { results },
    `Bulk session update completed: ${results.filter(r => r.success).length}/${results.length} successful`
  );
});

/**
 * DELETE /api/sessions - End multiple sessions (bulk operation)
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, z.object({
    courseIds: z.array(z.string().min(1)),
  }));

  // Note: Since MongoCourseManager doesn't have a deleteSession method,
  // we'll throw an error for now. This needs to be implemented.
  throw new ApiErrorResponse(
    'Session deletion not yet implemented',
    501,
    'NOT_IMPLEMENTED'
  );
});