import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { AIService } from '../../../../services/ai/index';
import { MongoCourseManager } from '../../../../services/mongoCourseManager';
import { models } from '../../../../config/models';
import {
  withErrorHandling,
  validateRequestBody,
  getUserIdFromRequest,
  ApiErrorResponse,
  createSuccessResponse,
} from '../../../../lib/api-utils';

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
const generateQuestionSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  questionType: z.enum(['high-level', 'concept', 'connection', 'elaboration', 'high-level-recall']),
  conceptName: z.string().optional(),
  itemName: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional().default([]),
  isFirstQuestion: z.boolean().optional().default(false),
  // Context for special questions
  context: z.object({
    performingItem: z.string().optional(),
    strugglingItem: z.string().optional(),
    itemsCovered: z.array(z.string()).optional(),
    weakTopics: z.array(z.object({
      topic: z.string(),
      comprehension: z.number(),
    })).optional(),
    strugglingItems: z.array(z.object({
      item: z.string(),
      averageComprehension: z.number(),
    })).optional(),
    connections: z.array(z.string()).optional(),
    previousQuestions: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    userAnswer: z.string().optional(),
    evaluation: z.string().optional(),
    fields: z.array(z.string()).optional(),
  }).optional().default({}),
  streaming: z.boolean().optional().default(false),
});

type GenerateQuestionRequest = z.infer<typeof generateQuestionSchema>;

/**
 * POST /api/ai/generate-question - Generate questions based on learning phase and context
 */
export const POST = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  const body = await validateRequestBody(request, generateQuestionSchema);
  
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

  // Convert conversation history format
  const conversationHistory = body.conversationHistory.map(entry => ({
    role: entry.role,
    content: entry.content,
  }));

  let question: string;

  try {
    switch (body.questionType) {
      case 'high-level':
        question = await aiService.generateHighLevelQuestion(
          course,
          conversationHistory,
          session.existingUnderstanding,
          body.isFirstQuestion
        );
        break;

      case 'concept':
        if (!body.conceptName) {
          throw new ApiErrorResponse('conceptName is required for concept questions', 400, 'MISSING_CONCEPT');
        }
        const concept = course.concepts.find(c => c.name === body.conceptName);
        if (!concept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        question = await aiService.generateConceptQuestion(
          concept,
          conversationHistory,
          session.existingUnderstanding,
          body.isFirstQuestion
        );
        break;

      case 'connection':
        if (!body.context.connections) {
          throw new ApiErrorResponse('connections context is required for connection questions', 400, 'MISSING_CONNECTIONS');
        }
        question = await aiService.generateConnectionQuestion(
          body.context.connections,
          course,
          body.context.previousQuestions || [],
          session.existingUnderstanding
        );
        break;

      case 'elaboration':
        if (!body.itemName || !body.conceptName || !body.context.fields) {
          throw new ApiErrorResponse('itemName, conceptName, and fields are required for elaboration questions', 400, 'MISSING_ELABORATION_CONTEXT');
        }
        const elaborationConcept = course.concepts.find(c => c.name === body.conceptName);
        if (!elaborationConcept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        question = await aiService.generateElaborationQuestion(
          body.itemName,
          body.context.fields,
          elaborationConcept,
          body.context.userAnswer,
          body.context.evaluation
        );
        break;

      case 'high-level-recall':
        if (!body.conceptName || !body.context.itemsCovered) {
          throw new ApiErrorResponse('conceptName and itemsCovered are required for high-level recall questions', 400, 'MISSING_RECALL_CONTEXT');
        }
        const recallConcept = course.concepts.find(c => c.name === body.conceptName);
        if (!recallConcept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        question = await aiService.generateHighLevelRecall(
          recallConcept,
          body.context.itemsCovered,
          session.existingUnderstanding,
          body.context.weakTopics,
          body.context.strugglingItems
        );
        break;

      default:
        throw new ApiErrorResponse(`Unknown question type: ${body.questionType}`, 400, 'INVALID_QUESTION_TYPE');
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
      itemName: body.itemName,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    throw new ApiErrorResponse(
      `Failed to generate ${body.questionType} question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'QUESTION_GENERATION_FAILED'
    );
  }
});