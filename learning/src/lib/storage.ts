// Browser-compatible storage for courses and sessions
// Uses localStorage for persistence

import { Course, LearningSession } from "@/types/course";

const STORAGE_PREFIX = "learning_app_";
const COURSES_KEY = `${STORAGE_PREFIX}courses`;
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;

export class BrowserStorage {
  // Course operations
  static async saveCourse(course: Course): Promise<void> {
    const courses = await this.getAllCourses();
    const index = courses.findIndex(c => c.id === course.id);
    
    if (index >= 0) {
      courses[index] = course;
    } else {
      courses.push(course);
    }
    
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  }

  static async getCourse(courseId: string): Promise<Course | null> {
    const courses = await this.getAllCourses();
    return courses.find(c => c.id === courseId) || null;
  }

  static async getAllCourses(): Promise<Course[]> {
    const data = localStorage.getItem(COURSES_KEY);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static async deleteCourse(courseId: string): Promise<void> {
    const courses = await this.getAllCourses();
    const filtered = courses.filter(c => c.id !== courseId);
    localStorage.setItem(COURSES_KEY, JSON.stringify(filtered));
    
    // Also delete associated session
    await this.deleteSession(courseId);
  }

  // Session operations
  static async saveSession(session: LearningSession): Promise<void> {
    const sessions = await this.getAllSessions();
    const key = `${session.courseId}`;
    sessions[key] = session;
    
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  static async getSession(courseId: string): Promise<LearningSession | null> {
    const sessions = await this.getAllSessions();
    return sessions[courseId] || null;
  }

  static async getAllSessions(): Promise<Record<string, LearningSession>> {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) return {};
    
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static async deleteSession(courseId: string): Promise<void> {
    const sessions = await this.getAllSessions();
    delete sessions[courseId];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  // Utility methods
  static clearAll(): void {
    localStorage.removeItem(COURSES_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  }

  static exportData(): { courses: Course[]; sessions: Record<string, LearningSession> } {
    return {
      courses: JSON.parse(localStorage.getItem(COURSES_KEY) || "[]"),
      sessions: JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}")
    };
  }

  static importData(data: { courses: Course[]; sessions: Record<string, LearningSession> }): void {
    localStorage.setItem(COURSES_KEY, JSON.stringify(data.courses));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(data.sessions));
  }
}