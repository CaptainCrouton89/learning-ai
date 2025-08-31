import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      concept, 
      conversationHistory, 
      existingUnderstanding, 
      isFirstQuestion 
    } = await request.json();
    
    if (!concept || !conversationHistory || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const question = await aiService.generateConceptQuestion(
      concept,
      conversationHistory,
      existingUnderstanding,
      isFirstQuestion
    );
    
    return NextResponse.json({ question });
  } catch (error) {
    console.error("Failed to generate concept question:", error);
    return NextResponse.json(
      { error: "Failed to generate question" },
      { status: 500 }
    );
  }
}