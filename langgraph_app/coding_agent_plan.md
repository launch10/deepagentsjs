# Landing Page Coding Agent - Final Plan

Reference materials:

1. https://blog.langchain.com/using-skills-with-deep-agents/
2. https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md

## What We're Building

A coding agent that generates high-converting landing pages for pre-sales signups using:

- User's brainstorm context (idea, audience, solution, social proof)
- Selected theme (6 colors in tailwind.config.ts)
- Selected images (Cloudflare R2 URLs)
- Vite + React + Tailwind + shadcn template

## Key Architecture Decisions

| Decision           | Choice                                                   |
| ------------------ | -------------------------------------------------------- |
| Primary storage    | Real filesystem (`/tmp/website-{id}/`)                   |
| Search             | Postgres FTS on `code_files` view                        |
| Sync strategy      | **Write-through** (every write → filesystem + DB)        |
| Execution          | Real filesystem (pnpm, tests, bash)                      |
| Todo tracking      | `todoListMiddleware` from langchain                      |
| Copy generation    | Writing subagent                                         |
| Analytics          | Posthog - views, CTAs, form signups                      |
| Error handling     | Frontend bubbles errors, agent fixes (max 3 retries)     |
| Context management | Summarize todos, evict file contents, summarize messages |

## Skills tool.

Progressive disclosure via tool:

```typescript
const skills = tool(
  async ({ action, skillName }) => {
    if (action === "list") {
      // Return just frontmatter for all skills
      const skillDirs = await glob("/skills/*/SKILL.md");
      return Promise.all(
        skillDirs.map(async (path) => {
          const content = await readFile(path);
          return parseFrontmatter(content); // { name, description, triggers }
        })
      );
    }

    if (action === "load") {
      // Return full SKILL.md content
      return readFile(`/skills/${skillName}/SKILL.md`);
    }
  },
  {
    name: "skills",
    description:
      "List available skills or load a specific skill's instructions",
    schema: z.object({
      action: z.enum(["list", "load"]),
      skillName: z.string().optional(),
    }),
  }
);
```

Agent flow:

1. skills({ action: "list" }) → sees available skills with descriptions
2. skills({ action: "load", skillName: "create-hero-section" }) → gets full instructions
3. Follows instructions using existing tools

## Write-Through Architecture

**Core Principle:** Agent writes to ONE place (filesystem). System handles dual-write.

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent's View                           │
│                                                             │
│   Unified filesystem. write_file("/src/Hero.tsx", code)    │
│   Agent doesn't know or care about DB sync.                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  WriteThroughBackend                        │
│                                                             │
│   Every write/edit does BOTH:                              │
│   1. Write to filesystem (/tmp/website-{id}/)              │
│   2. Write to Postgres (website_files table)               │
│                                                             │
│   Reads: Filesystem (fast, local)                          │
│   Search: Postgres FTS (leverages existing indexes)        │
│   Shell/Bash: Real filesystem (just works)                 │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**

- Agent has simple mental model (just a filesystem)
- Shell commands work (pnpm install, tests, scripts)
- Postgres FTS always current (write-through keeps it synced)
- Subagents share filesystem, see each other's work immediately
- Frontend sees changes via `code_files` view (existing infra)

## WriteThroughBackend Implementation

```typescript
class WriteThroughBackend implements BackendProtocol {
  private fs: FilesystemBackend;
  private websiteId: number;
  private db: Database;

  constructor(config: { workDir: string; websiteId: number; db: Database }) {
    this.fs = new FilesystemBackend({
      rootDir: config.workDir,
      virtualMode: true,
    });
    this.websiteId = config.websiteId;
    this.db = config.db;
  }

  // Reads go to filesystem (fast, local)
  async read(path: string, offset?: number, limit?: number): Promise<string> {
    return this.fs.read(path, offset, limit);
  }

  async readRaw(path: string): Promise<FileData> {
    return this.fs.readRaw(path);
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    return this.fs.lsInfo(path);
  }

  async globInfo(pattern: string, path?: string): Promise<FileInfo[]> {
    return this.fs.globInfo(pattern, path);
  }

  // Search goes to Postgres (leverages FTS indexes)
  async grepRaw(
    pattern: string,
    path?: string,
    glob?: string
  ): Promise<GrepMatch[] | string> {
    const results = await CodeFileModel.searchWithRank(pattern, this.websiteId);
    return results.map((r) => ({
      path: r.path,
      matches: extractMatches(r.content, pattern),
    }));
  }

  // Writes go to BOTH filesystem and DB
  async write(path: string, content: string): Promise<WriteResult> {
    // 1. Write to filesystem
    const fsResult = await this.fs.write(path, content);
    if (fsResult.error) return fsResult;

    // 2. Write to Postgres
    await this.db
      .insert(websiteFiles)
      .values({
        websiteId: this.websiteId,
        path,
        content,
        shasum: computeSha(content),
      })
      .onConflictDoUpdate({
        target: [websiteFiles.websiteId, websiteFiles.path],
        set: { content, shasum: computeSha(content), updatedAt: new Date() },
      });

    return { path, filesUpdate: null }; // External storage
  }

  // Edits go to BOTH filesystem and DB
  async edit(
    path: string,
    oldString: string,
    newString: string,
    replaceAll?: boolean
  ): Promise<EditResult> {
    // 1. Edit filesystem
    const fsResult = await this.fs.edit(path, oldString, newString, replaceAll);
    if (fsResult.error) return fsResult;

    // 2. Read new content and write to DB
    const newContent = await this.fs.read(path);
    await this.db
      .insert(websiteFiles)
      .values({
        websiteId: this.websiteId,
        path,
        content: newContent,
        shasum: computeSha(newContent),
      })
      .onConflictDoUpdate({
        target: [websiteFiles.websiteId, websiteFiles.path],
        set: {
          content: newContent,
          shasum: computeSha(newContent),
          updatedAt: new Date(),
        },
      });

    return { path, occurrences: fsResult.occurrences, filesUpdate: null };
  }
}
```

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INITIALIZE                                               │
│                                                             │
│    Create work directory: /tmp/website-{websiteId}-{uuid}/ │
│    Hydrate from code_files view → filesystem               │
│    (Template files + any existing website_files)           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AGENT RUNS                                               │
│                                                             │
│    All file operations use WriteThroughBackend             │
│    - Reads: filesystem                                     │
│    - Writes: filesystem + DB (write-through)               │
│    - Search: Postgres FTS                                  │
│    - Shell: real filesystem                                │
│                                                             │
│    Subagents share same work directory                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. COMPLETE/CLEANUP                                         │
│                                                             │
│    DB already synced (write-through)                       │
│    Delete work directory                                   │
│    Frontend sees changes via code_files view               │
└─────────────────────────────────────────────────────────────┘
```

## What We Build vs Reuse

| Component                 | Source       | LOC   |
| ------------------------- | ------------ | ----- |
| `FilesystemBackend`       | deepagentsjs | reuse |
| `BackendProtocol`         | deepagentsjs | reuse |
| Filesystem middleware     | deepagentsjs | reuse |
| `todoListMiddleware`      | langchain    | reuse |
| **`WriteThroughBackend`** | **build**    | ~150  |
| **Hydration logic**       | **build**    | ~50   |
| **Graph + nodes**         | **build**    | ~400  |
| **Prompts**               | **build**    | ~300  |
| **Writing subagent**      | **build**    | ~200  |

**Total new code: ~1,100 LOC**

## Graph Structure

```
┌────────────────────────────────────────────────────────────┐
│                   codingAgentGraph                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  START                                                     │
│    │                                                       │
│    ▼                                                       │
│  ┌──────────────┐                                         │
│  │  initialize  │  Create workDir, hydrate from DB        │
│  └──────┬───────┘                                         │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                   codingAgent                         │ │
│  │  (ReAct agent with tools + todoListMiddleware)       │ │
│  │                                                       │ │
│  │  Tools (all use WriteThroughBackend):                │ │
│  │  • ls, read_file, write_file, edit_file, glob, grep  │ │
│  │  • write_todos (from langchain)                      │ │
│  │  • draftCopy (writing subagent)                      │ │
│  │  • shell (bash commands in workDir)                  │ │
│  └──────────────────────────────────────────────────────┘ │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────┐     ┌─────────────────────────────┐    │
│  │  errorCheck  │────▶│ errors && retries < 3       │    │
│  └──────┬───────┘     │   → codingAgent             │    │
│         │             │ else → complete             │    │
│         │             └─────────────────────────────┘    │
│         ▼                                                  │
│  ┌──────────────┐                                         │
│  │   complete   │  Cleanup workDir                        │
│  └──────────────┘                                         │
│         │                                                  │
│         ▼                                                  │
│       END                                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## State Schema

```typescript
const CodingAgentAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Work directory (created in initialize)
  workDir: Annotation<string>,

  // Context (loaded in initialize)
  brainstorm: Annotation<BrainstormContext>,
  theme: Annotation<ThemeConfig>,
  images: Annotation<Image[]>,

  // Progress (managed by todoListMiddleware)
  todos: Annotation<Todo[]>,

  // Errors (from frontend)
  consoleErrors: Annotation<ConsoleError[], typeof concatReducer>,
  errorRetries: Annotation<number>,

  // Status
  status: Annotation<"running" | "completed" | "error">,
});
```

## System Prompt

```xml
<role>
You are a landing page coding agent. You create high-converting
landing pages that drive pre-sales signups.
</role>

<context>
<brainstorm>
Idea: {brainstorm.idea}
Audience: {brainstorm.audience}
Solution: {brainstorm.solution}
Social Proof: {brainstorm.socialProof}
</brainstorm>

<theme>
Colors: primary, secondary, accent, muted, background, foreground
Each has -foreground variant for contrast text.
</theme>

<images>
{images.map(img => `${img.url} ${img.is_logo ? "(logo)" : ""}`)}
</images>
</context>

<instructions>
1. Plan work with todos (private for internal, public for user visibility)
2. Use draftCopy tool for marketing copy before coding each section
3. Create components in /src/components/ (Hero.tsx, Features.tsx, etc.)
4. Create pages in /src/pages/ (IndexPage.tsx)
5. Use ONLY theme colors (bg-primary, text-secondary-foreground)
6. Add Posthog tracking to CTAs and signup forms
7. Use shell tool for pnpm commands if needed
8. Verify by reading files back after writing
</instructions>

<analytics>
CTA buttons: onClick={() => posthog.capture('cta_clicked', { section: 'hero' })}
Signup forms: onSubmit={() => posthog.capture('signup_completed')}
</analytics>

<constraints>
- ONLY shadcn components from template
- ONLY theme color utilities (never hex)
- One component per file, under 150 lines
</constraints>
```

## Implementation Plan

### Phase 1: Infrastructure (~2 days)

1. Build `WriteThroughBackend` implementing `BackendProtocol`
2. Build hydration logic (code_files → filesystem)
3. Create `CodingAgentAnnotation` state schema
4. Wire up filesystem middleware from deepagentsjs
5. Add shell tool for bash commands

### Phase 2: Core Agent (~2 days)

6. Create graph structure (initialize → codingAgent → errorCheck → complete)
7. Write system prompt
8. Implement `draftCopy` tool (writing subagent)
9. Add error loop logic

### Phase 3: Polish (~1-2 days)

10. Add context summarization middleware
11. Test end-to-end flow
12. Tune prompts

### Phase 4: Future

13. Parallel section subagents
14. Signup API endpoint
15. Analytics dashboard

## Key Benefits of Write-Through

1. **Simple mental model**: Agent just uses filesystem
2. **Shell commands work**: pnpm, tests, scripts - real filesystem
3. **Search is fast**: Postgres FTS always current
4. **Subagents coordinate**: Shared filesystem, immediate visibility
5. **Frontend works**: Existing `code_files` view sees all changes
6. **No complex sync**: Write-through keeps everything consistent
7. **Rollback available**: `website_file_histories` via historiographer

## Open Items (Deferred)

- **Signup API auth**: Anonymous POST with website_id + rate limiting
- **Multi-page**: Start with IndexPage only
- **Nav/Footer**: Template-provided initially
- **Tests/smoketests**: Future enhancement
