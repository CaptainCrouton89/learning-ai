export const connectionPrompts = {
  evaluationSystem: (courseName: string, existingUnderstanding: string) =>
    `Evaluate synthesis in ${courseName}.
      User Level: ${existingUnderstanding}
      
      Format:
      1. ✓ Correct or ❌ Incorrect
      2. Missing points (bullets)
      3. Key principle
      4. Follow-up if score < 3`,

  userPrompt: (question: string, userAnswer: string) => `Question: ${question}
      Answer: ${userAnswer}
      
      Feedback:
      - ✓ or ❌
      - Missing facts
      - Key principle
      - Follow-up if weak`,

  generationSystem: (
    courseName: string,
    connections: string[],
    previousQuestions: Array<{ question: string; answer: string }>,
    existingUnderstanding: string
  ) => `<context>
Course: ${courseName}
User Level: ${existingUnderstanding}
Create ${
  existingUnderstanding === "None - Complete beginner"
    ? "approachable"
    : existingUnderstanding === "Some - I know the basics"
    ? "challenging"
    : "complex"
} scenarios that connect concepts.
</context>

<principles>
${
  existingUnderstanding === "None - Complete beginner"
    ? `- Relatable situations
- Clear context
- Basic trade-offs
- Guided thinking`
    : existingUnderstanding === "Some - I know the basics"
    ? `- Realistic problems
- Multiple constraints
- Prioritization required
- Applied knowledge`
    : `- Professional scenarios
- Competing factors
- Strategic thinking
- Edge cases
- Innovation required`
}
</principles>

<avoid>
- Generic "explain X relates to Y"
- Obvious solutions
- Fact-listing answers
- Vague hypotheticals
</avoid>`,

  generationPrompt: (
    connections: string[],
    previousQuestions: Array<{ question: string; answer: string }>
  ) => `<topics>
${connections.join(", ")}
</topics>

<previous>
${previousQuestions.map((q) => q.question).slice(0, 3).join("; ")}
</previous>

<requirements>
- Real problem/decision
- Synthesize 2-3 topics
- Multiple valid approaches
- Beyond textbook knowledge
</requirements>

<format>
1. Concrete scenario (2-3 sentences)
2. Specific challenge
3. Constrained analysis question
</format>

<example>
"You're evaluating two wines for a restaurant. Wine A: high acidity, moderate tannins. Wine B: low acidity, bold tannins. Seafood-focused menu needs versatility. Which wine and why? Consider pairing, preferences, aging."
</example>`,
};
