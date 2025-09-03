import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIService } from '@/services/ai';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import {
  withErrorHandling,
  createSuccessResponse,
  validateRequestBody,
  getUserIdFromRequest,
  ApiErrorResponse,
} from '@/lib/api-utils';
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

// Schema for course generation (different from creation as we generate the name)
const generateCourseSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  documentContent: z.string().optional(),
  timeAvailable: z.string().min(1, 'Time available is required'),
  existingUnderstanding: z.string().min(1, 'Existing understanding is required'),
  focusDescription: z.string().optional(),
});

/**
 * POST /api/courses/generate - Generate a new course
 */
export const POST = withErrorHandling(async (request: Request) => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, generateCourseSchema);
  
  const manager = await getCourseManager();

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

  // Generate course structure with focusDescription as learningGoals
  const course = await aiService.generateCourseStructure(
    body.topic,
    body.documentContent || null,
    body.timeAvailable,
    body.existingUnderstanding,
    body.focusDescription || ''
  );

  // Check if course with generated name already exists
  const existingCourses = await manager.listCourses();
  if (existingCourses.includes(course.name)) {
    // If the generated name exists, append a number
    let counter = 2;
    let uniqueName = `${course.name}-${counter}`;
    while (existingCourses.includes(uniqueName)) {
      counter++;
      uniqueName = `${course.name}-${counter}`;
    }
    course.name = uniqueName;
  }

  // Set userId for the course
  course.userId = userId;
  
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