import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      item,
      fields,
      userAnswer,
      concept,
      otherConcepts,
      previousAttempts,
      existingUnderstanding 
    } = await request.json();
    
    if (!item || !fields || !userAnswer || !concept || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const result = await aiService.evaluateFlashcardAnswer(
      item,
      fields,
      userAnswer,
      concept,
      otherConcepts || [],
      previousAttempts || [],
      existingUnderstanding
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate flashcard answer:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}