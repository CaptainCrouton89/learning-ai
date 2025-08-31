import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      topic, 
      documentContent, 
      timeAvailable, 
      existingUnderstanding, 
      learningGoals 
    } = await request.json();
    
    if (!topic || !timeAvailable || !existingUnderstanding || !learningGoals) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const course = await aiService.generateCourseStructure(
      topic,
      documentContent || null,
      timeAvailable,
      existingUnderstanding,
      learningGoals
    );
    
    return NextResponse.json(course);
  } catch (error) {
    console.error("Failed to generate course:", error);
    return NextResponse.json(
      { error: "Failed to generate course structure" },
      { status: 500 }
    );
  }
}