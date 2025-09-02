# Web Transformation Parallel Implementation Plan

The learning-ai application is transforming from a CLI tool into a full-stack web application while maintaining CLI compatibility. The system implements a sophisticated 5-phase learning methodology with AI-driven interactions, spaced repetition, and comprehensive progress tracking. MongoDB integration is complete, Next.js infrastructure is ready, but the web interface and API layer need to be built from scratch.

## Critically Relevant Files and Documentation

### Core Services

- `/src/services/ai/index.ts` - AIService facade for all AI operations
- `/src/services/mongoCourseManager.ts` - MongoDB persistence layer (production-ready)
- `/src/services/database/schemas.ts` - MongoDB document schemas
- `/src/config/storage.ts` - Storage abstraction layer

### Learning Implementation

- `/src/phases/*.ts` - All 5 learning phase implementations
- `/src/types/course.ts` - Core data structures and interfaces
- `/src/commands/start.ts` - Phase orchestration logic
- `/src/commands/resume.ts` - Session resumption patterns

### Web Infrastructure

- `/src/app/layout.tsx` - Next.js root layout
- `/src/components/ui/*` - Complete shadcn/ui component library
- `/tsconfig.json` - Next.js TypeScript configuration
- `/package.json` - Dependencies and build scripts

### Documentation

- `/Users/silasrhyneer/Code/learning-ai/CLAUDE.md` - Project guidelines and commands
- `/Users/silasrhyneer/Code/learning-ai/learning-structure.md` - 5-phase learning methodology
- `/plans/web-transformation/shared.md` - Architecture overview
- `/plans/web-transformation/service-architecture.docs.md` - Service patterns and data flow

## Implementation Plan

### Phase 1: Foundation Infrastructure

#### Task 1.1: Authentication System Setup [Depends on: none]

**READ THESE BEFORE TASK**

- `/src/services/mongoCourseManager.ts` - Understand current session management
- `/src/services/database/schemas.ts` - Review existing schemas
- `/plans/web-transformation/data-models.docs.md` - User model requirements

**Instructions**

Files to Create:

- `/src/lib/auth.ts` - Authentication configuration (NextAuth.js or Supabase)
- `/src/app/api/auth/[...nextauth]/route.ts` - Auth API routes
- `/src/services/database/userSchemas.ts` - User and authentication schemas
- `/src/middleware.ts` - Authentication middleware for protected routes

Files to Modify:

- `/src/services/database/schemas.ts` - Add userId to session schemas
- `/.env.example` - Add auth provider configuration variables

Set up authentication provider (NextAuth.js recommended), create user schemas with MongoDB integration, implement session management middleware, and add userId field to existing course/session schemas for multi-tenant support.

#### Task 1.2: API Route Architecture [Depends on: none]

**READ THESE BEFORE TASK**

- `/src/services/ai/index.ts` - AIService methods to expose
- `/src/services/mongoCourseManager.ts` - CourseManager methods to wrap
- `/plans/web-transformation/service-architecture.docs.md` - Recommended API structure

**Instructions**

Files to Create:

- `/src/app/api/courses/route.ts` - Course CRUD operations
- `/src/app/api/courses/[id]/route.ts` - Individual course operations
- `/src/app/api/sessions/route.ts` - Session management
- `/src/app/api/sessions/[id]/route.ts` - Individual session operations
- `/src/lib/api-utils.ts` - Shared API utilities and error handling

Create RESTful API routes wrapping existing services, implement proper error handling and validation, add request/response type definitions, and ensure all routes use the MongoCourseManager for persistence.

#### Task 1.3: State Management Setup [Depends on: none]

**READ THESE BEFORE TASK**

- `/src/types/course.ts` - Core data structures
- `/src/phases/memorization.ts` - Complex state requirements
- `/plans/web-transformation/learning-phases.docs.md` - State tracking needs

**Instructions**

Files to Create:

- `/src/store/index.ts` - Redux store configuration
- `/src/store/slices/courseSlice.ts` - Course state management
- `/src/store/slices/sessionSlice.ts` - Session and progress state
- `/src/store/slices/learningSlice.ts` - Active learning state
- `/src/store/api/learningApi.ts` - RTK Query API slice

Set up Redux Toolkit with RTK Query for API integration, create slices for course, session, and learning state, implement Map serialization for complex progress structures, and add optimistic updates for better UX.

### Phase 2: Core Learning Interface

#### Task 2.1: Dashboard and Course Management UI [Depends on: 1.1, 1.2]

**READ THESE BEFORE TASK**

- `/src/commands/list.ts` - Course listing logic
- `/src/commands/start.ts` - Course creation flow
- `/src/components/ui/*` - Available UI components

**Instructions**

Files to Create:

- `/src/app/dashboard/page.tsx` - User dashboard with course list
- `/src/app/courses/page.tsx` - Course management interface
- `/src/app/courses/new/page.tsx` - New course creation form
- `/src/components/courses/CourseCard.tsx` - Course display component
- `/src/components/courses/CourseCreationWizard.tsx` - Multi-step course creation

Build dashboard showing user's courses with progress indicators, implement course creation wizard matching CLI initialization phase, add course management features (archive, delete, duplicate), and integrate with API routes for data persistence.

#### Task 2.2: Learning Session Interface [Depends on: 1.2, 1.3]

**READ THESE BEFORE TASK**

- `/src/phases/highLevel.ts` - Question/answer patterns
- `/src/phases/conceptLearning.ts` - Concept exploration flow
- `/src/types/course.ts` - Session data structures

**Instructions**

Files to Create:

- `/src/app/learning/[courseId]/page.tsx` - Main learning interface
- `/src/components/learning/QuestionInterface.tsx` - Q&A interaction component
- `/src/components/learning/ProgressIndicator.tsx` - Visual progress tracking
- `/src/components/learning/ConversationHistory.tsx` - Chat-like history view
- `/src/components/learning/PhaseTransition.tsx` - Phase advancement UI

Create unified learning interface supporting all phases, implement question presentation with multiple input types, add conversation history display with context limiting, build progress visualization for topics/items/concepts, and handle phase transitions with user confirmation.

#### Task 2.3: Memorization Phase Interface [Depends on: 2.2]

**READ THESE BEFORE TASK**

- `/src/phases/memorization.ts` - Spaced repetition algorithm
- `/src/services/ai/evaluationService.ts` - Scoring logic
- `/plans/web-transformation/learning-phases.docs.md` - Memorization requirements

**Instructions**

Files to Create:

- `/src/components/learning/FlashcardInterface.tsx` - Flashcard display and interaction
- `/src/components/learning/SpacedRepetitionScheduler.tsx` - Visual scheduling feedback
- `/src/components/learning/ComprehensionFeedback.tsx` - Score visualization
- `/src/components/learning/MasteryIndicator.tsx` - Item mastery status

Build flashcard interface with flip animations, implement comprehension scoring display (0-5 scale), add spaced repetition scheduling visualization, show mastery progress (2 successes required), and integrate ease factor adjustments.

### Phase 3: AI Integration Layer

#### Task 3.1: AI Service API Routes [Depends on: 1.2]

**READ THESE BEFORE TASK**

- `/src/services/ai/index.ts` - AIService methods
- `/src/services/ai/prompts.ts` - Prompt templates
- `/src/services/ai/schemas.ts` - Response schemas

**Instructions**

Files to Create:

- `/src/app/api/ai/generate-question/route.ts` - Question generation endpoint
- `/src/app/api/ai/evaluate-answer/route.ts` - Answer evaluation endpoint
- `/src/app/api/ai/generate-course/route.ts` - Course structure generation
- `/src/app/api/ai/special-questions/route.ts` - Special question generation

Create API endpoints for all AI operations, implement Vercel AI SDK streaming for text generation responses, add request validation and rate limiting, ensure proper error handling for AI failures, maintain conversation context in requests, and create separate endpoint for fetching updated scores.

#### Task 3.2: Streaming AI Responses [Depends on: 3.1]

**READ THESE BEFORE TASK**

- `/src/services/ai/evaluationService.ts` - Scoring and evaluation needs
- `/src/phases/highLevel.ts` - Interactive Q&A patterns
- `/plans/web-transformation/service-architecture.docs.md` - Streaming recommendations
- `/plans/web-transformation/ai-sdk-streaming-reference.md` - Comprehensive streaming patterns and tool calling

**Instructions**

Files to Create:

- `/src/app/api/sessions/[id]/stream/route.ts` - Streaming endpoint with tool calling
- `/src/app/api/sessions/[id]/progress/route.ts` - Progress/scores endpoint
- `/src/hooks/useStreamingCompletion.ts` - React hook using `useChat` from AI SDK
- `/src/components/learning/ScorePanel.tsx` - Score display component for sidebar
- `/src/lib/ai-tools.ts` - Tool definitions for flashcard evaluation

Implement Vercel AI SDK streaming with `streamText` and tool calling for evaluation, create separate progress endpoint for score updates, build React components using `useChat` hook for tool support, display scores in sidebar that update after tool execution, handle multi-step tool calls with `stopWhen`, and implement progressive UI updates during generation. Reference the AI SDK Streaming Reference for patterns.

### Phase 4: Advanced Features

#### Task 4.1: Progress Analytics Dashboard [Depends on: 2.1, 2.2]

**READ THESE BEFORE TASK**

- `/src/services/mongoCourseManager.ts` - Progress tracking methods
- `/src/types/course.ts` - Progress data structures
- `/plans/web-transformation/data-models.docs.md` - Analytics requirements

**Instructions**

Files to Create:

- `/src/app/analytics/page.tsx` - Analytics dashboard
- `/src/components/analytics/ConceptMastery.tsx` - Concept progress visualization
- `/src/components/analytics/LearningTimeline.tsx` - Session history timeline
- `/src/components/analytics/StrengthsWeaknesses.tsx` - Performance analysis
- `/src/lib/analytics.ts` - Analytics calculation utilities

Build comprehensive analytics dashboard, implement concept mastery visualization with charts, add learning timeline with session history, identify strengths and weaknesses by topic, and calculate retention rates and study patterns.

#### Task 4.2: Adaptive Learning Recommendations [Depends on: 4.1]

**READ THESE BEFORE TASK**

- `/src/phases/memorization.ts` - Scheduling algorithms
- `/src/services/ai/evaluationService.ts` - Performance evaluation
- `/plans/web-transformation/learning-phases.docs.md` - Adaptation strategies

**Instructions**

Files to Create:

- `/src/services/recommendations.ts` - Recommendation engine
- `/src/components/learning/StudyRecommendations.tsx` - Recommendation display
- `/src/app/api/recommendations/route.ts` - Recommendation API endpoint
- `/src/lib/performance-analyzer.ts` - Performance analysis utilities

Create recommendation engine based on performance data, suggest optimal study times and focus areas, implement adaptive difficulty adjustments, generate personalized learning paths, and integrate with spaced repetition scheduling.

#### Task 4.3: Offline Support and PWA [Depends on: 2.2]

**READ THESE BEFORE TASK**

- `/src/services/mongoCourseManager.ts` - Data caching needs
- `/src/services/ai/index.ts` - Offline AI considerations
- Next.js PWA documentation

**Instructions**

Files to Create:

- `/public/manifest.json` - PWA manifest
- `/src/app/offline/page.tsx` - Offline fallback page
- `/src/lib/service-worker.ts` - Service worker implementation
- `/src/lib/offline-storage.ts` - IndexedDB integration
- `/src/hooks/useOffline.ts` - Offline detection hook

Implement service worker for offline caching, create IndexedDB storage for offline data, add background sync for progress updates, implement offline fallback UI, and cache critical learning content locally.

### Phase 5: Polish and Optimization

#### Task 5.1: Mobile Responsive Design [Depends on: 2.1, 2.2, 2.3]

**READ THESE BEFORE TASK**

- All component files in `/src/components/`
- `/src/app/globals.css` - Current styling setup
- Tailwind CSS responsive utilities documentation

**Instructions**

Files to Modify:

- All page components in `/src/app/`
- All learning components in `/src/components/learning/`
- `/src/components/ui/*` - Ensure mobile compatibility

Implement responsive layouts for all pages, optimize touch interactions for flashcards, add mobile-specific navigation patterns, ensure readable typography on small screens, and test gesture support for learning interactions.

#### Task 5.2: Performance Optimization [Depends on: all previous tasks]

**READ THESE BEFORE TASK**

- Next.js performance documentation
- `/src/services/ai/index.ts` - AI service optimization points
- `/src/services/mongoCourseManager.ts` - Database query patterns

**Instructions**

Files to Create:

- `/src/lib/cache.ts` - Redis caching utilities
- `/src/lib/query-optimizer.ts` - Database query optimization

Files to Modify:

- `/src/app/api/*` - Add caching headers
- `/src/store/api/learningApi.ts` - Implement query caching

Implement Redis caching for AI responses, optimize database queries with proper indexing, add lazy loading for course content, implement virtual scrolling for long lists, and optimize bundle size with code splitting.

## Advice

- **Authentication First**: Implement authentication before any user-specific features to avoid refactoring later
- **Use Existing Services**: The AIService and MongoCourseManager are production-ready - wrap them in API routes rather than reimplementing
- **Preserve Learning Logic**: The 5-phase system with spaced repetition is proven - maintain exact behavior when porting to web
- **Map Serialization**: Pay special attention to Map structures - they need careful handling for Redux and API transmission
- **Progress Tracking Fidelity**: Never-decreasing comprehension scores are critical - ensure this logic is preserved in all state updates
- **Streaming AI Responses**: Use Vercel AI SDK streaming with tool calling for evaluation - see [AI SDK Streaming Reference](./ai-sdk-streaming-reference.md)
- **Score Updates**: Display scores in sidebar that update after tool execution completes
- **Tool Calling**: Implement tools for flashcard evaluation and comprehension scoring
- **Mobile-First Design**: Design for mobile from the beginning - the learning interface should work well on phones
- **Offline Capability**: Plan for offline support early - learning shouldn't require constant connectivity
- **Type Safety**: Leverage the existing TypeScript types - they ensure consistency between CLI and web
