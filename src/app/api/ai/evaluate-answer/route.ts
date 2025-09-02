import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { AIService } from '../../../../services/ai/index.js';
import { MongoCourseManager } from '../../../../services/mongoCourseManager.js';
import { models } from '../../../../config/models.js';
import {
  withErrorHandling,
  validateRequestBody,
  getUserIdFromRequest,
  ApiErrorResponse,
  createSuccessResponse,
} from '../../../../lib/api-utils.js';

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
const evaluateAnswerSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  question: z.string().min(1, 'Question is required'),
  userAnswer: z.string().min(1, 'User answer is required'),
  evaluationType: z.enum(['high-level', 'concept', 'flashcard', 'connection', 'elaboration', 'high-level-recall']),
  conceptName: z.string().optional(),
  itemName: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional().default([]),
  // Context for different evaluation types
  context: z.object({
    topics: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
    unmasteredTopics: z.array(z.string()).optional(),
    otherConcepts: z.array(z.string()).optional(),
    previousAttempts: z.array(z.object({
      userAnswer: z.string(),
      aiResponse: z.string(),
    })).optional(),
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
  }).optional().default({}),
  updateProgress: z.boolean().optional().default(true),
  streaming: z.boolean().optional().default(false),
});

type EvaluateAnswerRequest = z.infer<typeof evaluateAnswerSchema>;

/**
 * POST /api/ai/evaluate-answer - Evaluate user answers and provide responses with comprehension scoring
 */
export const POST = withErrorHandling(async (request: Request): Promise<NextResponse> => {
  const userId = getUserIdFromRequest(request);
  const body = await validateRequestBody(request, evaluateAnswerSchema);
  
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

  let evaluationResult: {
    comprehension?: number;
    response: string;
    targetTopic?: string;
    followUp?: string | null;
  };

  try {
    switch (body.evaluationType) {
      case 'high-level':
        // Get comprehension progress from concept progress for scoring context
        const comprehensionProgress = new Map<string, number>();
        for (const [conceptName, conceptProgress] of session.conceptsProgress.entries()) {
          for (const [topicName, topicProgress] of conceptProgress.topicProgress.entries()) {
            comprehensionProgress.set(topicName, topicProgress.currentComprehension);
          }
        }
        const response = await aiService.generateHighLevelResponse(
          body.userAnswer,
          course,
          conversationHistory,
          session.existingUnderstanding,
          comprehensionProgress
        );
        
        // Score comprehension for high-level topics
        const topics = body.context.topics || course.concepts.flatMap(c => c['high-level']);
        const comprehensionScores = await aiService.scoreComprehension(
          body.userAnswer,
          topics,
          conversationHistory,
          session.existingUnderstanding,
          'high-level'
        );

        evaluationResult = {
          response,
          comprehension: comprehensionScores.length > 0 ? Math.max(...comprehensionScores.map(s => s.comprehension)) : 3,
          targetTopic: comprehensionScores.length > 0 ? comprehensionScores[0].topic : undefined,
        };
        break;

      case 'concept':
        if (!body.conceptName) {
          throw new ApiErrorResponse('conceptName is required for concept evaluation', 400, 'MISSING_CONCEPT');
        }
        const concept = course.concepts.find(c => c.name === body.conceptName);
        if (!concept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        
        const conceptEvaluation = await aiService.evaluateConceptAnswer(
          body.userAnswer,
          concept,
          conversationHistory,
          body.context.unmasteredTopics,
          session.existingUnderstanding
        );
        
        evaluationResult = {
          comprehension: conceptEvaluation.comprehension,
          response: conceptEvaluation.response,
          targetTopic: conceptEvaluation.targetTopic,
        };
        break;

      case 'flashcard':
        if (!body.itemName || !body.conceptName || !body.context.fields) {
          throw new ApiErrorResponse('itemName, conceptName, and fields are required for flashcard evaluation', 400, 'MISSING_FLASHCARD_CONTEXT');
        }
        const flashcardConcept = course.concepts.find(c => c.name === body.conceptName);
        if (!flashcardConcept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        
        const flashcardEvaluation = await aiService.evaluateFlashcardAnswer(
          body.itemName,
          body.context.fields,
          body.userAnswer,
          flashcardConcept,
          body.context.otherConcepts || [],
          body.context.previousAttempts || [],
          session.existingUnderstanding
        );
        
        evaluationResult = {
          comprehension: flashcardEvaluation.comprehension,
          response: flashcardEvaluation.response,
        };
        break;

      case 'connection':
        const connectionEvaluation = await aiService.evaluateConnectionAnswer(
          body.question,
          body.userAnswer,
          course,
          session.existingUnderstanding
        );
        
        evaluationResult = {
          response: connectionEvaluation.response,
          followUp: connectionEvaluation.followUp,
          comprehension: 4, // Default good comprehension for connection answers
        };
        break;

      case 'elaboration':
        if (!body.itemName || !body.conceptName) {
          throw new ApiErrorResponse('itemName and conceptName are required for elaboration evaluation', 400, 'MISSING_ELABORATION_CONTEXT');
        }
        const elaborationConcept = course.concepts.find(c => c.name === body.conceptName);
        if (!elaborationConcept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        
        const elaborationResponse = await aiService.evaluateElaborationAnswer(
          body.question,
          body.userAnswer,
          body.itemName,
          elaborationConcept
        );
        
        evaluationResult = {
          response: elaborationResponse,
          comprehension: 4, // Default good comprehension for elaboration answers
        };
        break;

      case 'high-level-recall':
        if (!body.conceptName || !body.context.itemsCovered) {
          throw new ApiErrorResponse('conceptName and itemsCovered are required for high-level recall evaluation', 400, 'MISSING_RECALL_CONTEXT');
        }
        const recallConcept = course.concepts.find(c => c.name === body.conceptName);
        if (!recallConcept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found in course`, 404, 'CONCEPT_NOT_FOUND');
        }
        
        const recallResponse = await aiService.evaluateHighLevelAnswer(
          body.question,
          body.userAnswer,
          recallConcept,
          body.context.itemsCovered,
          session.existingUnderstanding,
          body.context.weakTopics,
          body.context.strugglingItems
        );
        
        evaluationResult = {
          response: recallResponse,
          comprehension: 4, // Default good comprehension for high-level recall
        };
        break;

      default:
        throw new ApiErrorResponse(`Unknown evaluation type: ${body.evaluationType}`, 400, 'INVALID_EVALUATION_TYPE');
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
        content: evaluationResult.response,
        timestamp: new Date(),
      }
    );

    // Update progress if requested
    if (body.updateProgress && evaluationResult.comprehension !== undefined && body.conceptName) {
      if (body.evaluationType === 'flashcard' && body.itemName) {
        // Update item progress for flashcards
        await manager.updateItemProgress(
          session,
          body.conceptName,
          body.itemName,
          {
            question: body.question,
            userAnswer: body.userAnswer,
            aiResponse: {
              comprehension: evaluationResult.comprehension,
              response: evaluationResult.response,
            },
          }
        );
      } else if (evaluationResult.targetTopic) {
        // Update comprehension progress for topic-based evaluations
        // Update topic progress in concept progress
        const conceptProgress = session.conceptsProgress.get(body.conceptName!);
        if (conceptProgress && evaluationResult.targetTopic) {
          const topicProgress = conceptProgress.topicProgress.get(evaluationResult.targetTopic);
          if (topicProgress) {
            const newScore = Math.max(topicProgress.currentComprehension, evaluationResult.comprehension);
            topicProgress.currentComprehension = newScore;
          } else {
            conceptProgress.topicProgress.set(evaluationResult.targetTopic, {
              topicName: evaluationResult.targetTopic,
              currentComprehension: evaluationResult.comprehension,
              attempts: [],
            });
          }
        }
      }
    }
    
    await manager.saveSession(session);

    // Return streaming response if requested
    if (body.streaming) {
      const stream = streamText({
        model: models.fast,
        prompt: evaluationResult.response,
      });

      return new NextResponse(stream.toTextStreamResponse().body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Return standard JSON response
    return createSuccessResponse({
      comprehension: evaluationResult.comprehension,
      response: evaluationResult.response,
      targetTopic: evaluationResult.targetTopic,
      followUp: evaluationResult.followUp,
      evaluationType: body.evaluationType,
      conceptName: body.conceptName,
      itemName: body.itemName,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    throw new ApiErrorResponse(
      `Failed to evaluate ${body.evaluationType} answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'ANSWER_EVALUATION_FAILED'
    );
  }
});