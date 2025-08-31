import { NextRequest, NextResponse } from "next/server";
import { BrowserStorage } from "@/lib/storage";
import { Course } from "@/types/course";

// GET /api/courses/[courseId] - Get a specific course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const course = await BrowserStorage.getCourse(courseId);
    
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(course);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

// PUT /api/courses/[courseId] - Update a course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const course: Course = await request.json();
    
    if (course.id !== courseId) {
      return NextResponse.json(
        { error: "Course ID mismatch" },
        { status: 400 }
      );
    }
    
    await BrowserStorage.saveCourse(course);
    return NextResponse.json(course);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[courseId] - Delete a course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    await BrowserStorage.deleteCourse(courseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}