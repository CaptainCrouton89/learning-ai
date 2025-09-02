# Web Transformation Shared Architecture

The learning-ai application is transforming from a CLI tool into a full web application. The system follows a 5-phase learning methodology with AI-driven question generation, spaced repetition, and comprehensive progress tracking. The web transformation will maintain CLI compatibility while adding authentication, multi-user support, and rich UI interactions through Next.js and MongoDB.

## Relevant Files

### Core Services
- `/src/services/ai/index.ts`: AIService facade coordinating course generation, question creation, and answer evaluation
- `/src/services/mongoCourseManager.ts`: MongoDB-based persistence with Map serialization and user session management
- `/src/services/courseManager.ts`: File-based storage fallback for CLI compatibility
- `/src/services/database/schemas.ts`: MongoDB document schemas for courses and sessions
- `/src/services/database/mongoClient.ts`: MongoDB connection management and pooling

### Learning Phases
- `/src/phases/initialization.ts`: Course creation and user preference collection
- `/src/phases/highLevel.ts`: Foundational Q&A with comprehension scoring
- `/src/phases/conceptLearning.ts`: Deep concept exploration with topic mastery
- `/src/phases/memorization.ts`: Spaced repetition flashcard system with adaptive scheduling
- `/src/phases/drawingConnections.ts`: Scenario-based synthesis questions

### Web Infrastructure
- `/src/app/layout.tsx`: Next.js root layout with font configuration
- `/src/app/page.tsx`: Default landing page (needs replacement)
- `/src/components/ui/`: Comprehensive shadcn/ui component library (15 components)
- `/tsconfig.json`: Dual TypeScript configuration for web and CLI builds
- `/package.json`: Dependencies including Next.js 15.5.2, React 19.1.0, MongoDB driver

### Data Models
- `/src/types/course.ts`: Core TypeScript interfaces for Course, LearningSession, ConceptProgress
- `/src/commands/start.ts`: CLI command orchestrating phase flow
- `/src/commands/resume.ts`: Session resumption logic with phase-aware continuation

## Relevant Tables

### MongoDB Collections
- `courses`: Course structures with concepts, topics, and memorizable items
- `sessions`: User learning sessions with progress tracking and conversation history
- `users` (to be added): User authentication and preferences
- `user_courses` (to be added): User-course associations and enrollment data

## Relevant Patterns

### Service Architecture Patterns
**Facade Pattern**: AIService provides a unified interface to CourseService, GenerationService, and EvaluationService for all AI operations - `/src/services/ai/index.ts`

**Dual Storage Strategy**: CourseManager interface implemented by both file-based and MongoDB storage backends, selected via configuration - `/src/config/storage.ts`

**Map Serialization**: Complex nested Maps converted to arrays for JSON/MongoDB persistence with bidirectional transformation - `/src/services/mongoCourseManager.ts:95-165`

### Learning Flow Patterns
**Phase Orchestration**: Sequential phase execution with resumption support through session state persistence - `/src/commands/start.ts`, `/src/commands/resume.ts`

**Spaced Repetition Algorithm**: SuperMemo-style scheduling with ease factors, intervals, and position-based review scheduling - `/src/phases/memorization.ts:calculateInterval`

**Comprehension Scoring**: 0-5 scale evaluation where 4+ equals success, with never-decreasing topic scores - `/src/services/ai/evaluationService.ts`

### State Management Patterns
**Session Persistence**: Every interaction updates session state with automatic saving to maintain resumability - All phase implementations

**Conversation History**: Bounded conversation tracking (last 10 messages) for context-aware AI responses - `/src/phases/highLevel.ts`

**Progress Tracking**: Multi-level progress (items, topics, concepts) with mastery thresholds and special question triggers - `/src/services/mongoCourseManager.ts:updateItemProgress`

### Web-Specific Patterns (To Implement)
**Authentication Middleware**: Protected routes using NextAuth.js or Supabase for user-scoped operations

**API Route Structure**: RESTful endpoints under `/api/` for courses, sessions, and learning operations

**Real-time Updates**: Vercel AI SDK streaming for live text generation with sidebar score updates

**Component Architecture**: Phase-specific React components with shared UI elements from shadcn/ui

## Relevant Docs

**`/Users/silasrhyneer/Code/learning-ai/CLAUDE.md`**: You _must_ read this when working on CLI commands, development setup, or understanding the project structure and philosophy.

**`/Users/silasrhyneer/Code/learning-ai/learning-structure.md`**: You _must_ read this when working on learning phases, educational methodology, or modifying the 5-phase system.

**`/Users/silasrhyneer/Code/learning-ai/plans/web-transformation/service-architecture.docs.md`**: You _must_ read this when working on API development, service layer modifications, or understanding data flow patterns.

**`/Users/silasrhyneer/Code/learning-ai/plans/web-transformation/learning-phases.docs.md`**: You _must_ read this when creating web UI components for learning phases or adapting CLI interactions to web interfaces.

**`/Users/silasrhyneer/Code/learning-ai/plans/web-transformation/nextjs-infrastructure.docs.md`**: You _must_ read this when setting up authentication, configuring Next.js, or working with shadcn/ui components.

**`/Users/silasrhyneer/Code/learning-ai/plans/web-transformation/data-models.docs.md`**: You _must_ read this when modifying database schemas, implementing user models, or working with progress tracking systems.