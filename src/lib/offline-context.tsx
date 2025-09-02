'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { OfflineStorage } from './offline-storage.js';
import { Course, LearningSession } from '../types/course.js';

interface OfflineContextType {
  isOnline: boolean;
  isOffline: boolean;
  storage: OfflineStorage | null;
  isInitialized: boolean;
  cacheSize: number;
  pendingSyncCount: number;
  
  // Methods
  initializeStorage: () => Promise<void>;
  saveCourseOffline: (course: Course) => Promise<void>;
  saveSessionOffline: (session: LearningSession) => Promise<void>;
  getCachedCourse: (courseName: string) => Promise<import('./offline-storage.js').OfflineCourse | null>;
  getCachedSession: (userId: string, courseId: string) => Promise<import('./offline-storage.js').OfflineSession | null>;
  syncData: () => Promise<void>;
  clearCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [storage, setStorage] = useState<OfflineStorage | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Initialize storage
  const initializeStorage = async () => {
    if (storage) return;
    
    try {
      const offlineStorage = new OfflineStorage();
      await offlineStorage.init();
      setStorage(offlineStorage);
      setIsInitialized(true);
      
      // Get initial cache info
      const size = await offlineStorage.getCacheSize();
      setCacheSize(size);
      
      const [pendingProgress, pendingSessions] = await Promise.all([
        offlineStorage.getPendingProgressUpdates(),
        offlineStorage.getPendingSessionUpdates()
      ]);
      
      setPendingSyncCount(pendingProgress.length + pendingSessions.length);
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  };

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🟢 Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('🔴 Connection lost - offline mode activated');
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize storage on mount
  useEffect(() => {
    initializeStorage();
    
    return () => {
      if (storage) {
        storage.close();
      }
    };
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      const timer = setTimeout(() => {
        syncData();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingSyncCount]);

  const saveCourseOffline = async (course: Course) => {
    if (!storage || !isInitialized) {
      throw new Error('Offline storage not available');
    }
    
    await storage.saveCourse(course);
    const newSize = await storage.getCacheSize();
    setCacheSize(newSize);
  };

  const saveSessionOffline = async (session: LearningSession) => {
    if (!storage || !isInitialized) {
      throw new Error('Offline storage not available');
    }
    
    await storage.saveSession(session);
    const newSize = await storage.getCacheSize();
    setCacheSize(newSize);
  };

  const getCachedCourse = async (courseName: string) => {
    if (!storage || !isInitialized) {
      return null;
    }
    
    return await storage.getCourse(courseName);
  };

  const getCachedSession = async (userId: string, courseId: string) => {
    if (!storage || !isInitialized) {
      return null;
    }
    
    return await storage.getSession(userId, courseId);
  };

  const syncData = async () => {
    if (!isOnline || !storage) {
      return;
    }
    
    try {
      console.log('🔄 Starting data sync...');
      
      // Register background sync for both progress and session updates
      await Promise.all([
        storage.registerBackgroundSync('progress-sync'),
        storage.registerBackgroundSync('session-sync')
      ]);

      // Update cache information
      const [pendingProgress, pendingSessions, size] = await Promise.all([
        storage.getPendingProgressUpdates(),
        storage.getPendingSessionUpdates(),
        storage.getCacheSize()
      ]);

      setPendingSyncCount(pendingProgress.length + pendingSessions.length);
      setCacheSize(size);
      
      console.log('✅ Data sync completed');
    } catch (error) {
      console.error('❌ Data sync failed:', error);
      throw error;
    }
  };

  const clearCache = async () => {
    if (!storage) {
      throw new Error('Offline storage not available');
    }

    try {
      console.log('🗑️ Clearing offline cache...');
      await storage.clearAllData();
      
      setCacheSize(0);
      setPendingSyncCount(0);
      
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      throw error;
    }
  };

  const value: OfflineContextType = {
    isOnline,
    isOffline: !isOnline,
    storage,
    isInitialized,
    cacheSize,
    pendingSyncCount,
    initializeStorage,
    saveCourseOffline,
    saveSessionOffline,
    getCachedCourse,
    getCachedSession,
    syncData,
    clearCache
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within an OfflineProvider');
  }
  return context;
}