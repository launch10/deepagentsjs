# Brainstorm Chat State Management - Implementation Plan

## Problem Statement

We need to maintain chat state correctly across two scenarios:
1. **Component switching during streaming** - When user sends message, UI switches from BrainstormLanding to BrainstormConversation while maintaining streaming state
2. **Fresh navigation to new chat** - When user navigates to `/projects/new`, they should get a fresh empty chat, not a stale one from registry

## Design Decisions (from user)

1. **When to clear `api::__new__`**: After user sends first message, rekey from `api::__new__` to `api::threadId`, then DELETE the old `api::__new__` entry
2. **How to detect fresh navigation**: Server sends `thread_id` via Inertia props. If defined, use that as key. If undefined, use `__new__`
3. **Where to implement**: In the SDK's `useLanggraph` hook, not in the Rails app
4. **No context approach**: Don't lift hooks to context - it defeats the smartsubscription optimization

## Failed Approaches (for reference)

### Approach 1: Check SDK messages for routing
- `useBrainstormIsNewConversation()` checked `messages.length === 0`
- **Failed because**: Old chat persists under `api::__new__`, shows conversation instead of landing

### Approach 2: Key prop to force remount
- `<BrainstormChat key={thread_id || "new"} />`
- **Failed because**: Key only changes with Inertia props, `replaceState` doesn't change props

### Approach 3: rekeyChat function
- Move chat from `api::__new__` to `api::uuid` when threadId assigned
- **Failed because**: After rekey, NEW component instances still compute `api::__new__` (props unchanged), find nothing, create empty chat

### Approach 4: Server props for routing
- Check `thread_id` from Inertia props
- **Failed because**: Props only change on full navigation, can't switch UI during streaming

### Approach 5: router.visit for navigation
- Full Inertia navigation when threadId available
- **Failed because**: 404 - project not in DB yet; also loses streaming state

### Approach 6: Context provider for hooks
- Lift hooks to stable parent level
- **Failed because**: Can't start fresh new chat; defeats smartsubscription purpose

## The Core Technical Problem

When `rekeyChat` moves chat from `api::__new__` to `api::uuid`:

1. Existing `useLanggraph` instances still have `chatRef` pointing to the chat object ✓
2. Registry now has chat under `api::uuid`, `api::__new__` is deleted ✓
3. **NEW** `useLanggraph` instances (from component switch) have null `chatRef`
4. They call `getInitialThreadId()` which returns `undefined` (props unchanged)
5. They compute key as `api::__new__`
6. Registry doesn't have `api::__new__` (deleted by rekey)
7. **They create a NEW empty chat** ✗

## Proposed Solution: Registry Redirect

Add a redirect/alias mechanism to the registry so `api::__new__` lookups find the rekeyed chat:

```typescript
// In chatRegistry.ts
const redirects = new Map<string, string>(); // oldKey -> newKey

export function rekeyChat(oldKey: string, newKey: string): void {
  if (oldKey === newKey) return;

  const entry = registry.get(oldKey);
  if (!entry) return;
  if (registry.has(newKey)) return;

  // Move to new key
  registry.set(newKey, entry);
  registry.delete(oldKey);

  // Store redirect so lookups for oldKey find newKey
  redirects.set(oldKey, newKey);
}

export function getOrCreateChat<TState>(options: ChatRegistryOptions<TState>): LanggraphChat<UIMessage, TState> {
  const key = getChatKey(options.api, options.threadId);

  // Check for redirect FIRST
  const redirectedKey = redirects.get(key);
  if (redirectedKey && registry.has(redirectedKey)) {
    return registry.get(redirectedKey)!.chat;
  }

  // Normal lookup
  if (registry.has(key)) {
    return registry.get(key)!.chat;
  }

  // Create new chat
  const isNewChat = options.threadId === undefined;
  const chat = new LanggraphChat<UIMessage, TState>({...});
  registry.set(key, { chat, refCount: 0 });
  return chat;
}

// Called when user navigates fresh to /projects/new
export function clearNewChatRedirect(api: string): void {
  const newKey = getChatKey(api, undefined); // api::__new__
  redirects.delete(newKey);
  // Also delete the registry entry if it exists
  registry.delete(newKey);
}
```

### Flow with redirect:

1. User on `/projects/new`, `thread_id` undefined
2. useLanggraph computes key `api::__new__`, creates chat
3. User sends message
4. `rekeyChat('api::__new__', 'api::uuid')` - moves chat AND stores redirect
5. Component switches, NEW useLanggraph instances look for `api::__new__`
6. **Redirect found!** Returns chat from `api::uuid`
7. Streaming continues with correct chat

### Clearing redirect on fresh navigation:

In Brainstorm.tsx page component:
```tsx
export default function Brainstorm() {
  const { thread_id, langgraph_path } = usePage().props;

  useEffect(() => {
    if (!thread_id) {
      // Fresh navigation to new - clear any stale redirects
      clearNewChatRedirect(langgraph_path);
    }
  }, []); // Only on mount

  return <BrainstormChat key={thread_id || "new"} />;
}
```

## Implementation Steps

1. [ ] Add `redirects` Map to chatRegistry.ts
2. [ ] Update `rekeyChat` to store redirect
3. [ ] Update `getOrCreateChat` to check redirects first
4. [ ] Add `clearNewChatRedirect` export
5. [ ] Add rekey effect to useLanggraph when `exposedThreadId` changes
6. [ ] Call `clearNewChatRedirect` on Brainstorm page mount when `thread_id` is undefined
7. [ ] Revert BrainstormChat and hooks to NOT use context
8. [ ] Test: Send message, verify streaming works during component switch
9. [ ] Test: Navigate to `/projects/new`, verify fresh chat

## Open Questions

1. Should `clearNewChatRedirect` also stop any in-progress streaming on the old chat?
2. Should redirects have a TTL to prevent memory leaks?
3. What happens if user has multiple tabs with different chats?
