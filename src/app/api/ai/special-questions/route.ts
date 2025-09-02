import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { AIService } from '@/services/ai';
import { MongoCourseManager } from '@/services/mongoCourseManager';
import { models } from '@/config/models';
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
const specialQuestionSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  questionType: z.enum(['connection-to-struggling', 'elaboration', 'high-level-recall']),
  conceptName: z.string().min(1, 'Concept name is required'),
  // Context based on question type
  context: z.object({
    // For connection-to-struggling questions
    performingItem: z.string().optional(),
    strugglingItem: z.string().optional(),
    
    // For elaboration questions
    itemName: z.string().optional(),
    fields: z.array(z.string()).optional(),
    userAnswer: z.string().optional(),
    evaluation: z.string().optional(),
    
    // For high-level recall questions
    itemsCovered: z.array(z.string()).optional(),
    weakTopics: z.array(z.object({
      topic: z.string(),
      comprehension: z.number(),
    })).optional(),
    strugglingItems: z.array(z.object({
      item: z.string(),
      averageComprehension: z.number(),
    })).optional(),
  }),
  streaming: z.boolean().optional().default(false),
});

type SpecialQuestionRequest = z.infer<typeof specialQuestionSchema>;

/**
 * POST /api/ai/special-questions - Generate special questions for enhanced learning
 */
export const POST = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  const body = await validateRequestBody(request, specialQuestionSchema);
  
  const manager = await getCourseManager();
  
  // Load course and session
  const course = await manager.loadCourse(body.courseId);
  const session = await manager.loadSession(body.courseId, userId);
  
  if (!session) {
    throw new ApiErrorResponse(
      `No active session found for course "${body.courseId}"`,
      404,
      'SESSION_NOT_FOUND'
    );
  }

  // Find the concept
  const concept = course.concepts.find(c => c.name === body.conceptName);
  if (!concept) {
    throw new ApiErrorResponse(
      `Concept "${body.conceptName}" not found in course`,
      404,
      'CONCEPT_NOT_FOUND'
    );
  }

  let question: string;

  try {
    switch (body.questionType) {
      case 'connection-to-struggling':
        if (!body.context.performingItem || !body.context.strugglingItem) {
          throw new ApiErrorResponse(
            'performingItem and strugglingItem are required for connection-to-struggling questions',
            400,
            'MISSING_CONNECTION_CONTEXT'
          );
        }
        
        question = await aiService.generateConnectionToStruggling(
          body.context.performingItem,
          body.context.strugglingItem,
          concept
        );
        break;

      case 'elaboration':
        if (!body.context.itemName || !body.context.fields) {
          throw new ApiErrorResponse(
            'itemName and fields are required for elaboration questions',
            400,
            'MISSING_ELABORATION_CONTEXT'
          );
        }
        
        question = await aiService.generateElaborationQuestion(
          body.context.itemName,
          body.context.fields,
          concept,
          body.context.userAnswer,
          body.context.evaluation
        );
        break;

      case 'high-level-recall':
        if (!body.context.itemsCovered) {
          throw new ApiErrorResponse(
            'itemsCovered is required for high-level recall questions',
            400,
            'MISSING_RECALL_CONTEXT'
          );
        }
        
        question = await aiService.generateHighLevelRecall(
          concept,
          body.context.itemsCovered,
          session.existingUnderstanding,
          body.context.weakTopics,
          body.context.strugglingItems
        );
        break;

      default:
        throw new ApiErrorResponse(
          `Unknown special question type: ${body.questionType}`,
          400,
          'INVALID_QUESTION_TYPE'
        );
    }

    // Update conversation history in session
    session.conversationHistory.push({
      role: 'assistant',
      content: question,
      timestamp: new Date(),
    });
    
    await manager.saveSession(session);

    // Return streaming response if requested
    if (body.streaming) {
      const stream = streamText({
        model: models.fast,
        prompt: question,
      });

      return new NextResponse(stream.toTextStreamResponse().body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Return standard JSON response
    return createSuccessResponse({
      question,
      questionType: body.questionType,
      conceptName: body.conceptName,
      context: body.context,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    throw new ApiErrorResponse(
      `Failed to generate ${body.questionType} special question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'SPECIAL_QUESTION_GENERATION_FAILED'
    );
  }
});

/**
 * POST /api/ai/special-questions/evaluate - Evaluate answers to special questions
 */
export const PUT = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  
  const body = await validateRequestBody(request, z.object({
    courseId: z.string().min(1, 'Course ID is required'),
    question: z.string().min(1, 'Question is required'),
    userAnswer: z.string().min(1, 'User answer is required'),
    questionType: z.enum(['connection-to-struggling', 'elaboration', 'high-level-recall']),
    conceptName: z.string().min(1, 'Concept name is required'),
    context: z.object({
      // For connection-to-struggling evaluation
      performingItem: z.string().optional(),
      strugglingItem: z.string().optional(),
      
      // For elaboration evaluation
      itemName: z.string().optional(),
      
      // For high-level recall evaluation
      itemsCovered: z.array(z.string()).optional(),
      weakTopics: z.array(z.object({
        topic: z.string(),
        comprehension: z.number(),
      })).optional(),
      strugglingItems: z.array(z.object({
        item: z.string(),
        averageComprehension: z.number(),
      })).optional(),
    }),
    streaming: z.boolean().optional().default(false),
  }));
  
  const manager = await getCourseManager();
  
  // Load course and session
  const course = await manager.loadCourse(body.courseId);
  const session = await manager.loadSession(body.courseId, userId);
  
  if (!session) {
    throw new ApiErrorResponse(
      `No active session found for course "${body.courseId}"`,
      404,
      'SESSION_NOT_FOUND'
    );
  }

  // Find the concept
  const concept = course.concepts.find(c => c.name === body.conceptName);
  if (!concept) {
    throw new ApiErrorResponse(
      `Concept "${body.conceptName}" not found in course`,
      404,
      'CONCEPT_NOT_FOUND'
    );
  }

  let evaluationResponse: string;

  try {
    switch (body.questionType) {
      case 'connection-to-struggling':
        if (!body.context.performingItem || !body.context.strugglingItem) {
          throw new ApiErrorResponse(
            'performingItem and strugglingItem are required for connection evaluation',
            400,
            'MISSING_CONNECTION_CONTEXT'
          );
        }
        
        evaluationResponse = await aiService.evaluateConnectionQuestionAnswer(
          body.question,
          body.userAnswer,
          body.context.performingItem,
          body.context.strugglingItem,
          concept
        );
        break;

      case 'elaboration':
        if (!body.context.itemName) {
          throw new ApiErrorResponse(
            'itemName is required for elaboration evaluation',
            400,
            'MISSING_ELABORATION_CONTEXT'
          );
        }
        
        evaluationResponse = await aiService.evaluateElaborationAnswer(
          body.question,
          body.userAnswer,
          body.context.itemName,
          concept
        );
        break;

      case 'high-level-recall':
        if (!body.context.itemsCovered) {
          throw new ApiErrorResponse(
            'itemsCovered is required for high-level recall evaluation',
            400,
            'MISSING_RECALL_CONTEXT'
          );
        }
        
        evaluationResponse = await aiService.evaluateHighLevelAnswer(
          body.question,
          body.userAnswer,
          concept,
          body.context.itemsCovered,
          session.existingUnderstanding,
          body.context.weakTopics,
          body.context.strugglingItems
        );
        break;

      default:
        throw new ApiErrorResponse(
          `Unknown special question type for evaluation: ${body.questionType}`,
          400,
          'INVALID_QUESTION_TYPE'
        );
    }

    // Update conversation history in session
    session.conversationHistory.push(
      {
        role: 'user',
        content: body.userAnswer,
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: evaluationResponse,
        timestamp: new Date(),
      }
    );
    
    await manager.saveSession(session);

    // Return streaming response if requested
    if (body.streaming) {
      const stream = streamText({
        model: models.fast,
        prompt: evaluationResponse,
      });

      return new NextResponse(stream.toTextStreamResponse().body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Return standard JSON response
    return createSuccessResponse({
      response: evaluationResponse,
      questionType: body.questionType,
      conceptName: body.conceptName,
      question: body.question,
      userAnswer: body.userAnswer,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    throw new ApiErrorResponse(
      `Failed to evaluate ${body.questionType} special question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'SPECIAL_QUESTION_EVALUATION_FAILED'
    );
  }
});