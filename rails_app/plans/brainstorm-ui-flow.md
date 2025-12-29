# Brainstorm UI Flow Implementation Plan

## Overview

Implement the Brainstorm UI flow that guides users through 5 questions to gather information for landing page generation. The flow consists of two pages:

1. **Landing Page** (`/projects/new`) - Initial welcome screen with message input
2. **Conversation Page** (`/projects/{UUID}/brainstorm`) - Full chat interface with Brand Personalization panel

The backend (brainstorm.ts graph) is already complete with tests.

## Architecture Decisions

| Decision                | Choice                              | Rationale                                                                     |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Route for landing page  | `/projects/new`                     | Clear intent, matches existing patterns                                       |
| Progress UI             | Light visual touches (topic badges) | Not a full stepper, keeps focus on conversation                               |
| URL transition          | Silent `history.replaceState`       | Seamless UX, threadId becomes projectUUID                                     |
| State management        | Zustand + Immer (BrainstormStore)   | Matches existing campaign patterns                                            |
| URL replacement trigger | On first message submit             | Immediate UX - use `state.projectUUID` or generate UUID client-side on submit |
| Topic detection         | Use `state.brainstorm` keys         | Finished topics have keys in state.brainstorm object + currentTopic           |
| Brand assets            | Existing Rails APIs                 | Uploads controller (is_logo: true), Themes controller for colors              |
| SSE error handling      | Internal to useLanggraph            | Hook handles reconnection automatically                                       |

## Clarifications & Resolved Questions

### State Management

- **Q: How does Landing → Conversation state transfer work?**
- **A:** Since we use `history.replaceState` (not navigation), the React component stays mounted. The `useBrainstormChat` hook instance persists, so no state transfer is needed.

### URL Replacement

- **Q: What triggers URL replacement?**
- **A:** Replace URL immediately on first message submit. Either:
  1. Use `state.projectUUID` if the backend generates it, OR
  2. Generate UUID client-side on submit and pass to backend

  This provides immediate UX feedback rather than waiting for Langgraph response.

### Topic Detection

- **Q: How do we detect topic transitions for TopicBadge?**
- **A:** Use `state.brainstorm` which contains keys for finished topics. Combined with `state.currentTopic`, we can determine which topic we're on and calculate the topic index.

### Command Buttons

- **Q: What about commands during streaming?**
- **A:** Not an issue - command buttons only appear after streaming ends (they're a state change that occurs post-stream).

### Brand Personalization Panel

- **Q: Where does brand data come from?**
- **A:** Rails APIs:
  - **Logo**: Uploads controller with `is_logo: true` (existing)
  - **Colors**: Themes controller (existing)
  - **Images**: Uploads controller (existing)
  - **Social Links**: **NEW API NEEDED** - `SocialLinks` table attached to projects

### Error Handling

- **Q: What about project creation failures?**
- **A:** MVP punt - retry the create project node. No custom error UI for now.

### SSE Connection

- **Q: What about SSE connection failures?**
- **A:** Handled internally by `useLanggraph` hook with automatic reconnection.

## Punted for MVP

| Item                           | Reason                                  | Future Resolution                             |
| ------------------------------ | --------------------------------------- | --------------------------------------------- |
| Concurrent editing (multi-tab) | Requires complex backend infrastructure | Add WebSocket-based state sync or tab locking |
| Project creation error UI      | MVP scope                               | Add inline error with retry button            |
| Message length validation      | Low risk for brainstorm                 | Add character limit with counter              |

## Design Tokens

```typescript
// colors.ts
export const brainstormColors = {
  // Layout
  sidebarBg: "#12183D",
  pageBg: "#FAFAF9",

  // Text
  textPrimary: "#2E3238",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  // Messages
  userBubbleBg: "#EDEDEC",
  aiBubbleBg: "transparent",

  // Topic Badge
  topicBadgeBg: "rgba(215, 218, 241, 0.16)",
  topicBadgeBorder: "#9BA3DB",
  topicBadgeText: "#9BA3DB",

  // CTA
  primaryCta: "#DF6D4A",
  primaryCtaHover: "#C85F42",

  // Build My Site Gradient
  buildCtaGradient: "linear-gradient(-71.12deg, #D8644F 0%, #3748B8 95.53%)",
  buildCtaBorder: "#3748B8",

  // Command Buttons
  commandBorder: "#D1D5DB",
  commandHoverBg: "#F3F4F6",
};
```

## Component Architecture

```
app/javascript/frontend/
├── pages/
│   └── Brainstorm/
│       ├── index.tsx            # /projects/new - Landing + inline Conversation
│       └── Show.tsx             # /projects/{id}/brainstorm - Direct navigation (page refresh)
├── features/
│   └── Brainstorm/
│       ├── components/
│       │   ├── LandingView.tsx         # Initial "Tell us your idea" view
│       │   ├── ConversationView.tsx    # Full chat interface
│       │   ├── MessageList.tsx
│       │   ├── MessageInput.tsx
│       │   ├── TopicBadge.tsx
│       │   ├── ThinkingIndicator.tsx
│       │   ├── CommandButtons.tsx
│       │   ├── BuildMySiteCta.tsx
│       │   └── BrandPersonalizationPanel.tsx
│       ├── hooks/
│       │   └── useBrainstormChat.ts
│       └── types.ts
└── stores/
    └── brainstormStore.ts       # Already exists, may need updates
```

**Key insight:** The Landing page (`/projects/new`) renders both LandingView and ConversationView conditionally in the same component. This keeps the hook instance alive during the URL transition. The Show page (`/projects/{id}/brainstorm`) is for direct navigation/page refresh and hydrates from Inertia props.

## Shared Chat Components (Compound Component Pattern)

### Design Philosophy: Compound Components

Instead of boolean props like `showFileUpload`, `showBubble`, we use **compound components** for maximum flexibility and composability:

```tsx
// ❌ Boolean props (inflexible)
<MessageInput showFileUpload={false} showRefresh={false} />

// ✅ Compound components (composable)
<Chat.Input>
  <Chat.Input.Textarea placeholder="Type your answer..." />
  <Chat.Input.SubmitButton />
</Chat.Input>

// Campaign version with more features
<Chat.Input>
  <Chat.Input.FileUpload />
  <Chat.Input.Textarea placeholder="Ask for changes..." />
  <Chat.Input.SubmitButton />
  <Chat.Input.RefreshButton onRefresh={handleRefresh} />
</Chat.Input>
```

### Shared Component Architecture

```
app/javascript/frontend/components/chat/
├── index.tsx                    # Chat compound component root
├── Chat.tsx                     # Context provider
├── MessageList/
│   ├── index.tsx               # Chat.MessageList
│   ├── Message.tsx             # Chat.Message (auto-detects role)
│   └── ScrollAnchor.tsx        # Auto-scroll behavior
├── Input/
│   ├── index.tsx               # Chat.Input compound root
│   ├── Textarea.tsx            # Chat.Input.Textarea
│   ├── SubmitButton.tsx        # Chat.Input.SubmitButton
│   ├── FileUpload.tsx          # Chat.Input.FileUpload (Campaign)
│   └── RefreshButton.tsx       # Chat.Input.RefreshButton (Campaign)
├── AIMessage/
│   ├── index.tsx               # Chat.AIMessage compound root
│   ├── Content.tsx             # Markdown content
│   ├── Bubble.tsx              # Optional bubble wrapper
│   └── Loading.tsx             # Loading state variants
├── UserMessage.tsx             # Chat.UserMessage
├── TopicBadge.tsx              # Chat.TopicBadge (reusable)
├── CommandButtons.tsx          # Chat.CommandButtons (reusable)
└── ThinkingIndicator.tsx       # Chat.ThinkingIndicator (reusable)
```

### Usage Examples

**Brainstorm Chat:**

```tsx
<Chat threadId={projectId} api="/api/brainstorm/stream">
  <Chat.TopicBadge topic={currentTopic} current={topicIndex} />

  <Chat.MessageList>
    {messages.map((msg) => (
      <Chat.Message key={msg.id} message={msg} />
    ))}
    {isStreaming && <Chat.ThinkingIndicator variant="rocket" />}
  </Chat.MessageList>

  <Chat.CommandButtons commands={availableCommands} onCommand={sendCommand} />

  <Chat.Input>
    <Chat.Input.Textarea placeholder="Type your answer..." />
    <Chat.Input.SubmitButton />
  </Chat.Input>
</Chat>
```

**Campaign Chat:**

```tsx
<Chat threadId={threadId} api="/api/ads/stream">
  <Chat.MessageList>
    {messages.map((msg) => (
      <Chat.Message key={msg.id} message={msg}>
        <Chat.AIMessage.Bubble />
      </Chat.Message>
    ))}
    {isStreaming && <Chat.ThinkingIndicator variant="spinner" />}
  </Chat.MessageList>

  <Chat.Input>
    <Chat.Input.FileUpload />
    <Chat.Input.Textarea placeholder="Ask me for changes..." />
    <Chat.Input.SubmitButton />
    <Chat.Input.RefreshButton onRefresh={refreshSuggestions} />
  </Chat.Input>
</Chat>
```

### Implementation Approach: Option A (Extract Shared First)

Since this application is AI-managed, we can achieve more than historically believed:

1. **Phase 0**: Create shared `components/chat/` with compound components
2. **Phase 1**: Refactor Campaign chat to use shared components
3. **Phase 2**: Build Brainstorm using shared + specific components
4. **Benefit**: Single source of truth, consistent patterns, easier maintenance

## Development Practices

### TDD (Red/Green/Refactor)

All components built using test-driven development:

```
app/javascript/frontend/components/chat/__tests__/
├── MessageList.test.tsx
├── Input.test.tsx
├── AIMessage.test.tsx
├── UserMessage.test.tsx
├── TopicBadge.test.tsx
├── CommandButtons.test.tsx
└── ThinkingIndicator.test.tsx
```

**Test pattern** (following existing patterns in `hooks/__tests__/`):

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Chat } from "../index";

describe("Chat.TopicBadge", () => {
  it("displays correct topic number and label", () => {
    render(<Chat.TopicBadge topic="audience" current={2} />);
    expect(screen.getByText("Question 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Your Audience")).toBeInTheDocument();
  });
});
```

### Storybook

Every component gets a story for dev happiness and debuggability:

```
stories/chat/
├── MessageList.stories.tsx
├── Input.stories.tsx
├── AIMessage.stories.tsx
├── UserMessage.stories.tsx
├── TopicBadge.stories.tsx
├── CommandButtons.stories.tsx
├── ThinkingIndicator.stories.tsx
└── BrainstormChat.stories.tsx    # Full composition example
```

**Story pattern** (following existing `AIMessage.stories.tsx`):

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chat } from "@components/chat";

const meta = {
  title: "Chat/TopicBadge",
  component: Chat.TopicBadge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Chat.TopicBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idea: Story = {
  args: { topic: "idea", current: 1 },
};

export const Audience: Story = {
  args: { topic: "audience", current: 2 },
};

export const LastQuestion: Story = {
  args: { topic: "lookAndFeel", current: 5 },
};
```

## langgraph-ai-sdk Integration Patterns

### Delete Old Patterns

Remove these files that follow outdated patterns:

- `app/javascript/frontend/hooks/useBrainstormChat.ts` - Replace with new pattern
- Any `BrainstormBridge` definitions using old `createBridge` pattern

### New Pattern: Granular Subscriptions

Use **selectors** for performance - components only re-render when their specific data changes:

```typescript
// ❌ Old pattern - re-renders on ANY state change
const { messages, state, status } = useBrainstormChat();

// ✅ New pattern - granular subscriptions
const messages = useLanggraphMessages<BrainstormBridge>(options);
const currentTopic = useLanggraphState<BrainstormBridge, "currentTopic">(options, "currentTopic");
const { sendMessage, updateState } = useLanggraphActions<BrainstormBridge>(options);
```

### Convenience Hooks

Use the SDK's convenience hooks for common patterns:

```typescript
import {
  useLanggraphMessages,
  useLanggraphState,
  useLanggraphStatus,
  useLanggraphIsLoading,
  useLanggraphActions,
} from "langgraph-ai-sdk-react";

// In components - each subscribes only to what it needs
function TopicBadgeContainer() {
  const currentTopic = useLanggraphState<BrainstormBridge, "currentTopic">(options, "currentTopic");
  const brainstorm = useLanggraphState<BrainstormBridge, "brainstorm">(options, "brainstorm");
  // Only re-renders when currentTopic or brainstorm changes
}

function MessageListContainer() {
  const messages = useLanggraphMessages<BrainstormBridge>(options);
  // Only re-renders when messages change
}

function InputContainer() {
  const { sendMessage } = useLanggraphActions<BrainstormBridge>(options);
  const status = useLanggraphStatus<BrainstormBridge>(options);
  // Actions never cause re-renders, status is minimal
}
```

### Shared Options Pattern

Define options once, share across components:

```typescript
// hooks/useBrainstormOptions.ts
export function useBrainstormOptions(projectId?: string) {
  const jwt = useJwt();

  return useMemo(
    () => ({
      api: "/api/brainstorm/stream",
      headers: { Authorization: `Bearer ${jwt}` },
      getInitialThreadId: () => projectId,
    }),
    [jwt, projectId]
  );
}

// Usage in any component
function BrainstormChat({ projectId }) {
  const options = useBrainstormOptions(projectId);
  const messages = useLanggraphMessages<BrainstormBridge>(options);
  // All components using same options share underlying state
}
```

### Bridge Type Definition

```typescript
// types/brainstorm.ts
import { BridgeType, BaseMessage } from "langgraph-ai-sdk-types";

export interface BrainstormState {
  messages: BaseMessage[];
  currentTopic: string | null;
  brainstorm: Record<string, unknown>; // Finished topic data
  availableCommands: string[];
  redirect?: string;
}

export type BrainstormBridge = BridgeType<
  BrainstormState,
  typeof brainstormMessageSchema,
  "messages" // Streaming target
>;
```

## Implementation Tasks

### Phase 0: Shared Chat Components (TDD + Storybook)

Build the shared `components/chat/` compound component system first.

#### 0.1 Create Chat Context & Root

**Files:**

- `app/javascript/frontend/components/chat/index.tsx`
- `app/javascript/frontend/components/chat/Chat.tsx`
- `app/javascript/frontend/components/chat/__tests__/Chat.test.tsx`
- `stories/chat/Chat.stories.tsx`

#### 0.2 Build MessageList Components

**Files:**

- `app/javascript/frontend/components/chat/MessageList/index.tsx`
- `app/javascript/frontend/components/chat/MessageList/Message.tsx`
- `app/javascript/frontend/components/chat/MessageList/ScrollAnchor.tsx`
- `app/javascript/frontend/components/chat/__tests__/MessageList.test.tsx`
- `stories/chat/MessageList.stories.tsx`

#### 0.3 Build Input Components

**Files:**

- `app/javascript/frontend/components/chat/Input/index.tsx`
- `app/javascript/frontend/components/chat/Input/Textarea.tsx`
- `app/javascript/frontend/components/chat/Input/SubmitButton.tsx`
- `app/javascript/frontend/components/chat/Input/FileUpload.tsx`
- `app/javascript/frontend/components/chat/Input/RefreshButton.tsx`
- `app/javascript/frontend/components/chat/__tests__/Input.test.tsx`
- `stories/chat/Input.stories.tsx`

#### 0.4 Build AIMessage Components

**Files:**

- `app/javascript/frontend/components/chat/AIMessage/index.tsx`
- `app/javascript/frontend/components/chat/AIMessage/Content.tsx`
- `app/javascript/frontend/components/chat/AIMessage/Bubble.tsx`
- `app/javascript/frontend/components/chat/AIMessage/Loading.tsx`
- `app/javascript/frontend/components/chat/__tests__/AIMessage.test.tsx`
- `stories/chat/AIMessage.stories.tsx`

#### 0.5 Build UserMessage Component

**Files:**

- `app/javascript/frontend/components/chat/UserMessage.tsx`
- `app/javascript/frontend/components/chat/__tests__/UserMessage.test.tsx`
- `stories/chat/UserMessage.stories.tsx`

#### 0.6 Build Reusable Brainstorm Components

**Files:**

- `app/javascript/frontend/components/chat/TopicBadge.tsx`
- `app/javascript/frontend/components/chat/CommandButtons.tsx`
- `app/javascript/frontend/components/chat/ThinkingIndicator.tsx`
- `app/javascript/frontend/components/chat/__tests__/TopicBadge.test.tsx`
- `app/javascript/frontend/components/chat/__tests__/CommandButtons.test.tsx`
- `app/javascript/frontend/components/chat/__tests__/ThinkingIndicator.test.tsx`
- `stories/chat/TopicBadge.stories.tsx`
- `stories/chat/CommandButtons.stories.tsx`
- `stories/chat/ThinkingIndicator.stories.tsx`

#### 0.7 Refactor Campaign Chat to Use Shared Components

- Update `AdsChat.tsx` to use `Chat.*` compound components
- Update `AdsChatMessages.tsx` to use `Chat.MessageList`
- Update `AdsChatInput.tsx` to use `Chat.Input.*`
- Verify existing Campaign functionality works
- Delete old component files once migrated

### Phase 1: Brainstorm Foundation

#### 1.1 Create Landing Page Route & Controller

```ruby
# config/routes.rb
resources :projects do
  collection do
    get :new  # Landing page
  end
  member do
    get :brainstorm  # Conversation page
  end
end
```

```ruby
# app/controllers/projects_controller.rb
def new
  render inertia: 'Brainstorm/Landing'
end

def brainstorm
  @project = current_account.projects.find(params[:id])
  render inertia: 'Brainstorm/Conversation', props: {
    project: @project.as_json(include: :brainstorm_state),
    threadId: @project.thread_id
  }
end
```

#### 1.2 Create Landing Page Component

**File:** `app/javascript/frontend/pages/Brainstorm/Landing.tsx`

Key elements:

- Full-width layout with centered content
- "Tell us your next big idea" heading
- Textarea with placeholder "Enter your idea..."
- Submit button (coral #DF6D4A)
- On submit: POST to create project, start brainstorm stream, redirect to conversation

```tsx
// Landing.tsx structure
import { v4 as uuidv4 } from "uuid";

export default function BrainstormLanding() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const { sendMessage, status, messages } = useBrainstormChat(projectId);

  const handleSubmit = async (message: string) => {
    // Generate project UUID on first submit for immediate URL update
    const newProjectId = uuidv4();
    setProjectId(newProjectId);

    // Replace URL immediately - don't wait for response
    window.history.replaceState({}, "", `/projects/${newProjectId}/brainstorm`);

    // Send message with the new projectId as threadId
    await sendMessage(message);
  };

  // Once we have messages, we're in conversation mode
  const isConversationStarted = messages.length > 0;

  if (isConversationStarted) {
    // Render conversation UI inline (same component, different view)
    return <ConversationView projectId={projectId} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
      <div className="max-w-2xl w-full px-6">
        <h1 className="text-4xl font-bold text-[#2E3238] mb-8">Tell us your next big idea</h1>
        <MessageInput onSubmit={handleSubmit} isLoading={status === "streaming"} />
      </div>
    </div>
  );
}
```

**Note:** UUID is generated client-side on submit for immediate URL update. This becomes the `threadId` for Langgraph and `id` for the Rails project. The component conditionally renders either landing or conversation view based on whether messages exist.

#### 1.3 Extend useBrainstormChat Hook

**File:** `app/javascript/frontend/hooks/useBrainstormChat.ts` (already exists)

The hook already exists and syncs with brainstormStore. We need to **extend** it with:

- `sendCommand()` helper for brainstorm commands
- Derived state for `topicIndex`, `isComplete`, `finishedTopics`
- Expose `currentTopic` and `availableCommands` from state

```typescript
import { useLanggraph } from "@langgraph/ai-sdk-react";
import { BrainstormState } from "../types";

const TOPIC_ORDER = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;

export function useBrainstormChat(initialThreadId?: string) {
  const chat = useLanggraph<BrainstormState>({
    api: "/api/brainstorm/stream",
    threadId: initialThreadId,
  });

  const sendCommand = (command: "helpMe" | "skip" | "doTheRest" | "finished") => {
    chat.updateState({ command });
    chat.sendMessage(""); // Trigger with empty message
  };

  // Calculate topic index from state.brainstorm (finished topics have keys)
  const brainstormData = chat.state?.brainstorm || {};
  const finishedTopics = TOPIC_ORDER.filter((topic) => topic in brainstormData);
  const currentTopic = chat.state?.currentTopic;
  const topicIndex = currentTopic
    ? TOPIC_ORDER.indexOf(currentTopic) + 1
    : finishedTopics.length + 1;

  const isComplete = finishedTopics.length === 5;

  return {
    ...chat,
    sendCommand,
    currentTopic,
    topicIndex,
    isComplete,
    finishedTopics,
    availableCommands: chat.state?.availableCommands || [],
    brainstormData, // Contains finished topic answers
    redirect: chat.state?.redirect,
  };
}
```

### Phase 2: Conversation Page Components

#### 2.1 TopicBadge Component

**File:** `app/javascript/frontend/features/Brainstorm/components/TopicBadge.tsx`

```tsx
const TOPIC_LABELS = {
  idea: "Your Idea",
  audience: "Your Audience",
  solution: "Your Solution",
  socialProof: "Social Proof",
  lookAndFeel: "Look & Feel",
};

export function TopicBadge({ topic, total = 5, current }: TopicBadgeProps) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{
        backgroundColor: "rgba(215, 218, 241, 0.16)",
        borderColor: "#9BA3DB",
      }}
    >
      <span className="text-sm font-medium" style={{ color: "#9BA3DB" }}>
        Question {current} of {total}
      </span>
      <span className="text-sm" style={{ color: "#9BA3DB" }}>
        {TOPIC_LABELS[topic]}
      </span>
    </div>
  );
}
```

#### 2.2 MessageList Component

**File:** `app/javascript/frontend/features/Brainstorm/components/MessageList.tsx`

Renders AI and user messages differently:

- AI messages: Left-aligned, no bubble
- User messages: Right-aligned, gray bubble (#EDEDEC)
- Topic badge shown above message list (not per-message)

```tsx
export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-6 py-6">
      {messages.map((message, i) => (
        <div key={message.id || i} className={message.role === "user" ? "flex justify-end" : ""}>
          <div
            className={
              message.role === "user"
                ? "bg-[#EDEDEC] rounded-2xl px-4 py-3 max-w-[80%]"
                : "max-w-[80%]"
            }
          >
            <p className="text-[#2E3238] whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Note:** TopicBadge is rendered at the conversation header level, not per-message. The current topic is derived from `state.currentTopic` and index is calculated from finished topics in `state.brainstorm`.

#### 2.3 ThinkingIndicator Component

**File:** `app/javascript/frontend/features/Brainstorm/components/ThinkingIndicator.tsx`

```tsx
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="relative">
        <RocketIcon className="w-6 h-6 text-[#DF6D4A]" />
        <div className="absolute inset-0 animate-spin">
          <SpinnerIcon className="w-8 h-8 text-[#DF6D4A] opacity-50" />
        </div>
      </div>
      <span className="text-[#6B7280]">Thinking...</span>
    </div>
  );
}
```

#### 2.4 CommandButtons Component

**File:** `app/javascript/frontend/features/Brainstorm/components/CommandButtons.tsx`

Shows available commands based on state:

```tsx
const COMMAND_CONFIG = {
  helpMe: { label: "Help Me Answer", icon: HelpCircleIcon },
  skip: { label: "Skip Question", icon: SkipForwardIcon },
  doTheRest: { label: "Do the rest for me", icon: FastForwardIcon },
};

export function CommandButtons({ availableCommands, onCommand }: CommandButtonsProps) {
  if (!availableCommands.length) return null;

  return (
    <div className="flex gap-2 mt-4">
      {availableCommands.map((cmd) => {
        const config = COMMAND_CONFIG[cmd];
        return (
          <button
            key={cmd}
            onClick={() => onCommand(cmd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D1D5DB]
                       hover:bg-[#F3F4F6] transition-colors"
          >
            <config.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

#### 2.5 BuildMySiteCta Component

**File:** `app/javascript/frontend/features/Brainstorm/components/BuildMySiteCta.tsx`

Shown when all questions are complete:

```tsx
export function BuildMySiteCta({ onBuild }: { onBuild: () => void }) {
  return (
    <button
      onClick={onBuild}
      className="w-full py-3 px-6 rounded-lg text-white font-semibold text-lg
                 transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: "linear-gradient(-71.12deg, #D8644F 0%, #3748B8 95.53%)",
        border: "1px solid #3748B8",
      }}
    >
      Build My Site
    </button>
  );
}
```

#### 2.6 BrandPersonalizationPanel Component

**File:** `app/javascript/frontend/features/Brainstorm/components/BrandPersonalizationPanel.tsx`

Collapsible sidebar showing extracted brand info. Data comes from Rails APIs:

- **Logo**: `GET /api/projects/:id/uploads?is_logo=true` (existing)
- **Colors**: `GET /api/projects/:id/theme` (existing)
- **Images**: `GET /api/projects/:id/uploads` (existing)
- **Social Links**: `GET /api/projects/:id/social_links` (**NEW API**)

```tsx
export function BrandPersonalizationPanel({ projectId }: { projectId: string }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch brand data from Rails APIs
  const { data: uploads } = useSWR(`/api/projects/${projectId}/uploads`);
  const { data: theme } = useSWR(`/api/projects/${projectId}/theme`);
  const { data: socialLinks } = useSWR(`/api/projects/${projectId}/social_links`);

  const logo = uploads?.find((u: Upload) => u.is_logo);
  const images = uploads?.filter((u: Upload) => !u.is_logo) || [];
  const colors = theme?.colors || [];

  return (
    <aside className="w-80 bg-white border-l border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#2E3238]">Brand Personalization</h2>
        <button onClick={() => setIsExpanded(!isExpanded)}>
          <ChevronIcon className={isExpanded ? "rotate-180" : ""} />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {logo && (
            <Section title="Logo">
              <img src={logo.url} alt="Brand logo" className="max-w-full" />
            </Section>
          )}

          {colors.length > 0 && (
            <Section title="Brand Colors">
              <div className="flex gap-2">
                {colors.map((color: string) => (
                  <div
                    key={color}
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </Section>
          )}

          {images.length > 0 && (
            <Section title="Images">
              <div className="grid grid-cols-2 gap-2">
                {images.slice(0, 6).map((img: Upload) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    className="rounded object-cover aspect-square"
                  />
                ))}
              </div>
            </Section>
          )}

          {socialLinks?.length > 0 && (
            <Section title="Social Links">
              <div className="flex flex-col gap-1">
                {socialLinks.map((link: SocialLink) => (
                  <a
                    key={link.id}
                    href={link.url}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {link.platform}
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </aside>
  );
}
```

**Note:** Uses SWR for data fetching with automatic revalidation. Panel updates as user uploads assets during brainstorm.

### Phase 3: Conversation Page Integration

#### 3.1 Conversation Page Component

**File:** `app/javascript/frontend/pages/Brainstorm/Conversation.tsx`

```tsx
export default function BrainstormConversation({ project, threadId }: Props) {
  const {
    messages,
    status,
    sendMessage,
    sendCommand,
    currentTopic,
    topicIndex,
    isComplete,
    availableCommands,
    brainstormData,
    redirect,
  } = useBrainstormChat(threadId);

  // Handle redirect to website builder
  useEffect(() => {
    if (redirect === "website") {
      router.visit(`/projects/${project.id}/build`);
    }
  }, [redirect, project.id]);

  return (
    <div className="flex h-screen bg-[#FAFAF9]">
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Topic Badge Header */}
        {currentTopic && (
          <div className="px-6 pt-6">
            <TopicBadge topic={currentTopic} current={topicIndex} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6">
          <MessageList messages={messages} />

          {status === "streaming" && <ThinkingIndicator />}

          {!isComplete && availableCommands.length > 0 && (
            <CommandButtons availableCommands={availableCommands} onCommand={sendCommand} />
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-6">
          {isComplete ? (
            <BuildMySiteCta onBuild={() => sendCommand("finished")} />
          ) : (
            <MessageInput
              onSubmit={sendMessage}
              isLoading={status === "streaming"}
              placeholder="Type your answer..."
            />
          )}
        </div>
      </main>

      {/* Side Panel - pulls from Rails APIs */}
      <BrandPersonalizationPanel projectId={project.id} />
    </div>
  );
}
```

### Phase 4: Rails Backend Integration

#### 4.1 Create BrainstormBridge (if not exists)

**File:** `app/controllers/api/brainstorm_controller.rb`

```ruby
class Api::BrainstormController < ApplicationController
  def stream
    # Proxy to Langgraph with JWT auth
    langgraph_url = "#{ENV['LANGGRAPH_URL']}/api/brainstorm/stream"

    response.headers['Content-Type'] = 'text/event-stream'
    response.headers['Cache-Control'] = 'no-cache'

    # Stream response from Langgraph
    # ... SSE streaming implementation
  end
end
```

#### 4.2 Create Project on First Message

The landing page should create a project when the user sends their first message:

```ruby
# app/controllers/projects_controller.rb
def create
  @project = current_account.projects.create!(
    thread_id: params[:thread_id],
    name: "Brainstorm #{Time.current.strftime('%B %d, %Y')}",
    status: 'brainstorming'
  )

  render json: { project: @project }
end
```

### Phase 5: State Sync & Polish

#### 5.1 Update BrainstormStore

**File:** `app/javascript/frontend/stores/brainstormStore.ts`

```typescript
interface BrainstormState {
  // From Langgraph
  currentTopic: string | null;
  remainingTopics: string[];
  memories: BrainstormMemories;
  availableCommands: string[];

  // UI state
  isLoading: boolean;
  error: string | null;
}

export const useBrainstormStore = create<BrainstormState>()(
  immer((set) => ({
    currentTopic: null,
    remainingTopics: ["idea", "audience", "solution", "socialProof", "lookAndFeel"],
    memories: {},
    availableCommands: [],
    isLoading: false,
    error: null,

    updateFromGraph: (graphState: Partial<BrainstormState>) => {
      set((state) => {
        Object.assign(state, graphState);
      });
    },

    hydrateFromInertia: (props: InertiaProps) => {
      set((state) => {
        if (props.brainstormState) {
          Object.assign(state, props.brainstormState);
        }
      });
    },
  }))
);
```

#### 5.2 Silent URL Replacement

Implement URL transition without page reload:

```typescript
// In useBrainstormChat.ts
useEffect(() => {
  if (threadId && window.location.pathname === "/projects/new") {
    window.history.replaceState({ threadId }, "", `/projects/${threadId}/brainstorm`);
  }
}, [threadId]);
```

## Testing Strategy

### Unit Tests

- [ ] TopicBadge renders correct topic number and label
- [ ] CommandButtons only shows available commands
- [ ] MessageList differentiates AI vs user messages
- [ ] useBrainstormChat correctly wraps useLanggraph

### Integration Tests

- [ ] Landing page submits message and creates project
- [ ] URL updates silently after first message
- [ ] Commands trigger correct Langgraph state updates
- [ ] "Build My Site" triggers redirect

### E2E Tests

- [ ] Complete brainstorm flow through all 5 questions
- [ ] Skip question flow
- [ ] Help me answer flow
- [ ] Do the rest for me flow

## File Checklist

### Phase 0: Shared Chat Components

#### Components

- [ ] `app/javascript/frontend/components/chat/index.tsx`
- [ ] `app/javascript/frontend/components/chat/Chat.tsx`
- [ ] `app/javascript/frontend/components/chat/MessageList/index.tsx`
- [ ] `app/javascript/frontend/components/chat/MessageList/Message.tsx`
- [ ] `app/javascript/frontend/components/chat/MessageList/ScrollAnchor.tsx`
- [ ] `app/javascript/frontend/components/chat/Input/index.tsx`
- [ ] `app/javascript/frontend/components/chat/Input/Textarea.tsx`
- [ ] `app/javascript/frontend/components/chat/Input/SubmitButton.tsx`
- [ ] `app/javascript/frontend/components/chat/Input/FileUpload.tsx`
- [ ] `app/javascript/frontend/components/chat/Input/RefreshButton.tsx`
- [ ] `app/javascript/frontend/components/chat/AIMessage/index.tsx`
- [ ] `app/javascript/frontend/components/chat/AIMessage/Content.tsx`
- [ ] `app/javascript/frontend/components/chat/AIMessage/Bubble.tsx`
- [ ] `app/javascript/frontend/components/chat/AIMessage/Loading.tsx`
- [ ] `app/javascript/frontend/components/chat/UserMessage.tsx`
- [ ] `app/javascript/frontend/components/chat/TopicBadge.tsx`
- [ ] `app/javascript/frontend/components/chat/CommandButtons.tsx`
- [ ] `app/javascript/frontend/components/chat/ThinkingIndicator.tsx`

#### Tests (TDD)

- [ ] `app/javascript/frontend/components/chat/__tests__/Chat.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/MessageList.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/Input.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/AIMessage.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/UserMessage.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/TopicBadge.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/CommandButtons.test.tsx`
- [ ] `app/javascript/frontend/components/chat/__tests__/ThinkingIndicator.test.tsx`

#### Storybook

- [ ] `stories/chat/Chat.stories.tsx`
- [ ] `stories/chat/MessageList.stories.tsx`
- [ ] `stories/chat/Input.stories.tsx`
- [ ] `stories/chat/AIMessage.stories.tsx`
- [ ] `stories/chat/UserMessage.stories.tsx`
- [ ] `stories/chat/TopicBadge.stories.tsx`
- [ ] `stories/chat/CommandButtons.stories.tsx`
- [ ] `stories/chat/ThinkingIndicator.stories.tsx`

### Phase 1-3: Brainstorm Feature

#### Pages & Views

- [ ] `app/javascript/frontend/pages/Brainstorm/index.tsx` - Landing + Conversation
- [ ] `app/javascript/frontend/pages/Brainstorm/Show.tsx` - Direct navigation/refresh
- [ ] `app/javascript/frontend/features/Brainstorm/components/LandingView.tsx`
- [ ] `app/javascript/frontend/features/Brainstorm/components/ConversationView.tsx`
- [ ] `app/javascript/frontend/features/Brainstorm/components/BuildMySiteCta.tsx`
- [ ] `app/javascript/frontend/features/Brainstorm/components/BrandPersonalizationPanel.tsx`

#### Hooks & Types

- [ ] `app/javascript/frontend/hooks/useBrainstormOptions.ts` - Shared options pattern
- [ ] `app/javascript/frontend/features/Brainstorm/types.ts` - BrainstormBridge type

#### Storybook (Brainstorm-specific)

- [ ] `stories/brainstorm/LandingView.stories.tsx`
- [ ] `stories/brainstorm/ConversationView.stories.tsx`
- [ ] `stories/brainstorm/BuildMySiteCta.stories.tsx`
- [ ] `stories/brainstorm/BrandPersonalizationPanel.stories.tsx`
- [ ] `stories/brainstorm/BrainstormChat.stories.tsx` - Full composition

#### Rails Backend

- [ ] `app/controllers/api/brainstorm_controller.rb` (if not exists)

### New Backend Files (Rails)

- [ ] `app/models/social_link.rb` - SocialLink model (belongs_to :project)
- [ ] `db/migrate/xxx_create_social_links.rb` - Migration for social_links table
- [ ] `app/controllers/api/social_links_controller.rb` - CRUD for social links

**SocialLink schema:**

```ruby
# social_links table
t.references :project, null: false, foreign_key: true
t.string :platform, null: false  # e.g., "twitter", "instagram", "linkedin"
t.string :url, null: false
t.timestamps
```

### Files to Delete (Old Patterns)

- [ ] `app/javascript/frontend/hooks/useBrainstormChat.ts` - Replace with langgraph-ai-sdk convenience hooks
- [ ] Any old `BrainstormBridge` using `createBridge` pattern

### Files to Modify

- [ ] `config/routes.rb` - Add brainstorm routes + social_links nested resource
- [ ] `app/controllers/projects_controller.rb` - Add new/brainstorm actions
- [ ] `app/models/project.rb` - Add `has_many :social_links`
- [ ] `app/javascript/frontend/stores/brainstormStore.ts` - May be unnecessary with langgraph-ai-sdk state management

### Campaign Chat Migration (Phase 0.7)

- [ ] `app/javascript/frontend/components/ads/sidebar/AdsChat.tsx` - Use Chat.\* components
- [ ] `app/javascript/frontend/components/ads/sidebar/ads-chat/AdsChatMessages.tsx` - Replace with Chat.MessageList
- [ ] `app/javascript/frontend/components/ads/sidebar/ads-chat/AdsChatInput.tsx` - Replace with Chat.Input.\*
- [ ] `app/javascript/frontend/components/ads/sidebar/ads-chat/AIMessage.tsx` - Delete after migration
- [ ] `app/javascript/frontend/components/ads/sidebar/ads-chat/HumanMessage.tsx` - Delete after migration

## Dependencies

- Existing `useLanggraph` hook from `@langgraph/ai-sdk-react`
- Existing brainstorm.ts graph in langgraph_app
- Existing BrainstormStore pattern

## Risks & Mitigations

| Risk                                             | Mitigation                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| URL replacement breaks back button               | Using `replaceState` so back button goes to previous page, not /projects/new |
| State sync issues between landing → conversation | Single component with conditional rendering - hook instance persists         |
| Brand panel shows stale data                     | SWR with automatic revalidation from Rails APIs                              |
| Large images in panel                            | Limit to 6 images with `slice(0, 6)`, lazy loading via browser               |
| Client-generated UUID collision                  | Vanishingly rare with UUIDv4 (2^122 possibilities)                           |

## Success Criteria

1. User can start a brainstorm from `/projects/new`
2. URL silently updates to `/projects/{id}/brainstorm` after first message
3. All 5 topics flow naturally with topic badges
4. Command buttons appear contextually
5. Brand Personalization panel updates in real-time
6. "Build My Site" redirects to website builder
7. State persists across page refreshes (via Inertia hydration)
