"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Course, LearningSession } from "@/types/course";
import { CourseCard } from "@/components/courses/CourseCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookOpen, Clock, TrendingUp, Filter } from "lucide-react";

interface CourseWithSession {
  course: Course;
  session: LearningSession | null;
}

interface DashboardStats {
  totalCourses: number;
  activeCourses: number;
  completedCourses: number;
  totalTimeSpent: string;
}

export default function DashboardPage() {
  const [courses, setCourses] = useState<CourseWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "not-started">("all");
  const [stats, setStats] = useState<DashboardStats>({
    totalCourses: 0,
    activeCourses: 0,
    completedCourses: 0,
    totalTimeSpent: "0h"
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      console.log("🔄 Fetching courses...");
      const response = await fetch("/api/courses");
      console.log("📡 Response status:", response.status);
      if (!response.ok) throw new Error("Failed to fetch courses");
      
      const data = await response.json();
      console.log("📦 Raw API data:", data);
      const coursesData: Course[] = data.data?.courses || [];
      console.log("📚 Courses data:", coursesData);
      console.log("📊 Number of courses:", coursesData.length);
      
      // Load sessions for each course
      const coursesWithSessions = await Promise.all(
        coursesData.map(async (course: Course) => {
          try {
            console.log(`🎯 Loading session for course: ${course.name}`);
            const sessionResponse = await fetch(`/api/sessions?courseId=${course.name}`);
            const session: LearningSession | null = sessionResponse.ok ? await sessionResponse.json() as LearningSession : null;
            console.log(`📋 Session for ${course.name}:`, session ? 'found' : 'not found');
            return { course, session };
          } catch (error) {
            console.log(`❌ Error loading session for ${course.name}:`, error);
            return { course, session: null };
          }
        })
      );

      console.log("🎓 Courses with sessions:", coursesWithSessions);
      setCourses(coursesWithSessions);
      
      // Calculate stats
      const totalCourses = coursesWithSessions.length;
      const activeCourses = coursesWithSessions.filter(({ session }) => 
        session && session.currentPhase !== "drawing-connections"
      ).length;
      const completedCourses = coursesWithSessions.filter(({ session }) => 
        session && session.currentPhase === "drawing-connections"
      ).length;

      setStats({
        totalCourses,
        activeCourses,
        completedCourses,
        totalTimeSpent: "0h" // TODO: Calculate from session data
      });
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(({ course, session }) => {
    // Search filter - handle both full course objects and summary format
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.concepts && course.concepts.some(concept => 
        concept.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    
    if (!matchesSearch) return false;

    // Status filter
    switch (filterStatus) {
      case "active":
        return session && session.currentPhase !== "drawing-connections";
      case "completed":
        return session && session.currentPhase === "drawing-connections";
      case "not-started":
        return !session;
      default:
        return true;
    }
  });

  console.log("🔍 Filtered courses:", filteredCourses);
  console.log("🔍 Total courses before filter:", courses.length);
  console.log("🔍 Filtered courses count:", filteredCourses.length);
  console.log("🔍 Search term:", searchTerm);
  console.log("🔍 Filter status:", filterStatus);

  const handleResumeCourse = async (courseName: string) => {
    // TODO: Navigate to learning session
    console.log("Resume course:", courseName);
  };

  const handleArchiveCourse = async (courseName: string) => {
    if (!window.confirm("Are you sure you want to archive this course?")) return;
    
    try {
      const response = await fetch(`/api/courses/${courseName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      
      if (response.ok) {
        loadCourses();
      }
    } catch (error) {
      console.error("Failed to archive course:", error);
    }
  };

  const handleDeleteCourse = async (courseName: string) => {
    if (!window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;
    
    try {
      const response = await fetch(`/api/courses/${courseName}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        loadCourses();
      }
    } catch (error) {
      console.error("Failed to delete course:", error);
    }
  };

  const handleDuplicateCourse = async (courseName: string) => {
    try {
      const response = await fetch(`/api/courses/${courseName}/duplicate`, {
        method: "POST",
      });
      
      if (response.ok) {
        loadCourses();
      }
    } catch (error) {
      console.error("Failed to duplicate course:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold">Learning Dashboard</h1>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-3 sm:p-6">
                  <div className="h-3 sm:h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-6 sm:h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Learning Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track your progress and manage your learning journey
            </p>
          </div>
          <Link href="/courses/new">
            <Button className="flex items-center gap-2 w-full sm:w-auto h-12 sm:h-10 touch-manipulation">
              <Plus className="w-4 h-4" />
              <span className="sm:hidden">Create Course</span>
              <span className="hidden sm:inline">Create Course</span>
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="touch-manipulation">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Courses</CardTitle>
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalCourses}</div>
            </CardContent>
          </Card>
          
          <Card className="touch-manipulation">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.activeCourses}</div>
            </CardContent>
          </Card>

          <Card className="touch-manipulation">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.completedCourses}</div>
            </CardContent>
          </Card>

          <Card className="touch-manipulation col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Time Spent</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalTimeSpent}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 sm:h-10 text-base touch-manipulation"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
              className="h-10 touch-manipulation whitespace-nowrap"
            >
              All
            </Button>
            <Button
              variant={filterStatus === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("active")}
              className="h-10 touch-manipulation whitespace-nowrap"
            >
              Active
            </Button>
            <Button
              variant={filterStatus === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("completed")}
              className="h-10 touch-manipulation whitespace-nowrap"
            >
              Completed
            </Button>
            <Button
              variant={filterStatus === "not-started" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("not-started")}
              className="h-10 touch-manipulation whitespace-nowrap"
            >
              <span className="hidden sm:inline">Not Started</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || filterStatus !== "all" ? "No courses match your filters" : "No courses found"}
              </h3>
              <p className="text-muted-foreground mb-4 text-center">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "Start your learning journey by creating your first course."
                }
              </p>
              {!searchTerm && filterStatus === "all" && (
                <Link href="/courses/new">
                  <Button className="flex items-center gap-2 h-12 sm:h-10 touch-manipulation">
                    <Plus className="w-4 h-4" />
                    Create Your First Course
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredCourses.map(({ course, session }) => (
              <CourseCard
                key={course.name}
                course={course}
                session={session}
                onResume={handleResumeCourse}
                onArchive={handleArchiveCourse}
                onDelete={handleDeleteCourse}
                onDuplicate={handleDuplicateCourse}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}