import { NextRequest, NextResponse } from "next/server";
import { BrowserStorage } from "@/lib/storage";
import { LearningSession } from "@/types/course";

// GET /api/sessions/[courseId] - Get session for a course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session = await BrowserStorage.getSession(courseId);
    
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// PUT /api/sessions/[courseId] - Update/create session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session: LearningSession = await request.json();
    
    if (session.courseId !== courseId) {
      return NextResponse.json(
        { error: "Course ID mismatch" },
        { status: 400 }
      );
    }
    
    await BrowserStorage.saveSession(session);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[courseId] - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    await BrowserStorage.deleteSession(courseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}