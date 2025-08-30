# Learning AI CLI

An AI-powered interactive learning tool that creates personalized courses and guides you through structured learning sessions.

## Features

- **Adaptive Learning**: Creates customized courses based on your time availability and depth preferences
- **Multi-Phase Learning**: Progresses through high-level overview, concept learning, memorization, and synthesis
- **Interactive Q&A**: Engaging question-answer format with AI feedback
- **Flashcard Practice**: Spaced repetition system for memorizing key items
- **Progress Tracking**: Saves your learning sessions and allows resuming anytime

## Installation

```bash
npm install
```

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

3. Build the project:
```bash
npm run build
```

## Usage

### Start a new learning session

```bash
# Learn from GPT's knowledge base
npm start -- start --topic "wine"

# Learn from a document
npm start -- start --file "path/to/document.txt"

# Interactive mode (will prompt for topic)
npm start -- start
```

### Resume a previous session

```bash
# Resume a specific course
npm start -- resume --course "wine"

# Interactive mode (will show available courses)
npm start -- resume
```

### List available courses

```bash
npm start -- list
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Learning Phases

1. **Initialization**: Choose topic, time availability, and focus areas
2. **High-Level Overview**: Build foundational understanding through Q&A
3. **Concept Learning**: Deep dive into specific topics with analogies and explanations
4. **Memorization**: Flashcard practice with spaced repetition
5. **Drawing Connections**: Scenario-based questions that synthesize all concepts

## Project Structure

```
src/
├── commands/       # CLI command handlers
├── phases/         # Learning phase implementations
├── services/       # AI and course management
├── types/          # TypeScript type definitions
└── index.ts        # CLI entry point
```