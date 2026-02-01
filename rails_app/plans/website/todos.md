# Website Builder Todos Feature

## Overview

Add a user-facing task list to show progress while the website builder works. The deepagentsjs agent already has `todoListMiddleware()` built-in that provides a `write_todos` tool and produces `result.todos`.

We need to:
1. Instruct the agent to produce user-friendly task names via system prompt
2. Pass the agent's todos through to the graph state
3. Stream todos to the frontend via existing SDK infrastructure
4. Display dynamic todos in the sidebar (replacing hardcoded steps)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            deepagentsjs Agent                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  todoListMiddleware() (built-in)                                     │   │
│  │  - Provides write_todos tool                                         │   │
│  │  - Agent writes: { content: "Analyzing your ideas", status: "..." } │   │
│  │  - Result includes: result.todos                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         websiteBuilderNode                                   │
│  return {                                                                    │
│    messages: result.messages,                                               │
│    todos: result.todos ?? [],  // ◄── PASS THROUGH                         │
│    status: "completed",                                                      │
│  };                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WebsiteAnnotation                                    │
│  todos: Annotation<Todo[]>({                                                │
│    default: () => [],                                                        │
│    reducer: (current, next) => next,  // Replace on each update             │
│  }),                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    langgraph-ai-sdk (automatic)                              │
│  Streams state updates as: data-state-todos                                 │
│  No SDK changes needed - works automatically for any annotation field       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Frontend Component                                   │
│  const todos = useWebsiteChatState("todos") ?? [];                          │
│  // Render dynamic task list with icons based on content keywords            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Define Todo Type

**File:** `shared/types/website/todos.ts` (NEW)

```typescript
export const TodoStatuses = ["pending", "in_progress", "completed"] as const;
export type TodoStatus = (typeof TodoStatuses)[number];

export interface Todo {
  content: string;
  status: TodoStatus;
}
```

**File:** `shared/types/website/index.ts` (UPDATE)

```typescript
// Add export
export * as Todos from "./todos";
```

---

### Step 2: Add todos to WebsiteAnnotation

**File:** `langgraph_app/app/annotation/websiteAnnotation.ts`

Add after the `domainRecommendations` field (around line 68):

```typescript
  // Agent-managed todos for progress tracking UI
  todos: Annotation<Array<{ content: string; status: "pending" | "in_progress" | "completed" }>>({
    default: () => [],
    reducer: (current, next) => next,  // Replace entire array on each update
  }),
```

---

### Step 3: Add todos to WebsiteGraphState Type

**File:** `shared/state/website.ts`

Add to the type definition (around line 17):

```typescript
export type WebsiteGraphState = Simplify<CoreGraphState & {
    command: Website.CommandName | undefined;
    improveCopyStyle: Website.ImproveCopyStyle | undefined;
    brainstormId: PrimaryKeyType | undefined;
    brainstorm: Brainstorm.MemoriesType | undefined;
    theme: Website.ThemeType | undefined;
    images: Website.Image[];
    consoleErrors: Website.Errors.ConsoleError[];
    errorRetries: number;
    status: Core.Status;
    files: Website.FileMap;
    domainRecommendations: Website.DomainRecommendations.DomainRecommendations | undefined;
    todos: Array<{ content: string; status: "pending" | "in_progress" | "completed" }>;  // ADD
}>;
```

---

### Step 4: Pass todos Through in websiteBuilderNode

**File:** `langgraph_app/app/nodes/website/websiteBuilder.ts`

Update the return statement (lines 157-160):

```typescript
    return {
      messages: result.messages,
      status: "completed",
      todos: result.todos ?? [],  // ADD: pass through agent's todos
    };
```

Also update the cache mode return (lines 130-135):

```typescript
      return {
        messages: [...(state.messages || []), aiMessage],
        files,
        status: "completed",
        todos: [],  // ADD: empty todos for cache mode
      };
```

---

### Step 5: Add Todo Instructions to Agent System Prompt

**File:** `langgraph_app/app/prompts/coding/shared/todoTracking.ts` (NEW)

```typescript
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { CodingPromptState } from "./types";

/**
 * Instructions for user-friendly progress tracking via todos.
 * Guides the agent to write task names from the user's perspective.
 */
export const todoTrackingPrompt = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  return `
## PROGRESS TRACKING

Use the write_todos tool to show your progress to the user. Write task names from the USER's perspective - focus on what they see happening, not technical implementation details.

### Good Task Names (User-Friendly Outcomes)
- "Analyzing your ideas"
- "Setting up branding & color"
- "Writing compelling copy"
- "Designing hero section"
- "Adding additional sections"
- "Selecting the perfect images"
- "Polishing site with final touches"

### Bad Task Names (Too Technical - AVOID)
- "Edit config.json"
- "Create components/Header.tsx"
- "Run prettier on files"
- "Update Tailwind classes"

### How to Use
1. Before starting a major phase, add it as a todo with status "pending"
2. When you begin work on that phase, update its status to "in_progress"
3. When the phase is complete, update its status to "completed"
4. You can have multiple todos at once - only ONE should be "in_progress" at a time

### Example Flow
\`\`\`
// At start of work
write_todos([
  { content: "Analyzing your ideas", status: "in_progress" },
  { content: "Setting up branding & color", status: "pending" },
  { content: "Writing compelling copy", status: "pending" },
  { content: "Designing hero section", status: "pending" },
])

// After analysis complete, starting branding
write_todos([
  { content: "Analyzing your ideas", status: "completed" },
  { content: "Setting up branding & color", status: "in_progress" },
  { content: "Writing compelling copy", status: "pending" },
  { content: "Designing hero section", status: "pending" },
])
\`\`\`
`.trim();
};
```

**File:** `langgraph_app/app/prompts/coding/shared/index.ts` (UPDATE)

Add export:
```typescript
export { todoTrackingPrompt } from "./todoTracking";
```

**File:** `langgraph_app/app/prompts/coding/agent.ts` (UPDATE)

Import and include in the prompt:

```typescript
import {
  // ... existing imports
  todoTrackingPrompt,  // ADD
} from "./shared";

export const buildStaticContextPrompt = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  const [
    // ... existing prompts
    todoTracking,  // ADD
  ] = await Promise.all([
    // ... existing calls
    todoTrackingPrompt(state, config),  // ADD
  ]);

  return `
${userGoal}

${role}

${context}

${tools}

${todoTracking}

// ... rest of prompt
`.trim();
};
```

---

### Step 6: Update Frontend to Consume Dynamic Todos

**File:** `rails_app/app/javascript/frontend/components/website/sidebar/loading/WebsiteSidebarLoading.tsx`

Replace entire file:

```typescript
import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import LoadingStepPill, { type LoadingStepStatus } from "./WebsiteSidebarLoadingStepPill";
import {
  LightBulbIcon,
  PaintBrushIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  RectangleGroupIcon,
  PhotoIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { useWebsiteChatState } from "@hooks/website";

interface LoadingStepConfig {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

// Fallback steps shown before agent produces any todos
const fallbackSteps: LoadingStepConfig[] = [
  { id: "analyze", icon: LightBulbIcon, label: "Analyzing your ideas" },
  { id: "branding", icon: PaintBrushIcon, label: "Setting up branding & color" },
  { id: "copy", icon: ChatBubbleBottomCenterTextIcon, label: "Writing compelling copy" },
  { id: "hero", icon: StarIcon, label: "Designing hero section" },
  { id: "sections", icon: RectangleGroupIcon, label: "Adding additional sections" },
  { id: "images", icon: PhotoIcon, label: "Selecting the perfect images" },
  { id: "polish", icon: SparklesIcon, label: "Polishing site with final touches" },
];

/**
 * Map todo content to an appropriate icon based on keywords.
 * Falls back to SparklesIcon for unrecognized content.
 */
function getIconForContent(content: string): ComponentType<SVGProps<SVGSVGElement>> {
  const lower = content.toLowerCase();

  if (lower.includes("analyz") || lower.includes("idea")) return LightBulbIcon;
  if (lower.includes("brand") || lower.includes("color")) return PaintBrushIcon;
  if (lower.includes("copy") || lower.includes("writ")) return ChatBubbleBottomCenterTextIcon;
  if (lower.includes("hero")) return StarIcon;
  if (lower.includes("section")) return RectangleGroupIcon;
  if (lower.includes("image") || lower.includes("photo")) return PhotoIcon;
  if (lower.includes("polish") || lower.includes("final")) return SparklesIcon;

  return SparklesIcon; // Default fallback
}

export default function WebsiteSidebarLoading() {
  const todos = useWebsiteChatState("todos");

  // If no todos yet (agent hasn't started), show fallback with first step in progress
  if (!todos || todos.length === 0) {
    return (
      <CardHeader className="px-4 py-4">
        <CardTitle className="text-lg font-semibold font-serif">Landing Page Designer</CardTitle>
        <CardDescription className="flex flex-col gap-2 pt-1">
          {fallbackSteps.map((step, index) => (
            <LoadingStepPill
              key={step.id}
              icon={step.icon}
              label={step.label}
              status={index === 0 ? "in_progress" : "pending"}
            />
          ))}
        </CardDescription>
      </CardHeader>
    );
  }

  // Render agent's actual todos
  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">Landing Page Designer</CardTitle>
      <CardDescription className="flex flex-col gap-2 pt-1">
        {todos.map((todo, index) => (
          <LoadingStepPill
            key={`${todo.content}-${index}`}
            icon={getIconForContent(todo.content)}
            label={todo.content}
            status={todo.status as LoadingStepStatus}
          />
        ))}
      </CardDescription>
    </CardHeader>
  );
}
```

---

### Step 7: Update WebsiteSidebar to Remove currentStep Prop

**File:** `rails_app/app/javascript/frontend/components/website/sidebar/WebsiteSidebar.tsx`

Remove `currentStep` prop usage since it's no longer needed - the component now reads todos from state directly.

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `shared/types/website/todos.ts` | CREATE | Todo type definitions |
| `shared/types/website/index.ts` | UPDATE | Export Todos namespace |
| `shared/state/website.ts` | UPDATE | Add todos to WebsiteGraphState |
| `langgraph_app/app/annotation/websiteAnnotation.ts` | UPDATE | Add todos annotation field |
| `langgraph_app/app/nodes/website/websiteBuilder.ts` | UPDATE | Pass through result.todos |
| `langgraph_app/app/prompts/coding/shared/todoTracking.ts` | CREATE | Todo instructions prompt |
| `langgraph_app/app/prompts/coding/shared/index.ts` | UPDATE | Export todoTrackingPrompt |
| `langgraph_app/app/prompts/coding/agent.ts` | UPDATE | Include todo instructions |
| `rails_app/.../WebsiteSidebarLoading.tsx` | UPDATE | Consume todos from state |

---

## Verification

1. **Start dev servers:**
   ```bash
   cd rails_app && bin/dev
   ```

2. **Create a new website project** - triggers the create workflow

3. **Watch the sidebar** - todos should:
   - Show fallback steps initially (first one in_progress)
   - Update dynamically as agent writes todos
   - Show real progress based on agent's work

4. **Check streaming in DevTools:**
   - Network tab → filter for EventStream
   - Look for `data-state-todos` events

5. **Verify user-friendly names:**
   - Todos should say "Analyzing your ideas" not "Reading config files"
   - If agent doesn't follow prompts, iterate on the prompt instructions

---

## Fallback Strategy

If the agent doesn't reliably produce user-friendly task names:

1. **Option A: Strengthen prompts** - Add more examples, stricter instructions
2. **Option B: Create custom middleware** - Build middleware with structured schema (displayName, icon fields)
3. **Option C: Map agent todos** - Keep agent's technical todos, map to display names on frontend

---

## Future Enhancements

- [ ] Add "failed" status for error handling
- [ ] Persist todos to database for resume capability
- [ ] Different todo lists for different commands (create vs edit)
- [ ] Animations/transitions between states
- [ ] Make deepagents' todoMiddleware configurable via PR
