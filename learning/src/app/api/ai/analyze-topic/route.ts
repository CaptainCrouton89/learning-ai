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
    
    const analysis = await aiService.analyzeTopic(
      topic,
      timeAvailable,
      existingUnderstanding
    );
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to analyze topic:", error);
    return NextResponse.json(
      { error: "Failed to analyze topic" },
      { status: 500 }
    );
  }
}