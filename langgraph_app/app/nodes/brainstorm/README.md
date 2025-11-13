# Brainstorm Nodes

## Architecture Overview

The brainstorming flow uses a multi-agent pattern with specialized nodes:

```
START → reset → createBrainstorm → loadNextSteps → router
                                                      ↓
                                    ┌─────────────────┼─────────────────┐
                                    ↓                 ↓                 ↓
                                qaAgent        brainstormAgent    nextStepsAgent
                                    ↓                 ↓                 ↓
                            ┌───────┴──────┐          END              END
                            ↓              ↓
                      saveAnswers    brainstormAgent
                            ↓              ↓
                      loadNextSteps       END
```

## Nodes

### 1. **qaAgent** (`qaAgent.ts`)
- **Purpose**: Evaluates if user's answer is GREAT
- **Input**: User's message + current topic
- **Output**: QA result with `success` boolean and `reasoning`
- **Context**: Loads topic-specific criteria from `app/prompts/brainstorm/topics/{topic}.md`

### 2. **brainstormAgent** (`brainstormAgent.ts`)
- **Purpose**: Asks questions OR asks for clarification
- **Modes**:
  - **Question Mode**: When `qa.success = true` or no QA yet, asks the next question
  - **Clarification Mode**: When `qa.success = false`, asks follow-up to refine answer
- **Output**: Question in structured format (text, examples, conclusion)
- **Context**: Loads topic-specific guidance from markdown files

### 3. **saveAnswersNode** (`saveAnswersNode.ts`)
- **Purpose**: Saves user's answer to database
- **Action**: Writes to `brainstorms` table via upsert
- **Route**: Always returns to `loadNextSteps` to advance to next topic

### 4. **nextStepsAgent** (`nextStepsAgent.ts`)
- **Purpose**: Guides user after completing all brainstorming questions
- **Message**: Celebrates completion + explains Brand Personalization + Build My Site button
- **Route**: Ends conversation (waits for user to take action)

## Routing Logic

### `routerNode` (after loadNextSteps)
```typescript
if (!currentTopic) → nextStepsAgent          // All topics done
if (qa?.success) → brainstormAgent           // Good answer, ask next question
if (conversational) → qaAgent                // User answered, evaluate it
else → nextStepsAgent                        // UI topic (lookAndFeel)
```

### `routeAfterQANode` (after qaAgent)
```typescript
if (qa.success) → saveAnswers                // Answer is GREAT, save it
else → brainstormAgent                       // Not good enough, clarify
```

## Topic Context Files

Each topic can have a markdown file with:
- Evaluation criteria
- Common weaknesses
- Examples of GREAT answers
- Red flags to watch for

Location: `app/prompts/brainstorm/topics/{topic}.md`

Topics:
- `idea.md` - Core business concept
- `audience.md` - Target customer details
- `solution.md` - How the business helps
- `socialProof.md` - Testimonials, credentials, results
- `lookAndFeel.md` - UI guidance (not conversational)

## Key Features

1. **Separation of Concerns**:
   - QA agent only evaluates
   - Brainstorm agent only converses
   - Save node only persists
   - Next steps agent only guides

2. **Topic-Specific Context**:
   - Each topic can have unique evaluation criteria
   - Loaded dynamically from markdown files
   - Easy to update without code changes

3. **Explicit Flow**:
   - Graph structure shows decision points
   - Easy to test each node independently
   - Clear routing logic based on state

## State Schema

```typescript
{
  currentTopic: TopicType,           // Which question we're on
  qa: QAResultType,                  // {success: boolean, reasoning: string}
  memories: MemoriesType,            // Saved answers by topic
  remainingTopics: TopicType[],     // Topics left to cover
  messages: BaseMessage[],          // Conversation history
  websiteId: number                 // User's project
}
```
