'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { OfflineStorage } from '../lib/offline-storage.js';

export interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
  pendingSyncCount: number;
  cacheSize: number;
}

export interface OfflineActions {
  syncData: () => Promise<void>;
  clearCache: () => Promise<void>;
  registerBackgroundSync: (tag: string) => Promise<void>;
  getCacheSize: () => Promise<number>;
}

export function useOffline(): OfflineStatus & OfflineActions {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  const [lastOffline, setLastOffline] = useState<Date | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [cacheSize, setCacheSize] = useState<number>(0);
  
  const storageRef = useRef<OfflineStorage | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize offline storage
  useEffect(() => {
    const initStorage = async () => {
      try {
        storageRef.current = new OfflineStorage();
        await storageRef.current.init();
        
        // Get initial cache size and pending sync count
        await updateCacheInfo();
      } catch (error) {
        console.error('Failed to initialize offline storage:', error);
      }
    };

    initStorage();

    return () => {
      if (storageRef.current) {
        storageRef.current.close();
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Update cache information
  const updateCacheInfo = useCallback(async () => {
    if (!storageRef.current) return;

    try {
      const [pendingProgress, pendingSessions, size] = await Promise.all([
        storageRef.current.getPendingProgressUpdates(),
        storageRef.current.getPendingSessionUpdates(),
        storageRef.current.getCacheSize()
      ]);

      setPendingSyncCount(pendingProgress.length + pendingSessions.length);
      setCacheSize(size);
    } catch (error) {
      console.error('Failed to update cache info:', error);
    }
  }, []);

  // Handle online status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnline(new Date());
      console.log('🟢 Connection restored');
      
      // Automatically sync when coming back online
      if (pendingSyncCount > 0) {
        syncTimeoutRef.current = setTimeout(() => {
          syncData();
        }, 1000); // Small delay to ensure connection is stable
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOffline(new Date());
      console.log('🔴 Connection lost - offline mode activated');
    };

    // Set initial state
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      setLastOnline(new Date());
    } else {
      setLastOffline(new Date());
    }

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSyncCount]);

  // Sync data when online
  const syncData = useCallback(async () => {
    if (!isOnline || !storageRef.current) {
      console.log('⚠️ Cannot sync: offline or storage not available');
      return;
    }

    try {
      console.log('🔄 Starting data sync...');
      
      // Register background sync for both progress and session updates
      await Promise.all([
        storageRef.current.registerBackgroundSync('progress-sync'),
        storageRef.current.registerBackgroundSync('session-sync')
      ]);

      // Update cache information
      await updateCacheInfo();
      
      console.log('✅ Data sync completed');
    } catch (error) {
      console.error('❌ Data sync failed:', error);
      throw error;
    }
  }, [isOnline, updateCacheInfo]);

  // Clear all cached data
  const clearCache = useCallback(async () => {
    if (!storageRef.current) {
      throw new Error('Offline storage not available');
    }

    try {
      console.log('🗑️ Clearing offline cache...');
      await storageRef.current.clearAllData();
      
      // Clear service worker caches
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          const messageChannel = new MessageChannel();
          registration.active.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
        }
      }
      
      await updateCacheInfo();
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      throw error;
    }
  }, [updateCacheInfo]);

  // Register background sync
  const registerBackgroundSync = useCallback(async (tag: string) => {
    if (!storageRef.current) {
      throw new Error('Offline storage not available');
    }

    try {
      await storageRef.current.registerBackgroundSync(tag);
      console.log(`📡 Background sync registered: ${tag}`);
    } catch (error) {
      console.error(`❌ Failed to register background sync: ${tag}`, error);
      throw error;
    }
  }, []);

  // Get current cache size
  const getCacheSize = useCallback(async (): Promise<number> => {
    if (!storageRef.current) {
      return 0;
    }

    try {
      const size = await storageRef.current.getCacheSize();
      setCacheSize(size);
      return size;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }, []);

  // Update cache info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateCacheInfo();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [updateCacheInfo]);

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnline,
    lastOffline,
    pendingSyncCount,
    cacheSize,
    syncData,
    clearCache,
    registerBackgroundSync,
    getCacheSize
  };
}

// Hook for managing offline data operations
export function useOfflineData() {
  const storageRef = useRef<OfflineStorage | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initStorage = async () => {
      try {
        storageRef.current = new OfflineStorage();
        await storageRef.current.init();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize offline data storage:', error);
      }
    };

    initStorage();

    return () => {
      if (storageRef.current) {
        storageRef.current.close();
      }
    };
  }, []);

  const saveOfflineProgress = useCallback(async (
    userId: string,
    courseId: string,
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
    }
  ) => {
    if (!storageRef.current || !isInitialized) {
      throw new Error('Offline storage not available');
    }

    try {
      const updateId = await storageRef.current.addProgressUpdate({
        userId,
        courseId,
        data
      });

      // Register for background sync
      await storageRef.current.registerBackgroundSync('progress-sync');
      
      return updateId;
    } catch (error) {
      console.error('Failed to save offline progress:', error);
      throw error;
    }
  }, [isInitialized]);

  const saveOfflineSession = useCallback(async (
    userId: string,
    courseId: string,
    sessionData: Partial<import('../types/course.js').LearningSession>
  ) => {
    if (!storageRef.current || !isInitialized) {
      throw new Error('Offline storage not available');
    }

    try {
      const updateId = await storageRef.current.addSessionUpdate({
        userId,
        courseId,
        data: sessionData
      });

      // Register for background sync
      await storageRef.current.registerBackgroundSync('session-sync');
      
      return updateId;
    } catch (error) {
      console.error('Failed to save offline session:', error);
      throw error;
    }
  }, [isInitialized]);

  const getCachedCourse = useCallback(async (courseName: string) => {
    if (!storageRef.current || !isInitialized) {
      return null;
    }

    try {
      return await storageRef.current.getCourse(courseName);
    } catch (error) {
      console.error('Failed to get cached course:', error);
      return null;
    }
  }, [isInitialized]);

  const getCachedSession = useCallback(async (userId: string, courseId: string) => {
    if (!storageRef.current || !isInitialized) {
      return null;
    }

    try {
      return await storageRef.current.getSession(userId, courseId);
    } catch (error) {
      console.error('Failed to get cached session:', error);
      return null;
    }
  }, [isInitialized]);

  return {
    isInitialized,
    saveOfflineProgress,
    saveOfflineSession,
    getCachedCourse,
    getCachedSession,
    storage: storageRef.current
  };
}

// Service Worker registration hook
export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isWaitingForUpdate, setIsWaitingForUpdate] = useState(false);

  useEffect(() => {
    const registerSW = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('Service workers not supported');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none'
        });

        setRegistration(reg);
        setIsInstalled(true);

        // Check for waiting service worker
        if (reg.waiting) {
          setIsWaitingForUpdate(true);
        }

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setIsWaitingForUpdate(true);
              }
            });
          }
        });

        console.log('✅ Service worker registered successfully');
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setIsWaitingForUpdate(false);
      window.location.reload();
    }
  }, [registration]);

  return {
    registration,
    isInstalled,
    isWaitingForUpdate,
    updateServiceWorker
  };
}