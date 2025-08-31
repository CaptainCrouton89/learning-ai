"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCourse } from "@/hooks/useCourse";
import { useLearning } from "@/contexts/LearningContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

export default function LearnPage({ 
  params 
}: { 
  params: Promise<{ courseId: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getCourse, getSession } = useCourse();
  const { 
    currentCourse, 
    setCurrentCourse, 
    currentSession,
    setCurrentSession,
    currentPhase,
    setCurrentPhase
  } = useLearning();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourseData() {
      try {
        setIsLoading(true);
        
        // Load course
        const course = await getCourse(resolvedParams.courseId);
        if (!course) {
          setError("Course not found");
          return;
        }
        
        setCurrentCourse(course);
        
        // Load or create session
        let session = await getSession(resolvedParams.courseId);
        if (!session) {
          // Create new session
          session = {
            courseId: course.id,
            phase: "high-level",
            conversationHistory: [],
            startedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            conceptProgress: new Map(),
            currentConceptIndex: 0,
            completedConcepts: [],
            abstractQuestionsAsked: [],
            timeSpent: 0,
          };
        }
        
        setCurrentSession(session);
        setCurrentPhase(session.phase);
        
      } catch (err) {
        console.error("Failed to load course:", err);
        setError("Failed to load course data");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadCourseData();
  }, [resolvedParams.courseId, getCourse, getSession, setCurrentCourse, setCurrentSession, setCurrentPhase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading course...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !currentCourse) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center space-y-4">
              <p className="text-destructive font-semibold">{error || "Course not found"}</p>
              <Button onClick={() => router.push("/")} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-4xl">
        {/* Course Header */}
        <div className="mb-8">
          <Button 
            onClick={() => router.push("/")} 
            variant="ghost" 
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">{currentCourse.name}</h1>
          <p className="text-muted-foreground">{currentCourse.description}</p>
          
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span>{currentCourse.concepts.length} concepts</span>
            <span>•</span>
            <span>{currentCourse.timeEstimate}</span>
            <span>•</span>
            <span>Phase: {currentPhase}</span>
          </div>
        </div>

        {/* Phase Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentPhase === "high-level" && "High-Level Understanding"}
              {currentPhase === "concept" && "Concept Learning"}
              {currentPhase === "memorization" && "Memorization Practice"}
              {currentPhase === "connections" && "Drawing Connections"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Phase components coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}