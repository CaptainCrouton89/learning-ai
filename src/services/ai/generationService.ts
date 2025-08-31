import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Concept, Course } from "../../types/course.js";
import { conceptLearningPrompts, highLevelPrompts } from "./prompts.js";

export class GenerationService {
  private model = openai("gpt-5-mini");

  async generateHighLevelQuestion(
    course: Course,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    const backgroundTopics = course.backgroundKnowledge || [];
    const { text } = await generateText({
      model: this.model,
      system: highLevelPrompts.questionSystem(course.name, backgroundTopics, existingUnderstanding),
      prompt: `<context>
${
  conversationHistory.length > 0
    ? `Previous discussion:\n${conversationHistory
        .slice(-4)
        .map((entry) => `${entry.role}: ${entry.content}`)
        .join("\n\n")}`
    : "Starting the conversation."
}
</context>

${
  isFirstQuestion
    ? `First, provide a brief 3-paragraph introduction to ${course.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then ask a probing question about ${course.name} that explores foundational understanding.`
    : `Ask a probing question about ${course.name} that explores foundational understanding.`
}`,
    });

    return text;
  }

  async generateConceptQuestion(
    concept: Concept,
    conversationHistory: Array<{ role: string; content: string }>,
    existingUnderstanding: string,
    isFirstQuestion: boolean = false
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: conceptLearningPrompts.questionSystem(
        concept.name,
        concept["high-level"],
        existingUnderstanding
      ),
      prompt: `<context>
${
  conversationHistory.length > 0
    ? `Recent discussion:\n${conversationHistory
        .slice(-3)
        .map((entry) => `${entry.role}: ${entry.content}`)
        .join("\n\n")}`
    : "This is the beginning of our discussion."
}
</context>

${
  isFirstQuestion
    ? `First, provide a brief 3-paragraph introduction to ${concept.name} that gives essential context. Each paragraph should be 2-3 sentences max.
Then generate a focused question or teaching point that explores a specific aspect of ${concept.name}.`
    : `Generate a focused question or teaching point that explores a specific aspect of ${concept.name}.`
}`,
    });

    return text;
  }

  async generateAbstractQuestion(
    concept: Concept,
    allConcepts: Concept[],
    previousQuestions: string[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are an expert educator creating thought-provoking synthesis questions about ${concept.name}.
</role>

<objective>
Generate questions that test deep understanding through analysis, not just recall.
</objective>

<question-design-principles>
1. **Force Critical Analysis**: Ask "why" and "how" rather than "what"
2. **Require Prioritization**: "Which factor is MOST important..." 
3. **Include Constraints**: "Given only X, how would you..."
4. **Explore Edge Cases**: "Why might this pattern fail when..."
5. **Demand Specific Examples**: "Provide two contrasting cases where..."
6. **Challenge Assumptions**: "Why might X seem true but actually be misleading?"
</question-design-principles>

<avoid>
- Self-evident answers ("how does understanding X help you understand X?")
- Overly broad scope ("explain everything about...")
- Pure description without analysis
- Questions where the answer is contained in the question
</avoid>`,
      prompt: `<context>
Concept: ${concept.name}
Related concepts: ${allConcepts.map((c) => c.name).join(", ")}
Previous questions to avoid: ${previousQuestions.join("; ")}
</context>

<task>
Generate ONE precise question that:
1. Tests synthesis across multiple aspects of ${concept.name}
2. Requires the learner to analyze trade-offs or competing factors
3. Cannot be answered with simple recall or description
4. Has a non-obvious answer that requires genuine thinking

Focus on questions like:
- "Why does X typically lead to Y, and in what specific situations might this relationship reverse?"
- "If you had to choose between optimizing for A or B, which would have greater impact on C and why?"
- "What's the most common misconception about X, and why does it persist despite evidence?"
</task>`,
    });

    return text;
  }

  async generateConnectionQuestion(
    connections: string[],
    course: Course,
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are an expert educator creating scenario-based synthesis questions for ${course.name}.
</role>

<user-level>
Existing Understanding: ${existingUnderstanding}
</user-level>

<objective>
Create ${
  existingUnderstanding === 'None - Complete beginner'
    ? 'approachable scenarios that help beginners see connections'
    : existingUnderstanding === 'Some - I know the basics'
    ? 'challenging scenarios that require integrating knowledge'
    : 'complex, nuanced scenarios with multiple trade-offs'
} between concepts to solve real problems.
</objective>

<scenario-design-principles>
${
  existingUnderstanding === 'None - Complete beginner'
    ? `1. **Start with Relatable Situations**: "Imagine you need to..." or "A friend asks you..."
2. **Provide Clear Context**: Explain any technical terms in the scenario
3. **Focus on Fundamental Trade-offs**: "Would you choose X or Y and why?"
4. **Guide Thinking Process**: "Consider how [concept A] affects [concept B]"`
    : existingUnderstanding === 'Some - I know the basics'
    ? `1. **Present Realistic Problems**: "Your team encounters..." or "A project requires..."
2. **Include Multiple Constraints**: Time, budget, technical limitations
3. **Require Prioritization**: "Given these constraints, what's most important?"
4. **Test Applied Knowledge**: "How would you implement X while considering Y?"`
    : `1. **Complex Professional Scenarios**: "As the lead architect..." or "The CEO asks you..."
2. **Multiple Competing Factors**: Political, technical, financial, strategic
3. **Demand Strategic Thinking**: "What's your 3-phase approach?"
4. **Test Edge Cases**: "What if the usual approach fails?"
5. **Require Innovation**: "How would you solve this unprecedented challenge?"`
}
</scenario-design-principles>

<avoid>
- Generic "explain how X relates to Y" questions
- Scenarios with obvious solutions
- Questions that can be answered by listing facts
- Hypotheticals without specific constraints
</avoid>`,
      prompt: `<context>
Key topics to connect: ${connections.join(", ")}
Previous scenarios covered: ${previousQuestions.map(q => q.question).slice(0, 3).join("; ")}
</context>

<task>
Create a SPECIFIC scenario that:
1. Presents a realistic problem or decision point
2. Requires synthesizing at least 2-3 of the connection topics
3. Has multiple valid approaches with different trade-offs
4. Cannot be solved with textbook knowledge alone

Structure:
1. Set up a concrete scenario (2-3 sentences)
2. Present a specific challenge or decision
3. Ask for analysis with constraints (e.g., "Given limited time, which TWO factors would you prioritize?")

Example format:
"You're evaluating two wines for a restaurant's house selection. Wine A has high acidity and moderate tannins, while Wine B has low acidity but bold tannins. Your menu is seafood-focused but you need versatility. Which wine would you choose and why? Consider food pairing principles, customer preferences, and aging potential in your analysis."
</task>`,
    });

    return text;
  }

  async generateElaborationQuestion(
    item: string,
    fields: string[],
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate an elaboration question about ${item} from ${concept.name}.
      The user struggled with this item. Ask "why" or "what causes" questions to deepen understanding.
      Focus on the underlying reasons, mechanisms, or causes.
      Keep the question concise and focused.`,
      prompt: `Item: ${item}
      Fields: ${fields.join(", ")}
      Generate a question like "Why is X true?" or "What causes Y?" or "How does X lead to Y?"
      Make it specific to this item and help the user understand the deeper reasoning.`,
    });

    return text;
  }

  async generateConnectionToStruggling(
    performingItem: string,
    strugglingItem: string,
    concept: Concept
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `Generate a connection question linking two items from ${concept.name}.
      The user knows ${performingItem} well but struggles with ${strugglingItem}.
      Create a question that helps them understand ${strugglingItem} by comparing or relating it to ${performingItem}.`,
      prompt: `Well-known item: ${performingItem}
      Struggling item: ${strugglingItem}
      
      Generate a question like:
      - "How does ${performingItem} compare to ${strugglingItem}?"
      - "What similarities/differences exist between these two?"
      - "How does understanding ${performingItem} help you understand ${strugglingItem}?"
      
      Be specific and help build connections between what they know and what they're learning.`,
    });

    return text;
  }

  async generateHighLevelRecall(
    concept: Concept,
    itemsCovered: string[],
    existingUnderstanding: string
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: `<role>
You are an expert educator testing synthesis and critical thinking about ${concept.name}.
</role>

<user-level>
Existing Understanding: ${existingUnderstanding}
</user-level>

<objective>
Create questions that test understanding through analysis, scaled to the learner's level.
</objective>

<difficulty-scaled-frameworks>
${
  existingUnderstanding === 'None - Complete beginner'
    ? `**BEGINNER-LEVEL SYNTHESIS (Simple Pattern Recognition)**:
1. **Basic Comparison**: "Which item is MOST similar to X?"
2. **Simple Grouping**: "Which of these items belong together?"
3. **Clear Differences**: "What's the main difference between A and B?"
4. **Obvious Relationships**: "How does X directly affect Y?"
5. **Basic Prioritization**: "Which is more important: A or B?"

Focus on:
- Clear, direct relationships
- Binary choices (this OR that)
- Observable patterns
- Concrete examples
- Single-step reasoning`
    : existingUnderstanding === 'Some - I know the basics'
    ? `**INTERMEDIATE-LEVEL SYNTHESIS (Pattern Analysis)**:
1. **Comparative Analysis**: "Among X, Y, and Z, which most influences..."
2. **Conditional Reasoning**: "Why does X lead to Y, but not always?"
3. **Pattern Recognition**: "What pattern connects these three items?"
4. **Trade-offs**: "If you prioritize X, what happens to Y?"
5. **Contextual Application**: "In scenario A vs B, which approach works?"

Focus on:
- Multi-factor comparisons
- Cause-and-effect chains
- Exceptions to rules
- Trade-off decisions
- Context-dependent answers`
    : `**ADVANCED-LEVEL SYNTHESIS (Complex Analysis)**:
1. **Counter-intuitive Insights**: "Why might the obvious approach fail?"
2. **Complex Causality**: "Under what conditions does the pattern reverse?"
3. **Hidden Relationships**: "What unexpected connection exists between..."
4. **Multi-constraint Optimization**: "Given constraints A, B, and C, how would you..."
5. **Misconception Analysis**: "Why does misconception X persist despite evidence?"
6. **System-level Thinking**: "How do second-order effects change the outcome?"

Focus on:
- Non-obvious relationships
- Multiple interacting factors
- Edge cases and exceptions
- Strategic thinking
- Meta-level analysis`
}
</difficulty-scaled-frameworks>

<critical-requirements>
- Questions must match the learner's understanding level
- Avoid overwhelming beginners with complexity
- Challenge advanced learners appropriately
- Focus on "why" and "which" rather than "what" or "list"
- Include specific constraints or conditions
- Require choosing/ranking rather than just explaining
</critical-requirements>

<bad-question-patterns-to-avoid>
- "Explain how understanding X helps you understand X" (tautological)
- "Describe all the factors that influence..." (too broad, no analysis)
- "How do A, B, and C work together?" (vague, descriptive)
- "What have you learned about..." (pure recall)
</bad-question-patterns-to-avoid>`,
      prompt: `<context>
Concept: ${concept.name}
Items studied: ${itemsCovered.slice(-10).join(", ")}
Key topics: ${concept["high-level"].slice(0, 5).join(", ")}
Learner Level: ${existingUnderstanding}
</context>

<task>
Generate ONE precise analytical question appropriate for the learner's level:

${
  existingUnderstanding === 'None - Complete beginner'
    ? `**BEGINNER QUESTION REQUIREMENTS**:
1. Reference 2 specific items they've studied
2. Ask for a simple comparison or grouping
3. Have a clear, logical answer
4. Build confidence while testing synthesis

<good-beginner-examples>
- "Looking at ${itemsCovered[0] || 'item A'} and ${itemsCovered[1] || 'item B'}, which one is more [specific attribute]? Why?"
- "You've learned about [X, Y, Z]. Which two are most similar and what makes them alike?"
- "If you had to choose between [A] and [B] for [simple goal], which would work better?"
- "What's the biggest difference between [item X] and [item Y] that you've noticed?"
</good-beginner-examples>`
    : existingUnderstanding === 'Some - I know the basics'
    ? `**INTERMEDIATE QUESTION REQUIREMENTS**:
1. Reference 2-3 specific items from those studied
2. Require comparing, prioritizing, or identifying patterns
3. Have a reasoned answer with trade-offs
4. Test analytical thinking

<good-intermediate-examples>
- "Between ${itemsCovered[0] || 'factor A'} and ${itemsCovered[1] || 'factor B'}, which has a greater impact on [outcome]? What conditions might change this?"
- "You've learned about [X, Y, Z]. What pattern connects all three, and which one is the exception?"
- "If you had to optimize for [goal A] vs [goal B], how would your choice between [item X] and [item Y] change?"
- "Why does [relationship] work for [items A and B] but not for [item C]?"
</good-intermediate-examples>`
    : `**ADVANCED QUESTION REQUIREMENTS**:
1. Reference multiple specific items with complex relationships
2. Require identifying non-obvious connections or contradictions
3. Have nuanced answers with multiple valid perspectives
4. Challenge assumptions and test deep synthesis

<good-advanced-examples>
- "Between ${itemsCovered[0] || 'factor A'} and ${itemsCovered[1] || 'factor B'}, which has a greater impact on [outcome], and under what specific conditions would this hierarchy completely reverse?"
- "You've learned about [X, Y, Z]. What counter-intuitive relationship exists between them that beginners often miss?"
- "Why does [common assumption] about [items A and B] seem logical but actually mislead practitioners? What's the real dynamic?"
- "Given constraints [A, B, C], how would you balance [competing factors] to achieve [complex goal]? What's the key trade-off?"
</good-advanced-examples>`
}

<bad-examples-to-avoid>
- "Explain how [listing items] contribute to [obvious outcome]"
- "Describe the relationship between [X] and [Y]"
- "How does understanding [X] help you evaluate [X]?"
- Questions that are too complex for beginners or too simple for advanced learners
</bad-examples-to-avoid>

Create a question following the appropriate difficulty level, using the actual items and topics from this concept.
</task>`,
    });

    return text;
  }
}