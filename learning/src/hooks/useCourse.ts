"use client";

import { useState, useCallback, useEffect } from "react";
import { Course, LearningSession } from "@/types/course";
import { BrowserStorage } from "@/lib/storage";

export function useCourse() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all courses on mount
  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/courses");
      if (!response.ok) throw new Error("Failed to load courses");
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCourse = useCallback(async (course: Course): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      
      if (!response.ok) throw new Error("Failed to save course");
      await loadCourses(); // Reload courses
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadCourses]);

  const getCourse = useCallback(async (courseId: string): Promise<Course | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to get course");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get course");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCourse = useCallback(async (course: Course): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      
      if (!response.ok) throw new Error("Failed to update course");
      await loadCourses(); // Reload courses
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update course");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadCourses]);

  const deleteCourse = useCallback(async (courseId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete course");
      await loadCourses(); // Reload courses
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadCourses]);

  const getSession = useCallback(async (courseId: string): Promise<LearningSession | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/sessions/${courseId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to get session");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get session");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSession = useCallback(async (session: LearningSession): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/sessions/${session.courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session)
      });
      
      if (!response.ok) throw new Error("Failed to save session");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (courseId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/sessions/${courseId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete session");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    courses,
    isLoading,
    error,
    loadCourses,
    saveCourse,
    getCourse,
    updateCourse,
    deleteCourse,
    getSession,
    saveSession,
    deleteSession,
  };
}