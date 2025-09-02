"use client";

import { CourseCreationWizard } from "@/components/courses/CourseCreationWizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Course } from "@/types/course";
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CourseCreationData {
  topic: string;
  documentContent?: string;
  timeAvailable: string;
  existingUnderstanding: string;
  focusDescription: string;
  learningGoals?: string[];
  selectedGoal?: string;
}

export default function NewCoursePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCourse, setCreatedCourse] = useState<Course | null>(null);

  const handleCreateCourse = async (courseData: CourseCreationData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the course generation API
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: courseData.topic,
          documentContent: courseData.documentContent,
          timeAvailable: courseData.timeAvailable,
          existingUnderstanding: courseData.existingUnderstanding,
          focusDescription: courseData.focusDescription,
        }),
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(errorData.error || "Failed to create course");
      }

      const course = (await response.json()) as Course;

      // Save the course
      const saveResponse = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(course),
      });

      if (!saveResponse.ok) {
        const errorData: any = await saveResponse.json();
        throw new Error(errorData.error || "Failed to save course");
      }

      setCreatedCourse(course);
      setSuccess(true);
    } catch (error) {
      console.error("Course creation error:", error);
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  const handleStartLearning = () => {
    if (createdCourse) {
      router.push(`/learn/${createdCourse.name}`);
    }
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  if (success && createdCourse) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 h-10 touch-manipulation"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
          </div>

          {/* Success Card */}
          <Card>
            <CardContent className="flex flex-col items-center text-center py-8 sm:py-12 px-4 sm:px-6">
              <CheckCircle className="w-12 sm:w-16 h-12 sm:h-16 text-green-500 mb-4 sm:mb-6" />
              <h2 className="text-xl sm:text-2xl font-bold mb-2">
                Course Created Successfully!
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md">
                Your course "{createdCourse.name}" is ready. You can start
                learning right away or manage it from your dashboard.
              </p>

              {/* Course Summary */}
              <div className="w-full max-w-md space-y-4 mb-8 p-4 bg-muted rounded-lg text-left">
                <h3 className="font-semibold">Course Summary:</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {createdCourse.name}
                  </p>
                  <p>
                    <span className="font-medium">Concepts:</span>{" "}
                    {createdCourse.concepts.length}
                  </p>
                  <p>
                    <span className="font-medium">Total Items:</span>{" "}
                    {createdCourse.concepts.reduce(
                      (sum, concept) => sum + concept.memorize.items.length,
                      0
                    )}
                  </p>
                  <div className="pt-2">
                    <p className="font-medium mb-1">Learning Topics:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                      {createdCourse.concepts.slice(0, 3).map((concept) => (
                        <li key={concept.name}>{concept.name}</li>
                      ))}
                      {createdCourse.concepts.length > 3 && (
                        <li>
                          + {createdCourse.concepts.length - 3} more concepts
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <Button
                  onClick={handleStartLearning}
                  size="lg"
                  className="flex items-center gap-2 h-12 touch-manipulation"
                >
                  Start Learning Now
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackToDashboard}
                  size="lg"
                  className="h-12 touch-manipulation"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 sm:mb-6">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 h-10 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">
                  Course Creation Failed
                </h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Course Creation Wizard */}
        <CourseCreationWizard
          onComplete={handleCreateCourse}
          onCancel={handleCancel}
          isLoading={isLoading}
        />

        {/* Loading State Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card>
              <CardContent className="flex flex-col items-center py-8 px-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <h3 className="font-semibold mb-2">Creating Your Course</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Our AI is generating a personalized learning experience for
                  you.
                  <br />
                  This may take a few moments...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Help Information */}
        <Card className="mt-6 sm:mt-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Topic Selection</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Choose any subject you want to learn about. You can specify
                  broad topics like "JavaScript" or narrow ones like "React
                  hooks patterns".
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Document Upload</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Upload PDFs, text files, or markdown documents to create a
                  course based on specific material you need to learn.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Time Planning</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Select how much time you have available. This helps create
                  appropriately sized lessons and learning objectives.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Learning Focus</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Be specific about what you want to achieve. This helps
                  generate more targeted questions and exercises.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
