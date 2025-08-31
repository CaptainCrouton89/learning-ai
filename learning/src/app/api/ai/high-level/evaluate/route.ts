import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      userAnswer,
      course, 
      conversationHistory, 
      existingUnderstanding,
      comprehensionProgress 
    } = await request.json();
    
    if (!userAnswer || !course || !conversationHistory || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Convert array back to Map if provided
    const progressMap = comprehensionProgress 
      ? new Map<string, number>(comprehensionProgress)
      : undefined;
    
    const result = await aiService.generateHighLevelResponse(
      userAnswer,
      course,
      conversationHistory,
      existingUnderstanding,
      progressMap
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate high-level answer:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}