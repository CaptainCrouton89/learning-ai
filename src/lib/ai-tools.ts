import { tool } from "ai";
import { z } from "zod";
import { EvaluationService } from "../services/ai/evaluationService.js";
import { getCourseManager, STORAGE_TYPE } from "../config/storage.js";
import { MongoCourseManager } from "../services/mongoCourseManager.js";
import type { Course, LearningSession, ConceptAttempt } from "../types/course.js";

// Helper function to load session with appropriate parameters
async function loadSessionSafely(courseManager: any, sessionId: string, courseId: string): Promise<LearningSession | null> {
  if (STORAGE_TYPE === 'mongodb' && courseManager instanceof MongoCourseManager) {
    // MongoDB version requires both courseId and userId
    return await courseManager.loadSession(courseId, sessionId);
  } else {
    // File-based version only needs sessionId (which is the courseId in their system)
    return await courseManager.loadSession(sessionId);
  }
}

// Initialize evaluation service
const evaluationService = new EvaluationService();

/**
 * Tool for evaluating flashcard answers with comprehension scoring
 */
export const evaluateFlashcard = tool({
  description: "Evaluate a flashcard answer and provide comprehension score and feedback",
  inputSchema: z.object({
    sessionId: z.string().describe("Learning session ID"),
    courseId: z.string().describe("Course ID"),
    conceptName: z.string().describe("Name of the concept being learned"),
    item: z.string().describe("The flashcard item being answered"),
    fields: z.array(z.string()).describe("Fields that should be covered in the answer"),
    userAnswer: z.string().describe("User's answer to the flashcard"),
    existingUnderstanding: z.string().describe("User's existing understanding level"),
    previousAttempts: z.array(z.object({
      userAnswer: z.string(),
      aiResponse: z.string()
    })).describe("Previous attempts for this item")
  }),
  execute: async ({ sessionId, courseId, conceptName, item, fields, userAnswer, existingUnderstanding, previousAttempts }) => {
    try {
      const courseManager = await getCourseManager();
      
      // Load the course and session
      const course = await courseManager.loadCourse(courseId);
      const session = await loadSessionSafely(courseManager, sessionId, courseId);
      
      if (!course || !session) {
        throw new Error("Course or session not found");
      }

      // Find the concept
      const concept = course.concepts.find(c => c.name === conceptName);
      if (!concept) {
        throw new Error(`Concept ${conceptName} not found`);
      }

      // Get other concepts for context
      const otherConcepts = course.concepts
        .filter(c => c.name !== conceptName)
        .map(c => c.name);

      // Evaluate the flashcard answer
      const result = await evaluationService.evaluateFlashcardAnswer(
        item,
        fields,
        userAnswer,
        concept,
        otherConcepts,
        previousAttempts,
        existingUnderstanding
      );

      // Create attempt record
      const attempt = {
        question: `Flashcard: ${item}`,
        userAnswer,
        aiResponse: {
          comprehension: result.comprehension,
          response: result.response
        },
        timestamp: new Date()
      };

      // Update item progress
      await courseManager.updateItemProgress(session, conceptName, item, attempt);

      return {
        comprehension: result.comprehension,
        response: result.response,
        success: result.comprehension >= 4,
        message: `Flashcard evaluated. Comprehension: ${result.comprehension}/5`
      };

    } catch (error) {
      console.error("Error evaluating flashcard:", error);
      return {
        comprehension: 0,
        response: "An error occurred while evaluating your answer. Please try again.",
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool for scoring comprehension across multiple topics
 */
export const scoreComprehension = tool({
  description: "Score user comprehension across multiple learning topics",
  inputSchema: z.object({
    sessionId: z.string().describe("Learning session ID"),
    userAnswer: z.string().describe("User's answer to be evaluated"),
    topics: z.array(z.string()).describe("Topics to evaluate comprehension for"),
    contextType: z.enum(["high-level", "concept"]).describe("Type of learning context"),
    conceptName: z.string().optional().describe("Specific concept name if contextType is concept"),
    existingUnderstanding: z.string().describe("User's existing understanding level")
  }),
  execute: async ({ sessionId, userAnswer, topics, contextType, conceptName, existingUnderstanding }) => {
    try {
      const courseManager = await getCourseManager();
      const session = await loadSessionSafely(courseManager, sessionId, sessionId);
      
      if (!session) {
        throw new Error("Session not found");
      }

      // Get conversation history for context
      const conversationHistory = session.conversationHistory.slice(-6);

      // Score comprehension
      const comprehensionUpdates = await evaluationService.scoreComprehension(
        userAnswer,
        topics,
        conversationHistory,
        existingUnderstanding,
        contextType,
        conceptName
      );

      // Update progress for each topic
      const improvedTopics = [];
      for (const update of comprehensionUpdates) {
        const contextKey = contextType === "high-level" ? "high-level" : conceptName!;
        
        // Get current comprehension
        const conceptProgress = session.conceptsProgress.get(contextKey);
        const currentComprehension = conceptProgress?.topicProgress.get(update.topic)?.currentComprehension ?? 0;
        
        // Only update if score improved
        const finalComprehension = Math.max(currentComprehension, update.comprehension);
        
        if (finalComprehension > currentComprehension) {
          improvedTopics.push({
            topic: update.topic,
            oldScore: currentComprehension,
            newScore: finalComprehension
          });

          // Create attempt record
          const attempt: ConceptAttempt = {
            question: session.conversationHistory[session.conversationHistory.length - 2]?.content || "Question not found",
            userAnswer,
            aiResponse: {
              comprehension: finalComprehension,
              response: "Comprehension scored",
              targetTopic: update.topic
            },
            timestamp: new Date()
          };

          // Update topic progress
          await courseManager.updateConceptTopicProgress(session, contextKey, attempt);
        }
      }

      return {
        comprehensionUpdates,
        improvedTopics,
        message: `Scored comprehension for ${comprehensionUpdates.length} topics`
      };

    } catch (error) {
      console.error("Error scoring comprehension:", error);
      return {
        comprehensionUpdates: [],
        improvedTopics: [],
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool for updating session progress and phase information
 */
export const updateSessionProgress = tool({
  description: "Update learning session progress and phase information",
  inputSchema: z.object({
    sessionId: z.string().describe("Learning session ID"),
    phase: z.enum(["initialization", "high-level", "concept-learning", "memorization", "drawing-connections"]).optional().describe("New phase to set"),
    conceptName: z.string().optional().describe("Current concept being worked on"),
    progressNotes: z.string().optional().describe("Notes about current progress")
  }),
  execute: async ({ sessionId, phase, conceptName, progressNotes }) => {
    try {
      const courseManager = await getCourseManager();
      const session = await loadSessionSafely(courseManager, sessionId, sessionId);
      
      if (!session) {
        throw new Error("Session not found");
      }

      // Update phase if provided
      if (phase) {
        await courseManager.updateSessionPhase(session, phase, conceptName);
      }

      // Add progress notes to conversation if provided
      if (progressNotes) {
        await courseManager.addConversationEntry(session, "assistant", progressNotes);
      }

      return {
        success: true,
        currentPhase: session.currentPhase,
        currentConcept: session.currentConcept,
        message: "Session progress updated successfully"
      };

    } catch (error) {
      console.error("Error updating session progress:", error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

// Export all tools as a collection
export const aiTools = {
  evaluateFlashcard,
  scoreComprehension,
  updateSessionProgress
};

export type AITools = typeof aiTools;