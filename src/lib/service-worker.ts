/// <reference lib="webworker" />

const CACHE_NAME = 'learning-ai-v1';
const STATIC_CACHE_NAME = 'learning-ai-static-v1';
const DYNAMIC_CACHE_NAME = 'learning-ai-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/next.svg',
  '/globe.svg',
  '/file.svg',
  '/window.svg',
  '/vercel.svg'
];

// API routes to cache
const API_ROUTES = [
  '/api/courses',
  '/api/sessions',
  '/api/learning'
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install event - cache static assets
sw.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Installing');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        await staticCache.addAll(STATIC_ASSETS);
        console.log('[ServiceWorker] Static assets cached');
        
        // Skip waiting to activate immediately
        await sw.skipWaiting();
      } catch (error) {
        console.error('[ServiceWorker] Install failed:', error);
        throw error;
      }
    })()
  );
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Activating');
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const cachesToDelete = cacheNames.filter(cacheName => 
          cacheName !== STATIC_CACHE_NAME && 
          cacheName !== DYNAMIC_CACHE_NAME &&
          cacheName !== CACHE_NAME
        );
        
        await Promise.all(
          cachesToDelete.map(cacheName => caches.delete(cacheName))
        );
        
        console.log('[ServiceWorker] Old caches cleaned up');
        
        // Claim all clients
        await sw.clients.claim();
      } catch (error) {
        console.error('[ServiceWorker] Activation failed:', error);
        throw error;
      }
    })()
  );
});

// Fetch event - implement caching strategies
sw.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Static assets - Cache First strategy
    if (STATIC_ASSETS.some(asset => pathname === asset || pathname.includes(asset))) {
      return await cacheFirstStrategy(request, STATIC_CACHE_NAME);
    }
    
    // API routes - Network First strategy with offline fallback
    if (API_ROUTES.some(route => pathname.startsWith(route))) {
      return await networkFirstStrategy(request, DYNAMIC_CACHE_NAME);
    }
    
    // Next.js static files (_next/*)
    if (pathname.startsWith('/_next/')) {
      return await cacheFirstStrategy(request, STATIC_CACHE_NAME);
    }
    
    // Application routes - Network First with cache fallback
    return await networkFirstStrategy(request, DYNAMIC_CACHE_NAME);
    
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return a generic offline response
    return new Response(
      JSON.stringify({ error: 'Offline - content not available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache First strategy - good for static assets
async function cacheFirstStrategy(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log('[ServiceWorker] Cache hit:', request.url);
    return cached;
  }
  
  console.log('[ServiceWorker] Cache miss, fetching:', request.url);
  const response = await fetch(request);
  
  // Cache successful responses
  if (response.status === 200) {
    await cache.put(request, response.clone());
  }
  
  return response;
}

// Network First strategy - good for dynamic content
async function networkFirstStrategy(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  
  try {
    console.log('[ServiceWorker] Network first:', request.url);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.status === 200) {
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// Background sync for offline actions
sw.addEventListener('sync', (event: any) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);
  
  if (event.tag === 'progress-sync') {
    event.waitUntil(syncProgress());
  }
  
  if (event.tag === 'session-sync') {
    event.waitUntil(syncSessions());
  }
});

async function syncProgress(): Promise<void> {
  try {
    console.log('[ServiceWorker] Syncing progress data...');
    
    // Get offline storage instance
    const offlineStorage = await import('./offline-storage.js');
    const storage = new offlineStorage.OfflineStorage();
    await storage.init();
    
    // Get pending progress updates
    const pendingUpdates = await storage.getPendingProgressUpdates();
    
    for (const update of pendingUpdates) {
      try {
        const response = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await storage.markProgressUpdateSynced(update.id);
          console.log('[ServiceWorker] Progress update synced:', update.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync progress update:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Progress sync failed:', error);
  }
}

async function syncSessions(): Promise<void> {
  try {
    console.log('[ServiceWorker] Syncing session data...');
    
    // Get offline storage instance
    const offlineStorage = await import('./offline-storage.js');
    const storage = new offlineStorage.OfflineStorage();
    await storage.init();
    
    // Get pending session updates
    const pendingSessions = await storage.getPendingSessionUpdates();
    
    for (const session of pendingSessions) {
      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session.data)
        });
        
        if (response.ok) {
          await storage.markSessionUpdateSynced(session.id);
          console.log('[ServiceWorker] Session update synced:', session.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync session update:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Session sync failed:', error);
  }
}

// Message handler for communication with main thread
sw.addEventListener('message', (event: ExtendableMessageEvent) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(getCacheSize().then(size => {
      event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
    }));
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches().then(() => {
      event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
    }));
  }
});

async function getCacheSize(): Promise<number> {
  let totalSize = 0;
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const responses = await cache.keys();
    
    for (const response of responses) {
      const cachedResponse = await cache.match(response);
      if (cachedResponse && cachedResponse.headers.get('content-length')) {
        totalSize += parseInt(cachedResponse.headers.get('content-length') || '0', 10);
      }
    }
  }
  
  return totalSize;
}

async function clearAllCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  console.log('[ServiceWorker] All caches cleared');
}

export {};