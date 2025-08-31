import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { 
      userAnswer,
      concept, 
      conversationHistory, 
      existingUnderstanding,
      unmasteredTopics 
    } = await request.json();
    
    if (!userAnswer || !concept || !conversationHistory || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const result = await aiService.generateConceptResponse(
      userAnswer,
      concept,
      conversationHistory,
      existingUnderstanding,
      unmasteredTopics
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate concept answer:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}