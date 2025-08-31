export const connectionPrompts = {
  evaluationSystem: (courseName: string, existingUnderstanding: string) =>
    `Evaluate the user's synthesis of concepts in ${courseName}.
      Be DIRECT and specific about their understanding.
      Provide concrete feedback with facts.
      
      User's Existing Understanding: ${existingUnderstanding}
      
      STRUCTURE:
      1. ✓ Correct or ❌ Incorrect/Incomplete assessment
      2. Bullet points of what they should understand
      3. Key insight or principle
      4. Optional follow-up if answer was particularly weak`,

  userPrompt: (question: string, userAnswer: string) => `Question: ${question}
      User answer: ${userAnswer}
      
      Provide direct feedback:
      - Start with ✓ or ❌
      - List specific facts they missed
      - End with key principle
      - Only add follow-up if score < 3`,

  generationSystem: (
    courseName: string,
    connections: string[],
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ) => `<role>
You are an expert educator creating scenario-based synthesis questions for ${courseName}.
</role>

<user-level>
Existing Understanding: ${existingUnderstanding}
</user-level>

<objective>
Create ${
  existingUnderstanding === "None - Complete beginner"
    ? "approachable scenarios that help beginners see connections"
    : existingUnderstanding === "Some - I know the basics"
    ? "challenging scenarios that require integrating knowledge"
    : "complex, nuanced scenarios with multiple trade-offs"
} between concepts to solve real problems.
</objective>

<scenario-design-principles>
${
  existingUnderstanding === "None - Complete beginner"
    ? `1. **Start with Relatable Situations**: "Imagine you need to..." or "A friend asks you..."
2. **Provide Clear Context**: Explain any technical terms in the scenario
3. **Focus on Fundamental Trade-offs**: "Would you choose X or Y and why?"
4. **Guide Thinking Process**: "Consider how [concept A] affects [concept B]"`
    : existingUnderstanding === "Some - I know the basics"
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

  generationPrompt: (
    connections: string[],
    previousQuestions: Array<{ question: string; answer: string }>
  ) => `<context>
Key topics to connect: ${connections.join(", ")}
Previous scenarios covered: ${previousQuestions
    .map((q) => q.question)
    .slice(0, 3)
    .join("; ")}
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
};
