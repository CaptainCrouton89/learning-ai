'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LearningTimelineEntry } from '@/lib/analytics';
import { 
  Brain, 
  BookOpen, 
  Target, 
  Clock,
  TrendingUp,
  Calendar,
  CircleDot
} from 'lucide-react';

interface LearningTimelineProps {
  data: LearningTimelineEntry[];
}

export function LearningTimeline({ data }: LearningTimelineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No learning activity recorded yet.</p>
        <p className="text-sm mt-2">Start studying to see your timeline!</p>
      </div>
    );
  }

  // Group entries by date for better visualization
  const groupedByDate = groupEntriesByDate(data);
  const recentEntries = data.slice(-20); // Show last 20 activities

  // Calculate daily statistics
  const dailyStats = calculateDailyStats(data);

  return (
    <div className="space-y-6">
      {/* Timeline Statistics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-primary">
            {dailyStats.totalActivities}
          </div>
          <div className="text-xs text-muted-foreground">Total Activities</div>
        </div>
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-green-600">
            {dailyStats.averageScore.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">Avg. Score</div>
        </div>
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-blue-600">
            {dailyStats.activeDays}
          </div>
          <div className="text-xs text-muted-foreground">Active Days</div>
        </div>
      </div>

      <Separator />

      {/* Recent Activity Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Recent Activity</span>
          </h4>
          <Badge variant="outline" className="text-xs">
            Last 20 activities
          </Badge>
        </div>

        <ScrollArea className="h-80">
          <div className="space-y-3 pr-4">
            {recentEntries.map((entry, index) => (
              <TimelineEntry key={index} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Daily Summary */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span>Daily Progress</span>
        </h4>

        <div className="space-y-2">
          {Object.entries(groupedByDate)
            .slice(-7) // Show last 7 days
            .map(([date, entries]) => (
              <DaySummary key={date} date={date} entries={entries} />
            ))}
        </div>
      </div>
    </div>
  );
}

interface TimelineEntryProps {
  entry: LearningTimelineEntry;
}

function TimelineEntry({ entry }: TimelineEntryProps) {
  const activityIcon = getActivityIcon(entry.activityType);
  const scoreColor = getScoreColor(entry.comprehensionScore);
  const timeAgo = getTimeAgo(entry.date);

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="p-3">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`p-1.5 rounded-full ${getActivityBgColor(entry.activityType)}`}>
              {activityIcon}
            </div>
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm capitalize">
                  {entry.concept.replace('-', ' ')}
                </span>
                <Badge variant="outline" className="text-xs">
                  {entry.phase}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getScoreVariant(entry.comprehensionScore)} className="text-xs">
                  {entry.comprehensionScore}/5
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timeAgo}
                </span>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <span className="capitalize">
                {entry.activityType.replace('_', ' ')}:
              </span>
              {' '}
              <span className="font-medium">
                {entry.itemOrTopic.replace('-', ' ')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DaySummaryProps {
  date: string;
  entries: LearningTimelineEntry[];
}

function DaySummary({ date, entries }: DaySummaryProps) {
  const averageScore = entries.reduce((sum, entry) => sum + entry.comprehensionScore, 0) / entries.length;
  const activityCounts = entries.reduce((acc, entry) => {
    acc[entry.activityType] = (acc[entry.activityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dateObj = new Date(date);
  const isToday = dateObj.toDateString() === new Date().toDateString();
  const isYesterday = dateObj.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  let displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (isToday) displayDate = 'Today';
  if (isYesterday) displayDate = 'Yesterday';

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <CircleDot className="h-3 w-3 text-primary" />
          <span className="font-medium text-sm">{displayDate}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {entries.length} activities
        </Badge>
      </div>
      
      <div className="flex items-center space-x-3">
        <div className="flex space-x-1">
          {Object.entries(activityCounts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {getActivityShortName(type)}: {count}
            </Badge>
          ))}
        </div>
        <Badge variant={getScoreVariant(averageScore)} className="text-xs">
          Avg: {averageScore.toFixed(1)}
        </Badge>
      </div>
    </div>
  );
}

// Helper functions
function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'flashcard':
      return <BookOpen className="h-3 w-3 text-white" />;
    case 'concept_question':
      return <Brain className="h-3 w-3 text-white" />;
    case 'special_question':
      return <Target className="h-3 w-3 text-white" />;
    default:
      return <CircleDot className="h-3 w-3 text-white" />;
  }
}

function getActivityBgColor(activityType: string): string {
  switch (activityType) {
    case 'flashcard':
      return 'bg-blue-500';
    case 'concept_question':
      return 'bg-purple-500';
    case 'special_question':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
}

function getActivityShortName(activityType: string): string {
  switch (activityType) {
    case 'flashcard':
      return 'FC';
    case 'concept_question':
      return 'CQ';
    case 'special_question':
      return 'SQ';
    default:
      return 'AC';
  }
}

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 4) return 'default';
  if (score >= 3) return 'secondary';
  return 'destructive';
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks === 1) return '1w ago';
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
  
  return date.toLocaleDateString();
}

function groupEntriesByDate(entries: LearningTimelineEntry[]): Record<string, LearningTimelineEntry[]> {
  return entries.reduce((acc, entry) => {
    const dateKey = entry.date.toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, LearningTimelineEntry[]>);
}

function calculateDailyStats(entries: LearningTimelineEntry[]) {
  const totalActivities = entries.length;
  const averageScore = entries.length > 0 
    ? entries.reduce((sum, entry) => sum + entry.comprehensionScore, 0) / entries.length
    : 0;
  
  const uniqueDates = new Set(entries.map(entry => entry.date.toDateString()));
  const activeDays = uniqueDates.size;
  
  return {
    totalActivities,
    averageScore,
    activeDays,
  };
}