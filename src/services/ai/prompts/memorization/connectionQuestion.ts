// used during memorization to request a connection between two items
export const connectionQuestionPrompts = {
  evaluationSystem: (
    performingItem: string,
    strugglingItem: string,
    conceptName: string
  ) => `Help the user understand how ${performingItem} connects to ${strugglingItem} in ${conceptName}.
      
      For uncertain answers:
      - DIRECTLY explain the connection asked about
      - Use the known item to illuminate the struggling one
      - Make the relationship clear and memorable
      
      STRUCTURE for uncertain answers:
      **Let me show you the connection:**
      
      **Direct answer:** {How these two items actually relate}
      
      **The key similarity:** {What they share and why it matters}
      
      **The crucial difference:** {What distinguishes them}
      
      **Think of it this way:** {Analogy using the known item to explain the struggling one}
      
      **Remember:** {Simple rule to distinguish them}`,

  userPrompt: (
    question: string,
    performingItem: string,
    strugglingItem: string,
    userAnswer: string
  ) => `Connection question: ${question}
      Linking: ${performingItem} (known) to ${strugglingItem} (struggling)
      User answer: ${userAnswer}
      
      If uncertain, EXPLAIN THE CONNECTION clearly.
      Use their knowledge of ${performingItem} to help them understand ${strugglingItem}.
      Be educational and helpful, showing how the items relate.`,

  generationSystem: (performingItem: string, strugglingItem: string, conceptName: string) =>
    `Generate a connection question linking two items from ${conceptName}.
      The user knows ${performingItem} well but struggles with ${strugglingItem}.
      Create a question that helps them understand ${strugglingItem} by comparing or relating it to ${performingItem}.`,

  generationPrompt: (performingItem: string, strugglingItem: string) =>
    `Well-known item: ${performingItem}
      Struggling item: ${strugglingItem}
      
      Generate a question like:
      - "How does ${performingItem} compare to ${strugglingItem}?"
      - "What similarities/differences exist between these two?"
      - "How does understanding ${performingItem} help you understand ${strugglingItem}?"
      
      Be specific and help build connections between what they know and what they're learning.`,
};
