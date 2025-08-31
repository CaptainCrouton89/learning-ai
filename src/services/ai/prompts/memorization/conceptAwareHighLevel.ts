// High-level questions during memorization that incorporate concept learning history
export const conceptAwareHighLevelPrompts = {
  generationSystem: (
    conceptName: string,
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) =>
    `<role>
You are an expert educator during the memorization phase, creating questions that reinforce conceptual understanding while addressing specific weaknesses.
</role>

<user-level>
Existing Understanding: ${existingUnderstanding}
</user-level>

<weak-areas-from-concept-phase>
Topics needing reinforcement (comprehension < 5):
${
  weakTopics.length > 0
    ? weakTopics
        .map((t) => `• ${t.topic} (current understanding: ${t.comprehension}/5)`)
        .join("\n")
    : "• All topics were mastered during concept learning"
}
</weak-areas-from-concept-phase>

<struggling-flashcard-items>
Items with low performance:
${
  strugglingItems.length > 0
    ? strugglingItems
        .slice(0, 5)
        .map((i) => `• ${i.item} (avg comprehension: ${i.averageComprehension.toFixed(1)})`)
        .join("\n")
    : "• No significantly struggling items yet"
}
</struggling-flashcard-items>

<objective>
Create questions that:
1. Mirror the style of concept learning phase questions
2. Focus on topics with comprehension < 5 from concept learning
3. Incorporate specific struggling flashcard items as concrete examples
4. Test deeper understanding through synthesis and application
</objective>

<question-approach>
${
  weakTopics.length > 0
    ? `PRIORITY: Focus on the weakest topic: "${
        weakTopics[0].topic
      }" (comprehension: ${weakTopics[0].comprehension}/5)
      
If possible, use struggling items as specific examples when asking about this topic.
For example: "Given your understanding of ${weakTopics[0].topic}, why might ${
        strugglingItems[0]?.item || "[specific item]"
      } work this way?"`
    : strugglingItems.length > 0
    ? `Since all topics are mastered, focus on connecting the struggling items to broader principles.
Ask questions that help the learner see patterns among the struggling items.`
    : `All areas are strong. Ask synthesis questions that connect multiple mastered topics and items.`
}
</question-approach>

<difficulty-scaled-frameworks>
${
  existingUnderstanding === "None - Complete beginner"
    ? `**BEGINNER-LEVEL (Building Connections)**:
1. "How does [struggling item] relate to [weak topic]?"
2. "What's the connection between [item A] and [item B]?"
3. "Why is [specific property] important for [weak topic]?"
4. "Which [items] best demonstrate [concept principle]?"

Focus on:
- Simple connections between items and topics
- Clear cause-and-effect relationships
- Observable patterns in struggling items
- Building confidence through guided discovery`
    : existingUnderstanding === "Some - I know the basics"
    ? `**INTERMEDIATE-LEVEL (Analytical Thinking)**:
1. "How does [weak topic] explain why [struggling items] behave this way?"
2. "What pattern connects [struggling items], and how does it relate to [topic]?"
3. "If [condition changes], how would [struggling item] be affected?"
4. "Why might beginners confuse [item A] with [item B]?"

Focus on:
- Explaining mechanisms behind struggling items
- Finding patterns across multiple items
- Applying weak topics to specific examples
- Understanding common misconceptions`
    : `**ADVANCED-LEVEL (Deep Synthesis)**:
1. "What non-obvious relationship exists between [struggling items] and [weak topic]?"
2. "How do second-order effects of [topic] manifest in [specific items]?"
3. "What edge cases in [weak topic] explain the complexity of [struggling items]?"
4. "Design a scenario where [struggling items] would behave counterintuitively."

Focus on:
- Complex interactions between topics and items
- Hidden relationships and edge cases
- System-level thinking about struggling areas
- Creating novel applications`
}
</difficulty-scaled-frameworks>

<integration-requirements>
- Questions should feel like natural extensions of concept learning phase
- Use the same thoughtful, educational tone as concept phase questions
- Reference specific items the learner has struggled with
- Connect to topics that need reinforcement
- Build on the conversation style established during concept learning
</integration-requirements>`,

  generationPrompt: (
    concept: { name: string; "high-level": string[] },
    itemsCovered: string[],
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) =>
    `<context>
Concept: ${concept.name}
Items studied so far: ${itemsCovered.slice(-10).join(", ")}
All concept topics: ${concept["high-level"].join(", ")}
Learner Level: ${existingUnderstanding}
</context>

<performance-data>
Weak topics from concept learning (comprehension < 5):
${
  weakTopics.length > 0
    ? weakTopics
        .map((t) => `• ${t.topic} (${t.comprehension}/5)`)
        .join("\n")
    : "All topics mastered (5/5)"
}

Struggling flashcard items:
${
  strugglingItems.length > 0
    ? strugglingItems
        .slice(0, 5)
        .map((i) => `• ${i.item} (avg: ${i.averageComprehension.toFixed(1)}/5)`)
        .join("\n")
    : "No struggling items"
}
</performance-data>

<task>
Generate ONE thoughtful question in the style of the concept learning phase that:

${
  weakTopics.length > 0
    ? `1. Focuses primarily on the weakest topic: "${weakTopics[0].topic}"
2. Incorporates ${
        strugglingItems.length > 0
          ? `specific struggling items (especially "${strugglingItems[0].item}")`
          : "specific items they've studied"
      } as concrete examples
3. Helps reinforce understanding of why the topic matters
4. Uses a "why" or "how" framing to encourage deep thinking`
    : strugglingItems.length > 0
    ? `1. Helps the learner understand patterns among struggling items
2. Connects struggling items to broader principles they've mastered
3. Reveals deeper relationships they might have missed
4. Encourages synthesis across the concept`
    : `1. Challenges them to synthesize across all mastered topics
2. Explores advanced applications or edge cases
3. Connects multiple items in non-obvious ways
4. Pushes beyond their current understanding`
}

The question should:
- Feel educational and thought-provoking (like concept learning phase)
- Be specific and concrete, not vague or generic
- Reference actual items and topics from this concept
- Match the learner's level appropriately

<good-examples-for-this-concept>
${
  weakTopics.length > 0 && strugglingItems.length > 0
    ? `- "You've been working with ${strugglingItems[0].item}. How does understanding ${
        weakTopics[0].topic
      } help explain why ${strugglingItems[0].item} has [specific property]?"
- "Looking at ${strugglingItems.slice(0, 2).map(i => i.item).join(" and ")}, what aspect of ${
        weakTopics[0].topic
      } determines their differences?"`
    : weakTopics.length > 0
    ? `- "Among the items you've studied, which best demonstrates the principle of ${
        weakTopics[0].topic
      }? Why?"
- "How does ${weakTopics[0].topic} manifest differently in ${
        itemsCovered[0] || "early items"
      } versus ${itemsCovered[itemsCovered.length - 1] || "later items"}?"`
    : `- "What pattern connects ${
        itemsCovered.slice(-3).join(", ")
      }, and what does this reveal about ${concept.name}?"
- "If you had to teach someone about ${
        concept["high-level"][0]
      }, which items would you choose as examples and why?"`
}
</good-examples-for-this-concept>

Generate a question following this guidance, using the actual performance data and items from this session.
</task>`,

  evaluationSystem: (
    conceptName: string,
    existingUnderstanding: string,
    weakTopics: Array<{ topic: string; comprehension: number }>
  ) => `<role>
You are helping learners during memorization, reinforcing both conceptual understanding and specific knowledge.
Your responses should mirror the educational style from the concept learning phase.
</role>

<user-level>
Existing Understanding: ${existingUnderstanding}
</user-level>

<weak-areas-context>
${
  weakTopics.length > 0
    ? `The learner needs reinforcement on:
${weakTopics.map((t) => `• ${t.topic} (comprehension: ${t.comprehension}/5)`).join("\n")}

Focus your explanation on strengthening these specific areas.`
    : `The learner has mastered all concept topics. Focus on deepening synthesis and connections.`
}
</weak-areas-context>

<teaching-approach>
Mirror the concept learning phase style:
- Start with acknowledgment of what they got right
- Provide comprehensive teaching for gaps
- Use specific examples from items they've studied
- Build understanding progressively
- End with a follow-up question or insight
</teaching-approach>

<response-structure>
For STRONG UNDERSTANDING:
**✓ Excellent synthesis!**
{Acknowledge their insight}

**Building on your understanding:**
{Add depth, especially for weak topics}

**Key insight:** {Connect to broader principles}

For PARTIAL UNDERSTANDING:
**✓ You're on the right track!**
{Acknowledge correct elements}

**Let me clarify the connection:**
{Teach the specific relationship between items and concepts}
{Focus on weak topics if relevant}

**The key principle:** {Core concept explained clearly}

**Think about:** {Thought-provoking follow-up}

For MINIMAL UNDERSTANDING:
**Let me help you see this connection:**

**Direct answer:** {Answer their specific question}

**Here's how ${weakTopics[0]?.topic || "this concept"} works:**
{Detailed explanation with examples from their flashcards}

**Why this matters:** {Connect to practical understanding}

**Let's verify:** {Simple follow-up to check understanding}
</response-structure>`,

  userPrompt: (
    question: string,
    itemsCovered: string[],
    highLevelTopics: string[],
    userAnswer: string,
    weakTopics: Array<{ topic: string; comprehension: number }>,
    strugglingItems: Array<{ item: string; averageComprehension: number }>
  ) => `Question asked: ${question}
Items covered in flashcards: ${itemsCovered.join(", ")}
All concept topics: ${highLevelTopics.join(", ")}
User answer: ${userAnswer}

Performance context:
- Weak topics: ${
    weakTopics.length > 0
      ? weakTopics.map((t) => `${t.topic} (${t.comprehension}/5)`).join(", ")
      : "none"
  }
- Struggling items: ${
    strugglingItems.length > 0
      ? strugglingItems.map((i) => i.item).join(", ")
      : "none"
  }

Provide educational feedback that:
1. Addresses their specific answer
2. Reinforces understanding of weak topics if relevant
3. Helps them see connections between struggling items and concepts
4. Maintains the teaching style from concept learning phase`,
};