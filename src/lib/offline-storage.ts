import { Course, LearningSession } from '../types/course';

export interface OfflineProgressUpdate {
  id: string;
  timestamp: number;
  userId: string;
  courseId: string;
  data: {
    conceptName: string;
    itemName?: string;
    attempt: {
      question: string;
      userAnswer: string;
      aiResponse: { comprehension: number; response: string };
    };
    scheduling?: {
      easeFactor: number;
      interval: number;
      nextDuePosition: number;
      successCount: number;
    };
  };
  synced: boolean;
}

export interface OfflineSessionUpdate {
  id: string;
  timestamp: number;
  userId: string;
  courseId: string;
  data: Partial<LearningSession>;
  synced: boolean;
}

export interface OfflineCourse extends Course {
  cachedAt: number;
  lastAccessed: number;
}

export interface OfflineSession extends LearningSession {
  cachedAt: number;
  lastAccessed: number;
}

export class OfflineStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'learning-ai-offline';
  private readonly version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Courses store
        if (!db.objectStoreNames.contains('courses')) {
          const coursesStore = db.createObjectStore('courses', { keyPath: 'name' });
          coursesStore.createIndex('cachedAt', 'cachedAt');
          coursesStore.createIndex('lastAccessed', 'lastAccessed');
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('userId', 'userId');
          sessionsStore.createIndex('courseId', 'courseId');
          sessionsStore.createIndex('userCourse', ['userId', 'courseId'], { unique: true });
          sessionsStore.createIndex('cachedAt', 'cachedAt');
          sessionsStore.createIndex('lastAccessed', 'lastAccessed');
        }

        // Progress updates store (for background sync)
        if (!db.objectStoreNames.contains('progressUpdates')) {
          const progressStore = db.createObjectStore('progressUpdates', { keyPath: 'id' });
          progressStore.createIndex('userId', 'userId');
          progressStore.createIndex('courseId', 'courseId');
          progressStore.createIndex('timestamp', 'timestamp');
          progressStore.createIndex('synced', 'synced');
        }

        // Session updates store (for background sync)
        if (!db.objectStoreNames.contains('sessionUpdates')) {
          const sessionUpdatesStore = db.createObjectStore('sessionUpdates', { keyPath: 'id' });
          sessionUpdatesStore.createIndex('userId', 'userId');
          sessionUpdatesStore.createIndex('courseId', 'courseId');
          sessionUpdatesStore.createIndex('timestamp', 'timestamp');
          sessionUpdatesStore.createIndex('synced', 'synced');
        }

        // Cache metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private ensureDb(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  // Course Management
  async saveCourse(course: Course): Promise<void> {
    this.ensureDb();
    
    const offlineCourse: OfflineCourse = {
      ...course,
      cachedAt: Date.now(),
      lastAccessed: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['courses'], 'readwrite');
      const store = transaction.objectStore('courses');
      
      const request = store.put(offlineCourse);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save course'));
    });
  }

  async getCourse(courseName: string): Promise<OfflineCourse | null> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['courses'], 'readonly');
      const store = transaction.objectStore('courses');
      
      const request = store.get(courseName);
      
      request.onsuccess = () => {
        const course = request.result;
        if (course) {
          // Update last accessed time
          course.lastAccessed = Date.now();
          const updateTransaction = this.db!.transaction(['courses'], 'readwrite');
          updateTransaction.objectStore('courses').put(course);
        }
        resolve(course || null);
      };
      
      request.onerror = () => reject(new Error('Failed to get course'));
    });
  }

  async getCachedCourses(): Promise<OfflineCourse[]> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['courses'], 'readonly');
      const store = transaction.objectStore('courses');
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get cached courses'));
    });
  }

  // Session Management
  async saveSession(session: LearningSession): Promise<void> {
    this.ensureDb();

    const sessionId = `${session.userId}-${session.courseId}`;
    const offlineSession: OfflineSession = {
      ...session,
      cachedAt: Date.now(),
      lastAccessed: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const request = store.put({ ...offlineSession, id: sessionId });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save session'));
    });
  }

  async getSession(userId: string, courseId: string): Promise<OfflineSession | null> {
    this.ensureDb();

    const sessionId = `${userId}-${courseId}`;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      
      const request = store.get(sessionId);
      
      request.onsuccess = () => {
        const session = request.result;
        if (session) {
          // Update last accessed time
          session.lastAccessed = Date.now();
          const updateTransaction = this.db!.transaction(['sessions'], 'readwrite');
          updateTransaction.objectStore('sessions').put(session);
        }
        resolve(session || null);
      };
      
      request.onerror = () => reject(new Error('Failed to get session'));
    });
  }

  async getUserSessions(userId: string): Promise<OfflineSession[]> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get user sessions'));
    });
  }

  // Progress Updates for Background Sync
  async addProgressUpdate(update: Omit<OfflineProgressUpdate, 'id' | 'timestamp' | 'synced'>): Promise<string> {
    this.ensureDb();

    const progressUpdate: OfflineProgressUpdate = {
      ...update,
      id: `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['progressUpdates'], 'readwrite');
      const store = transaction.objectStore('progressUpdates');
      
      const request = store.add(progressUpdate);
      
      request.onsuccess = () => resolve(progressUpdate.id);
      request.onerror = () => reject(new Error('Failed to add progress update'));
    });
  }

  async getPendingProgressUpdates(): Promise<OfflineProgressUpdate[]> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['progressUpdates'], 'readonly');
      const store = transaction.objectStore('progressUpdates');
      const index = store.index('synced');
      
      const request = index.getAll(IDBKeyRange.only(false));
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get pending progress updates'));
    });
  }

  async markProgressUpdateSynced(updateId: string): Promise<void> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['progressUpdates'], 'readwrite');
      const store = transaction.objectStore('progressUpdates');
      
      const getRequest = store.get(updateId);
      
      getRequest.onsuccess = () => {
        const update = getRequest.result;
        if (update) {
          update.synced = true;
          const putRequest = store.put(update);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('Failed to mark progress update as synced'));
        } else {
          resolve(); // Update not found, assume it's already processed
        }
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get progress update'));
    });
  }

  // Session Updates for Background Sync
  async addSessionUpdate(update: Omit<OfflineSessionUpdate, 'id' | 'timestamp' | 'synced'>): Promise<string> {
    this.ensureDb();

    const sessionUpdate: OfflineSessionUpdate = {
      ...update,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessionUpdates'], 'readwrite');
      const store = transaction.objectStore('sessionUpdates');
      
      const request = store.add(sessionUpdate);
      
      request.onsuccess = () => resolve(sessionUpdate.id);
      request.onerror = () => reject(new Error('Failed to add session update'));
    });
  }

  async getPendingSessionUpdates(): Promise<OfflineSessionUpdate[]> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessionUpdates'], 'readonly');
      const store = transaction.objectStore('sessionUpdates');
      const index = store.index('synced');
      
      const request = index.getAll(IDBKeyRange.only(false));
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get pending session updates'));
    });
  }

  async markSessionUpdateSynced(updateId: string): Promise<void> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessionUpdates'], 'readwrite');
      const store = transaction.objectStore('sessionUpdates');
      
      const getRequest = store.get(updateId);
      
      getRequest.onsuccess = () => {
        const update = getRequest.result;
        if (update) {
          update.synced = true;
          const putRequest = store.put(update);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('Failed to mark session update as synced'));
        } else {
          resolve(); // Update not found, assume it's already processed
        }
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get session update'));
    });
  }

  // Cache Management
  async getCacheSize(): Promise<number> {
    this.ensureDb();

    let totalSize = 0;
    const stores = ['courses', 'sessions', 'progressUpdates', 'sessionUpdates'];

    for (const storeName of stores) {
      const count = await this.getStoreCount(storeName);
      totalSize += count;
    }

    return totalSize;
  }

  private async getStoreCount(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count ${storeName}`));
    });
  }

  async clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    this.ensureDb();

    const cutoffTime = Date.now() - maxAge;
    const stores = ['courses', 'sessions'];

    for (const storeName of stores) {
      await this.clearOldStoreEntries(storeName, cutoffTime);
    }
  }

  private async clearOldStoreEntries(storeName: string, cutoffTime: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('lastAccessed');
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error(`Failed to clear old ${storeName} entries`));
    });
  }

  async clearAllData(): Promise<void> {
    this.ensureDb();

    const stores = ['courses', 'sessions', 'progressUpdates', 'sessionUpdates', 'metadata'];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      
      let completedStores = 0;
      const totalStores = stores.length;

      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completedStores++;
          if (completedStores === totalStores) {
            resolve();
          }
        };
        
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
      });
    });
  }

  // Background Sync Registration
  async registerBackgroundSync(tag: string): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await (registration as any).sync.register(tag);
        console.log(`Background sync registered: ${tag}`);
      } catch (error) {
        console.error(`Background sync registration failed: ${tag}`, error);
      }
    }
  }

  // Metadata Management
  async setMetadata(key: string, value: any): Promise<void> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      
      const request = store.put({ key, value, timestamp: Date.now() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to set metadata'));
    });
  }

  async getMetadata(key: string): Promise<any> {
    this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      
      request.onerror = () => reject(new Error('Failed to get metadata'));
    });
  }

  // Utility Methods
  isOnline(): boolean {
    return navigator.onLine;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}