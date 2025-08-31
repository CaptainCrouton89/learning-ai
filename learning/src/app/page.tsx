"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCourse } from "@/hooks/useCourse";
import { useLearning } from "@/contexts/LearningContext";
import { BookOpen, Plus, Play, Trash2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { courses, isLoading, loadCourses, deleteCourse } = useCourse();
  const { setCurrentCourse, setCurrentSession } = useLearning();

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleStartNew = () => {
    setCurrentCourse(null);
    setCurrentSession(null);
    router.push("/learn/new");
  };

  const handleResumeCourse = async (courseId: string) => {
    router.push(`/learn/${courseId}`);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm("Are you sure you want to delete this course?")) {
      await deleteCourse(courseId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">AI Learning App</h1>
          <p className="text-muted-foreground">
            Personalized AI-powered learning experience tailored to your needs
          </p>
        </div>

        <div className="grid gap-6">
          {/* New Course Card */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Start New Learning Journey
              </CardTitle>
              <CardDescription>
                Create a personalized course based on your interests and available time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartNew} size="lg" className="w-full sm:w-auto">
                <BookOpen className="mr-2 h-4 w-4" />
                Create New Course
              </Button>
            </CardContent>
          </Card>

          {/* Existing Courses */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          ) : courses.length > 0 ? (
            <>
              <h2 className="text-2xl font-semibold mt-4">Your Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <Card key={course.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{course.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {course.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground">
                          {course.concepts.length} concepts • {course.timeEstimate}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleResumeCourse(course.id)}
                          className="flex-1"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteCourse(course.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your learning journey by creating your first course
                </p>
                <Button onClick={handleStartNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Course
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}