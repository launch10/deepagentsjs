# Why WebContainers for In-Browser Code Execution

## The Problem

Users need to see their landing page as they're building it. The AI generates React/Vite code that needs to be compiled and rendered in real-time.

## The Decision

Use WebContainers API for in-browser Node.js execution. The generated website runs entirely in the user's browser.

## Why WebContainers

### Real-time Preview

Users need instant feedback as the AI generates and modifies code. WebContainers enable:
- Live preview updates as files change
- No deploy step between edit and view
- True WYSIWYG editing experience

### Prior Art: Bolt.new

StackBlitz's Bolt.new demonstrated this pattern works for AI-powered code generation:
- User describes what they want
- AI generates code
- Code runs immediately in browser
- User sees result and iterates

Launch10 follows this proven pattern for landing page generation.

### Cost and Scaling

Alternative approaches have significant cost implications:

| Approach | Cost Model |
|----------|------------|
| **WebContainers** | Zero server cost - runs in browser |
| Server-side Node per user | $$$ - one process per active user |
| Pre-rendered static | Can't show live edits |
| Docker containers | Expensive to spin up/down per session |

With WebContainers, 1000 concurrent users = 0 additional server cost.

### Security Isolation

Browser sandbox provides security:
- User code can't access server filesystem
- Network requests are constrained
- Each user's code isolated from others
- No risk of privilege escalation

## How It Works

```
┌─────────────────────────────────────────────────┐
│                  User's Browser                  │
│                                                  │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  React App   │────►│   WebContainer       │  │
│  │  (UI)        │     │   ┌──────────────┐   │  │
│  │              │     │   │  Node.js     │   │  │
│  │              │     │   │  Vite        │   │  │
│  │              │     │   │  Website     │   │  │
│  │              │◄────│   │  (port 5173) │   │  │
│  └──────────────┘     │   └──────────────┘   │  │
│                       └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

1. AI generates website files (React + Vite)
2. Files written to WebContainer filesystem
3. WebContainer runs `pnpm install && pnpm dev`
4. Vite dev server starts on virtual port
5. Preview iframe shows the running website
6. File changes trigger HMR updates

## File Storage

Website files use a write-through pattern:
- Stored as JSON in PostgreSQL (source of truth)
- Written to WebContainer filesystem for execution
- This enables both persistence and live preview

## Consequences

**Benefits:**
- Instant preview with zero server cost
- Proven pattern from Bolt.new
- Secure browser sandbox
- No infrastructure to manage per user

**Trade-offs:**
- Requires modern browser with WebContainer support
- First load is slower (downloads Node.js runtime)
- Memory usage in browser can be significant
- Debugging can be tricky (browser-in-browser)

## Files Involved

- `rails_app/app/javascript/frontend/` - React app with WebContainer integration
- Website files stored in `website_files` table
- Template structure in `rails_app/templates/`
