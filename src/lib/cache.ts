// Redis client interface for cases where ioredis is not available
interface RedisClient {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<"OK">;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): RedisClient;
  exec(): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
  quit(): Promise<string>;
}

// Try to import Redis, fall back to mock if not available
let Redis: any;
try {
  Redis = require("ioredis");
} catch {
  Redis = class MockRedis implements RedisClient {
    async ping() { return "PONG"; }
    async get() { return null; }
    async setex() { return "OK" as const; }
    async del() { return 0; }
    async keys() { return []; }
    async exists() { return 0; }
    async mget() { return []; }
    pipeline() { return this; }
    async exec() { return []; }
    on() {}
    async quit() { return "OK"; }
  };
}

export class CacheService {
  private redis: RedisClient | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      if (this.redis) {
        this.redis.on("connect", () => {
          console.log("Redis connected");
          this.isConnected = true;
        });

        this.redis.on("error", (error: Error) => {
          console.error("Redis error:", error);
          this.isConnected = false;
        });

        this.redis.on("close", () => {
          console.log("Redis connection closed");
          this.isConnected = false;
        });

        // Test connection
        await this.redis.ping();
      }
    } catch (error) {
      console.warn("Redis not available, operating without cache:", error);
      this.redis = null;
      this.isConnected = false;
    }
  }

  private getCacheKey(prefix: string, identifier: string): string {
    return `learning-ai:${prefix}:${identifier}`;
  }

  async get<T>(prefix: string, key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.getCacheKey(prefix, key);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as T;
      }
      
      return null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set<T>(
    prefix: string, 
    key: string, 
    value: T, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey(prefix, key);
      const serialized = JSON.stringify(value);
      await this.redis.setex(cacheKey, ttlSeconds, serialized);
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  async del(prefix: string, key: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey(prefix, key);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      const fullPattern = this.getCacheKey("*", pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  async exists(prefix: string, key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(prefix, key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error("Cache exists check error:", error);
      return false;
    }
  }

  async mget<T>(prefix: string, keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || !this.isConnected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const cacheKeys = keys.map(key => this.getCacheKey(prefix, key));
      const results = await this.redis.mget(...cacheKeys);
      
      return results.map((result: string | null) => {
        if (result) {
          try {
            return JSON.parse(result) as T;
          } catch {
            return null;
          }
        }
        return null;
      });
    } catch (error) {
      console.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  async mset<T>(
    prefix: string, 
    entries: Array<{ key: string; value: T }>, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    if (!this.redis || !this.isConnected || entries.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();
      
      entries.forEach(({ key, value }) => {
        const cacheKey = this.getCacheKey(prefix, key);
        const serialized = JSON.stringify(value);
        pipeline.setex(cacheKey, ttlSeconds, serialized);
      });
      
      await pipeline.exec();
    } catch (error) {
      console.error("Cache mset error:", error);
    }
  }

  async getOrSet<T>(
    prefix: string,
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(prefix, key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch and store
    const value = await fetcher();
    await this.set(prefix, key, value, ttlSeconds);
    return value;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Cache prefixes for different types of data
export const CACHE_PREFIXES = {
  AI_RESPONSES: "ai-responses",
  COURSE_DATA: "courses", 
  SESSION_DATA: "sessions",
  PROGRESS_DATA: "progress",
  USER_COURSES: "user-courses",
  QUESTION_GENERATION: "questions",
  FLASHCARD_EVALUATION: "flashcards",
  SPECIAL_QUESTIONS: "special-questions",
} as const;

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SHORT: 300,       // 5 minutes
  MEDIUM: 3600,     // 1 hour
  LONG: 86400,      // 24 hours
  VERY_LONG: 604800, // 1 week
} as const;

// Singleton cache service instance
export const cacheService = new CacheService();

// Utility function to generate cache keys for AI responses
export function generateAIResponseKey(
  operation: string,
  ...params: (string | number | boolean)[]
): string {
  return `${operation}:${params.join(":")}`;
}

// Utility function to generate course-related cache keys
export function generateCourseKey(courseId: string, operation?: string): string {
  return operation ? `${courseId}:${operation}` : courseId;
}

// Utility function to generate session-related cache keys
export function generateSessionKey(
  userId: string, 
  courseId: string, 
  operation?: string
): string {
  const base = `${userId}:${courseId}`;
  return operation ? `${base}:${operation}` : base;
}

// Cache warming functions
export async function warmUserCache(userId: string): Promise<void> {
  // Implement cache warming logic if needed
  // This would pre-populate commonly accessed data
  console.log(`Warming cache for user: ${userId}`);
}

export async function warmCourseCache(courseId: string): Promise<void> {
  // Implement cache warming logic for course data
  console.log(`Warming cache for course: ${courseId}`);
}