// This file is a placeholder that loads the actual service worker from the build
// The real service worker implementation is in /src/lib/service-worker.ts

// Simple service worker for basic offline functionality
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

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        await staticCache.addAll(STATIC_ASSETS);
        console.log('[ServiceWorker] Static assets cached');
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
      } catch (error) {
        console.error('[ServiceWorker] Install failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
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
        await self.clients.claim();
      } catch (error) {
        console.error('[ServiceWorker] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Static assets - Cache First strategy
    if (pathname === '/' || pathname === '/offline' || pathname.startsWith('/_next/') || pathname.includes('.')) {
      return await cacheFirstStrategy(request, STATIC_CACHE_NAME);
    }
    
    // API routes - Network First strategy with offline fallback
    if (pathname.startsWith('/api/')) {
      return await networkFirstStrategy(request, DYNAMIC_CACHE_NAME);
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
async function cacheFirstStrategy(request, cacheName) {
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
async function networkFirstStrategy(request, cacheName) {
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
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);
  
  if (event.tag === 'progress-sync') {
    event.waitUntil(syncProgress());
  }
  
  if (event.tag === 'session-sync') {
    event.waitUntil(syncSessions());
  }
});

async function syncProgress() {
  try {
    console.log('[ServiceWorker] Syncing progress data...');
    // Simplified sync implementation
    // In production, this would sync with IndexedDB
  } catch (error) {
    console.error('[ServiceWorker] Progress sync failed:', error);
  }
}

async function syncSessions() {
  try {
    console.log('[ServiceWorker] Syncing session data...');
    // Simplified sync implementation
    // In production, this would sync with IndexedDB
  } catch (error) {
    console.error('[ServiceWorker] Session sync failed:', error);
  }
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches().then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      }
    }));
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  console.log('[ServiceWorker] All caches cleared');
}