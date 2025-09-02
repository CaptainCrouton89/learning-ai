import { generateObject } from "ai";
import { models } from '../../config/models.js';
import { Concept, Course } from '../../types/course.js';
import { CourseService } from './courseService.js';
import { EvaluationService } from './evaluationService.js';
import { GenerationService } from './generationService.js';
import { learningGoalSuggestionPrompts } from './prompts/index.js';
import { LearningGoalSuggestionsSchema } from './schemas.js';

export class AIService {
  private courseService = new CourseService();
  private generationService = new GenerationService();
  private evaluationService = new EvaluationService();

  async analyzeTopic(
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ): Promise<{
    is_appropriate: boolean;
    reason: string;
    suggested_refinements: string[];
    clarifying_questions: string[];
  }> {
    return this.courseService.analyzeTopic(
      topic,
      timeAvailable,
      existingUnderstanding
    );
  }

  async refineTopic(
    originalTopic: string,
    userResponse: string,
    timeAvailable: string
  ): Promise<string> {
    return this.courseService.refineTopic(
      originalTopic,
      userResponse,
      timeAvailable
    );
  }

  async generateCourseStructure(
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    existingUnderstanding: string,
    learningGoals: string
  ): Promise<Course> {
    return this.courseService.generateCourseStructure(
      topic,
      documentContent,
      timeAvailable,
      existingUnderstanding,
      learningGoals
    );
  }

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    return this.generationService.generateHighLevelQuestion(
      course,
      conversationHistory,
      existingUnderstanding,
      isFirstQuestion
    );
  }

  async generateHighLevelResponse(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    comprehensionProgress?: Map<string, number>
  ): Promise<string> {
    return this.evaluationService.generateHighLevelResponse(
      userAnswer,
      course,
      conversationHistory,
      existingUnderstanding,
      comprehensionProgress
    );
  }

  async scoreComprehension(
    userAnswer: string,
    topics: string[],
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    contextType: "high-level" | "concept",
    conceptName?: string
  ): Promise<Array<{ topic: string; comprehension: number }>> {
    return this.evaluationService.scoreComprehension(
      userAnswer,
      topics,
      conversationHistory,
      existingUnderstanding,
      contextType,
      conceptName
    );
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    return this.generationService.generateConceptQuestion(
      concept,
      conversationHistory,
      existingUnderstanding,
      isFirstQuestion
    );
  }

  async generateConceptResponse(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    unmasteredTopics?: string[]
  ): Promise<string> {
    return this.evaluationService.generateConceptResponse(
      userAnswer,
      concept,
      conversationHistory,
      existingUnderstanding,
      unmasteredTopics
    );
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[],
    existingUnderstanding: string = "Some - I know the basics"
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    return this.evaluationService.evaluateConceptAnswer(
      userAnswer,
      concept,
      conversationHistory,
      unmasteredTopics,
      existingUnderstanding
    );
  }

  async evaluateFlashcardAnswer(
    item: string,
    fields: string[],
    userAnswer: string,
    concept: Concept,
    otherConcepts: string[],
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>,
    existingUnderstanding: string
  ): Promise<{ comprehension: number; response: string }> {
    return this.evaluationService.evaluateFlashcardAnswer(
      item,
      fields,
      userAnswer,
      concept,
      otherConcepts,
      previousAttempts,
      existingUnderstanding
    );
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ): Promise<string> {
    return this.generationService.generateConnectionQuestion(
      connections,
      course,
      previousQuestions,
      existingUnderstanding
    );
  }

  async evaluateConnectionAnswer(
    question: string,
    userAnswer: string,
    course: Course,
    existingUnderstanding: string
  ): Promise<{ response: string; followUp: string | null }> {
    return this.evaluationService.evaluateConnectionAnswer(
      question,
      userAnswer,
      course,
      existingUnderstanding
    );
  }

  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept,
    userAnswer?: string,
    evaluation?: string
  ): Promise<string> {
    return this.generationService.generateElaborationQuestion(
      item,
      fields,
      concept,
      userAnswer,
      evaluation
    );
  }

  async generateConnectionToStruggling(
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    return this.generationService.generateConnectionToStruggling(
      performingItem,
      strugglingItem,
      concept
    );
  }

  async generateHighLevelRecall(
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string,
    weakTopics?: Array<{ topic: string; comprehension: number }>,
    strugglingItems?: Array<{ item: string; averageComprehension: number }>
  ): Promise<string> {
    return this.generationService.generateHighLevelRecall(
      concept,
      itemsCovered,
      existingUnderstanding,
      weakTopics,
      strugglingItems
    );
  }

  async evaluateElaborationAnswer(
    question: string,
    userAnswer: string,
    item: string,
    concept: Concept
  ): Promise<string> {
    return this.evaluationService.evaluateElaborationAnswer(
      question,
      userAnswer,
      item,
      concept
    );
  }

  async evaluateConnectionQuestionAnswer(
    question: string,
    userAnswer: string,
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    return this.evaluationService.evaluateConnectionQuestionAnswer(
      question,
      userAnswer,
      performingItem,
      strugglingItem,
      concept
    );
  }

  async evaluateHighLevelAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string,
    weakTopics?: Array<{ topic: string; comprehension: number }>,
    strugglingItems?: Array<{ item: string; averageComprehension: number }>
  ): Promise<string> {
    return this.evaluationService.evaluateHighLevelAnswer(
      question,
      userAnswer,
      concept,
      itemsCovered,
      existingUnderstanding,
      weakTopics,
      strugglingItems
    );
  }

  async generateLearningGoals(
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ): Promise<string[]> {
    const { object } = await generateObject({
      model: models.fast,
      schema: LearningGoalSuggestionsSchema,
      system: learningGoalSuggestionPrompts.system,
      prompt: learningGoalSuggestionPrompts.userPrompt(
        topic,
        timeAvailable,
        existingUnderstanding
      ),
    });
    return object.goals;
  }
}

export * from './schemas.js';
