'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  WifiOff, 
  RefreshCw, 
  Database, 
  RotateCcw, 
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { useOffline, useOfflineData } from '@/hooks/useOffline';

export default function OfflinePage() {
  const { 
    isOnline, 
    isOffline, 
    lastOnline, 
    lastOffline, 
    pendingSyncCount, 
    cacheSize,
    syncData,
    clearCache,
    getCacheSize
  } = useOffline();
  
  const { 
    isInitialized, 
    getCachedCourse, 
    getCachedSession 
  } = useOfflineData();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [cachedData, setCachedData] = useState<{
    courses: number;
    sessions: number;
  }>({ courses: 0, sessions: 0 });

  // Check for cached data
  useEffect(() => {
    const loadCachedDataInfo = async () => {
      if (!isInitialized) return;
      
      try {
        // This would need to be implemented in the offline storage
        // For now, we'll use placeholder values
        setCachedData({
          courses: Math.floor(cacheSize / 2), // Rough estimate
          sessions: Math.floor(cacheSize / 2)
        });
      } catch (error) {
        console.error('Failed to load cached data info:', error);
      }
    };

    loadCachedDataInfo();
  }, [isInitialized, cacheSize]);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    // Check connection
    if (navigator.onLine) {
      // Connection is available, redirect to home
      window.location.href = '/';
    } else {
      // Still offline, just refresh the page state
      setTimeout(() => {
        setIsRetrying(false);
      }, 2000);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      await syncData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    
    try {
      await clearCache();
    } catch (error) {
      console.error('Clear cache failed:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-orange-100 dark:bg-orange-900">
            <WifiOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">You're Offline</h1>
        <p className="text-muted-foreground">
          No internet connection detected. You can still access your cached learning content.
        </p>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Status:</span>
                <Badge variant={isOnline ? "default" : "destructive"}>
                  {isOnline ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Online
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
              </div>
              
              {lastOnline && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Online:</span>
                  <span className="text-sm">{formatDate(lastOnline)}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {lastOffline && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Went Offline:</span>
                  <span className="text-sm">{formatDate(lastOffline)}</span>
                </div>
              )}
              
              {pendingSyncCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Sync:</span>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {pendingSyncCount} items
                  </Badge>
                </div>
              )}
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex gap-2">
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying}
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking...' : 'Retry Connection'}
            </Button>
            
            {isOnline && pendingSyncCount > 0 && (
              <Button 
                onClick={handleSync} 
                disabled={isSyncing}
                variant="outline"
              >
                <RotateCcw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cached Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Offline Content
          </CardTitle>
          <CardDescription>
            Content available for offline access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {cachedData.courses}
              </div>
              <div className="text-sm text-muted-foreground">Courses</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {cachedData.sessions}
              </div>
              <div className="text-sm text-muted-foreground">Sessions</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatFileSize(cacheSize * 1024)} {/* Rough estimate */}
              </div>
              <div className="text-sm text-muted-foreground">Cache Size</div>
            </div>
          </div>

          {cacheSize > 0 ? (
            <>
              <Alert className="mb-4">
                <Database className="h-4 w-4" />
                <AlertDescription>
                  You have offline content available. You can continue learning even without an internet connection.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button 
                  asChild 
                  className="flex-1"
                >
                  <a href="/courses">
                    View My Courses
                  </a>
                </Button>
                
                <Button 
                  asChild 
                  variant="outline"
                  className="flex-1"
                >
                  <a href="/dashboard">
                    View Progress
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                No offline content available. You'll need to go online to download courses and start learning.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      {cacheSize > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Management
            </CardTitle>
            <CardDescription>
              Manage your offline storage and cache
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Clear Offline Cache</div>
                  <div className="text-sm text-muted-foreground">
                    Free up storage space by removing cached content
                  </div>
                </div>
                <Button 
                  onClick={handleClearCache}
                  disabled={isClearing}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className={`h-4 w-4 mr-2 ${isClearing ? 'animate-spin' : ''}`} />
                  {isClearing ? 'Clearing...' : 'Clear Cache'}
                </Button>
              </div>

              {pendingSyncCount > 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    You have {pendingSyncCount} pending changes that will be synced when you reconnect to the internet.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          While offline, you can still access previously downloaded content and your progress will sync when you reconnect.
        </p>
        
        <div className="flex gap-2 justify-center">
          <Button variant="outline" asChild>
            <a href="/">
              Return Home
            </a>
          </Button>
          
          {cacheSize > 0 && (
            <Button asChild>
              <a href="/courses">
                Continue Learning
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}