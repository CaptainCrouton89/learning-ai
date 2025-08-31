import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/services/ai";

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { topic, timeAvailable, existingUnderstanding } = await request.json();
    
    if (!topic || !timeAvailable || !existingUnderstanding) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const goals = await aiService.generateLearningGoals(
      topic,
      timeAvailable,
      existingUnderstanding
    );
    
    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Failed to generate learning goals:", error);
    return NextResponse.json(
      { error: "Failed to generate learning goals" },
      { status: 500 }
    );
  }
}