import { Collection, Db, MongoClient, CreateIndexesOptions, Document, IndexSpecification } from "mongodb";
import { cacheService, CACHE_PREFIXES, CACHE_TTL, generateSessionKey, generateCourseKey } from "./cache.js";

export interface QueryOptimizer {
  optimizeQuery<T extends Document>(collectionName: string, query: object, options?: QueryOptimizationOptions): Promise<T[]>;
  createOptimalIndexes(): Promise<void>;
  analyzeQueryPerformance(collectionName: string, query: object): Promise<QueryAnalysis>;
}

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cachePrefix?: string;
  cacheKey?: string;
  cacheTTL?: number;
  maxResults?: number;
  sortBy?: Record<string, 1 | -1>;
  projection?: Record<string, 1 | 0>;
}

export interface QueryAnalysis {
  executionTimeMs: number;
  documentsExamined: number;
  documentsReturned: number;
  indexUsed: boolean;
  indexName?: string;
  recommendations: string[];
}

export class MongoQueryOptimizer implements QueryOptimizer {
  private db: Db;
  private performanceMetrics: Map<string, QueryAnalysis[]> = new Map();

  constructor(db: Db) {
    this.db = db;
  }

  async optimizeQuery<T extends Document>(
    collectionName: string,
    query: object,
    options: QueryOptimizationOptions = {}
  ): Promise<T[]> {
    const {
      useCache = true,
      cachePrefix,
      cacheKey,
      cacheTTL = CACHE_TTL.MEDIUM,
      maxResults = 1000,
      sortBy,
      projection
    } = options;

    // Generate cache key if caching is enabled
    let finalCacheKey: string | null = null;
    if (useCache && cachePrefix && cacheKey) {
      finalCacheKey = cacheKey;
    }

    // Try to get from cache first
    if (finalCacheKey && cachePrefix) {
      const cached = await cacheService.get<T[]>(cachePrefix, finalCacheKey);
      if (cached) {
        return cached;
      }
    }

    // Execute optimized query
    const collection = this.db.collection<T>(collectionName);
    let cursor = collection.find(query);

    // Apply projection if provided
    if (projection) {
      cursor = cursor.project(projection);
    }

    // Apply sorting if provided
    if (sortBy) {
      cursor = cursor.sort(sortBy);
    }

    // Apply limit
    cursor = cursor.limit(maxResults);

    const startTime = Date.now();
    const results = await cursor.toArray() as T[];
    const endTime = Date.now();

    // Store performance metrics
    await this.recordPerformanceMetric(collectionName, query, {
      executionTimeMs: endTime - startTime,
      documentsExamined: results.length, // Simplified - would need explain() for accurate count
      documentsReturned: results.length,
      indexUsed: true, // Simplified - would need explain() for accurate detection
      recommendations: []
    });

    // Cache results if caching is enabled
    if (finalCacheKey && cachePrefix && results.length > 0) {
      await cacheService.set(cachePrefix, finalCacheKey, results, cacheTTL);
    }

    return results;
  }

  async createOptimalIndexes(): Promise<void> {
    const collections = [
      {
        name: "courses",
        indexes: [
          { key: { name: 1 } as IndexSpecification, options: { unique: true } },
          { key: { createdAt: -1 } as IndexSpecification },
          { key: { updatedAt: -1 } as IndexSpecification },
          { key: { "concepts.name": 1 } as IndexSpecification },
          { key: { "concepts.topics": 1 } as IndexSpecification }
        ]
      },
      {
        name: "sessions", 
        indexes: [
          { key: { userId: 1 } as IndexSpecification },
          { key: { courseId: 1 } as IndexSpecification },
          { key: { userId: 1, courseId: 1 } as IndexSpecification, options: { unique: true } },
          { key: { userId: 1, updatedAt: -1 } as IndexSpecification },
          { key: { lastActivityTime: -1 } as IndexSpecification },
          { key: { currentPhase: 1 } as IndexSpecification },
          { key: { currentConcept: 1 } as IndexSpecification },
          // Compound indexes for common query patterns
          { key: { userId: 1, currentPhase: 1 } as IndexSpecification },
          { key: { userId: 1, lastActivityTime: -1 } as IndexSpecification },
          { key: { courseId: 1, currentPhase: 1 } as IndexSpecification }
        ]
      }
    ];

    for (const collectionDef of collections) {
      const collection = this.db.collection(collectionDef.name);
      
      for (const indexDef of collectionDef.indexes) {
        try {
          await collection.createIndex(indexDef.key, indexDef.options || {});
          console.log(`Created index on ${collectionDef.name}:`, indexDef.key);
        } catch (error) {
          // Index might already exist, log but continue
          console.warn(`Index creation warning for ${collectionDef.name}:`, error);
        }
      }
    }
  }

  async analyzeQueryPerformance(
    collectionName: string,
    query: object
  ): Promise<QueryAnalysis> {
    const collection = this.db.collection(collectionName);
    
    try {
      const startTime = Date.now();
      const explanation = await collection.find(query).explain("executionStats");
      const endTime = Date.now();

      const executionStats = explanation.executionStats;
      const analysis: QueryAnalysis = {
        executionTimeMs: endTime - startTime,
        documentsExamined: executionStats.totalDocsExamined || 0,
        documentsReturned: executionStats.totalDocsReturned || 0,
        indexUsed: executionStats.executionSuccess && executionStats.totalDocsExamined < 1000,
        indexName: executionStats.indexName,
        recommendations: []
      };

      // Generate recommendations
      if (analysis.documentsExamined > analysis.documentsReturned * 10) {
        analysis.recommendations.push(
          "Consider adding an index to reduce document examination ratio"
        );
      }

      if (analysis.executionTimeMs > 100) {
        analysis.recommendations.push(
          "Query execution time is high, consider optimization"
        );
      }

      if (!analysis.indexUsed) {
        analysis.recommendations.push(
          "No index was used for this query, consider adding relevant indexes"
        );
      }

      return analysis;
    } catch (error) {
      console.error("Query analysis error:", error);
      return {
        executionTimeMs: 0,
        documentsExamined: 0,
        documentsReturned: 0,
        indexUsed: false,
        recommendations: ["Query analysis failed"]
      };
    }
  }

  private async recordPerformanceMetric(
    collectionName: string,
    query: object,
    analysis: QueryAnalysis
  ): Promise<void> {
    const queryKey = `${collectionName}:${JSON.stringify(query)}`;
    
    if (!this.performanceMetrics.has(queryKey)) {
      this.performanceMetrics.set(queryKey, []);
    }
    
    const metrics = this.performanceMetrics.get(queryKey)!;
    metrics.push(analysis);
    
    // Keep only last 100 metrics per query
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  getPerformanceMetrics(queryKey?: string): Map<string, QueryAnalysis[]> | QueryAnalysis[] | null {
    if (queryKey) {
      return this.performanceMetrics.get(queryKey) || null;
    }
    return this.performanceMetrics;
  }

  async optimizeSessionQueries(userId: string, courseId?: string): Promise<void> {
    const cacheKey = generateSessionKey(userId, courseId || "all");
    
    // Pre-warm session cache
    if (courseId) {
      const sessionQuery = { userId, courseId };
      await this.optimizeQuery("sessions", sessionQuery, {
        useCache: true,
        cachePrefix: CACHE_PREFIXES.SESSION_DATA,
        cacheKey,
        cacheTTL: CACHE_TTL.MEDIUM,
        maxResults: 1
      });
    } else {
      // Cache all user sessions
      const userSessionsQuery = { userId };
      await this.optimizeQuery("sessions", userSessionsQuery, {
        useCache: true,
        cachePrefix: CACHE_PREFIXES.SESSION_DATA,
        cacheKey: `${userId}:all`,
        cacheTTL: CACHE_TTL.SHORT,
        maxResults: 50,
        sortBy: { lastActivityTime: -1 }
      });
    }
  }

  async optimizeCourseQueries(courseId: string): Promise<void> {
    const cacheKey = generateCourseKey(courseId);
    
    // Pre-warm course cache
    const courseQuery = { name: courseId };
    await this.optimizeQuery("courses", courseQuery, {
      useCache: true,
      cachePrefix: CACHE_PREFIXES.COURSE_DATA,
      cacheKey,
      cacheTTL: CACHE_TTL.LONG,
      maxResults: 1
    });
  }

  async batchOptimizeQueries<T extends Document>(
    collectionName: string,
    queries: Array<{ query: object; cacheKey?: string }>,
    options: QueryOptimizationOptions = {}
  ): Promise<T[][]> {
    // Execute queries in parallel for better performance
    const promises = queries.map(({ query, cacheKey }) =>
      this.optimizeQuery<T>(collectionName, query, {
        ...options,
        cacheKey: cacheKey || JSON.stringify(query)
      })
    );

    return Promise.all(promises);
  }
}

// Helper functions for common query patterns
export async function optimizeUserCoursesQuery(
  queryOptimizer: MongoQueryOptimizer,
  userId: string
): Promise<any[]> {
  return queryOptimizer.optimizeQuery("sessions", 
    { userId }, 
    {
      useCache: true,
      cachePrefix: CACHE_PREFIXES.USER_COURSES,
      cacheKey: userId,
      cacheTTL: CACHE_TTL.MEDIUM,
      sortBy: { lastActivityTime: -1 },
      projection: { courseId: 1, currentPhase: 1, lastActivityTime: 1 }
    }
  );
}

export async function optimizeProgressQuery(
  queryOptimizer: MongoQueryOptimizer,
  userId: string,
  courseId: string
): Promise<any[]> {
  return queryOptimizer.optimizeQuery("sessions",
    { userId, courseId },
    {
      useCache: true,
      cachePrefix: CACHE_PREFIXES.PROGRESS_DATA,
      cacheKey: generateSessionKey(userId, courseId, "progress"),
      cacheTTL: CACHE_TTL.SHORT,
      projection: { 
        conceptsProgress: 1, 
        currentPhase: 1, 
        lastActivityTime: 1 
      }
    }
  );
}

export async function optimizeCourseListQuery(
  queryOptimizer: MongoQueryOptimizer
): Promise<any[]> {
  return queryOptimizer.optimizeQuery("courses",
    {},
    {
      useCache: true,
      cachePrefix: CACHE_PREFIXES.COURSE_DATA,
      cacheKey: "all-courses",
      cacheTTL: CACHE_TTL.LONG,
      sortBy: { createdAt: -1 },
      projection: { name: 1, createdAt: 1, updatedAt: 1 }
    }
  );
}

// Lazy loading utilities
export class LazyLoader<T = any> {
  private cache = new Map<string, T>();
  private loadPromises = new Map<string, Promise<T>>();

  async load(key: string, loader: () => Promise<T>): Promise<T> {
    // Return cached value if available
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Return existing promise if loading
    if (this.loadPromises.has(key)) {
      return this.loadPromises.get(key)!;
    }

    // Create new loading promise
    const promise = loader().then(value => {
      this.cache.set(key, value);
      this.loadPromises.delete(key);
      return value;
    }).catch(error => {
      this.loadPromises.delete(key);
      throw error;
    });

    this.loadPromises.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.loadPromises.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.loadPromises.clear();
  }
}

// Virtual scrolling utilities for long lists
export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualScrollResult<T> {
  items: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
}

export function calculateVirtualScroll<T>(
  items: T[],
  scrollTop: number,
  config: VirtualScrollConfig
): VirtualScrollResult<T> {
  const { itemHeight, containerHeight, overscan = 3 } = config;
  const totalHeight = items.length * itemHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleItemCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(
    items.length - 1,
    startIndex + visibleItemCount + overscan * 2
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  
  return {
    items: visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY
  };
}

// Bundle optimization utilities
export function createCodeSplitLoader<T>(
  importFn: () => Promise<{ default: T }>
): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (cached) return cached;
    if (loading) return loading;

    loading = importFn().then(module => {
      cached = module.default;
      loading = null;
      return cached;
    });

    return loading;
  };
}