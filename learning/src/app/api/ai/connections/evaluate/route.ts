import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      question,
      userAnswer,
      course,
      existingUnderstanding
    } = await request.json();
    
    if (!question || !userAnswer || !course || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const result = await aiService.evaluateConnectionAnswer(
      question,
      userAnswer,
      course,
      existingUnderstanding
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate connection answer:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}