import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIService } from '../../../../services/ai/index';
import { MongoCourseManager } from '../../../../services/mongoCourseManager';
import {
  withErrorHandling,
  withCaching,
  createSuccessResponse,
  validateRequestBody,
  getUserIdFromRequest,
  requestSchemas,
  ApiErrorResponse,
  CacheOptions,
} from '../../../../lib/api-utils';
import { CACHE_PREFIXES, CACHE_TTL } from '../../../../lib/cache';
import { Course } from '../../../../types/course';

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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/courses/[id] - Get a specific course by ID
 */
export const GET = withErrorHandling(
  withCaching<RouteContext>(
    async (request: Request, context: RouteContext) => {
      const userId = getUserIdFromRequest(request);
      const { id: courseId } = await context.params;

      if (!courseId) {
        throw new ApiErrorResponse('Course ID is required', 400, 'MISSING_COURSE_ID');
      }

      const manager = await getCourseManager();
      
      try {
        const course = await manager.loadCourse(courseId);
        
        return createSuccessResponse({
          id: course.name,
          name: course.name,
          backgroundKnowledge: course.backgroundKnowledge || [],
          concepts: course.concepts,
          'drawing-connections': course['drawing-connections'],
          conceptsCount: course.concepts.length,
          totalItems: course.concepts.reduce(
            (total, concept) => total + concept.memorize.items.length,
            0
          ),
          createdAt: new Date().toISOString(), // TODO: Add actual timestamps from MongoDB
          updatedAt: new Date().toISOString(),
        }, undefined, 200, {
          prefix: CACHE_PREFIXES.COURSE_DATA,
          key: courseId,
          ttl: CACHE_TTL.LONG,
          maxAge: CACHE_TTL.LONG,
          staleWhileRevalidate: CACHE_TTL.VERY_LONG,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new ApiErrorResponse(`Course with ID "${courseId}" not found`, 404, 'COURSE_NOT_FOUND');
        }
        throw error;
      }
    },
    async (request: Request, context: RouteContext) => {
      const params = await context.params;
      if (!params.id) return null;
      return {
        prefix: CACHE_PREFIXES.COURSE_DATA,
        key: params.id,
        ttl: CACHE_TTL.LONG,
        maxAge: CACHE_TTL.LONG,
        staleWhileRevalidate: CACHE_TTL.VERY_LONG,
      };
    }
  )
);

/**
 * PUT /api/courses/[id] - Update a specific course
 */
export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  const userId = getUserIdFromRequest(request);
  const { id: courseId } = await context.params;

  if (!courseId) {
    throw new ApiErrorResponse('Course ID is required', 400, 'MISSING_COURSE_ID');
  }

  const body = await validateRequestBody(request, requestSchemas.updateCourse);
  const manager = await getCourseManager();

  try {
    const existingCourse = await manager.loadCourse(courseId);
    
    const updatedCourse: Course = {
      ...existingCourse,
      ...body,
      name: body.name || existingCourse.name,
    };

    await manager.saveCourse(updatedCourse);

    return createSuccessResponse({
      id: updatedCourse.name,
      name: updatedCourse.name,
      backgroundKnowledge: updatedCourse.backgroundKnowledge || [],
      concepts: updatedCourse.concepts,
      'drawing-connections': updatedCourse['drawing-connections'],
      conceptsCount: updatedCourse.concepts.length,
      totalItems: updatedCourse.concepts.reduce(
        (total, concept) => total + concept.memorize.items.length,
        0
      ),
      updatedAt: new Date().toISOString(),
    }, `Course "${updatedCourse.name}" updated successfully`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(`Course with ID "${courseId}" not found`, 404, 'COURSE_NOT_FOUND');
    }
    throw error;
  }
});

/**
 * DELETE /api/courses/[id] - Delete a specific course
 */
export const DELETE = withErrorHandling(async (request: Request, context: RouteContext) => {
  const userId = getUserIdFromRequest(request);
  const { id: courseId } = await context.params;

  if (!courseId) {
    throw new ApiErrorResponse('Course ID is required', 400, 'MISSING_COURSE_ID');
  }

  // Note: Since MongoCourseManager doesn't have a delete method,
  // we'll throw an error for now. This needs to be implemented.
  throw new ApiErrorResponse(
    'Course deletion not yet implemented',
    501,
    'NOT_IMPLEMENTED'
  );
});

/**
 * POST /api/courses/[id]/sessions - Create a new session for this course
 */
export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const userId = getUserIdFromRequest(request);
  const { id: courseId } = await context.params;

  if (!courseId) {
    throw new ApiErrorResponse('Course ID is required', 400, 'MISSING_COURSE_ID');
  }

  const body = await validateRequestBody(request, z.object({
    existingUnderstanding: z.string().optional(),
    timeAvailable: z.string().optional(),
  }));

  const manager = await getCourseManager();

  // Verify course exists
  try {
    await manager.loadCourse(courseId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(`Course with ID "${courseId}" not found`, 404, 'COURSE_NOT_FOUND');
    }
    throw error;
  }

  // Check if user already has an active session for this course
  const existingSession = await manager.loadSession(courseId, userId);
  if (existingSession) {
    throw new ApiErrorResponse(
      `Active session already exists for course "${courseId}"`,
      409,
      'SESSION_ALREADY_EXISTS'
    );
  }

  // Create new session
  const session = await manager.createSession(courseId, userId);
  
  if (body.existingUnderstanding) {
    session.existingUnderstanding = body.existingUnderstanding;
  }
  if (body.timeAvailable) {
    session.timeAvailable = body.timeAvailable;
  }

  await manager.saveSession(session);

  return createSuccessResponse({
    sessionId: `${userId}-${courseId}`,
    userId: session.userId,
    courseId: session.courseId,
    currentPhase: session.currentPhase,
    currentConcept: session.currentConcept,
    startTime: session.startTime.toISOString(),
    lastActivityTime: session.lastActivityTime.toISOString(),
    existingUnderstanding: session.existingUnderstanding,
    timeAvailable: session.timeAvailable,
  }, `Session created for course "${courseId}"`, 201);
});