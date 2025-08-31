// High-level questions during memorization that incorporate concept learning history
export const conceptAwareHighLevelPrompts = {
  generationSystem: (
    conceptName: string,
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) =>
    `<role>
Expert educator reinforcing conceptual understanding during memorization.
</role>

<context>
Learner Level: ${existingUnderstanding}

Weak Topics (comprehension < 5):
${
  weakTopics.length > 0
    ? weakTopics
        .map((t) => `• ${t.topic} (${t.comprehension}/5)`)
        .join("\n")
    : "All mastered"
}

Struggling Items:
${
  strugglingItems.length > 0
    ? strugglingItems
        .slice(0, 5)
        .map((i) => `• ${i.item} (${i.averageComprehension.toFixed(1)}/5)`)
        .join("\n")
    : "None"
}
</context>

<objective>
Create concept-phase style questions that:
1. Target weak topics
2. Use struggling items as examples
3. Test synthesis and application
</objective>

<approach>
${
  weakTopics.length > 0
    ? `Focus: ${weakTopics[0].topic} (${weakTopics[0].comprehension}/5)
Use struggling items as examples`
    : strugglingItems.length > 0
    ? `Connect struggling items to broader patterns`
    : `Synthesize across mastered topics`
}
</approach>

<question-templates>
${
  existingUnderstanding === "None - Complete beginner"
    ? `BEGINNER:
• How does [struggling item] relate to [weak topic]?
• What connects [item A] and [item B]?
• Which items best demonstrate [principle]?`
    : existingUnderstanding === "Some - I know the basics"
    ? `INTERMEDIATE:
• How does [topic] explain [struggling items]' behavior?
• What pattern connects [items] to [topic]?
• Why might beginners confuse [item A] with [item B]?`
    : `ADVANCED:
• What non-obvious relationship exists between [items] and [topic]?
• How do edge cases in [topic] explain [struggling items]?
• Design a scenario where [items] behave counterintuitively.`
}
</question-templates>

`,

  generationPrompt: (
    concept: { name: string; "high-level": string[] },
    itemsCovered: string[],
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) =>
    `<context>
Concept: ${concept.name}
Recent items: ${itemsCovered.slice(-10).join(", ")}
Topics: ${concept["high-level"].join(", ")}
Level: ${existingUnderstanding}

Weak topics: ${
  weakTopics.length > 0
    ? weakTopics.map((t) => `${t.topic} (${t.comprehension}/5)`).join(", ")
    : "None"
}
Struggling items: ${
  strugglingItems.length > 0
    ? strugglingItems.slice(0, 3).map((i) => i.item).join(", ")
    : "None"
}
</context>

<task>
Generate ONE concept-phase style question:

${
  weakTopics.length > 0
    ? `• Focus on: ${weakTopics[0].topic}
• Use examples: ${strugglingItems[0]?.item || "studied items"}
• Frame with "why" or "how"`
    : strugglingItems.length > 0
    ? `• Connect struggling items to patterns
• Link to mastered principles`
    : `• Synthesize across topics
• Explore edge cases`
}

Make it specific to this concept and match learner's level.



Example patterns:
${
  weakTopics.length > 0 && strugglingItems.length > 0
    ? `"How does ${weakTopics[0].topic} explain ${strugglingItems[0].item}'s properties?"`
    : weakTopics.length > 0
    ? `"Which items best demonstrate ${weakTopics[0].topic}?"`
    : `"What pattern connects these items?"`
}
</task>`,

  evaluationSystem: (
    conceptName: string,
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>
  ) => `<role>
Educator reinforcing conceptual understanding during memorization.
</role>

<context>
Level: ${existingUnderstanding}
${
  weakTopics.length > 0
    ? `Focus areas: ${weakTopics.map((t) => `${t.topic} (${t.comprehension}/5)`).join(", ")}`
    : `All mastered - deepen synthesis`
}
</context>

<response-patterns>
STRONG: Acknowledge → Add depth → Key insight
PARTIAL: Acknowledge correct → Clarify gaps → Core principle → Follow-up
MINIMAL: Direct answer → Detailed explanation → Verification
</response-patterns>`,

  userPrompt: (
    question: string,
    itemsCovered: string[],
    highLevelTopics: string[],
    userAnswer: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) => `Question: ${question}
Answer: ${userAnswer}

Context:
- Items: ${itemsCovered.join(", ")}
- Topics: ${highLevelTopics.join(", ")}
- Weak areas: ${weakTopics.length > 0 ? weakTopics.map((t) => `${t.topic} (${t.comprehension}/5)`).join(", ") : "none"}
- Struggling items: ${strugglingItems.length > 0 ? strugglingItems.slice(0, 3).map((i) => i.item).join(", ") : "none"}

Provide concept-phase style feedback addressing their answer and reinforcing weak areas.`,
};