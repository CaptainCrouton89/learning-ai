'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Trophy,
  Target,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  TrendingUp,
  Calendar,
  Zap,
  Award,
  BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ItemProgress, FlashcardAttempt } from '@/types/course';

interface ItemMasteryStatus {
  itemName: string;
  successCount: number;
  totalAttempts: number;
  averageScore: number;
  lastAttemptScore?: number;
  lastAttemptDate?: Date;
  easeFactor: number;
  interval: number;
  isMastered: boolean;
  progress: ItemProgress;
}

interface MasteryIndicatorProps {
  /** Map of item progress data */
  itemsProgress: Map<string, ItemProgress>;
  /** Current concept name */
  conceptName?: string;
  /** Display mode */
  displayMode?: 'grid' | 'list' | 'compact';
  /** Maximum items to show */
  maxItems?: number;
  /** Show detailed statistics */
  showStats?: boolean;
  /** Filter items by mastery status */
  filterBy?: 'all' | 'mastered' | 'in-progress' | 'struggling';
}

export function MasteryIndicator({
  itemsProgress,
  conceptName,
  displayMode = 'grid',
  maxItems = 20,
  showStats = true,
  filterBy = 'all'
}: MasteryIndicatorProps) {

  const masteryAnalysis = useMemo(() => {
    const items: ItemMasteryStatus[] = Array.from(itemsProgress.entries()).map(([itemName, progress]) => {
      const attempts = progress.attempts || [];
      const successfulAttempts = attempts.filter(attempt => attempt.aiResponse.comprehension >= 4);
      const averageScore = attempts.length > 0 
        ? attempts.reduce((sum, attempt) => sum + attempt.aiResponse.comprehension, 0) / attempts.length
        : 0;
      
      const lastAttempt = attempts[attempts.length - 1];
      
      return {
        itemName,
        successCount: progress.successCount,
        totalAttempts: attempts.length,
        averageScore: Math.round(averageScore * 10) / 10,
        lastAttemptScore: lastAttempt?.aiResponse.comprehension,
        lastAttemptDate: lastAttempt?.timestamp,
        easeFactor: progress.easeFactor,
        interval: progress.interval,
        isMastered: progress.successCount >= 2,
        progress
      };
    });

    // Apply filtering
    let filteredItems = items;
    switch (filterBy) {
      case 'mastered':
        filteredItems = items.filter(item => item.isMastered);
        break;
      case 'in-progress':
        filteredItems = items.filter(item => !item.isMastered && item.totalAttempts > 0);
        break;
      case 'struggling':
        filteredItems = items.filter(item => !item.isMastered && item.averageScore < 3 && item.totalAttempts >= 2);
        break;
    }

    // Sort items: mastered first, then by progress, then by name
    filteredItems.sort((a, b) => {
      if (a.isMastered && !b.isMastered) return -1;
      if (!a.isMastered && b.isMastered) return 1;
      if (!a.isMastered && !b.isMastered) {
        // Sort in-progress by success count, then by average score
        if (a.successCount !== b.successCount) return b.successCount - a.successCount;
        if (a.averageScore !== b.averageScore) return b.averageScore - a.averageScore;
      }
      return a.itemName.localeCompare(b.itemName);
    });

    const stats = {
      totalItems: items.length,
      masteredItems: items.filter(item => item.isMastered).length,
      inProgressItems: items.filter(item => !item.isMastered && item.totalAttempts > 0).length,
      strugglingItems: items.filter(item => !item.isMastered && item.averageScore < 3 && item.totalAttempts >= 2).length,
      untouchedItems: items.filter(item => item.totalAttempts === 0).length,
      averageEase: items.length > 0 ? items.reduce((sum, item) => sum + item.easeFactor, 0) / items.length : 2.5,
      overallMasteryRate: items.length > 0 ? (items.filter(item => item.isMastered).length / items.length) * 100 : 0
    };

    return {
      items: filteredItems.slice(0, maxItems),
      allItems: items,
      stats
    };
  }, [itemsProgress, filterBy, maxItems]);

  const getMasteryColor = (item: ItemMasteryStatus) => {
    if (item.isMastered) return 'text-green-600';
    if (item.successCount === 1) return 'text-yellow-600';
    if (item.totalAttempts === 0) return 'text-gray-400';
    if (item.averageScore < 3) return 'text-red-600';
    return 'text-blue-600';
  };

  const getMasteryBgColor = (item: ItemMasteryStatus) => {
    if (item.isMastered) return 'bg-green-50 border-green-200';
    if (item.successCount === 1) return 'bg-yellow-50 border-yellow-200';
    if (item.totalAttempts === 0) return 'bg-gray-50 border-gray-200';
    if (item.averageScore < 3) return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getMasteryIcon = (item: ItemMasteryStatus) => {
    if (item.isMastered) return <Trophy className="w-4 h-4 text-green-600" />;
    if (item.successCount === 1) return <Star className="w-4 h-4 text-yellow-600" />;
    if (item.totalAttempts === 0) return <Circle className="w-4 h-4 text-gray-400" />;
    return <Target className="w-4 h-4 text-blue-600" />;
  };

  const renderItemCard = (item: ItemMasteryStatus) => {
    const masteryProgress = (item.successCount / 2) * 100;
    
    return (
      <Card key={item.itemName} className={cn("transition-all hover:shadow-md", getMasteryBgColor(item))}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                {getMasteryIcon(item)}
                <span className="font-medium text-sm">{item.itemName}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Success indicators */}
                <div className="flex gap-1">
                  {[...Array(2)].map((_, index) => (
                    <div key={index}>
                      {index < item.successCount ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <Circle className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.successCount}/2 successes
                </span>
              </div>
            </div>
            
            {item.isMastered && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                <Award className="w-3 h-3 mr-1" />
                Mastered
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Mastery Progress</span>
              <span>{Math.round(masteryProgress)}%</span>
            </div>
            <Progress value={masteryProgress} className="h-2" />
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Attempts</div>
              <div className="font-medium flex items-center gap-1">
                <BarChart2 className="w-3 h-3" />
                {item.totalAttempts}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Avg Score</div>
              <div className={cn("font-medium", getMasteryColor(item))}>
                {item.totalAttempts > 0 ? `${item.averageScore}/5` : 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Difficulty</div>
              <div className="font-medium flex items-center gap-1">
                {item.easeFactor < 2 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-red-500" />
                    <span className="text-red-600">Hard</span>
                  </>
                ) : item.easeFactor > 3 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-green-600">Easy</span>
                  </>
                ) : (
                  <>
                    <Target className="w-3 h-3 text-blue-500" />
                    <span className="text-blue-600">Normal</span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Interval</div>
              <div className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.interval} cards
              </div>
            </div>
          </div>

          {/* Last attempt info */}
          {item.lastAttemptDate && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Last attempt:</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {item.lastAttemptDate.toLocaleDateString()}
                </div>
              </div>
              {item.lastAttemptScore && (
                <div className="flex items-center justify-between mt-1">
                  <span>Score:</span>
                  <span className={cn(
                    "font-medium",
                    item.lastAttemptScore >= 4 ? 'text-green-600' : 
                    item.lastAttemptScore >= 3 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {item.lastAttemptScore}/5
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderListItem = (item: ItemMasteryStatus) => {
    return (
      <div 
        key={item.itemName}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-muted/30",
          getMasteryBgColor(item)
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          {getMasteryIcon(item)}
          <div className="space-y-1">
            <span className="font-medium text-sm">{item.itemName}</span>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="flex gap-1">
                  {[...Array(2)].map((_, index) => (
                    <div key={index}>
                      {index < item.successCount ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                      ) : (
                        <Circle className="w-2.5 h-2.5 text-muted-foreground/40" />
                      )}
                    </div>
                  ))}
                </div>
                <span>{item.successCount}/2</span>
              </div>
              <span>•</span>
              <span>{item.totalAttempts} attempts</span>
              {item.averageScore > 0 && (
                <>
                  <span>•</span>
                  <span className={getMasteryColor(item)}>
                    {item.averageScore}/5 avg
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {item.isMastered && (
            <Badge className="bg-green-100 text-green-700 text-xs">
              Mastered
            </Badge>
          )}
          <div className="w-16">
            <Progress value={(item.successCount / 2) * 100} className="h-1.5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      {showStats && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <span>Mastery Progress</span>
                {conceptName && (
                  <Badge variant="outline" className="text-xs">
                    {conceptName}
                  </Badge>
                )}
              </div>
              <Badge className="bg-primary/10 text-primary">
                {Math.round(masteryAnalysis.stats.overallMasteryRate)}% Complete
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {masteryAnalysis.stats.masteredItems}
                </div>
                <div className="text-xs text-muted-foreground">Mastered</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {masteryAnalysis.stats.inProgressItems}
                </div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-red-600">
                  {masteryAnalysis.stats.strugglingItems}
                </div>
                <div className="text-xs text-muted-foreground">Struggling</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-gray-600">
                  {masteryAnalysis.stats.untouchedItems}
                </div>
                <div className="text-xs text-muted-foreground">Not Started</div>
              </div>
            </div>

            <Separator />

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Mastery Rate</span>
                <span className="font-medium">
                  {masteryAnalysis.stats.masteredItems}/{masteryAnalysis.stats.totalItems} items
                </span>
              </div>
              <Progress 
                value={masteryAnalysis.stats.overallMasteryRate} 
                className="h-3 bg-green-50"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Display */}
      <div className="space-y-4">
        {masteryAnalysis.items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Circle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="font-medium text-muted-foreground mb-2">No items found</h3>
              <p className="text-sm text-muted-foreground">
                {filterBy === 'all' 
                  ? 'No flashcard items are available for this concept.'
                  : `No items match the "${filterBy}" filter.`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {displayMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {masteryAnalysis.items.map(renderItemCard)}
              </div>
            )}
            
            {displayMode === 'list' && (
              <div className="space-y-2">
                {masteryAnalysis.items.map(renderListItem)}
              </div>
            )}
            
            {displayMode === 'compact' && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {masteryAnalysis.items.map(item => (
                      <div 
                        key={item.itemName}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded text-xs transition-all hover:bg-muted/30",
                          getMasteryBgColor(item)
                        )}
                      >
                        {getMasteryIcon(item)}
                        <span className="font-medium truncate flex-1">
                          {item.itemName}
                        </span>
                        <div className="flex gap-0.5">
                          {[...Array(2)].map((_, index) => (
                            <div key={index}>
                              {index < item.successCount ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                              ) : (
                                <Circle className="w-2.5 h-2.5 text-muted-foreground/40" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {masteryAnalysis.allItems.length > maxItems && (
              <div className="text-center py-4">
                <Badge variant="secondary">
                  Showing {masteryAnalysis.items.length} of {masteryAnalysis.allItems.length} items
                </Badge>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}