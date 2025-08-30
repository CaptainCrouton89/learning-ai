# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Run in development mode with auto-reload (watches src/index.ts)
- `npm run build` - Build TypeScript to dist/
- `npm run typecheck` - Type check without emitting files
- `npm run lint` - Lint all TypeScript files in src/

### Running the CLI
- `npm start -- start` - Start a new learning session (interactive)
- `npm start -- start --topic "wine"` - Start learning from GPT knowledge base
- `npm start -- start --file "path/to/document.txt"` - Start learning from a document
- `npm start -- resume` - Resume a previous session (interactive)
- `npm start -- resume --course "wine"` - Resume specific course
- `npm start -- list` - List all available courses

### Environment Setup
- Copy `.env.example` to `.env` and add OpenAI API key
- The project uses ESM modules (`"type": "module"` in package.json)

## Architecture

### Learning Flow
The application implements a structured 5-phase learning system as defined in `learning-structure.md`:

1. **Phase 1 (Initialization)**: Course creation based on user preferences
2. **Phase 2 (High-Level)**: Q&A for foundational understanding
3. **Phase 3 (Concept Learning)**: Deep dive into specific concepts
4. **Phase 3.5 (Memorization)**: Flashcard practice with spaced repetition
5. **Phase 4 (Drawing Connections)**: Scenario-based synthesis questions

### Core Services

**AIService** (`src/services/ai.ts`)
- Uses Vercel AI SDK with OpenAI GPT-4.1 model
- `generateObject()` for structured responses (course generation, flashcard evaluation)
- `generateText()` for conversational responses (Q&A, feedback)
- Flashcard evaluation returns comprehension score (0-5, where 4+ = success)
- Items need 2 successful attempts to be mastered

**CourseManager** (`src/services/courseManager.ts`)
- Persists courses to `courses/` directory
- Persists sessions to `sessions/` directory
- Tracks progress per concept and item
- Sessions store conversation history and current phase
- Handles serialization of Map structures for persistence

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
- Flashcard randomization happens on each iteration
- Abstract questions track previously asked to avoid repetition
- Comprehension scoring: 4+ adds to success count, 2 successes = mastery
- Editor prompts used for longer responses
- Progress indicators show remaining items to master
- Session timing tracked for statistics