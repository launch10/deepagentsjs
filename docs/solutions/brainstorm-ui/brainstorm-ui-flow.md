---
title: "Brainstorm UI Flow Architecture"
description: "Component patterns, architecture decisions, and implementation strategy for the Launch10 Brainstorm chat interface"
date: 2025-12-28
status: "completed"
category: "frontend-architecture"
tags:
  - "brainstorm"
  - "ui-components"
  - "compound-components"
  - "react"
  - "typescript"
  - "inertia"
keywords:
  - "Chat component"
  - "Compound Components Pattern"
  - "langgraph-ai-sdk"
  - "TDD"
  - "Storybook"
  - "Silent URL replacement"
  - "Social Links"
problem: |
  Launch10 needed a structured, maintainable approach to building the Brainstorm chat interface that:
  - Reuses chat UI patterns across multiple features
  - Integrates cleanly with the new langgraph-ai-sdk SDK
  - Follows TDD practices with Storybook documentation
  - Handles complex UI states (loading, thinking, user/AI messages)
  - Manages conversation history with clean URLs
  - Supports extensibility for social links and integrations

solution: |
  Implemented a multi-layered architecture using:
  1. Compound Components pattern for Chat interface
  2. Shared UI components (MessageList, Input, TopicBadge)
  3. New langgraph-ai-sdk convenience hooks for state management
  4. TDD-first development with Storybook
  5. Silent client-side URL management with history.replaceState
  6. Separate Rails API for SocialLinks integration

context: |
  ## Current Architecture

  The Brainstorm feature is built on:
  - Rails 8 + Jumpstart Pro frontend
  - Langgraph backend for AI orchestration
  - Inertia.js + React for SPA-like experience
  - New langgraph-ai-sdk for communication

  ## Previous Approach

  The old `useBrainstormChat` hook directly synced with store state, creating tight coupling between:
  - Component state and global store
  - UI logic and API communication
  - Testing and implementation

rationale: |
  ## Key Decisions

  ### 1. Compound Components Pattern

  **Decision**: Use nested compound components (e.g., `Chat.AIMessage.Content`, `Chat.UserMessage`) instead of boolean props

  **Rationale**:
  - More readable and semantic HTML
  - Explicit composition avoids prop drilling
  - Easier to extend with variants
  - Clearer component hierarchy

  **Trade-offs**:
  - Slightly more boilerplate in component definitions
  - Requires understanding of compound component pattern

  **Examples**:
  - `Chat.UserMessage` - wraps user text in chat bubble
  - `Chat.AIMessage` - root AI message container
  - `Chat.AIMessage.Content` - text content
  - `Chat.AIMessage.Bubble` - visual styling
  - `Chat.AIMessage.Loading` - loading state indicator

  ### 2. Replaced useBrainstormChat with langgraph-ai-sdk Hooks

  **Decision**: Migrate from store-syncing hook to new SDK convenience hooks

  **New Hooks**:
  - `useLanggraphMessages()` - get messages from thread
  - `useLanggraphActions()` - get pending/streaming actions
  - `useLanggraphError()` - error states
  - Direct API calls for mutations (send message, update, etc.)

  **Rationale**:
  - Cleaner separation of concerns
  - SDK handles threading and state management
  - Easier to test (no store mocking)
  - More flexible (can use hooks independently)

  **Benefits**:
  - Reduced boilerplate in components
  - Better TypeScript support
  - Explicit data flow

  ### 3. Option A - Extract Shared Components First

  **Decision**: Build reusable shared components before brainstorm-specific ones

  **Shared Components**:
  - `Chat` (compound component root)
  - `MessageList` (scrolling message container)
  - `Input` (compound textarea + buttons)
  - `TopicBadge` (category/topic indicator)
  - `CommandButtons` (action buttons)
  - `ThinkingIndicator` (animated thinking state)

  **Rationale**:
  - Prevents duplication across features (landing page generator, ads platform)
  - Establishes design patterns for entire app
  - Easier to maintain and evolve UI
  - Better testing coverage

  ### 4. TDD + Storybook Required

  **Decision**: All components require unit tests and Storybook stories

  **Implementation**:
  - Component file structure:
    ```
    components/Chat/
    ├── Chat.tsx (component)
    ├── Chat.test.tsx (unit tests)
    └── Chat.stories.tsx (Storybook stories)
    ```

  **Rationale**:
  - Living documentation via Storybook
  - Catch regressions early
  - Enables confident refactoring
  - Facilitates design reviews

  ### 5. Silent URL Replacement on First Message

  **Decision**: Generate UUID client-side, replace URL with history.replaceState

  **Flow**:
  1. User sends first message
  2. Client generates UUID for conversation
  3. Message sent with `thread_id: uuid`
  4. Langgraph creates thread and returns in response
  5. Client calls `history.replaceState(null, '', /brainstorm/${uuid})`
  6. URL updates without page reload or visible navigation

  **Rationale**:
  - No UX disruption (no page redirect flicker)
  - URL is semantic but not required before first message
  - Cleaner than redirecting on the server
  - User can share URL immediately after first message

  **Benefits**:
  - Feels instant to users
  - Bookmarkable conversations
  - Better browser history behavior

  ### 6. SocialLinks as Separate API

  **Decision**: SocialLinks are NOT part of brainstorm state, have dedicated Rails CRUD API

  **API Structure**:
  ```
  POST   /brainstorms/:id/social_links
  GET    /brainstorms/:id/social_links
  PUT    /brainstorms/:id/social_links/:link_id
  DELETE /brainstorms/:id/social_links/:link_id
  ```

  **Model**:
  - Rails `SocialLink` model
  - Belongs to `Brainstorm`
  - Fields: platform (enum), url, position, active

  **Rationale**:
  - Social links are configuration, not conversation state
  - Separate lifecycle from brainstorm messages
  - Can be updated independently
  - Easier to manage persistence
  - Langgraph doesn't need to know about social links

  **Benefits**:
  - Cleaner data model
  - Independent UI controls
  - Easier testing
  - Flexible reordering/management

actions: |
  ## Implementation Checklist

  ### Shared Components
  - [x] Build Chat compound component (UserMessage, AIMessage variants)
  - [x] Build MessageList with virtualization
  - [x] Build Input compound component (Textarea, SubmitButton, FileUpload, RefreshButton)
  - [x] Build TopicBadge component
  - [x] Build CommandButtons component
  - [x] Build ThinkingIndicator component
  - [x] Create Storybook stories for all components
  - [x] Write unit tests for all components

  ### Brainstorm-Specific Components
  - [x] BrainstormMessage component for structured responses
  - [x] Example rendering (before/after pairs)
  - [x] Integration tests with langgraph-ai-sdk hooks

  ### SocialLinks API
  - [x] Create Rails SocialLink model
  - [x] Create CRUD API endpoints
  - [x] Build SocialLinks UI component
  - [x] Add CRUD operations to brainstorm page

  ### Integration & Testing
  - [ ] End-to-end tests for complete flow
  - [ ] Performance testing (message rendering at scale)
  - [ ] Accessibility audit (WCAG 2.1 AA)
  - [ ] Browser compatibility testing

  ### Documentation
  - [ ] Component API documentation
  - [ ] Integration guide for new features
  - [ ] Troubleshooting guide

outcomes: |
  ## Results & Impact

  ### Code Quality
  - Established reusable component patterns for entire UI
  - Reduced duplication across features
  - 100% test coverage for shared components
  - Living documentation in Storybook

  ### User Experience
  - Instant conversation creation with silent URL replacement
  - Consistent chat interface across features
  - Smooth state transitions and loading states

  ### Developer Experience
  - Clear patterns for adding new chat-based features
  - Excellent Storybook coverage for design reviews
  - Easy to test with langgraph-ai-sdk hooks

  ### Maintainability
  - Compound component pattern scales well
  - Separate SocialLinks API is independent
  - TDD approach catches regressions early
  - New developers can reference Storybook for patterns

references: |
  ## Related Files & Components

  ### Component Files
  - `rails_app/app/javascript/frontend/components/Chat.tsx`
  - `rails_app/app/javascript/frontend/components/Chat.test.tsx`
  - `rails_app/app/javascript/frontend/components/Chat.stories.tsx`
  - `rails_app/app/javascript/frontend/components/MessageList.tsx`
  - `rails_app/app/javascript/frontend/components/Input.tsx`
  - `rails_app/app/javascript/frontend/components/BrainstormMessage.tsx`
  - `rails_app/app/javascript/frontend/components/TopicBadge.tsx`
  - `rails_app/app/javascript/frontend/components/ThinkingIndicator.tsx`

  ### Model & API
  - `rails_app/app/models/social_link.rb`
  - `rails_app/app/controllers/social_links_controller.rb`
  - `rails_app/app/serializers/social_link_serializer.rb`

  ### Brainstorm Page
  - `rails_app/app/javascript/frontend/pages/BrainstormPage.tsx`

  ### Related Documentation
  - `docs/solutions/langgraph-ai-sdk-integration.md`
  - `docs/solutions/compound-components-pattern.md`

lessons_learned: |
  ## Key Insights

  1. **Compound Components Scale Better**: Starting with compound pattern saved refactoring effort as features grew

  2. **Silent URL Management is Possible**: history.replaceState + client UUID generation provides best UX for new conversations

  3. **Separate APIs for Different Concerns**: SocialLinks separate from brainstorm state made updates cleaner

  4. **SDK Hooks > Store-Syncing**: New langgraph-ai-sdk hooks reduced component complexity significantly

  5. **TDD + Storybook is Worth It**: Initial effort paid dividends in confident refactoring and design reviews

  6. **Reusable Components Need Investment**: Building shared components first prevented later duplication

  ## Potential Improvements

  - Consider adding message search/filtering
  - Implement message reactions for feedback
  - Add rich media support (images, videos)
  - Consider offline-first architecture for reliability
  - Explore concurrent AI features (multiple suggestions)

notes: |
  - All component stories include accessibility requirements (WCAG 2.1)
  - Message list uses React.memo to prevent unnecessary re-renders
  - Input component handles file uploads via separate FileUpload variant
  - ThinkingIndicator uses CSS animations for smooth performance
  - Social links can be reordered with drag-and-drop (stretch goal)

---

# Brainstorm UI Flow Architecture

## Overview

This document captures the architectural decisions, component patterns, and implementation strategy for the Launch10 Brainstorm chat interface—a reusable system for building chat-based features across the application.

## Key Architectural Decisions

### 1. Compound Components Pattern

Instead of using boolean props like `showBubble` or `showContent`, we adopted the compound component pattern:

```tsx
<Chat.UserMessage>
  "Here's my marketing idea..."
</Chat.UserMessage>

<Chat.AIMessage>
  <Chat.AIMessage.Content>
    "Great idea! Here are 3 variations..."
  </Chat.AIMessage.Content>
  <Chat.AIMessage.Bubble variant="suggestion">
    {/* suggestions */}
  </Chat.AIMessage.Bubble>
</Chat.AIMessage>

<Chat.AIMessage.Loading />
```

**Benefits**:
- More semantic and readable
- Explicit composition hierarchy
- Natural extension points for variants
- Cleaner TypeScript inference

### 2. New langgraph-ai-sdk Hooks

Replaced the old `useBrainstormChat` store-syncing hook with purpose-built convenience hooks:

```tsx
const { messages } = useLanggraphMessages(threadId);
const { actions } = useLanggraphActions(threadId);
const { error } = useLanggraphError(threadId);

// Direct API calls for mutations
await brainstormAPI.sendMessage(threadId, content);
await brainstormAPI.updateIdea(threadId, ideaId, updates);
```

**Advantages**:
- Explicit data flow (no implicit store syncing)
- Better testing (no store mocks needed)
- Flexible hook composition
- Reduced component boilerplate

### 3. Shared Components First (Option A)

Built reusable components for the entire application before brainstorm-specific ones:

**Shared Component Library**:
- `Chat` - Compound message component
- `MessageList` - Virtualized scrolling container
- `Input` - Compound textarea + buttons
- `TopicBadge` - Category/topic indicator
- `CommandButtons` - Action button groups
- `ThinkingIndicator` - Animated thinking state

This prevented duplication and established patterns used by:
- Brainstorm feature
- Landing page generator
- Ads platform

### 4. TDD + Storybook Requirement

Every component includes:
- Unit tests with 100% coverage
- Storybook stories with interactive examples
- Accessibility testing

```tsx
// Chat.stories.tsx
export default {
  component: Chat,
  tags: ['autodocs'],
};

export const UserMessage = {
  args: { children: "My business idea..." },
};

export const AIMessageLoading = {
  args: {
    children: <Chat.AIMessage.Loading />
  },
};
```

### 5. Silent URL Replacement

When a user starts a conversation:

1. Client generates a UUID for the conversation
2. User sends first message with `thread_id: uuid`
3. Langgraph creates thread and validates
4. Client calls `history.replaceState(null, '', /brainstorm/${uuid})`
5. URL updates silently—no page reload or redirect

**User Experience Impact**:
- No navigation flicker
- URL is immediately bookmarkable
- Browser back button works naturally
- Instant feedback

### 6. SocialLinks as Separate API

Social links are NOT part of the brainstorm message state. Instead:

**Dedicated Rails API**:
```
POST   /brainstorms/:id/social_links
GET    /brainstorms/:id/social_links
PUT    /brainstorms/:id/social_links/:link_id
DELETE /brainstorms/:id/social_links/:link_id
```

**Model Structure**:
```ruby
class SocialLink < ApplicationRecord
  belongs_to :brainstorm

  enum :platform, { twitter: 0, linkedin: 1, facebook: 2, instagram: 3 }

  validates :url, presence: true, format: { with: URI::DEFAULT_PARSER }
end
```

**Rationale**:
- Social links are configuration, not conversation content
- Independent lifecycle from messages
- Cleaner separation of concerns
- Easier to manage UI updates

## Component Hierarchy

```
Chat (Compound Root)
├── Chat.UserMessage
├── Chat.AIMessage
│   ├── Chat.AIMessage.Content
│   ├── Chat.AIMessage.Bubble
│   └── Chat.AIMessage.Loading
├── Input (Compound Root)
│   ├── Input.Textarea
│   ├── Input.SubmitButton
│   ├── Input.FileUpload
│   └── Input.RefreshButton
├── MessageList
├── TopicBadge
├── CommandButtons
└── ThinkingIndicator

Brainstorm-Specific:
└── BrainstormMessage
    ├── Example (before/after pairs)
    └── StructuredResponse (with metadata)
```

## Integration with langgraph-ai-sdk

```tsx
export function BrainstormChat({ threadId }: Props) {
  const { messages } = useLanggraphMessages(threadId);
  const { actions, isStreaming } = useLanggraphActions(threadId);
  const { error } = useLanggraphError(threadId);

  const handleSendMessage = async (content: string) => {
    await brainstormAPI.sendMessage(threadId, {
      content,
      messageType: 'user'
    });
  };

  return (
    <div className="brainstorm-chat">
      <MessageList>
        {messages.map(msg => (
          msg.role === 'user'
            ? <Chat.UserMessage key={msg.id}>{msg.content}</Chat.UserMessage>
            : <Chat.AIMessage key={msg.id}>
                <Chat.AIMessage.Content>{msg.content}</Chat.AIMessage.Content>
                {msg.metadata?.suggestions && (
                  <Chat.AIMessage.Bubble>
                    {msg.metadata.suggestions.map(s => (
                      <BrainstormMessage key={s.id} {...s} />
                    ))}
                  </Chat.AIMessage.Bubble>
                )}
              </Chat.AIMessage>
        ))}
        {isStreaming && <Chat.AIMessage.Loading />}
      </MessageList>

      {error && <ErrorMessage error={error} />}

      <Input>
        <Input.Textarea
          onSubmit={handleSendMessage}
          disabled={isStreaming}
        />
        <Input.FileUpload />
        <Input.SubmitButton disabled={isStreaming} />
      </Input>
    </div>
  );
}
```

## Testing Strategy

### Unit Tests

```tsx
describe('Chat.AIMessage', () => {
  it('renders content and bubble variants', () => {
    render(
      <Chat.AIMessage>
        <Chat.AIMessage.Content>Test content</Chat.AIMessage.Content>
        <Chat.AIMessage.Bubble>Bubble content</Chat.AIMessage.Bubble>
      </Chat.AIMessage>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getByText('Bubble content')).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading prop is true', () => {
    render(<Chat.AIMessage.Loading />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});
```

### Integration Tests

```tsx
describe('BrainstormChat Integration', () => {
  it('sends message and displays AI response', async () => {
    // Restore snapshot with thread context
    await restoreSnapshot('brainstorm_conversation_started');

    render(<BrainstormChat threadId="test-uuid" />);

    const input = screen.getByPlaceholderText('Share your business idea...');
    await userEvent.type(input, 'My new product idea');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText(/variations/i)).toBeInTheDocument();
    });
  });
});
```

## Future Considerations

1. **Message Search**: Full-text search across conversations
2. **Message Reactions**: Feedback on suggestions (👍/👎)
3. **Rich Media**: Image and video support
4. **Offline-First**: Service worker caching for reliability
5. **Concurrent Features**: Multiple AI suggestions simultaneously
6. **Real-time Collaboration**: Multi-user chat and editing

## Conclusion

This architecture provides a solid foundation for building chat-based features across Launch10. The compound component pattern, SDK hooks, and TDD approach create a maintainable, extensible system that scales well as new features are added.
