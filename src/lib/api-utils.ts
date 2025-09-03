import { NextResponse } from 'next/server';
import { ZodSchema, z } from 'zod';
import { cacheService, CACHE_PREFIXES, CACHE_TTL } from './cache';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class ApiErrorResponse extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CacheOptions {
  prefix: string;
  key: string;
  ttl?: number;
  maxAge?: number;
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
}

export interface CacheHeaders {
  'Cache-Control': string;
  'ETag'?: string;
  'Last-Modified'?: string;
  'Vary'?: string;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200,
  cacheOptions?: CacheOptions
): NextResponse<ApiResponse<T>> {
  const headers: HeadersInit = {};
  
  if (cacheOptions) {
    const cacheHeaders = generateCacheHeaders(cacheOptions);
    Object.assign(headers, cacheHeaders as unknown as Record<string, string>);
  }

  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status, headers }
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  code?: string
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status }
  );
}

/**
 * Handles API errors with proper status codes and messages
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  if (error instanceof ApiErrorResponse) {
    return createErrorResponse(error.message, error.status, error.code);
  }

  if (error instanceof z.ZodError) {
    const message = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
    return createErrorResponse(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }

  if (error instanceof Error) {
    // Known error types
    if (error.message.includes('not found')) {
      return createErrorResponse(error.message, 404, 'NOT_FOUND');
    }
    
    if (error.message.includes('already exists')) {
      return createErrorResponse(error.message, 409, 'CONFLICT');
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return createErrorResponse(error.message, 403, 'FORBIDDEN');
    }

    return createErrorResponse(error.message, 500, 'INTERNAL_ERROR');
  }

  return createErrorResponse('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let body: any;
  try {
    body = await request.json();
    console.log('Request body before validation:', JSON.stringify(body, null, 2));
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('Validation failed for body:', JSON.stringify(body, null, 2));
      throw error;
    }
    throw new ApiErrorResponse('Invalid JSON in request body', 400, 'INVALID_JSON');
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T {
  const params: Record<string, string | string[]> = {};
  
  searchParams.forEach((value, key) => {
    if (params[key]) {
      // Handle multiple values for same key
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });

  return schema.parse(params);
}

/**
 * Extracts user ID from request headers or throws error
 */
export function getUserIdFromRequest(request: Request): string {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    throw new ApiErrorResponse('Authentication required. Please sign in to continue.', 401, 'UNAUTHORIZED');
  }
  return userId;
}

/**
 * Generates cache headers based on cache options
 */
export function generateCacheHeaders(options: CacheOptions): CacheHeaders {
  const {
    maxAge = 3600,
    staleWhileRevalidate = 86400,
    mustRevalidate = false
  } = options;

  let cacheControl = `public, max-age=${maxAge}`;
  
  if (staleWhileRevalidate) {
    cacheControl += `, stale-while-revalidate=${staleWhileRevalidate}`;
  }
  
  if (mustRevalidate) {
    cacheControl += ', must-revalidate';
  }

  const headers: CacheHeaders = {
    'Cache-Control': cacheControl,
    'Vary': 'Accept-Encoding, Authorization',
  };

  // Generate ETag based on cache key
  if (options.key) {
    const etag = `"${Buffer.from(options.key).toString('base64').slice(0, 16)}"`;
    headers.ETag = etag;
  }

  return headers;
}

/**
 * Checks if request can be served from cache and returns cached response if available
 */
export async function tryServeFromCache<T>(
  request: Request,
  cacheOptions: CacheOptions
): Promise<NextResponse<ApiResponse<T>> | null> {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const cached = await cacheService.get<T>(cacheOptions.prefix, cacheOptions.key);
  
  if (cached) {
    const headers = generateCacheHeaders(cacheOptions);
    
    // Check ETag for conditional requests
    if (ifNoneMatch && headers.ETag && ifNoneMatch === headers.ETag) {
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'Cache-Control': headers['Cache-Control'],
          'ETag': headers.ETag,
        }
      });
    }
    
    return NextResponse.json(
      {
        success: true,
        data: cached,
      },
      { 
        status: 200,
        headers: headers as unknown as HeadersInit
      }
    );
  }
  
  return null;
}

/**
 * Cache-aware wrapper for API handlers
 */
export function withCaching<T = any>(
  handler: (request: Request, context: T) => Promise<NextResponse>,
  getCacheOptions: (request: Request, context: T) => Promise<CacheOptions | null> | CacheOptions | null
) {
  return async (request: Request, context: T): Promise<NextResponse> => {
    const cacheOptions = await Promise.resolve(getCacheOptions(request, context));
    
    // Try to serve from cache for GET requests
    if (request.method === 'GET' && cacheOptions) {
      const cachedResponse = await tryServeFromCache(request, cacheOptions);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Execute handler
    const response = await handler(request, context);
    
    // Cache successful GET responses
    if (
      request.method === 'GET' && 
      cacheOptions && 
      response.status === 200
    ) {
      const responseData = await response.clone().json();
      if (responseData.success && responseData.data) {
        await cacheService.set(
          cacheOptions.prefix,
          cacheOptions.key,
          responseData.data,
          cacheOptions.ttl || CACHE_TTL.MEDIUM
        );
      }
    }
    
    return response;
  };
}

/**
 * Middleware wrapper for API route handlers with error handling
 */
export function withErrorHandling<T = any>(
  handler: (request: Request, context: T) => Promise<NextResponse>
): (request: Request, context: T) => Promise<NextResponse>;
export function withErrorHandling(
  handler: (request: Request) => Promise<NextResponse>
): (request: Request) => Promise<NextResponse>;
export function withErrorHandling<T = any>(
  handler: (request: Request, context?: T) => Promise<NextResponse>
) {
  return async (request: Request, context?: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Common validation schemas for API requests
 */
export const commonSchemas = {
  // User ID validation
  userId: z.string().min(1, 'User ID is required'),
  
  // Course name validation
  courseName: z.string().min(1, 'Course name is required').max(100, 'Course name too long'),
  
  // Session ID validation
  sessionId: z.string().min(1, 'Session ID is required'),
  
  // Pagination parameters
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  }),

  // Learning phases
  learningPhase: z.enum(['initialization', 'high-level', 'concept-learning', 'memorization', 'drawing-connections']),
};

/**
 * Request/Response type definitions for API endpoints
 */
export namespace ApiTypes {
  // Course-related types
  export interface CreateCourseRequest {
    name: string;
    topic: string;
    documentContent?: string;
    timeAvailable: string;
    existingUnderstanding: string;
    learningGoals: string;
  }

  export interface UpdateCourseRequest {
    name?: string;
    backgroundKnowledge?: string[];
    concepts?: Array<{
      name: string;
      'high-level': string[];
      memorize: {
        fields: string[];
        items: string[];
      };
    }>;
    'drawing-connections'?: string[];
  }

  export interface CourseListResponse {
    courses: Array<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }

  // Session-related types
  export interface CreateSessionRequest {
    courseId: string;
    existingUnderstanding?: string;
    timeAvailable?: string;
  }

  export interface UpdateSessionRequest {
    currentPhase?: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections';
    currentConcept?: string;
    existingUnderstanding?: string;
    timeAvailable?: string;
  }

  export interface SessionResponse {
    userId: string;
    courseId: string;
    currentPhase: string;
    currentConcept?: string;
    startTime: string;
    lastActivityTime: string;
    existingUnderstanding: string;
    timeAvailable: string;
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    progress: {
      conceptsCompleted: number;
      totalConcepts: number;
      itemsMastered: number;
      totalItems: number;
      overallCompletion: number;
    };
  }

  export interface ProgressUpdateRequest {
    conceptName: string;
    itemName?: string;
    attempt: {
      question: string;
      userAnswer: string;
      aiResponse: {
        comprehension: number;
        response: string;
        targetTopic?: string;
      };
    };
  }

  // Learning interaction types
  export interface SubmitAnswerRequest {
    question: string;
    answer: string;
    phase: string;
    conceptName?: string;
    itemName?: string;
  }

  export interface SubmitAnswerResponse {
    aiResponse: {
      comprehension?: number;
      response: string;
      targetTopic?: string;
    };
    nextQuestion?: string;
    phaseComplete?: boolean;
    suggestPhaseTransition?: boolean;
  }

  // Error types
  export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
  }
}

/**
 * Validation schemas for API requests
 */
export const requestSchemas = {
  createCourse: z.object({
    name: commonSchemas.courseName.optional(),
    topic: z.string().min(1, 'Topic is required'),
    documentContent: z.string().optional(),
    timeAvailable: z.string().min(1, 'Time available is required'),
    existingUnderstanding: z.string().min(1, 'Existing understanding is required'),
    learningGoals: z.string().min(1, 'Learning goals are required'),
  }),

  updateCourse: z.object({
    name: z.string().optional(),
    backgroundKnowledge: z.array(z.string()).optional(),
    concepts: z.array(z.object({
      name: z.string(),
      'high-level': z.array(z.string()),
      memorize: z.object({
        fields: z.array(z.string()),
        items: z.array(z.string()),
      }),
    })).optional(),
    'drawing-connections': z.array(z.string()).optional(),
  }),

  createSession: z.object({
    courseId: z.string().min(1, 'Course ID is required'),
    existingUnderstanding: z.string().optional(),
    timeAvailable: z.string().optional(),
  }),

  updateSession: z.object({
    currentPhase: commonSchemas.learningPhase.optional(),
    currentConcept: z.string().optional(),
    existingUnderstanding: z.string().optional(),
    timeAvailable: z.string().optional(),
  }),

  submitAnswer: z.object({
    question: z.string().min(1, 'Question is required'),
    answer: z.string().min(1, 'Answer is required'),
    phase: commonSchemas.learningPhase,
    conceptName: z.string().optional(),
    itemName: z.string().optional(),
  }),

  progressUpdate: z.object({
    conceptName: z.string().min(1, 'Concept name is required'),
    itemName: z.string().optional(),
    attempt: z.object({
      question: z.string(),
      userAnswer: z.string(),
      aiResponse: z.object({
        comprehension: z.number().min(0).max(5),
        response: z.string(),
        targetTopic: z.string().optional(),
      }),
    }),
  }),
};