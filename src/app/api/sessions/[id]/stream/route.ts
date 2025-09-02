import { openai } from '@ai-sdk/openai';
import { streamText, stepCountIs } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { models } from '../../../../../config/models.js';
import { getCourseManager, STORAGE_TYPE } from '../../../../../config/storage.js';
import { MongoCourseManager } from '../../../../../services/mongoCourseManager.js';
import { AIService } from '../../../../../services/ai/index.js';
import { aiTools } from '../../../../../lib/ai-tools.js';

// Helper function to load session with appropriate parameters
async function loadSessionSafely(courseManager: any, sessionId: string): Promise<any> {
  if (STORAGE_TYPE === 'mongodb' && courseManager instanceof MongoCourseManager) {
    // MongoDB version requires both courseId and userId - use sessionId as both for now
    return await courseManager.loadSession(sessionId, sessionId);
  } else {
    // File-based version only needs sessionId
    return await courseManager.loadSession(sessionId);
  }
}

// Define the expected request body schema
const StreamRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.date().optional()
  })),
  phase: z.enum(['high-level', 'concept-learning', 'memorization', 'drawing-connections']).optional(),
  conceptName: z.string().optional(),
  existingUnderstanding: z.string().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = (await params).id;
    const body = await request.json();
    
    // Validate request body
    const validatedRequest = StreamRequestSchema.parse(body);
    const { messages, phase, conceptName, existingUnderstanding } = validatedRequest;

    // Initialize services
    const courseManager = await getCourseManager();
    const aiService = new AIService();

    // Load session and course data
    const session = await loadSessionSafely(courseManager, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const course = await courseManager.loadCourse(session.courseId);
    if (!course) {
      return new Response('Course not found', { status: 404 });
    }

    // Convert UI messages to AI SDK format
    const aiMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];
    if (!latestUserMessage || latestUserMessage.role !== 'user') {
      return new Response('No user message found', { status: 400 });
    }

    // Add user message to conversation history
    await courseManager.addConversationEntry(session, 'user', latestUserMessage.content);

    // Build system prompt based on current phase and context
    let systemPrompt = '';
    let relevantTopics: string[] = [];

    if (phase === 'high-level') {
      // High-level phase - focus on foundational understanding
      relevantTopics = course.backgroundKnowledge && course.backgroundKnowledge.length > 0
        ? course.backgroundKnowledge
        : course.concepts.map(c => c.name);
      
      const comprehensionProgress = courseManager.getAllTopicsComprehension(
        session,
        'high-level',
        relevantTopics
      );

      let progressSummary = 'No prior progress';
      if (comprehensionProgress) {
        const entries = Array.from(comprehensionProgress.entries());
        progressSummary = entries
          .map(([topic, score]) => {
            const status = score >= 5 ? '✓' : score >= 3 ? '◐' : '○';
            return `${topic}: ${score}/5 ${status}`;
          })
          .join('\n');
      }

      systemPrompt = `You are a knowledgeable tutor helping a student learn ${course.name}. 
      
Current Phase: High-Level Overview
User Level: ${existingUnderstanding || 'Some - I know the basics'}
Topics to cover: ${relevantTopics.join(', ')}

Current Progress:
${progressSummary}

Your role:
1. Provide educational feedback on the user's answer
2. Ask follow-up questions to deepen understanding
3. Use the scoreComprehension tool to evaluate understanding of topics mentioned
4. Always include response length guidance in questions (e.g., "In 2-3 sentences...")
5. Keep responses conversational and encouraging

Guidelines:
- Score comprehension for topics the user actually addresses
- Never decrease existing comprehension scores
- Ask one focused follow-up question per response
- Acknowledge good understanding while identifying areas for improvement`;

    } else if (phase === 'concept-learning' && conceptName) {
      // Concept learning phase - focus on specific concept
      const concept = course.concepts.find(c => c.name === conceptName);
      if (!concept) {
        return new Response('Concept not found', { status: 400 });
      }

      const unmasteredTopics = courseManager.getUnmasteredTopics(session, conceptName, concept['high-level']);
      
      systemPrompt = `You are a knowledgeable tutor helping a student learn the "${conceptName}" concept in ${course.name}.

Current Phase: Concept Learning - ${conceptName}
User Level: ${existingUnderstanding || 'Some - I know the basics'}
Topics to master: ${concept['high-level'].join(', ')}
Unmastered topics: ${unmasteredTopics.join(', ') || 'All topics mastered'}

Your role:
1. Provide detailed explanations and feedback
2. Ask questions that help master the unmastered topics
3. Use the scoreComprehension tool to evaluate topic understanding
4. Always include response length guidance in questions
5. Build on previous understanding while addressing gaps

Guidelines:
- Focus questions on unmastered topics when possible
- Score comprehension for topics the user demonstrates understanding of
- Provide rich, detailed explanations
- Connect concepts to real-world applications`;

    } else if (phase === 'memorization' && conceptName) {
      // Memorization phase - flashcard interactions
      systemPrompt = `You are a flashcard tutor helping a student memorize key items for the "${conceptName}" concept in ${course.name}.

Current Phase: Memorization - ${conceptName}
User Level: ${existingUnderstanding || 'Some - I know the basics'}

Your role:
1. Evaluate flashcard answers using the evaluateFlashcard tool
2. Provide immediate feedback on accuracy and completeness
3. Ask follow-up questions to reinforce learning
4. Encourage spaced repetition for difficult items

Guidelines:
- Use the evaluateFlashcard tool for all answer evaluations
- Provide specific feedback on what was correct/incorrect
- Suggest memory techniques when helpful
- Be encouraging about progress`;

    } else {
      // Default system prompt
      systemPrompt = `You are a knowledgeable tutor helping a student learn ${course.name}.
      
Your role is to provide educational feedback, ask thoughtful questions, and help the student build understanding.
Use the appropriate tools to evaluate comprehension and track progress.`;
    }

    // Create the streaming response
    const result = streamText({
      model: models.fast,
      messages: [
        { role: 'system', content: systemPrompt },
        ...aiMessages
      ],
      tools: aiTools,
      stopWhen: stepCountIs(3), // Allow up to 3 tool execution steps
      onStepFinish: ({ toolCalls, toolResults }) => {
        console.log('Tool execution completed:', {
          toolCalls: toolCalls?.length ?? 0,
          toolResults: toolResults?.length ?? 0
        });
      },
      onFinish: async ({ text, usage }) => {
        if (text) {
          // Add AI response to conversation history
          await courseManager.addConversationEntry(session, 'assistant', text);
        }
        
        console.log('Stream finished:', {
          textLength: text?.length ?? 0,
          usage
        });
      }
    });

    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('Streaming API error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format', details: error.issues }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}