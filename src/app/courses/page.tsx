"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Course, LearningSession } from "@/types/course";
import { CourseCard } from "@/components/courses/CourseCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Search, 
  BookOpen, 
  Archive, 
  Trash2, 
  MoreVertical,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  Upload
} from "lucide-react";

interface CourseWithSession {
  course: Course;
  session: LearningSession | null;
}

type SortOption = "name" | "created" | "progress" | "activity";
type SortDirection = "asc" | "desc";

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "not-started" | "archived">("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/courses");
      if (!response.ok) throw new Error("Failed to fetch courses");
      
      const coursesData = await response.json() as Course[];
      
      // Load sessions for each course
      const coursesWithSessions = await Promise.all(
        coursesData.map(async (course: Course) => {
          try {
            const sessionResponse = await fetch(`/api/sessions?courseId=${course.name}`);
            const session: LearningSession | null = sessionResponse.ok ? await sessionResponse.json() as LearningSession : null;
            return { course, session };
          } catch {
            return { course, session: null };
          }
        })
      );

      setCourses(coursesWithSessions);
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCourses = courses
    .filter(({ course, session }) => {
      // Search filter
      const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.concepts.some(concept => 
          concept.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      if (!matchesSearch) return false;

      // Status filter
      switch (filterStatus) {
        case "active":
          return session && session.currentPhase !== "drawing-connections";
        case "completed":
          return session && session.currentPhase === "drawing-connections";
        case "not-started":
          return !session;
        case "archived":
          // TODO: Add archived flag to course
          return false;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "name":
          aValue = a.course.name.toLowerCase();
          bValue = b.course.name.toLowerCase();
          break;
        case "progress":
          // Calculate progress based on phase
          const getProgress = (session: LearningSession | null) => {
            if (!session) return 0;
            const phaseProgress = {
              initialization: 20,
              "high-level": 40,
              "concept-learning": 60,
              memorization: 80,
              "drawing-connections": 100
            };
            return phaseProgress[session.currentPhase] || 0;
          };
          aValue = getProgress(a.session);
          bValue = getProgress(b.session);
          break;
        case "activity":
          aValue = a.session ? new Date(a.session.lastActivityTime).getTime() : 0;
          bValue = b.session ? new Date(b.session.lastActivityTime).getTime() : 0;
          break;
        case "created":
          aValue = a.session ? new Date(a.session.startTime).getTime() : 0;
          bValue = b.session ? new Date(b.session.startTime).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

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

  const handleBulkDelete = async () => {
    if (selectedCourses.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedCourses.length} courses? This action cannot be undone.`)) return;
    
    try {
      await Promise.all(
        selectedCourses.map(courseName => 
          fetch(`/api/courses/${courseName}`, { method: "DELETE" })
        )
      );
      setSelectedCourses([]);
      loadCourses();
    } catch (error) {
      console.error("Failed to delete courses:", error);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedCourses.length === 0) return;
    if (!window.confirm(`Are you sure you want to archive ${selectedCourses.length} courses?`)) return;
    
    try {
      await Promise.all(
        selectedCourses.map(courseName => 
          fetch(`/api/courses/${courseName}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
          })
        )
      );
      setSelectedCourses([]);
      loadCourses();
    } catch (error) {
      console.error("Failed to archive courses:", error);
    }
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortDirection("asc");
    }
  };

  const toggleCourseSelection = (courseName: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseName)
        ? prev.filter(name => name !== courseName)
        : [...prev, courseName]
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="animate-pulse space-y-4 sm:space-y-6">
          <div className="h-6 sm:h-8 bg-muted rounded w-1/2 sm:w-1/4"></div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-12 sm:h-10 bg-muted rounded flex-1"></div>
            <div className="h-10 bg-muted rounded w-full sm:w-32"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-56 sm:h-64 bg-muted rounded"></div>
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
            <h1 className="text-2xl sm:text-3xl font-bold">Course Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage all your learning courses in one place
            </p>
          </div>
          <Link href="/courses/new">
            <Button className="flex items-center gap-2 w-full sm:w-auto h-12 sm:h-10 touch-manipulation">
              <Plus className="w-4 h-4" />
              Create Course
            </Button>
          </Link>
        </div>

        {/* Bulk Actions */}
        {selectedCourses.length > 0 && (
          <Card className="border-primary">
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedCourses.length} selected</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedCourses([])}
                  className="h-8 touch-manipulation"
                >
                  Clear
                </Button>
              </div>
              <div className="flex gap-2 flex-1 sm:flex-none">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkArchive}
                  className="flex items-center gap-2 h-10 touch-manipulation flex-1 sm:flex-none"
                >
                  <Archive className="w-4 h-4" />
                  <span className="hidden sm:inline">Archive</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 text-destructive hover:text-destructive h-10 touch-manipulation flex-1 sm:flex-none"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Controls */}
        <div className="space-y-4 sm:space-y-0 sm:flex sm:flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 sm:h-10 text-base touch-manipulation"
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
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
            <Button
              variant={filterStatus === "archived" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("archived")}
              className="h-10 touch-manipulation whitespace-nowrap"
            >
              Archived
            </Button>
          </div>

          {/* Sort */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("name")}
              className="flex items-center gap-2 h-10 touch-manipulation whitespace-nowrap"
            >
              Name
              {sortBy === "name" && (
                sortDirection === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("progress")}
              className="flex items-center gap-2 h-10 touch-manipulation whitespace-nowrap"
            >
              Progress
              {sortBy === "progress" && (
                sortDirection === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("activity")}
              className="flex items-center gap-2 h-10 touch-manipulation whitespace-nowrap"
            >
              Activity
              {sortBy === "activity" && (
                sortDirection === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Course Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAndSortedCourses.length} of {courses.length} courses
          </p>
          
          {/* Additional Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2 h-10 touch-manipulation">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2 h-10 touch-manipulation">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          </div>
        </div>

        {/* Courses Grid */}
        {filteredAndSortedCourses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || filterStatus !== "all" ? "No courses match your criteria" : "No courses found"}
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
            {filteredAndSortedCourses.map(({ course, session }) => (
              <div key={course.name} className="relative">
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course.name)}
                    onChange={() => toggleCourseSelection(course.name)}
                    className="w-5 h-5 text-primary bg-background border-2 rounded focus:ring-primary focus:ring-2 touch-manipulation"
                  />
                </div>
                
                <CourseCard
                  course={course}
                  session={session}
                  onResume={handleResumeCourse}
                  onArchive={handleArchiveCourse}
                  onDelete={handleDeleteCourse}
                  onDuplicate={handleDuplicateCourse}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}