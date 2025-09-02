import { NextResponse } from 'next/server';
import { streamObject, streamText } from 'ai';
import { z } from 'zod';
import { AIService } from '@/services/ai';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import { models } from '@/config/models';
import { CourseGenerationSchema } from '@/services/ai/schemas';
import {
  withErrorHandling,
  validateRequestBody,
  getUserIdFromRequest,
  ApiErrorResponse,
  createSuccessResponse,
} from '@/lib/api-utils';

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

// Request validation schema
const generateCourseSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  documentContent: z.string().optional(),
  timeAvailable: z.string().min(1, 'Time available is required'),
  existingUnderstanding: z.string().min(1, 'Existing understanding is required'),
  learningGoals: z.string().min(1, 'Learning goals are required'),
  analyzeTopic: z.boolean().optional().default(true),
  saveCourse: z.boolean().optional().default(false),
  courseName: z.string().optional(),
  streaming: z.boolean().optional().default(false),
});

type GenerateCourseRequest = z.infer<typeof generateCourseSchema>;

/**
 * POST /api/ai/generate-course - Generate course structure and optionally save it
 */
export const POST = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  const body = await validateRequestBody(request, generateCourseSchema);
  
  const manager = await getCourseManager();

  try {
    // Analyze topic appropriateness if requested
    let topicAnalysis = null;
    if (body.analyzeTopic) {
      topicAnalysis = await aiService.analyzeTopic(
        body.topic,
        body.timeAvailable,
        body.existingUnderstanding
      );

      if (!topicAnalysis.is_appropriate) {
        throw new ApiErrorResponse(
          `Topic "${body.topic}" is not appropriate for learning: ${topicAnalysis.reason}`,
          400,
          'INAPPROPRIATE_TOPIC',
        );
      }
    }

    // Return streaming course generation if requested
    if (body.streaming) {
      const stream = streamText({
        model: models.standard,
        prompt: `Generate a comprehensive course structure for learning about "${body.topic}".
        
Time available: ${body.timeAvailable}
Existing understanding: ${body.existingUnderstanding}
Learning goals: ${body.learningGoals}
${body.documentContent ? `\nDocument content to incorporate:\n${body.documentContent}` : ''}

Create a course that matches the learner's current level and time constraints. Return the response as JSON following this schema:
- name: string (course name)
- backgroundKnowledge: string[] (optional prerequisite concepts)
- concepts: array of objects with name and other properties
- drawing-connections: string[] (connection topics)`,
      });

      return new NextResponse(stream.toTextStreamResponse().body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Generate course structure
    const course = await aiService.generateCourseStructure(
      body.topic,
      body.documentContent || null,
      body.timeAvailable,
      body.existingUnderstanding,
      body.learningGoals
    );

    // Save course if requested
    let savedCourse = null;
    if (body.saveCourse) {
      // Use provided name or generate from topic
      const courseName = body.courseName || course.name;
      
      // Check if course with same name already exists
      const existingCourses = await manager.listCourses();
      if (existingCourses.includes(courseName)) {
        throw new ApiErrorResponse(
          `Course with name "${courseName}" already exists`,
          409,
          'COURSE_ALREADY_EXISTS'
        );
      }

      // Update course name if different
      if (courseName !== course.name) {
        course.name = courseName;
      }

      await manager.saveCourse(course);
      savedCourse = course;
    }

    // Generate learning goal suggestions
    const learningGoalSuggestions = await aiService.generateLearningGoals(
      body.topic,
      body.timeAvailable,
      body.existingUnderstanding
    );

    return createSuccessResponse({
      course,
      topicAnalysis,
      learningGoalSuggestions,
      saved: body.saveCourse,
      savedCourse,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    throw new ApiErrorResponse(
      `Failed to generate course structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'COURSE_GENERATION_FAILED'
    );
  }
});

/**
 * GET /api/ai/generate-course/analyze-topic - Analyze topic appropriateness
 */
export const GET = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  const { searchParams } = new URL(request.url);
  
  const topic = searchParams.get('topic');
  const timeAvailable = searchParams.get('timeAvailable');
  const existingUnderstanding = searchParams.get('existingUnderstanding');

  if (!topic || !timeAvailable || !existingUnderstanding) {
    throw new ApiErrorResponse(
      'topic, timeAvailable, and existingUnderstanding query parameters are required',
      400,
      'MISSING_PARAMETERS'
    );
  }

  try {
    const topicAnalysis = await aiService.analyzeTopic(
      topic,
      timeAvailable,
      existingUnderstanding
    );

    // Generate learning goal suggestions regardless of appropriateness
    const learningGoalSuggestions = await aiService.generateLearningGoals(
      topic,
      timeAvailable,
      existingUnderstanding
    );

    return createSuccessResponse({
      topicAnalysis,
      learningGoalSuggestions,
      analyzedAt: new Date().toISOString(),
    });

  } catch (error) {
    throw new ApiErrorResponse(
      `Failed to analyze topic: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TOPIC_ANALYSIS_FAILED'
    );
  }
});

/**
 * PUT /api/ai/generate-course/refine-topic - Refine topic based on user feedback
 */
export const PUT = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, z.object({
    originalTopic: z.string().min(1, 'Original topic is required'),
    userResponse: z.string().min(1, 'User response is required'),
    timeAvailable: z.string().min(1, 'Time available is required'),
    streaming: z.boolean().optional().default(false),
  }));

  try {
    // Return streaming refinement if requested
    if (body.streaming) {
      const stream = streamText({
        model: models.fast,
        prompt: `The user wants to learn about "${body.originalTopic}" but provided this feedback: "${body.userResponse}". 
        
Time available: ${body.timeAvailable}

Based on their feedback, provide a refined and more specific topic that would be better for learning. Return only the refined topic, nothing else.`,
      });

      return new NextResponse(stream.toTextStreamResponse().body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    const refinedTopic = await aiService.refineTopic(
      body.originalTopic,
      body.userResponse,
      body.timeAvailable
    );

    return createSuccessResponse({
      originalTopic: body.originalTopic,
      refinedTopic,
      userResponse: body.userResponse,
      refinedAt: new Date().toISOString(),
    });

  } catch (error) {
    throw new ApiErrorResponse(
      `Failed to refine topic: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TOPIC_REFINEMENT_FAILED'
    );
  }
});