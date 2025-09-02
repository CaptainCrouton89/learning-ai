'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  Target, 
  CheckCircle2,
  AlertCircle,
  Timer,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlashcardSchedule, ItemProgress } from '@/types/course';

interface SpacedRepetitionSchedulerProps {
  /** Current global position counter */
  currentPosition: number;
  /** Array of all flashcard schedules */
  schedules: FlashcardSchedule[];
  /** Detailed item progress for additional context */
  itemsProgress?: Map<string, ItemProgress>;
  /** Concept name for context */
  conceptName?: string;
}

interface ScheduleGroup {
  status: 'overdue' | 'due-soon' | 'scheduled' | 'mastered';
  label: string;
  color: string;
  icon: React.ReactNode;
  items: Array<FlashcardSchedule & { relativePosition: number }>;
}

export function SpacedRepetitionScheduler({
  currentPosition,
  schedules,
  itemsProgress,
  conceptName
}: SpacedRepetitionSchedulerProps) {
  
  const scheduleAnalysis = useMemo(() => {
    const enrichedSchedules = schedules.map(schedule => ({
      ...schedule,
      relativePosition: schedule.duePosition - currentPosition
    }));

    const overdue = enrichedSchedules.filter(s => s.relativePosition <= 0 && s.successCount < 2);
    const dueSoon = enrichedSchedules.filter(s => s.relativePosition > 0 && s.relativePosition <= 5 && s.successCount < 2);
    const scheduled = enrichedSchedules.filter(s => s.relativePosition > 5 && s.successCount < 2);
    const mastered = enrichedSchedules.filter(s => s.successCount >= 2);

    const groups: ScheduleGroup[] = [
      {
        status: 'overdue',
        label: 'Due Now',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle className="w-4 h-4" />,
        items: overdue.sort((a, b) => a.duePosition - b.duePosition)
      },
      {
        status: 'due-soon',
        label: 'Due Soon',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Timer className="w-4 h-4" />,
        items: dueSoon.sort((a, b) => a.duePosition - b.duePosition)
      },
      {
        status: 'scheduled',
        label: 'Scheduled',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Calendar className="w-4 h-4" />,
        items: scheduled.sort((a, b) => a.duePosition - b.duePosition)
      },
      {
        status: 'mastered',
        label: 'Mastered',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle2 className="w-4 h-4" />,
        items: mastered.sort((a, b) => (a.item).localeCompare(b.item))
      }
    ];

    const totalItems = schedules.length;
    const activeItems = totalItems - mastered.length;
    const averageInterval = activeItems > 0 ? 
      scheduled.reduce((sum, item) => sum + item.interval, 0) / scheduled.length : 0;
    const averageEase = activeItems > 0 ?
      enrichedSchedules.filter(s => s.successCount < 2).reduce((sum, item) => sum + item.easeFactor, 0) / activeItems : 2.5;

    return {
      groups: groups.filter(group => group.items.length > 0),
      stats: {
        totalItems,
        activeItems,
        masteredItems: mastered.length,
        overdueItems: overdue.length,
        averageInterval: Math.round(averageInterval * 10) / 10,
        averageEase: Math.round(averageEase * 100) / 100,
        masteryRate: (mastered.length / totalItems) * 100
      }
    };
  }, [schedules, currentPosition]);

  const getEaseFactorInfo = (easeFactor: number) => {
    if (easeFactor < 1.8) return { label: 'Very Hard', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (easeFactor < 2.2) return { label: 'Hard', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (easeFactor < 2.8) return { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (easeFactor < 3.5) return { label: 'Easy', color: 'text-green-600', bgColor: 'bg-green-50' };
    return { label: 'Very Easy', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
  };

  const formatRelativePosition = (relativePosition: number) => {
    if (relativePosition <= 0) return 'Due now';
    if (relativePosition === 1) return 'Next card';
    return `In ${relativePosition} cards`;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
            Spaced Repetition Schedule
            {conceptName && (
              <Badge variant="outline" className="ml-2 text-xs">
                {conceptName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-primary">{scheduleAnalysis.stats.totalItems}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-green-600">{scheduleAnalysis.stats.masteredItems}</div>
              <div className="text-xs text-muted-foreground">Mastered</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-yellow-600">{scheduleAnalysis.stats.overdueItems}</div>
              <div className="text-xs text-muted-foreground">Due Now</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-blue-600">{Math.round(scheduleAnalysis.stats.masteryRate)}%</div>
              <div className="text-xs text-muted-foreground">Mastery Rate</div>
            </div>
          </div>

          <Separator />

          {/* Advanced Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average Interval:</span>
              <span className="font-medium">{scheduleAnalysis.stats.averageInterval} cards</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average Ease:</span>
              <span className="font-medium">{scheduleAnalysis.stats.averageEase}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Position:</span>
              <span className="font-medium">#{currentPosition}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Items:</span>
              <span className="font-medium">{scheduleAnalysis.stats.activeItems}</span>
            </div>
          </div>

          {/* Mastery Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Mastery Progress</span>
              <span className="font-medium">{Math.round(scheduleAnalysis.stats.masteryRate)}%</span>
            </div>
            <Progress 
              value={scheduleAnalysis.stats.masteryRate} 
              className="h-2 bg-green-50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Groups */}
      <div className="grid gap-4">
        {scheduleAnalysis.groups.map((group) => (
          <Card key={group.status}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {group.icon}
                  <span className="text-base">{group.label}</span>
                  <Badge className={cn("text-xs", group.color)}>
                    {group.items.length} items
                  </Badge>
                </div>
                {group.status === 'overdue' && group.items.length > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    Needs Attention
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.items.slice(0, 5).map((schedule, index) => {
                  const easeInfo = getEaseFactorInfo(schedule.easeFactor);
                  const progress = itemsProgress?.get(schedule.item);
                  
                  return (
                    <div 
                      key={`${schedule.item}-${index}`} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{schedule.item}</span>
                          {schedule.successCount > 0 && (
                            <div className="flex gap-1">
                              {[...Array(schedule.successCount)].map((_, i) => (
                                <CheckCircle2 key={i} className="w-3 h-3 text-green-500" />
                              ))}
                              {[...Array(2 - schedule.successCount)].map((_, i) => (
                                <div key={i} className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatRelativePosition(schedule.relativePosition)}</span>
                          <span>•</span>
                          <span>Interval: {schedule.interval} cards</span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <div className={cn("w-2 h-2 rounded-full", easeInfo.bgColor, easeInfo.color)} />
                            <span>{easeInfo.label} ({schedule.easeFactor.toFixed(1)})</span>
                          </div>
                        </div>
                        
                        {progress && progress.attempts.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Last attempt: {progress.attempts[progress.attempts.length - 1]?.aiResponse.comprehension}/5
                          </div>
                        )}
                      </div>

                      {group.status !== 'mastered' && schedule.relativePosition > 0 && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <ArrowRight className="w-3 h-3 mr-1" />
                          <span>Due at #{schedule.duePosition}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {group.items.length > 5 && (
                  <div className="text-center py-2">
                    <Badge variant="secondary" className="text-xs">
                      +{group.items.length - 5} more items
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Visualization */}
      {scheduleAnalysis.stats.activeItems > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              Upcoming Review Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline axis */}
              <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
                <span>Now</span>
                <span>Position #{currentPosition + 20}</span>
              </div>
              
              {/* Timeline bar */}
              <div className="relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                <div className="absolute left-0 top-0 w-1 h-full bg-primary z-10" />
                
                {schedules
                  .filter(s => s.successCount < 2 && s.duePosition > currentPosition && s.duePosition <= currentPosition + 20)
                  .map((schedule, index) => {
                    const position = ((schedule.duePosition - currentPosition) / 20) * 100;
                    const easeInfo = getEaseFactorInfo(schedule.easeFactor);
                    
                    return (
                      <div
                        key={`timeline-${schedule.item}-${index}`}
                        className="absolute top-1 h-6 w-2 rounded"
                        style={{ 
                          left: `${Math.min(95, Math.max(2, position))}%`,
                          backgroundColor: easeInfo.color.includes('red') ? '#ef4444' : 
                                         easeInfo.color.includes('orange') ? '#f97316' :
                                         easeInfo.color.includes('blue') ? '#3b82f6' :
                                         easeInfo.color.includes('green') ? '#22c55e' : '#10b981'
                        }}
                        title={`${schedule.item} - Due in ${schedule.duePosition - currentPosition} cards`}
                      />
                    );
                  })}
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>#{currentPosition}</span>
                <span>#{currentPosition + 20}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}