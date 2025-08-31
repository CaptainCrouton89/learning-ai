// used during memorization to request a connection between two items, triggered after an easy topic
export const connectionQuestionPrompts = {
  generationSystem: (
    performingItem: string,
    strugglingItem: string,
    conceptName: string
  ) =>
    `<role>
You are an expert in ${conceptName} specializing in analogical reasoning and knowledge transfer.
</role>

<task>
Generate a connection question that uses the learner's mastery of "${performingItem}" to clarify "${strugglingItem}".
</task>

<requirements>
1. Bridge the two concepts explicitly
2. Focus on concrete, observable relationships
3. Use ${performingItem} to scaffold understanding
4. Apply cognitive bridging (analogy, contrast, or structural mapping)
</requirements>`,

  generationPrompt: (performingItem: string, strugglingItem: string) =>
    `<input>
Mastered: ${performingItem}
Struggling: ${strugglingItem}
</input>

<question-types>
Choose one approach:

1. STRUCTURAL: "What mechanism in ${performingItem} works similarly to [aspect] in ${strugglingItem}?"
2. CONTRAST: "How does ${strugglingItem} achieve [outcome] differently than ${performingItem}?"
3. CAUSAL: "How does [principle] in ${performingItem} explain ${strugglingItem}'s behavior?"
4. FUNCTIONAL: "What equivalent role does ${strugglingItem} play compared to ${performingItem}?"
5. EXTENSION: "How does ${strugglingItem} extend the principle from ${performingItem}?"
</question-types>

<requirements>
- Use specific properties of both items
- Include concrete details
- Activate existing mental models
- Avoid generic comparisons
</requirements>`,
  evaluationSystem: (
    performingItem: string,
    strugglingItem: string,
    conceptName: string
  ) => `<role>
You are a ${conceptName} expert using analogical reasoning to clarify concepts through familiar knowledge.
</role>

<task>
Evaluate the connection between ${performingItem} (mastered) and ${strugglingItem} (struggling).
</task>

<scoring>
5 - Articulates precise relationships with domain accuracy
4 - Correct connection with minor gaps
3 - Partial understanding, misses key relationships
2 - Fundamental misconceptions
1 - Vague or incorrect attempt
0 - No meaningful connection
</scoring>

<response-for-low-scores>
For scores 0-3:

## Bridge Concept
What they know about ${performingItem}: [property/behavior]

## Transfer
How this relates to ${strugglingItem}: [explicit connection]

## Key Insight
Shared principle: [underlying concept]

## Distinction
${performingItem} vs ${strugglingItem}: [precise difference]

## Mental Model
Think of ${strugglingItem} as ${performingItem} [transformation]
</response-for-low-scores>

<response-for-high-scores>
For scores 4-5:
- Acknowledge insights
- Extend understanding
- Connect to other concepts
</response-for-high-scores>`,

  userPrompt: (
    question: string,
    performingItem: string,
    strugglingItem: string,
    userAnswer: string
  ) => `<context>
Question: ${question}
Mastered: ${performingItem}
Struggling: ${strugglingItem}
</context>

<response>
${userAnswer}
</response>

<instructions>
1. Score comprehension (0-5)
2. Identify misconceptions

If score ≤ 3:
- Use ${performingItem} to scaffold understanding
- Provide concrete examples
- Build knowledge bridge

If score ≥ 4:
- Validate understanding
- Add nuances
- Extend to related concepts

Use ${performingItem} properties to illuminate ${strugglingItem}.
</instructions>`,
};
