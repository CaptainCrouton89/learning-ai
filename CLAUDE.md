# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `npm run dev` - Run in development mode with auto-reload (watches src/index.ts)
- `npm run build` - Build TypeScript to dist/
- `npm run typecheck` - Type check without emitting files
- `npm install` - Install dependencies

### Running the CLI

After building with `npm run build`, use these commands:

- `npm start -- start` - Start a new learning session (interactive)
- `npm start -- start --topic "wine"` - Start learning from GPT knowledge base
- `npm start -- start --file "path/to/document.txt"` - Start learning from a document
- `npm start -- resume` - Resume a previous session (interactive)
- `npm start -- resume --course "wine"` - Resume specific course
- `npm start -- list` - List all available courses

Alternatively, after global install: `learn start`, `learn resume`, `learn list`

### Environment Setup

- Copy `.env.example` to `.env` and add OpenAI API key: `OPENAI_API_KEY=your_key_here`
- The project uses ESM modules (`"type": "module"` in package.json)
- TypeScript builds to `dist/` directory
- CLI binary entry point: `dist/index.js`

## Architecture

### Learning Flow

The application implements a structured 5-phase learning system as defined in `learning-structure.md`:

1. **Phase 1 (Initialization)**: Course creation based on user preferences
2. **Phase 2 (High-Level)**: Q&A for foundational understanding
3. **Phase 3 (Concept Learning)**: Deep dive into specific concepts
4. **Phase 3.5 (Memorization)**: Flashcard practice with spaced repetition
5. **Phase 4 (Drawing Connections)**: Scenario-based synthesis questions

### Core Services

**AIService** (`src/services/ai/index.ts`)

- Facade for CourseService, GenerationService, and EvaluationService
- Uses Vercel AI SDK with OpenAI GPT models
- `generateObject()` for structured responses (course generation, flashcard evaluation)
- `generateText()` for conversational responses (Q&A, feedback)
- Flashcard evaluation returns comprehension score (0-5, where 4+ = success)
- Items need 2 successful attempts to be mastered
- High-level and concept comprehension tracking with topic-based scoring

**CourseManager** (`src/services/courseManager.ts`)

- Persists courses to `courses/` directory as JSON files
- Persists sessions to `sessions/` directory with format `{courseId}-session.json`
- Tracks progress per concept and item with success counts
- Sessions store conversation history, current phase, and timing
- Handles serialization/deserialization of Map structures for persistence
- Manages abstract questions tracking to avoid repetition

### Phase Implementation Pattern

Each phase class (`src/phases/`) follows this pattern:

- Takes Course and LearningSession objects
- Updates session phase via CourseManager
- Maintains conversation history
- Handles user interaction with Inquirer prompts
- Can transition to next phase or allow resuming later

### Data Flow

1. Commands (`src/commands/`) orchestrate phase transitions
2. Phases handle user interaction and call AIService
3. AIService makes OpenAI API calls with appropriate prompts
4. CourseManager persists all state changes
5. Abstract questions are inserted every 10 flashcard questions
6. Session can be resumed from any phase

### Key Implementation Details

- **Flashcard System**: Random order on each iteration, 2 successes needed for mastery
- **Abstract Questions**: Mixed in every 10 flashcard questions, tracks previously asked
- **Comprehension Scoring**: 0-5 scale, 4+ counts as success, topic-based tracking
- **Progress Tracking**: Items, topics, and concept-level progress with timestamps
- **Session Management**: Conversation history, phase state, resume capability
- **Error Handling**: Early error throwing, no fallbacks EVER

### Directory Structure

```
src/
├── commands/           # CLI command handlers (start.ts, resume.ts, list.ts)
├── phases/            # Learning phase implementations
│   ├── initialization.ts    # Course creation and user preference collection
│   ├── highLevel.ts        # Foundational Q&A phase
│   ├── conceptLearning.ts  # Deep dive into specific topics
│   ├── memorization.ts     # Flashcard practice with spaced repetition
│   └── drawingConnections.ts # Scenario-based synthesis questions
├── services/          # Core business logic
│   ├── ai/           # AI service modules
│   │   ├── index.ts         # Main AIService facade
│   │   ├── courseService.ts # Course structure generation
│   │   ├── generationService.ts # Question generation
│   │   ├── evaluationService.ts # Answer evaluation and scoring
│   │   ├── schemas.ts       # Zod validation schemas
│   │   └── prompts.ts       # AI prompt templates
│   └── courseManager.ts     # Data persistence and session management
├── types/            # TypeScript type definitions
│   └── course.ts           # Core data structures
├── utils/            # Utility functions
│   └── progressBar.ts      # CLI progress indicators
└── index.ts          # CLI entry point with Commander.js
```

### Data Persistence

- **Courses**: `courses/{courseName}.json` - Course structure with concepts and items
- **Sessions**: `sessions/{courseId}-session.json` - Learning progress and history
- **Map Serialization**: Complex nested Maps converted to arrays for JSON storage

### Critical Reminders:

- Never fallback—throw informative errors instead
