import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIService } from '../../../../services/ai/index.js';
import { MongoCourseManager } from '../../../../services/mongoCourseManager.js';
import {
  withErrorHandling,
  createSuccessResponse,
  validateRequestBody,
  getUserIdFromRequest,
  requestSchemas,
  ApiErrorResponse,
  ApiTypes,
} from '../../../../lib/api-utils.js';
import { LearningSession, Course, ConceptAttempt, FlashcardAttempt } from '../../../../types/course.js';

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

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * Helper function to calculate session progress
 */
function calculateSessionProgress(session: LearningSession, course: Course): ApiTypes.SessionResponse['progress'] {
  const totalConcepts = course.concepts.length;
  let conceptsCompleted = 0;
  let itemsMastered = 0;
  let totalItems = 0;

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

  const overallCompletion = totalItems > 0 ? (itemsMastered / totalItems) * 100 : 0;

  return {
    conceptsCompleted,
    totalConcepts,
    itemsMastered,
    totalItems,
    overallCompletion: Math.round(overallCompletion * 100) / 100,
  };
}

/**
 * Helper function to convert session to API response format
 */
async function sessionToApiResponse(session: LearningSession, course: Course): Promise<ApiTypes.SessionResponse> {
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
 * Parse session ID to extract courseId and userId
 * Expected format: userId-courseId or just courseId (backwards compatibility)
 */
function parseSessionId(sessionId: string, requestUserId: string): { courseId: string; userId: string } {
  // Check if sessionId contains userId prefix
  if (sessionId.includes('-') && sessionId.startsWith(requestUserId)) {
    const courseId = sessionId.substring(requestUserId.length + 1);
    return { courseId, userId: requestUserId };
  }
  
  // Backwards compatibility: treat sessionId as courseId
  return { courseId: sessionId, userId: requestUserId };
}

/**
 * GET /api/sessions/[id] - Get a specific session
 */
export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const requestUserId = getUserIdFromRequest(request);
  const { id: sessionId } = context.params;

  if (!sessionId) {
    throw new ApiErrorResponse('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  const { courseId, userId } = parseSessionId(sessionId, requestUserId);
  const manager = await getCourseManager();
  
  try {
    const [session, course] = await Promise.all([
      manager.loadSession(courseId, userId),
      manager.loadCourse(courseId)
    ]);

    if (!session) {
      throw new ApiErrorResponse(
        `Session not found for course "${courseId}"`,
        404,
        'SESSION_NOT_FOUND'
      );
    }

    const apiResponse = await sessionToApiResponse(session, course);
    return createSuccessResponse(apiResponse);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(
        `Session or course not found for ID "${sessionId}"`,
        404,
        'NOT_FOUND'
      );
    }
    throw error;
  }
});

/**
 * PUT /api/sessions/[id] - Update a specific session
 */
export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  const requestUserId = getUserIdFromRequest(request);
  const { id: sessionId } = context.params;

  if (!sessionId) {
    throw new ApiErrorResponse('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  const body = await validateRequestBody(request, requestSchemas.updateSession);
  const { courseId, userId } = parseSessionId(sessionId, requestUserId);
  const manager = await getCourseManager();

  try {
    const [session, course] = await Promise.all([
      manager.loadSession(courseId, userId),
      manager.loadCourse(courseId)
    ]);

    if (!session) {
      throw new ApiErrorResponse(
        `Session not found for course "${courseId}"`,
        404,
        'SESSION_NOT_FOUND'
      );
    }

    // Apply updates
    if (body.currentPhase) {
      await manager.updateSessionPhase(
        session,
        body.currentPhase,
        body.currentConcept
      );
    }

    if (body.existingUnderstanding) {
      session.existingUnderstanding = body.existingUnderstanding;
    }

    if (body.timeAvailable) {
      session.timeAvailable = body.timeAvailable;
    }

    await manager.saveSession(session);

    const apiResponse = await sessionToApiResponse(session, course);
    return createSuccessResponse(
      apiResponse,
      `Session "${sessionId}" updated successfully`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(
        `Session or course not found for ID "${sessionId}"`,
        404,
        'NOT_FOUND'
      );
    }
    throw error;
  }
});

/**
 * DELETE /api/sessions/[id] - End a specific session
 */
export const DELETE = withErrorHandling(async (request: Request, context: RouteContext) => {
  const requestUserId = getUserIdFromRequest(request);
  const { id: sessionId } = context.params;

  if (!sessionId) {
    throw new ApiErrorResponse('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  // Note: Since MongoCourseManager doesn't have a deleteSession method,
  // we'll throw an error for now. This needs to be implemented.
  throw new ApiErrorResponse(
    'Session deletion not yet implemented',
    501,
    'NOT_IMPLEMENTED'
  );
});

/**
 * POST /api/sessions/[id]/answers - Submit an answer and get AI response
 */
export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const requestUserId = getUserIdFromRequest(request);
  const { id: sessionId } = context.params;

  if (!sessionId) {
    throw new ApiErrorResponse('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  const body = await validateRequestBody(request, requestSchemas.submitAnswer);
  const { courseId, userId } = parseSessionId(sessionId, requestUserId);
  const manager = await getCourseManager();

  try {
    const [session, course] = await Promise.all([
      manager.loadSession(courseId, userId),
      manager.loadCourse(courseId)
    ]);

    if (!session) {
      throw new ApiErrorResponse(
        `Session not found for course "${courseId}"`,
        404,
        'SESSION_NOT_FOUND'
      );
    }

    let aiResponse: { comprehension?: number; response: string; targetTopic?: string };
    let nextQuestion: string | undefined;
    let phaseComplete = false;
    let suggestPhaseTransition = false;

    // Add user's question and answer to conversation history
    await manager.addConversationEntry(session, 'user', body.answer);

    // Process answer based on current phase
    switch (body.phase) {
      case 'high-level': {
        // High-level Q&A phase
        const scores = await aiService.scoreComprehension(
          body.answer,
          course.concepts.flatMap(c => c['high-level']),
          session.conversationHistory.slice(-10),
          session.existingUnderstanding,
          'high-level'
        );

        const response = await aiService.generateHighLevelResponse(
          body.answer,
          course,
          session.conversationHistory.slice(-10),
          session.existingUnderstanding
        );

        aiResponse = {
          response,
          comprehension: Math.max(...scores.map(s => s.comprehension)),
        };

        // Check if ready to move to concept learning
        const avgComprehension = scores.reduce((sum, s) => sum + s.comprehension, 0) / scores.length;
        if (avgComprehension >= 3.5) {
          suggestPhaseTransition = true;
        }
        break;
      }

      case 'concept-learning': {
        if (!body.conceptName) {
          throw new ApiErrorResponse('Concept name required for concept learning phase', 400);
        }

        const concept = course.concepts.find(c => c.name === body.conceptName);
        if (!concept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found`, 400);
        }

        const evaluation = await aiService.evaluateConceptAnswer(
          body.answer,
          concept,
          session.conversationHistory.slice(-10),
          manager.getUnmasteredTopics(session, body.conceptName, concept['high-level']),
          session.existingUnderstanding
        );

        // Update topic progress
        const attempt: ConceptAttempt = {
          question: body.question,
          userAnswer: body.answer,
          aiResponse: evaluation,
          timestamp: new Date(),
        };

        await manager.updateConceptTopicProgress(session, body.conceptName, attempt);

        aiResponse = {
          response: evaluation.response,
          comprehension: evaluation.comprehension,
          targetTopic: evaluation.targetTopic,
        };

        // Check if all topics are mastered
        const unmasteredTopics = manager.getUnmasteredTopics(
          session,
          body.conceptName,
          concept['high-level']
        );
        if (unmasteredTopics.length === 0) {
          suggestPhaseTransition = true;
        }
        break;
      }

      case 'memorization': {
        if (!body.conceptName || !body.itemName) {
          throw new ApiErrorResponse('Concept name and item name required for memorization phase', 400);
        }

        const concept = course.concepts.find(c => c.name === body.conceptName);
        if (!concept) {
          throw new ApiErrorResponse(`Concept "${body.conceptName}" not found`, 400);
        }

        if (!concept.memorize.items.includes(body.itemName)) {
          throw new ApiErrorResponse(`Item "${body.itemName}" not found in concept`, 400);
        }

        const evaluation = await aiService.evaluateFlashcardAnswer(
          body.itemName,
          concept.memorize.fields,
          body.answer,
          concept,
          course.concepts.map(c => c.name),
          [], // previous attempts - could be loaded from session
          session.existingUnderstanding
        );

        // Update item progress
        const attempt = {
          question: body.question,
          userAnswer: body.answer,
          aiResponse: evaluation,
        };

        await manager.updateItemProgress(session, body.conceptName, body.itemName, attempt);

        aiResponse = {
          response: evaluation.response,
          comprehension: evaluation.comprehension,
        };

        // Check if all items in concept are mastered
        const unmasteredItems = manager.getUnmasteredItems(session, body.conceptName);
        if (unmasteredItems.length === 0) {
          phaseComplete = true;
        }
        break;
      }

      case 'drawing-connections': {
        const evaluation = await aiService.evaluateConnectionAnswer(
          body.question,
          body.answer,
          course,
          session.existingUnderstanding
        );

        aiResponse = {
          response: evaluation.response,
        };

        if (evaluation.followUp) {
          nextQuestion = evaluation.followUp;
        }
        break;
      }

      default:
        throw new ApiErrorResponse(`Unsupported phase: ${body.phase}`, 400);
    }

    // Add AI response to conversation history
    await manager.addConversationEntry(session, 'assistant', aiResponse.response);

    const response: ApiTypes.SubmitAnswerResponse = {
      aiResponse,
      nextQuestion,
      phaseComplete,
      suggestPhaseTransition,
    };

    return createSuccessResponse(response, 'Answer processed successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiErrorResponse(
        `Session or course not found for ID "${sessionId}"`,
        404,
        'NOT_FOUND'
      );
    }
    throw error;
  }
});