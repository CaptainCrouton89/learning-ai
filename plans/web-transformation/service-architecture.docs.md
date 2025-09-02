# Service Architecture Analysis - Learning AI Web Transformation

## Executive Summary

The learning-ai application follows a well-structured service-oriented architecture with clear separation of concerns. The system is designed around a 5-phase learning flow with robust session management, AI-driven interactions, and flexible storage backends. This analysis covers the current architecture patterns and provides strategic recommendations for web transformation.

## Current Service Architecture Overview

### Core Service Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Commands Layer                       │
│  start.ts │ resume.ts │ list.ts                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Phases Layer                                │
│  initialization │ highLevel │ conceptLearning │ memorization │  │
│  drawingConnections                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Services Layer                               │
├─────────────────────────┬───────────────────────────────────────┤
│      CourseManager      │            AIService                  │
│  ┌─────────────────────┐│  ┌───────────────────────────────────┐│
│  │   CourseManager     ││  │  CourseService                    ││
│  │ (File-based JSON)   ││  │  GenerationService                ││
│  └─────────────────────┘│  │  EvaluationService                ││
│  ┌─────────────────────┐│  └───────────────────────────────────┘│
│  │ MongoCourseManager  ││                                       │
│  │ (MongoDB-based)     ││                                       │
│  └─────────────────────┘│                                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                  Persistence Layer                              │
│  File System (JSON) │ MongoDB Atlas                            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components Deep Dive

#### 1. AIService Facade Pattern
**File**: `src/services/ai/index.ts`

The AIService acts as a facade that coordinates three specialized services:

- **CourseService**: Topic analysis, course generation, concept detail generation
- **GenerationService**: Question generation across all learning phases
- **EvaluationService**: Answer evaluation, comprehension scoring, response generation

**Key Patterns**:
```typescript
// Delegation pattern - clean API surface
async generateHighLevelQuestion(course, history, understanding, isFirst) {
  return this.generationService.generateHighLevelQuestion(
    course, history, understanding, isFirst
  );
}

// Structured AI responses using Zod schemas
const { object } = await generateObject({
  model: models.fast,
  schema: FlashcardResponseSchema,
  system: prompts.system,
  prompt: prompts.userPrompt(...)
});
```

#### 2. Dual Storage Architecture
**Files**: `src/services/courseManager.ts`, `src/services/mongoCourseManager.ts`

Both storage implementations provide identical interfaces but different persistence strategies:

**CourseManager (File-based)**:
- Local file system storage (`courses/`, `sessions/`)
- JSON serialization with Map-to-Array conversion
- Direct file system operations

**MongoCourseManager (MongoDB-based)**:
- MongoDB Atlas integration with connection pooling
- Document schemas with proper indexing
- Automatic upserts and timestamps

**Key Pattern - Storage Abstraction**:
```typescript
// Configuration-driven storage selection
export async function getCourseManager(): Promise<CourseManager | MongoCourseManager> {
  if (STORAGE_TYPE === 'mongodb') {
    const manager = new MongoCourseManager();
    await manager.initialize();
    return manager;
  } else {
    return new CourseManager();
  }
}
```

#### 3. Complex Data Structure Handling

The system handles deeply nested Maps for tracking learning progress:

```typescript
// Runtime structure
conceptsProgress: Map<string, ConceptProgress>
  └── ConceptProgress {
    itemsProgress: Map<string, ItemProgress>
    topicProgress: Map<string, TopicProgress>
    specialQuestionsAsked: Array<SpecialQuestion>
  }

// Serialization for persistence
conceptsProgress: Array<{
  conceptName: string,
  itemsProgress: Array<ItemProgress>,
  topicProgress: Array<TopicProgress>,
  specialQuestionsAsked: Array<SpecialQuestion>
}>
```

## Data Flow Patterns

### 1. Phase-Driven Learning Flow

```
Initialization Phase
    ↓ (creates Course + LearningSession)
High-Level Phase  
    ↓ (updates conceptsProgress["high-level"])
Concept Learning Phase
    ↓ (for each concept, updates conceptsProgress[conceptName])
    └── Memorization Phase (sub-phase)
         ↓ (tracks itemsProgress with spaced repetition)
Drawing Connections Phase
    ↓ (creates synthesis questions across concepts)
```

### 2. Session Persistence Pattern

Every significant interaction triggers session persistence:

```typescript
// Pattern used throughout phases
async somePhaseAction(session: LearningSession) {
  // 1. Perform action (AI call, user interaction)
  const result = await this.ai.someMethod(...);
  
  // 2. Update session state
  await courseManager.updateItemProgress(session, concept, item, attempt);
  
  // 3. Add to conversation history
  await courseManager.addConversationEntry(session, 'assistant', response);
  
  // 4. Update phase state
  await courseManager.updateSessionPhase(session, 'next-phase', concept);
  
  // Session automatically persisted in each method
}
```

### 3. AI Service Integration Pattern

All AI interactions follow a consistent pattern:

```typescript
// 1. Prepare context and history
const context = {
  course,
  conversationHistory: session.conversationHistory.slice(-10),
  existingUnderstanding: session.existingUnderstanding,
  conceptProgress: session.conceptsProgress.get(conceptName)
};

// 2. Call appropriate AI service method
const response = await this.ai.evaluateAnswer(userAnswer, context);

// 3. Process structured response
if (response.comprehension >= 4) {
  // Update success tracking
  await this.updateProgress(session, item, response);
}

// 4. Persist changes
await courseManager.saveSession(session);
```

## Session Management Approach

### Conversation History Tracking

```typescript
interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Always bounded to prevent context overflow
conversationHistory: session.conversationHistory.slice(-10)
```

### Progress Tracking Strategy

**Multi-level Progress Tracking**:
1. **Item Level**: Individual flashcard mastery (requires 2 successes)
2. **Topic Level**: Comprehension scoring (0-5 scale, 5 = mastery)  
3. **Concept Level**: Aggregate progress across items and topics
4. **Phase Level**: Overall completion status

**Spaced Repetition Implementation**:
```typescript
interface ItemProgress {
  itemName: string;
  attempts: FlashcardAttempt[];
  successCount: number;
  easeFactor: number;      // Anki-style difficulty adjustment
  interval: number;        // Time between reviews
  lastReviewPosition: number;
  nextDuePosition: number; // When item should appear again
}
```

### Session Resume Capability

Sessions can be resumed from any phase with full context restoration:

```typescript
// Resume pattern in commands/resume.ts
const session = await courseManager.loadSession(courseName);
const course = await courseManager.loadCourse(courseName);

// Convert serialized Maps back to runtime Maps
const reconstructedSession = this.deserializeSession(session);

// Continue from current phase
await continueFromPhase(course, reconstructedSession, session.currentPhase);
```

## Database Integration Patterns

### MongoDB Schema Design

**Course Document Schema**:
```typescript
interface CourseDocument {
  _id?: ObjectId;
  name: string;
  backgroundKnowledge?: string[];
  concepts: Array<{
    name: string;
    'high-level': string[];
    memorize: {
      fields: string[];
      items: string[];
    };
  }>;
  'drawing-connections': string[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Session Document Schema** - Flattened for MongoDB:
```typescript
interface SessionDocument {
  _id?: ObjectId;
  courseId: string;
  currentPhase: PhaseType;
  conceptsProgress: Array<{
    conceptName: string;
    itemsProgress: Array<ItemProgress>;
    topicProgress: Array<TopicProgress>;
    specialQuestionsAsked: Array<SpecialQuestion>;
    globalPositionCounter: number;
  }>;
  conversationHistory: Array<ConversationEntry>;
  // ... other session fields
}
```

### Map Serialization Strategy

**Critical Pattern for Web Apps**:

```typescript
// Serialization (Memory → Database)
private sessionToDocument(session: LearningSession): SessionDocument {
  const conceptsProgressArray = Array.from(session.conceptsProgress.entries())
    .map(([key, value]) => ({
      conceptName: key,
      itemsProgress: Array.from(value.itemsProgress.entries())
        .map(([itemKey, itemValue]) => ({ ...itemValue })),
      topicProgress: Array.from(value.topicProgress.entries())
        .map(([topicKey, topicValue]) => ({ ...topicValue })),
      // ...
    }));
  return { ...session, conceptsProgress: conceptsProgressArray };
}

// Deserialization (Database → Memory)  
private documentToSession(document: SessionDocument): LearningSession {
  const conceptsProgress = new Map<string, ConceptProgress>();
  document.conceptsProgress.forEach((conceptDoc) => {
    const itemsProgress = new Map<string, ItemProgress>();
    conceptDoc.itemsProgress.forEach((item) => {
      itemsProgress.set(item.itemName, item);
    });
    // ... rebuild nested Maps
    conceptsProgress.set(conceptDoc.conceptName, {
      conceptName: conceptDoc.conceptName,
      itemsProgress,
      topicProgress,
      // ...
    });
  });
  return { ...document, conceptsProgress };
}
```

## Key Service Responsibilities

### CourseManager / MongoCourseManager
- **Course CRUD**: Save/load course structures
- **Session Management**: Create, save, load, update learning sessions  
- **Progress Tracking**: Update item/topic/concept progress
- **Conversation History**: Manage chat-like interaction history
- **Phase State Management**: Track and update current learning phase
- **Scheduling**: Spaced repetition calculations for flashcard review

### AIService Facade
- **Unified Interface**: Single entry point for all AI operations
- **Model Management**: Abstract model selection (fast/standard/reasoning)
- **Prompt Orchestration**: Route requests to specialized services

### CourseService  
- **Topic Analysis**: Validate learning topics for appropriateness
- **Course Generation**: Create structured learning paths from topics/documents
- **Content Structuring**: Generate concept details with flashcard items

### GenerationService
- **Question Generation**: Create contextual questions for each learning phase
- **Adaptive Content**: Generate questions based on conversation history
- **Special Questions**: Create elaboration, connection, and high-level recall questions

### EvaluationService
- **Answer Assessment**: Score user responses with comprehension ratings (0-5)
- **Progress Evaluation**: Determine mastery and advancement criteria
- **Response Generation**: Create educational feedback and follow-up questions

## Web Transformation Recommendations

### 1. API Architecture

**RESTful Endpoints with Real-time Extensions**:

```typescript
// Core API structure
POST   /api/courses                    // Create new course
GET    /api/courses                    // List user's courses  
GET    /api/courses/:id                // Get course details
PUT    /api/courses/:id                // Update course

POST   /api/courses/:id/sessions       // Start new session
GET    /api/courses/:id/sessions/current // Get current session
PUT    /api/sessions/:id               // Update session state
DELETE /api/sessions/:id               // End session

// Learning interactions
POST   /api/sessions/:id/answers       // Submit answer (returns streaming response)
GET    /api/sessions/:id/question      // Get next question
PUT    /api/sessions/:id/phase         // Advance to next phase

// Streaming endpoint for AI responses with tool calling
POST   /api/sessions/:id/stream        // Streaming text generation with Vercel AI SDK (see ai-sdk-streaming-reference.md)
```

### 2. State Management Strategy

**Redux Toolkit + RTK Query Recommended**:

```typescript
// Example slice structure
interface LearningState {
  currentCourse: Course | null;
  currentSession: LearningSession | null;
  currentPhase: PhaseType;
  questionInProgress: {
    question: string;
    startTime: Date;
    attempts: number;
  } | null;
  conversationHistory: ConversationEntry[];
  progress: {
    itemsProgress: Map<string, ItemProgress>;
    topicProgress: Map<string, TopicProgress>;
    overallCompletion: number;
  };
}

// RTK Query API slice
const learningApi = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/',
    prepareHeaders: (headers, { getState }) => {
      headers.set('authorization', `Bearer ${getState().auth.token}`);
      return headers;
    },
  }),
  tagTypes: ['Course', 'Session', 'Progress'],
  endpoints: (builder) => ({
    getCurrentSession: builder.query<LearningSession, string>({
      query: (courseId) => `courses/${courseId}/sessions/current`,
      providesTags: ['Session'],
    }),
    submitAnswer: builder.mutation<AnswerResponse, AnswerRequest>({
      query: ({ sessionId, ...body }) => ({
        url: `sessions/${sessionId}/answers`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session', 'Progress'],
    }),
  }),
});
```

### 3. Real-time Learning Experience

**Vercel AI SDK Streaming for Live Sessions**:

> **Reference**: See [AI SDK Streaming Reference](./ai-sdk-streaming-reference.md) for comprehensive streaming patterns and tool calling implementation details.

```typescript
// Client-side streaming with Vercel AI SDK
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

function LearningInterface() {
  const { messages, sendMessage, isLoading } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/sessions/${sessionId}/stream`,
    }),
    onFinish: ({ usage }) => {
      // Update scores after streaming completes
      fetchScores();
      // Track token usage for analytics
      trackUsage(usage);
    },
  });
  
  // Separate state for scores shown on the side
  const [scores, setScores] = useState({
    comprehension: 0,
    itemProgress: new Map(),
    topicProgress: new Map(),
  });
  
  const fetchScores = async () => {
    // Fetch updated scores from regular endpoint
    const response = await fetch(`/api/sessions/${sessionId}/progress`);
    const data = await response.json();
    setScores(data);
  };
  
  return (
    <div className="flex">
      <div className="flex-1">
        {/* Main learning interface with streaming text */}
        <div>{completion}</div>
        <form onSubmit={handleSubmit}>
          <input value={input} onChange={handleInputChange} />
        </form>
      </div>
      <div className="w-64">
        {/* Sidebar with scores that update after responses */}
        <ScorePanel scores={scores} />
      </div>
    </div>
  );
}
```

### 4. Component Architecture

**Recommended Component Structure**:

```
components/
├── learning/
│   ├── CourseSelector.tsx          // Course selection and creation
│   ├── SessionDashboard.tsx        // Current session overview  
│   ├── phases/
│   │   ├── HighLevelPhase.tsx      // Foundation Q&A
│   │   ├── ConceptLearningPhase.tsx // Deep concept exploration
│   │   ├── MemorizationPhase.tsx   // Flashcard interface
│   │   └── ConnectionsPhase.tsx    // Synthesis questions
│   ├── shared/
│   │   ├── QuestionInterface.tsx   // Common Q&A interface
│   │   ├── ProgressIndicator.tsx   // Visual progress tracking
│   │   ├── ConversationHistory.tsx // Chat-like history view
│   │   └── PhaseTransition.tsx     // Phase advancement UI
│   └── adaptive/
│       ├── FlashcardScheduler.tsx  // Spaced repetition UI
│       ├── DifficultyAdjuster.tsx  // Dynamic difficulty
│       └── SpecialQuestions.tsx    // Elaboration/connection prompts
```

### 5. Progressive Web App Features

**Offline Capability**:
- Cache conversation history and progress locally
- Sync when connection restored
- Background sync for seamless experience

**Mobile-First Design**:
- Touch-optimized flashcard interface
- Voice input for answers
- Adaptive layout for all screen sizes

### 6. Authentication & Multi-User Support

**User Session Management**:
```typescript
interface UserSession {
  userId: string;
  courses: Array<{
    courseId: string;
    enrolledAt: Date;
    currentSession?: LearningSession;
    completionStatus: number;
  }>;
  preferences: {
    timeAvailable: string;
    existingUnderstanding: string;
    learningStyle: 'visual' | 'auditory' | 'kinesthetic';
  };
}
```

### 7. Performance Optimizations

**Recommended Strategies**:

1. **Lazy Loading**: Load phases and questions on-demand
2. **Caching**: Cache AI-generated content with Redis
3. **Streaming**: Stream long AI responses for better UX  
4. **Background Processing**: Pre-generate questions during user thinking time
5. **Service Workers**: Cache critical UI components offline
6. **Streaming Responses**: Use Vercel AI SDK streaming for real-time text generation
   - See [AI SDK Streaming Reference](./ai-sdk-streaming-reference.md) for multi-step tool calls
   - Implement progressive UI updates with tool call states
   - Handle stream abortion gracefully with `consumeStream`

### 8. Monitoring & Analytics

**Learning Analytics Integration**:
```typescript
interface LearningAnalytics {
  sessionMetrics: {
    timePerQuestion: number;
    accuracyRate: number;
    conceptDifficulty: Map<string, number>;
    retentionRate: Map<string, number>;
  };
  userMetrics: {
    totalStudyTime: number;
    averageSessionLength: number;
    preferredLearningPhases: string[];
    strugglingConcepts: string[];
  };
}
```

## Migration Strategy

### Phase 1: Core API Development
1. Extract service layer to standalone API server
2. Implement authentication and user management
3. Create RESTful endpoints for core operations
4. Add Vercel AI SDK streaming for real-time text generation
   - Implement streaming with tool calls for flashcard evaluation
   - Use multi-step tool execution for complex learning interactions
   - Reference: [AI SDK Streaming Reference](./ai-sdk-streaming-reference.md)

### Phase 2: Frontend Development  
1. Build React frontend with component library
2. Implement Redux state management
3. Create responsive design system
4. Add PWA capabilities

### Phase 3: Enhancement & Scaling
1. Add advanced analytics and reporting
2. Implement A/B testing for learning effectiveness
3. Add collaborative learning features
4. Scale infrastructure for multiple users

## Conclusion

The current learning-ai architecture provides an excellent foundation for web transformation. The service-oriented design, clear separation of concerns, and robust session management translate well to web applications. The dual storage architecture and comprehensive progress tracking system are particularly well-suited for supporting multiple concurrent users in a web environment.

Key strengths to leverage:
- **Clean service abstractions** for API development
- **Comprehensive progress tracking** for user analytics  
- **Flexible AI integration** for adaptive learning
- **Robust session management** for seamless user experience

The recommendations above provide a roadmap for transforming the CLI application into a modern, scalable web learning platform while preserving the sophisticated learning methodology that makes the system effective.