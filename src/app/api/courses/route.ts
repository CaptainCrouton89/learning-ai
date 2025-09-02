import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIService } from '@/services/ai';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import {
  withErrorHandling,
  withCaching,
  createSuccessResponse,
  validateRequestBody,
  validateQueryParams,
  getUserIdFromRequest,
  requestSchemas,
  commonSchemas,
  ApiErrorResponse,
  ApiTypes,
  CacheOptions,
} from '@/lib/api-utils';
import { CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache';
import { Course } from '@/types/course';

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
 * GET /api/courses - List all courses for the authenticated user
 */
export const GET = withErrorHandling(
  withCaching(
    async (request: Request) => {
      const userId = getUserIdFromRequest(request);
      const { searchParams } = new URL(request.url);
      
      const { page, limit } = validateQueryParams(
        searchParams,
        commonSchemas.pagination
      );

      const manager = await getCourseManager();
      const courses = await manager.listCourses();
      
      // For now, return all courses since we don't have user-specific filtering yet
      // TODO: Add user-specific filtering when user association is implemented
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCourses = courses.slice(startIndex, endIndex);
      
      // Load course details for the paginated results
      const coursesWithDetails = await Promise.all(
        paginatedCourses.map(async (courseName) => {
          try {
            const course = await manager.loadCourse(courseName);
            return {
              id: courseName,
              name: course.name,
              conceptsCount: course.concepts.length,
              backgroundKnowledge: course.backgroundKnowledge || [],
              createdAt: new Date().toISOString(), // TODO: Add actual timestamps from MongoDB
              updatedAt: new Date().toISOString(),
            };
          } catch (error) {
            console.warn(`Failed to load course ${courseName}:`, error);
            return null;
          }
        })
      );

      const validCourses = coursesWithDetails.filter(course => course !== null);

      const response: ApiTypes.CourseListResponse = {
        courses: validCourses,
        total: courses.length,
        page,
        limit,
      };

      return createSuccessResponse(response, undefined, 200, {
        prefix: CACHE_PREFIXES.COURSE_DATA,
        key: `list:${userId}:${page}:${limit}`,
        ttl: CACHE_TTL.MEDIUM,
        maxAge: CACHE_TTL.MEDIUM,
        staleWhileRevalidate: CACHE_TTL.LONG,
      });
    },
    (request: Request) => {
      const userId = getUserIdFromRequest(request);
      const { searchParams } = new URL(request.url);
      const { page = 1, limit = 10 } = validateQueryParams(
        searchParams,
        commonSchemas.pagination
      );
      
      return {
        prefix: CACHE_PREFIXES.COURSE_DATA,
        key: `list:${userId}:${page}:${limit}`,
        ttl: CACHE_TTL.MEDIUM,
        maxAge: CACHE_TTL.MEDIUM,
        staleWhileRevalidate: CACHE_TTL.LONG,
      };
    }
  )
);

/**
 * POST /api/courses - Create a new course
 */
export const POST = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, requestSchemas.createCourse);
  
  // Check if course with same name already exists
  const manager = await getCourseManager();
  const existingCourses = await manager.listCourses();
  
  if (existingCourses.includes(body.name)) {
    throw new ApiErrorResponse(
      `Course with name "${body.name}" already exists`,
      409,
      'COURSE_ALREADY_EXISTS'
    );
  }

  // Analyze topic appropriateness
  const topicAnalysis = await aiService.analyzeTopic(
    body.topic,
    body.timeAvailable,
    body.existingUnderstanding
  );

  if (!topicAnalysis.is_appropriate) {
    throw new ApiErrorResponse(
      `Topic "${body.topic}" is not appropriate for learning: ${topicAnalysis.reason}`,
      400,
      'INAPPROPRIATE_TOPIC'
    );
  }

  // Generate course structure
  const course = await aiService.generateCourseStructure(
    body.topic,
    body.documentContent || null,
    body.timeAvailable,
    body.existingUnderstanding,
    body.learningGoals
  );

  // Save course to database
  await manager.saveCourse(course);

  return createSuccessResponse(
    {
      id: course.name,
      name: course.name,
      conceptsCount: course.concepts.length,
      backgroundKnowledge: course.backgroundKnowledge || [],
      concepts: course.concepts,
      'drawing-connections': course['drawing-connections'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    `Course "${course.name}" created successfully`,
    201
  );
});

/**
 * PUT /api/courses - Update multiple courses (bulk operation)
 */
export const PUT = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  // For bulk updates, expect an array of course updates
  const body = await validateRequestBody(request, z.object({
    courses: z.array(z.object({
      id: z.string(),
      ...requestSchemas.updateCourse.shape,
    })),
  }));

  const manager = await getCourseManager();
  const results = [];

  for (const courseUpdate of body.courses) {
    try {
      const existingCourse = await manager.loadCourse(courseUpdate.id);
      
      const updatedCourse: Course = {
        ...existingCourse,
        ...courseUpdate,
        name: courseUpdate.name || existingCourse.name,
      };

      await manager.saveCourse(updatedCourse);
      results.push({
        id: courseUpdate.id,
        success: true,
        message: `Course "${courseUpdate.id}" updated successfully`,
      });
    } catch (error) {
      results.push({
        id: courseUpdate.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return createSuccessResponse(
    { results },
    `Bulk update completed: ${results.filter(r => r.success).length}/${results.length} successful`
  );
});

/**
 * DELETE /api/courses - Delete multiple courses (bulk operation)
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, z.object({
    courseIds: z.array(z.string().min(1)),
  }));

  // Note: Since MongoCourseManager doesn't have a delete method,
  // we'll throw an error for now. This needs to be implemented.
  throw new ApiErrorResponse(
    'Course deletion not yet implemented',
    501,
    'NOT_IMPLEMENTED'
  );
});