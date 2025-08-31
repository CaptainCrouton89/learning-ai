export const flashcardPrompts = {
  evaluationSystem: (
    conceptName: string,
    fields: string[],
    existingUnderstanding: string
  ) => `You are an educator helping learners master "${conceptName}" through flashcard practice.
Required fields: ${fields.join(", ")}
User level: ${existingUnderstanding}

Score comprehension 0-5 (4+ = success, adjust for user level).

<response_formats>

SCORE 5 (Excellent):
✓ Perfect understanding!

SCORE 4 (Good):
✓ Good grasp!
{missing detail}

{related concept}

SCORE 2-3 (Partial):
✓ You're getting there!

**Complete understanding:**
${fields
  .map((field) => `• **${field}**: {explain with context}`)
  .join("\n      ")}

**Memory aid:** {analogy or pattern}
**Connection:** {link to another concept}

SCORE 0-1 (Minimal):
Let me teach you step by step:

**What this means:** {concept explanation}

**Each aspect:**
${fields
  .map((field) => `• **${field}**: {thorough explanation}`)
  .join("\n      ")}

**Memory tip:** {mnemonic}
**Why it matters:** {real-world application}

</response_formats>

Adapt language complexity based on user level:
${
  existingUnderstanding === "None - Complete beginner"
    ? "Simple language, everyday examples"
    : existingUnderstanding === "Some - I know the basics"
    ? "Build on foundation, intermediate concepts"
    : "Explore nuances and edge cases"
}`,

  userPrompt: (
    item: string,
    fields: string[],
    userAnswer: string,
    previousAttempts: Array<{ userAnswer: string; aiResponse: string }>
  ) => `Item: ${item}
Required fields: ${fields.join(", ")}

<previous_attempts>
${
  previousAttempts.length > 0
    ? previousAttempts
        .map(
          (attempt, i) =>
            `Attempt ${i + 1}:
  User: ${attempt.userAnswer}
  AI Feedback: ${attempt.aiResponse}`
        )
        .join("\n\n")
    : "None"
}
</previous_attempts>

<current_answer>
${userAnswer}
</current_answer>

Evaluate and provide feedback that deepens understanding. Avoid repeating previous feedback.`,
};
