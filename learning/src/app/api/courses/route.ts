import { NextRequest, NextResponse } from "next/server";
import { BrowserStorage } from "@/lib/storage";
import { Course } from "@/types/course";

// GET /api/courses - Get all courses
export async function GET() {
  try {
    const courses = await BrowserStorage.getAllCourses();
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create a new course
export async function POST(request: NextRequest) {
  try {
    const course: Course = await request.json();
    await BrowserStorage.saveCourse(course);
    return NextResponse.json(course);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}