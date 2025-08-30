# Learning Structure

## Phase 1

1. User hits initializes with either a document they want to learn, or else just wants to use GPT's internal knowledge base.
2. AI asks them how time time they have, how in depth they want to go, which topics they want to learn (5 bullets, a few words each, taken from document (or gpt's own ideas)).
3. AI Makes course.json. This file gets saved.

## Phase 2

4. Course begins. AI gives high level explanation of topic, utilizing bullet points. Follows it up with a question, probing user understanding, trying to paint out first layer of understanding. E.g. "What are the different types of things people use to describe wine flavors"
5. User replies. AI ties in more information from course, corrects use if necessary, and asks another follow up question. e.g. "where do you think those come from?"
6. AI continues. It should try to lay groundwork for all important concepts in the high level of the course. Might take 10-20 steps.
7. Upon finishing, AI asks if the user has any questions, or if they want to dive into some more focused topics. Answers user's questions until ready.

## Phase 3 (Learning a Concept)

8. Repeat step 4-6, but focused on specific topic. It should cover high-level understanding, and explain how the thing works. Should use analogies, break things down. Asking questions, user answers. Should name every item in memorization for this phase, to make sure user has foundational knowledge. Might continue for 10-20 steps.
9. When user is ready, flashcard practice begins

## Phase 3.5 (Memorization)

10. User gets an item. They should type out the required fields for it.
11. AI responds with corrections. Gives some explanation for why the answer is the way it is. Like, "It's actually a light bodied wine, not full bodied. [This is because the aging process does XYZ | This is unusual for this type of wine, since most in the region are like this. It's light bodied because XYZ | This is because it's not aged in oak barrels]".
12. Continues until user has gotten every single answer correct twice. Until the card is gotten right twice, the test question is kept in the pool of questions and can continue coming up. Should randomize order every time.
13. Mixed in with the questions should be more abstract/connections questions. e.g. "Do you notice any trends in which wines are acidic vs not?". These types of questions should happen every 10 questions that get asked. A log of previously asked questions and answers should be saved so repeats don't get asked.

    1.  User responds
    2.  AI draws more connections to concepts (e.g. "Yeah, good thinking. That's not true, but is relevant for XYZ. The main reason for differing levels of acidity actually comes down to ABC and DEF. What's interesting is that GHI and JKL"), then returns to questions

14. Phase 3-3.5 Repeats for the remaining concepts.

## Phase 4

15. Open ended questions get asked tying everythign together, using the drawing-connections fields from the course.json. Should ask longer form open ended questions, e.g. "Let's say you're cooking dinner, and you're going to have fish and rice. What wine do you serve? Why?" user responds. AI: "Your friend thinks you're full of shit, and says ABC. Break down exactly why he's wrong. Be specific." Multiple repeat questions can be asked. Each connection should get a few questions, each allowed a few follow-up questions.

# Implementation For Grading/AI Responses

## High Level

This should be a CLI tool. Use the vercel ai sdk for making AI requests. Users confirming choices should be done by pressing enter.

I want this to be expandable, so don't make monolith files—let's keep this organized.

### Flashcard phase

Flashcard questions shoudl be posed to user like this:
"Describe the following fields for [item]:

- field1
- field2
- field3"

The response should then go to the AI

When AI responds during the flashcard phase, it should use the generateObject response.

The system prompt should stress user answers needing to be complete, but not pretty. Just demonstrating knowledge of all fields. It should say that responses should aim to draw connections to other concepts and topics, and it should list the other concepts and topcis from the course.json. It should be concise, and draw new connections with its response to the user. Comprehension should be graded on how much understanding the AI thinks the user has. With less comprehension score, user should get more response.

As user prompt for the AI, it should get the question, a description of what fields need to be answered. It should also get the history of what the user has previously answered, and how the AI previously responded.

It should respond with following structure:

{
"comprehension": 0-5
"response": "Spot on." OR "It's actually a light bodied wine, not full bodied. [This is because the aging process does XYZ | This is unusual for this type of wine, since most in the region are like this. It's light bodied because XYZ | This is because it's not aged in oak barrels]"
}

Then (not using ai prompting, but post-ai), if the comprehension score is 4 or higher, then it counts as a success on the item. Once an item has two successes, it can be removed from the rotation. Remember, regardless, the user response and ai response (including comprehension score) need to be saved with the item.

### Q&A

When AI responds during regular Q&A, it should use regular generateText method.

For the phase 2 ai, it should use slightly different system and user prompting than with the phase 3 ai, using different fields from the course.json. The response history should be saved so that future questions have context of the user's understanding. Likewise, in the phase 3.5 q&a, they should know what previous abstract questions had been asked.

## Courses JSON

In order to make the courses.json, it should be a generateObject call from vercel ai sdk. it shoudl begin by making one call, generating name of course, concepts, and drawing-connections fields. Then, for each concept, it should make another parallel genrateobject for that concept to generate those fields. It should use the conversation history to inform the decision making.
