"use client";

import { Course, LearningSession } from "@/types/course";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, BookOpen, Users, Play, Archive, Trash2, Copy } from "lucide-react";

interface CourseCardProps {
  course: Course;
  session?: LearningSession | null;
  onResume?: (courseName: string) => void;
  onArchive?: (courseName: string) => void;
  onDelete?: (courseName: string) => void;
  onDuplicate?: (courseName: string) => void;
}

export function CourseCard({ course, session, onResume, onArchive, onDelete, onDuplicate }: CourseCardProps) {
  const totalItems = course.concepts?.reduce((sum, concept) => sum + concept.memorize.items.length, 0) || 0;
  
  const getStatusBadge = () => {
    if (!session) {
      return <Badge variant="outline">Not Started</Badge>;
    }
    
    const statusColors = {
      initialization: "default",
      "high-level": "secondary", 
      "concept-learning": "default",
      memorization: "secondary",
      "drawing-connections": "default"
    } as const;
    
    return (
      <Badge variant={statusColors[session.currentPhase] || "outline"}>
        {session.currentPhase?.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase()) || "Unknown"}
      </Badge>
    );
  };

  const getTimeAgo = () => {
    if (!session) return null;
    
    try {
      const lastActivity = new Date(session.lastActivityTime);
      const now = new Date();
      const diffMs = now.getTime() - lastActivity.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        return "recently";
      }
    } catch {
      return "Unknown";
    }
  };

  const getProgressPercentage = () => {
    if (!session) return 0;
    
    // Calculate progress based on phase completion
    const phaseProgress = {
      initialization: 20,
      "high-level": 40,
      "concept-learning": 60,
      memorization: 80,
      "drawing-connections": 100
    };
    
    return phaseProgress[session.currentPhase] || 0;
  };

  return (
    <Card className="hover:shadow-md transition-shadow touch-manipulation">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground line-clamp-2 flex-1 min-w-0">
            {course.name}
          </CardTitle>
          <div className="flex gap-2 flex-shrink-0">
            {getStatusBadge()}
          </div>
        </div>
        {session && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground mt-3">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs sm:text-sm">{getTimeAgo()}</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <span className="text-xs font-medium">{getProgressPercentage()}%</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <BookOpen className="w-4 h-4" />
              <span>{course.concepts?.length || 0} concepts</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{totalItems} items</span>
            </div>
          </div>

          {course.concepts && course.concepts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Topics:</p>
              <div className="flex flex-wrap gap-1">
                {course.concepts?.slice(0, 3).map((concept) => (
                  <Badge key={concept.name} variant="secondary" className="text-xs truncate max-w-24 sm:max-w-none">
                    {concept.name}
                  </Badge>
                ))}
                {course.concepts && course.concepts.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{course.concepts.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 sm:p-6 pt-0">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex gap-2 flex-1">
            {session ? (
              <Button 
                onClick={() => onResume?.(course.name)}
                size="sm"
                className="flex items-center gap-2 h-10 touch-manipulation flex-1 sm:flex-none"
              >
                <Play className="w-4 h-4" />
                Resume
              </Button>
            ) : (
              <Button 
                onClick={() => onResume?.(course.name)}
                size="sm"
                className="flex items-center gap-2 h-10 touch-manipulation flex-1 sm:flex-none"
              >
                <Play className="w-4 h-4" />
                Start
              </Button>
            )}
          </div>
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate?.(course.name)}
              className="h-10 w-10 p-0 touch-manipulation"
              title="Duplicate course"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive?.(course.name)}
              className="h-10 w-10 p-0 touch-manipulation"
              title="Archive course"
            >
              <Archive className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete?.(course.name)}
              className="h-10 w-10 p-0 text-destructive hover:text-destructive touch-manipulation"
              title="Delete course"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}