'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  User, 
  Bot, 
  ArrowLeft, 
  Calendar, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationHistoryProps {
  history: ConversationEntry[];
  onReturnToQuestion?: () => void;
  compact?: boolean;
  maxEntries?: number;
}

export function ConversationHistory({ 
  history, 
  onReturnToQuestion, 
  compact = false,
  maxEntries 
}: ConversationHistoryProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // Filter and limit history
  let displayHistory = [...history];
  if (maxEntries && !showAllHistory) {
    displayHistory = displayHistory.slice(-maxEntries);
  }
  
  const toggleEntryExpansion = (index: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEntries(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const truncateContent = (content: string, limit: number = 150) => {
    if (content.length <= limit) return content;
    return content.slice(0, limit) + '...';
  };

  if (displayHistory.length === 0) {
    return (
      <Card className={compact ? 'h-fit' : 'min-h-[300px] sm:min-h-[400px]'}>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
            <MessageCircle className="w-4 h-4" />
            {compact ? 'Recent Chat' : 'Conversation History'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="text-center text-muted-foreground py-6 sm:py-8">
            <MessageCircle className="w-6 sm:w-8 h-6 sm:h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">No conversation yet</p>
            <p className="text-xs hidden sm:block">Your questions and responses will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? 'h-fit max-h-80 sm:max-h-96' : 'min-h-[300px] sm:min-h-[400px]'}>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
            <MessageCircle className="w-4 h-4" />
            <span>{compact ? 'Recent Chat' : 'Conversation History'}</span>
            <Badge variant="secondary" className="text-xs">
              {history.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {maxEntries && history.length > maxEntries && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-xs h-8 px-2 touch-manipulation"
              >
                {showAllHistory ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Show Recent</span>
                    <span className="sm:hidden">Recent</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Show All ({history.length})</span>
                    <span className="sm:hidden">All</span>
                  </>
                )}
              </Button>
            )}
            {onReturnToQuestion && !compact && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReturnToQuestion}
                className="flex items-center gap-2 text-xs h-8 px-2 touch-manipulation"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Back to Learning</span>
                <span className="sm:hidden">Back</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className={compact ? 'h-64 sm:h-80' : 'h-72 sm:h-96'}>
          <div className="space-y-3 p-3 sm:p-4">
            {displayHistory.map((entry, index) => {
              const isExpanded = expandedEntries.has(index);
              const shouldTruncate = compact && entry.content.length > (compact ? 100 : 150);
              const displayContent = shouldTruncate && !isExpanded 
                ? truncateContent(entry.content, compact ? 80 : 150) 
                : entry.content;
              
              return (
                <div key={index} className="group">
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className={`rounded-full p-1 sm:p-1.5 flex-shrink-0 ${
                      entry.role === 'user' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {entry.role === 'user' ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <span className="text-xs font-medium capitalize">
                          {entry.role === 'user' ? 'You' : 'AI Teacher'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      
                      <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words`}>
                        {displayContent}
                      </div>

                      {/* Expand/Collapse Button */}
                      {shouldTruncate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEntryExpansion(index)}
                          className="mt-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground touch-manipulation"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Show less</span>
                              <span className="sm:hidden">Less</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Show more</span>
                              <span className="sm:hidden">More</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Actions (visible on hover for desktop) */}
                    {!compact && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 touch-manipulation"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {!compact && maxEntries && history.length > maxEntries && !showAllHistory && (
        <div className="p-3 sm:p-4 pt-0">
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllHistory(true)}
              className="text-xs h-10 touch-manipulation"
            >
              <span className="hidden sm:inline">View {history.length - maxEntries} older messages</span>
              <span className="sm:hidden">View {history.length - maxEntries} older</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}