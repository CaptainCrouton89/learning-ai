# Data Models Documentation for Web Transformation

## Overview

The learning-ai system implements a sophisticated 5-phase learning architecture with comprehensive progress tracking, spaced repetition, and AI-driven evaluation. The current data models support single-user CLI interactions with dual persistence (file system and MongoDB).

## Core Data Model Architecture

### Course Structure

```typescript
interface Course {
  name: string;
  backgroundKnowledge?: string[];
  concepts: Concept[];
  'drawing-connections': string[];
}

interface Concept {
  name: string;
  'high-level': string[];
  memorize: MemorizeField;
}

interface MemorizeField {
  fields: string[];
  items: string[];
}
```

**Key Characteristics:**
- Hierarchical structure: Course → Concepts → Items/Topics
- Static course definition vs dynamic progress tracking
- Supports background knowledge prerequisites
- Includes high-level understanding topics and memorizable items

### Learning Session Management

```typescript
interface LearningSession {
  courseId: string;
  currentPhase: 'initialization' | 'high-level' | 'concept-learning' | 'memorization' | 'drawing-connections';
  currentConcept?: string;
  conceptsProgress: Map<string, ConceptProgress>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  startTime: Date;
  lastActivityTime: Date;
  existingUnderstanding: string;
  timeAvailable: string;
}
```

**Key Features:**
- Phase-based progression system
- Complete conversation history preservation
- Activity tracking for session management
- User preference capture (understanding level, time availability)

### Progress Tracking System

#### Concept-Level Progress
```typescript
interface ConceptProgress {
  conceptName: string;
  itemsProgress: Map<string, ItemProgress>;
  topicProgress: Map<string, TopicProgress>;
  specialQuestionsAsked: Array<SpecialQuestion>;
  globalPositionCounter: number;
}
```

#### Item-Level Progress (Flashcard System)
```typescript
interface ItemProgress {
  itemName: string;
  attempts: FlashcardAttempt[];
  successCount: number;
  easeFactor: number;           // Spaced repetition algorithm
  interval: number;             // Review interval
  lastReviewPosition: number;   // Position tracking
  nextDuePosition: number;      // Scheduling
}

interface FlashcardAttempt {
  question: string;
  userAnswer: string;
  aiResponse: {
    comprehension: number;      // 0-5 scale, 4+ = success
    response: string;
  };
  timestamp: Date;
}
```

**Spaced Repetition Features:**
- SuperMemo-style ease factor calculation
- Position-based scheduling system
- 2 successful attempts required for mastery
- Comprehensive attempt history

#### Topic-Level Progress (Concept Understanding)
```typescript
interface TopicProgress {
  topicName: string;
  currentComprehension: number;  // 0-5 scale, 5 = mastery
  attempts: ConceptAttempt[];
}

interface ConceptAttempt {
  question: string;
  userAnswer: string;
  aiResponse: {
    comprehension: number;
    response: string;
    targetTopic: string;
  };
  timestamp: Date;
}
```

#### Special Questions System
```typescript
interface SpecialQuestion {
  type: 'elaboration' | 'connection' | 'high-level';
  question: string;
  answer: string;
  targetItem?: string;
  connectedItem?: string;
  timestamp: Date;
}
```

**Purpose:**
- Elaboration: Deep dive on struggling items
- Connection: Link well-performing items
- High-level: Concept understanding checks

## MongoDB Schema Implementation

### Course Document Schema
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

**Database Features:**
- Unique index on course name
- Automatic timestamp management
- Direct course structure persistence

### Session Document Schema
```typescript
interface SessionDocument {
  _id?: ObjectId;
  courseId: string;
  currentPhase: string;
  currentConcept?: string;
  conceptsProgress: Array<{
    conceptName: string;
    itemsProgress: Array<{
      itemName: string;
      attempts: FlashcardAttempt[];
      successCount: number;
      easeFactor: number;
      interval: number;
      lastReviewPosition: number;
      nextDuePosition: number;
    }>;
    topicProgress: Array<{
      topicName: string;
      currentComprehension: number;
      attempts: ConceptAttempt[];
    }>;
    specialQuestionsAsked: SpecialQuestion[];
    globalPositionCounter: number;
  }>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  startTime: Date;
  lastActivityTime: Date;
  existingUnderstanding: string;
  timeAvailable: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Database Optimizations:**
- Compound index on `{ courseId: 1 }`
- Compound index on `{ courseId: 1, updatedAt: -1 }` for session retrieval
- Map-to-Array transformation for MongoDB compatibility

## Data Persistence Architecture

### Dual Persistence Strategy
The system implements both file-based and MongoDB persistence:

**File-Based (CourseManager):**
- Courses: `courses/{courseName}.json`
- Sessions: `sessions/{courseId}-session.json`
- Map serialization using key-value array transformation

**MongoDB (MongoCourseManager):**
- Collections: `courses`, `sessions`
- Automatic connection management
- Complex Map↔Array transformations

### Map Serialization Pattern
```typescript
// In-memory structure
conceptsProgress: Map<string, ConceptProgress>

// File serialization
conceptsProgress: Array<{
  key: string,
  value: ConceptProgress
}>

// MongoDB serialization  
conceptsProgress: Array<{
  conceptName: string,
  itemsProgress: Array<...>,
  topicProgress: Array<...>
}>
```

## Data Relationships and Dependencies

### Hierarchical Structure
```
Course
├── Concepts[]
│   ├── High-level topics[]
│   └── Memorizable items[]
│
Session (per Course)
├── Phase progression
├── Conversation history
└── ConceptsProgress Map
    ├── ItemsProgress Map (flashcards)
    ├── TopicProgress Map (understanding)
    └── SpecialQuestions[]
```

### Progress Interdependencies
1. **Phase Progression**: Sequential phases with mastery requirements
2. **Item Mastery**: 2 successful attempts (comprehension ≥ 4)
3. **Topic Mastery**: Comprehension score = 5
4. **Concept Completion**: All items and topics mastered
5. **Special Questions**: Triggered by performance patterns

### Session State Management
- **Active Session**: One session per course
- **Resume Capability**: Full state restoration
- **Progress Persistence**: Real-time updates
- **History Preservation**: Complete conversation logs

## Missing User/Authentication Models

### Current Limitations
❌ **No User Entity**: Single-user system assumption
❌ **No Authentication**: Direct file/database access
❌ **No User Preferences**: Hard-coded defaults
❌ **No Multi-tenancy**: Shared course namespace
❌ **No User Progress Aggregation**: No cross-course analytics
❌ **No Social Features**: No sharing or collaboration

### Required User Models for Web Transformation

#### Core User Entity
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;
  subscription?: SubscriptionInfo;
}

interface UserPreferences {
  defaultExistingUnderstanding: string;
  defaultTimeAvailable: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  difficultyPreference: 'easy' | 'medium' | 'hard' | 'adaptive';
  reminderSettings: NotificationSettings;
}
```

#### Updated Session Model
```typescript
interface LearningSession {
  id: string;
  userId: string;           // NEW: User association
  courseId: string;
  // ... existing fields
}
```

#### User Course Association
```typescript
interface UserCourse {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
  lastAccessedAt: Date;
  completionPercentage: number;
  overallProgress: CourseProgress;
}
```

## Web Transformation Recommendations

### Authentication Integration
- **NextAuth.js**: Industry standard for Next.js applications
- **Database Sessions**: Migrate from file-based to user-scoped database records
- **JWT Tokens**: Stateless authentication for API endpoints

### API Architecture
```typescript
// Recommended API structure
/api/auth/[...nextauth].ts          // Authentication
/api/courses/index.ts               // List user's courses
/api/courses/[courseId]/index.ts    // Course details
/api/courses/[courseId]/session.ts  // Session management
/api/sessions/[sessionId]/progress.ts // Progress updates
/api/users/profile.ts               // User preferences
```

### Database Migration Strategy
1. **User Table Creation**: Add users collection with indexes
2. **Foreign Key Addition**: Add userId to existing collections
3. **Data Migration**: Associate existing sessions with default user
4. **Permission Layers**: Add user-scoped queries throughout

### State Management for Web
- **React Query/SWR**: Server state synchronization
- **Zustand/Redux**: Client-side state management
- **Real-time Updates**: Vercel AI SDK streaming for live text generation
- **Offline Support**: Service worker for offline learning

### Multi-User Data Considerations
- **Course Sharing**: Public/private course visibility
- **Progress Isolation**: User-scoped progress tracking
- **Performance Scaling**: Indexed queries for user data
- **Data Export**: User data portability features

## Technical Implementation Notes

### Complex Data Transformations
The system requires sophisticated Map↔Array transformations for persistence:
- **Nested Maps**: ConceptProgress contains ItemProgress and TopicProgress Maps
- **Serialization Complexity**: Deep object traversal required
- **Type Safety**: Zod schemas validate transformations

### Performance Considerations
- **Lazy Loading**: Load concepts/progress on demand
- **Batch Updates**: Group progress updates to reduce database calls
- **Indexing Strategy**: Compound indexes for user-course-session queries
- **Caching Layer**: Redis for frequently accessed course data

### Error Handling Philosophy
The codebase follows a "fail fast" approach:
- No fallback mechanisms
- Early error throwing
- Comprehensive error context
- This pattern should continue in web transformation

## Conclusion

The current data models are well-designed for single-user CLI interaction with sophisticated learning progression tracking. The web transformation will require significant additions to support multi-user scenarios while preserving the core learning mechanics. The MongoDB integration provides a solid foundation for scaling, but user management, authentication, and multi-tenancy features need to be built from the ground up.

Key priorities for web transformation:
1. User authentication and authorization system
2. Multi-tenant data architecture
3. RESTful API endpoints
4. Real-time progress synchronization
5. Responsive web interface matching CLI functionality