# Launch10 Frontend Style Guide

A guide to generating "us-style" frontend code based on patterns extracted from Brainstorm.tsx and Campaign.tsx.

---

## Core Philosophy

1. **Minimal page components** - Pages compose hooks and route to child components; they don't do heavy lifting
2. **Hooks as single source of truth** - All state comes from custom hooks, not props
3. **Composition over configuration** - Compound components, flexible nesting
4. **URL as truth** - Browser URL reflects app state, enables back/forward navigation
5. **Type safety everywhere** - Inertia types, Langgraph types, generic selectors

---

## 1. Page Component Structure

### Chat-Based Features (Brainstorm Pattern) - 20 lines max

```typescript
export default function FeatureName() {
  const chat = useFeatureNameChat();
  const isNewConversation = useFeatureNameIsNewConversation();
  const { sendMessage } = useFeatureNameSendMessage();

  return (
    <Chat.Root chat={chat} onSubmit={sendMessage}>
      {isNewConversation ? <LandingPage /> : <ConversationPage />}
    </Chat.Root>
  );
}
```

### Form-Based Features (Campaign Pattern) - 40-50 lines max

```typescript
export default function FeatureName() {
  const isLoadingHistory = useFeatureChatIsLoadingHistory();
  const substep = useWorkflow(selectSubstep);

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8">
      <div><SidebarPanel /></div>
      <div className="max-w-[948px]">
        <Preview className="mb-8" />
        {!shouldHideNav && <TabSwitcher disabled={isLoadingHistory} />}
        {isLoadingHistory ? <LoadingState /> : <ContentState />}
      </div>
    </main>
  );
}
```

---

## 2. Custom Hook Architecture

### Factory Hook Pattern (ALWAYS use this)

```typescript
// 1. Options factory - memoized, computes derived values
function useFeatureChatOptions() {
  const { thread_id, jwt, langgraph_path, root_path } = usePage<FeaturePageProps>().props;

  return useMemo(() => ({
    api: `${langgraph_path}/api/feature/stream`,
    headers: { Authorization: `Bearer ${jwt}` },
    getInitialThreadId: () => thread_id,
    attachments: { upload, validate }
  }), [thread_id, jwt, langgraph_path, root_path]);
}

// 2. Main hook with generic selector pattern
export function useFeatureChat<TSelected = FeatureSnapshot>(
  selector?: (snapshot: FeatureSnapshot) => TSelected
): TSelected {
  const options = useFeatureChatOptions();
  const snapshot = useLanggraph<FeatureBridgeType>(options);
  return (selector ? selector(snapshot) : snapshot) as TSelected;
}

// 3. Convenience selector hooks (granular subscriptions)
export const useFeatureChatMessages = () => useFeatureChat(s => s.messages);
export const useFeatureChatStatus = () => useFeatureChat(s => s.status);
export const useFeatureChatComposer = () => useFeatureChat(s => s.composer);
export const useFeatureChatIsLoading = () => useFeatureChat(s => s.isLoading);

// 4. Complex derived state hooks
export function useFeatureIsNewConversation() {
  const { thread_id } = usePage<FeaturePageProps>().props;
  if (thread_id) return false;
  return useFeatureChat(s => s.messages.length === 0);
}
```

### Hook File Organization

```
components/feature/hooks/
├── index.ts                    # Re-exports all hooks
├── useFeatureChat.ts           # Main hook + selectors
├── useFeatureSendMessage.ts    # Thin wrapper for actions
├── useFeatureSpecific.ts       # Feature-specific logic
└── useFeatureAutosave.ts       # If forms need autosave
```

---

## 3. Loading & Error States

### Delayed Skeleton Pattern (for potentially fast loads)

```typescript
const SKELETON_DELAY_MS = 200;

export function ConversationPage() {
  const { isLoadingHistory } = useFeatureChat();
  const isEmpty = messages.length === 0;
  const isLoading = isLoadingHistory || isEmpty;

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    let rafId: number;

    if (isLoading) {
      skeletonTimerRef.current = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
      setContentVisible(false);
    } else {
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
      setShowSkeleton(false);
      rafId = requestAnimationFrame(() => setContentVisible(true));
    }

    return () => {
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isLoading]);

  if (isLoading && showSkeleton) return <FeatureSkeleton />;
  if (isLoading) return <div className="h-full" />;  // Empty placeholder
  return <Content contentVisible={contentVisible} />;
}
```

### Simple Spinner Pattern (for user-triggered actions)

```typescript
{isLoadingHistory ? (
  <div className="flex items-center justify-center p-9">
    <LogoSpinner />
  </div>
) : (
  <Content />
)}
```

**Decision Guide:**
- Use **delayed skeleton** when: Loading may be fast (<200ms), want to avoid flash
- Use **simple spinner** when: User explicitly triggered action, loading is expected

---

## 4. TypeScript Patterns

### Inertia Type Extraction

```typescript
type NewFeatureProps =
  InertiaProps.paths["/features/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateFeatureProps =
  InertiaProps.paths["/features/{uuid}"]["get"]["responses"]["200"]["content"]["application/json"];
type FeaturePageProps = NewFeatureProps | UpdateFeatureProps;

const { thread_id, jwt } = usePage<FeaturePageProps>().props;
```

### Generic Selector Pattern

```typescript
// Allows type-safe subscriptions to specific state slices
export function useFeatureChat<TSelected = FeatureSnapshot>(
  selector?: (snapshot: FeatureSnapshot) => TSelected
): TSelected

// Usage - TypeScript infers return type
const snapshot = useFeatureChat();                    // Type: FeatureSnapshot
const messages = useFeatureChat(s => s.messages);     // Type: Message[]
const status = useFeatureChat(s => s.status);         // Type: Status
```

---

## 5. Layout Patterns

### Two-Column with Sidebar

```typescript
<main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8">
  <div>{/* Sidebar - 288px fixed */}</div>
  <div className="max-w-[948px]">{/* Main content */}</div>
</main>
```

### Responsive Two-Column

```typescript
<div className="grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-8">
  <div className="hidden lg:block">{/* Sidebar - hidden on mobile */}</div>
  <div>{/* Main content - full width on mobile */}</div>
</div>
```

### Scrollable Chat Layout

```typescript
<div className="h-full flex flex-col">
  <div className="flex-1 min-h-0 overflow-hidden">
    <div className="flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        <Messages />
      </div>
      <div className="shrink-0 bg-neutral-background">
        <Input />
      </div>
    </div>
  </div>
</div>
```

**Key:** `min-h-0` on flex children allows proper overflow behavior.

---

## 6. Chat Component System

### Compound Component Usage

```typescript
<Chat.Root chat={chat} onSubmit={sendMessage}>
  <Chat.Messages.List>
    {messages.map(msg =>
      msg.role === 'user'
        ? <Chat.UserMessage key={msg.id} blocks={msg.blocks} />
        : <Chat.AIMessage.Root key={msg.id}>
            <Chat.BlockRenderer blocks={msg.blocks} />
          </Chat.AIMessage.Root>
    )}
    <Chat.Messages.StreamingIndicator />
    <Chat.Messages.ScrollAnchor />
  </Chat.Messages.List>

  <Chat.Input.DropZone>
    <Chat.Input.AttachmentList />
    <Chat.Input.Textarea placeholder="Message..." />
    <Chat.Input.FileButton><DocumentPlusIcon /></Chat.Input.FileButton>
    <Chat.Input.SubmitButton><ArrowUpIcon /></Chat.Input.SubmitButton>
  </Chat.Input.DropZone>
</Chat.Root>
```

### Context Access in Children

```typescript
// Inside any child of Chat.Root
const { messages, composer, sendMessage, isStreaming } = useChatContext();
```

---

## 7. URL & Navigation

### Client-Side URL Updates (without Inertia roundtrip)

```typescript
// Use native pushState to avoid interrupting streams
const onThreadIdAvailable = useCallback((threadId: string) => {
  window.history.pushState({ threadId }, "", `/features/${threadId}`);
}, []);
```

### Form Navigation with Validation

```typescript
const setActiveTab = async (tabName: SubstepName) => {
  const isMovingForward = findIndex(tabName) > findIndex(activeTab);

  if (isMovingForward) {
    const isValid = await validateForm(currentStep);
    if (!isValid) return;  // Block forward navigation if invalid
  }

  setSubstep(tabName);
};
```

---

## 8. Styling Conventions

### Tailwind Classes

```typescript
// Use twMerge for conditional classes
className={twMerge(
  "base-classes here",
  condition && "conditional-classes"
)}

// Design tokens
"accent-yellow-700"  // Primary accent
"neutral-300"        // Borders
"neutral-background" // Background
```

### Responsive Prefixes

```typescript
"hidden lg:block"           // Hidden on mobile, visible on desktop
"grid-cols-1 lg:grid-cols-[288px_1fr]"  // Single column mobile, two-column desktop
```

---

## 9. Decision Matrix

| Scenario | Pattern |
|----------|---------|
| New chat feature | Brainstorm pattern (thin page, Chat.Root) |
| Multi-step form | Campaign pattern (substep routing, validation gates) |
| Fast load possible | Delayed skeleton (200ms delay) |
| User-triggered load | Simple spinner |
| State access | Custom hooks with selectors (never props for state) |
| URL updates during stream | `history.pushState` (not Inertia router) |
| Forward form navigation | Validate before allowing |
| Backward form navigation | Allow without validation |

---

## 10. Anti-Patterns to Avoid

1. **Don't prop-drill state** - Use hooks and context
2. **Don't use Inertia router during streams** - Use `history.pushState`
3. **Don't put business logic in pages** - Pages compose hooks and route only
4. **Don't subscribe to full state** - Use selectors for granular subscriptions
5. **Don't show skeleton immediately** - Delay 200ms to avoid flash
6. **Don't validate backward navigation** - Only validate forward movement
7. **Don't create new type definitions** - Extract from Inertia/Langgraph types

---

## Quick Reference: New Feature Checklist

- [ ] Create `useFeatureChat.ts` with factory pattern
- [ ] Add convenience selector hooks
- [ ] Create thin page component (20-50 lines)
- [ ] Use Chat.Root or form pattern based on feature type
- [ ] Implement delayed skeleton or simple spinner for loading
- [ ] Extract types from Inertia definitions
- [ ] Use context for state access in children
- [ ] Handle URL updates with `history.pushState`
- [ ] Add validation gates for form navigation (if applicable)
