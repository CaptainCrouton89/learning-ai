import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      connections,
      course,
      previousQuestions,
      existingUnderstanding
    } = await request.json();
    
    if (!connections || !course || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const question = await aiService.generateConnectionQuestion(
      connections,
      course,
      previousQuestions || [],
      existingUnderstanding
    );
    
    return NextResponse.json({ question });
  } catch (error) {
    console.error("Failed to generate connection question:", error);
    return NextResponse.json(
      { error: "Failed to generate question" },
      { status: 500 }
    );
  }
}