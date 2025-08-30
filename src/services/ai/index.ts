import { Concept, Course } from "../../types/course.js";
import { CourseService } from "./courseService.js";
import { EvaluationService } from "./evaluationService.js";
import { GenerationService } from "./generationService.js";

export class AIService {
  private courseService = new CourseService();
  private generationService = new GenerationService();
  private evaluationService = new EvaluationService();

  async generateCourseStructure(
    topic: string,
    documentContent: string | null,
    timeAvailable: string,
    depth: string,
    learningGoals: string
  ): Promise<Course> {
    return this.courseService.generateCourseStructure(
      topic,
      documentContent,
      timeAvailable,
      depth,
      learningGoals
    );
  }

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    return this.generationService.generateHighLevelQuestion(
      course,
      conversationHistory
    );
  }

  async generateHighLevelResponse(
    userAnswer: string,
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    comprehensionProgress?: Map<string, number>
  ): Promise<{
    response: string;
    comprehensionUpdates: Array<{ topic: string; comprehension: number }>;
  }> {
    return this.evaluationService.generateHighLevelResponse(
      userAnswer,
      course,
      conversationHistory,
      comprehensionProgress
    );
  }


  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    return this.generationService.generateConceptQuestion(
      concept,
      conversationHistory
    );
  }

  async generateConceptResponse(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[]
  ): Promise<{
    response: string;
    comprehensionUpdates: Array<{ topic: string; comprehension: number }>;
  }> {
    return this.evaluationService.generateConceptResponse(
      userAnswer,
      concept,
      conversationHistory,
      unmasteredTopics
    );
  }

  async evaluateConceptComprehension(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<Array<{ topic: string; comprehension: number }>> {
    return this.evaluationService.evaluateConceptComprehension(
      userAnswer,
      concept,
      conversationHistory
    );
  }

  async evaluateConceptAnswer(
    userAnswer: string,
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    unmasteredTopics?: string[]
  ): Promise<{ comprehension: number; response: string; targetTopic: string }> {
    return this.evaluationService.evaluateConceptAnswer(
      userAnswer,
      concept,
      conversationHistory,
      unmasteredTopics
    );
  }

  async evaluateFlashcardAnswer(
    item: string,
    fields: string[],
    userAnswer: string,
    concept: Concept,
    otherConcepts: string[],
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>
  ): Promise<{ comprehension: number; response: string }> {
    return this.evaluationService.evaluateFlashcardAnswer(
      item,
      fields,
      userAnswer,
      concept,
      otherConcepts,
      previousAttempts
    );
  }

  async generateAbstractQuestion(
    concept: Concept,
    allConcepts: Concept[],
    previousQuestions: string[]
  ): Promise<string> {
    return this.generationService.generateAbstractQuestion(
      concept,
      allConcepts,
      previousQuestions
    );
  }

  async evaluateAbstractAnswer(
    question: string,
    userAnswer: string,
    concept: Concept,
    allConcepts: Concept[]
  ): Promise<string> {
    return this.evaluationService.evaluateAbstractAnswer(
      question,
      userAnswer,
      concept,
      allConcepts
    );
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>
  ): Promise<string> {
    return this.generationService.generateConnectionQuestion(
      connections,
      course,
      previousQuestions
    );
  }

  async evaluateConnectionAnswer(
    question: string,
    userAnswer: string,
    course: Course
  ): Promise<{ response: string; followUp: string | null }> {
    return this.evaluationService.evaluateConnectionAnswer(
      question,
      userAnswer,
      course
    );
  }

  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept
  ): Promise<string> {
    return this.generationService.generateElaborationQuestion(
      item,
      fields,
      concept
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
    itemsCovered: string[]
  ): Promise<string> {
    return this.generationService.generateHighLevelRecall(
      concept,
      itemsCovered
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
    itemsCovered: string[]
  ): Promise<string> {
    return this.evaluationService.evaluateHighLevelAnswer(
      question,
      userAnswer,
      concept,
      itemsCovered
    );
  }
}

export * from "./schemas.js";
