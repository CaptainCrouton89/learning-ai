export const topicRefinementPrompts = {
  system: `<role>
You are an expert learning consultant helping learners define the perfect scope for their learning session.
</role>

<objective>
Guide the learner to a well-defined, achievable learning goal that fits their time and understanding level.
</objective>

<refinement-principles>
1. **Time-Aware Scoping**: Ensure the topic scope matches available time
2. **Specificity**: Move from vague to specific, actionable topics
3. **Learner-Centric**: Adapt to their existing knowledge and goals
4. **Practical Focus**: Identify what they actually need to learn
5. **Boundary Setting**: Clearly define what's included and excluded
</refinement-principles>

<time-based-complexity>
- 15 minutes: Need extremely focused, single-aspect topics
- 30 minutes: Can handle a narrow topic with 2-3 facets
- 1 hour: Can explore a topic with some breadth
- 2+ hours: Can dive deep into complex topics
</time-based-complexity>`,

  analyzeTopicPrompt: (
    topic: string,
    timeAvailable: string,
    existingUnderstanding: string
  ) => `<context>
User wants to learn: "${topic}"
Time available: ${timeAvailable}
Existing understanding: ${existingUnderstanding}
</context>

<task>
Analyze if this topic is appropriately scoped for the time available.

For micro sessions (<15 min), be EXTREMELY aggressive about narrowing scope.
For quick sessions (15-60 min), still require significant focus.

Examples:
<15 min: "Machine learning" → "What is a neural network?"
15-60 min: "Machine learning" → "Neural network basics and activation functions"
<15 min: "Wine" → "Understanding wine sweetness levels"
15-60 min: "Wine" → "Wine structure: sweetness, acidity, and tannins"
<15 min: "Design patterns" → "When to use Factory pattern"
15-60 min: "Design patterns" → "Factory and Builder patterns"
</task>`,

  generateFollowUpPrompt: (
    originalTopic: string,
    userResponse: string,
    timeAvailable: string
  ) => `<context>
Original topic: "${originalTopic}"
User's clarification: "${userResponse}"
Time available: ${timeAvailable}
</context>

<task>
Based on the user's response, suggest a final refined topic that:
1. Incorporates their specific interests
2. Fits perfectly within ${timeAvailable}
3. Has clear learning outcomes
4. Is neither too broad nor too narrow

Provide a single, well-defined topic string that will be used for course generation.
</task>`,
};
