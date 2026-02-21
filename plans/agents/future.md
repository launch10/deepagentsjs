# Master Agent Architecture: Skills-Based Progressive Disclosure

## Context

Launch10 runs 6 separate Langgraph graphs (website, brainstorm, deploy, ads, insights, support), each with its own tools. The vision: **one master agent** that can access any capability, with progressive skill disclosure (not a flat tool dump) and permission-gating.

**Key insight:** LLMs perform poorly with large tool sets. Claude Code solves this with `ToolSearch` for deferred tools and `Skill` for on-demand capabilities. We apply the same pattern: the master agent starts with a small base tool set and discovers domain-specific skills on demand.

**Key principle:** "If it's a tool/API we have internally, the agent should be capable of using it too, if the user driving the agent has perms in this context."

---

## Architecture Overview

```
Master Agent (ReAct loop, one conversation)
   |
   |-- Base Tools (always available, ~3-4)
   |     |-- use_skill       <- Meta-tool: activate a skill domain
   |     |-- list_skills     <- Show available skill domains
   |     |-- list_projects   <- Common starting point
   |     `-- navigate_ui     <- Drive the frontend
   |
   |-- SkillsMiddleware (LangChain createMiddleware)
   |     reads state.activeSkills -> injects domain tools per model call
   |     exactly like textEditorMiddleware injects tools dynamically
   |
   |-- Skill Domains (loaded on-demand)
   |     |-- "website"    -> [edit_website (subagent), get_website]
   |     |-- "brainstorm" -> [brainstorm (subagent), get_brainstorm]
   |     |-- "deploy"     -> [deploy_project (subagent), get_deploy, rollback]
   |     |-- "ads"        -> [create_campaign (subagent), get_campaign, update]
   |     |-- "domains"    -> [search_domains, create_domain, verify_dns]
   |     |-- "billing"    -> [check_credits, get_usage]
   |     |-- "analytics"  -> [generate_insights (subagent), get_dashboard]
   |     `-- "support"    -> [get_support (subagent)]
   |
   `-- Permission Layer
         |-- Role-based: skill visibility filtered by user | admin | internal
         |-- Context-based: tools within skills require projectId, websiteId, etc.
         `-- Approval-based: dangerous ops (deploy, delete, spend) trigger confirmation
```

**What stays the same:** All 6 existing graphs, tools, nodes, services, annotations, bridges, routes. The master agent is an *additional* entry point.

---

## How Progressive Disclosure Works

### The Flow

```
1. User: "What domains are available for my project?"

2. Agent has: [use_skill, list_skills, list_projects, navigate_ui]
   -> Agent calls use_skill({ skill: "domains" })
   -> Returns description of domain tools, updates state.activeSkills

3. SkillsMiddleware reads state.activeSkills = ["domains"]
   -> Injects: [search_domains, create_domain, verify_dns]

4. Agent now has: [base tools] + [domain tools]
   -> Agent calls search_domains({ query: "my-startup" })
   -> Returns results
```

### Why This Works (Proven Patterns)

| Pattern | Where It Exists | How We Use It |
|---------|----------------|---------------|
| Dynamic tool injection via middleware | `textEditorMiddleware.ts` -- injects text_editor into `request.tools` | SkillsMiddleware injects skill tools |
| State-driven tool selection | `ads/helpers/tools.ts` -- conditional FAQ tool | `state.activeSkills` drives tool set |
| State changes between model calls | `brainstormMiddleware` -- detects mode switches mid-turn | `use_skill` updates state, next call sees it |
| Meta-tool for discovery | Claude Code's `ToolSearch` | `use_skill` + `list_skills` |

---

## Phase 1: Skills Infrastructure + First Skill (Foundation)

**Goal:** Build the skills registry, middleware, and prove it with one skill ("website") as a callable subagent.

### 1A. Skill Registry

`app/skills/schemas.ts`
```typescript
export const SkillDomain = z.enum([
  "brainstorm", "website", "deploy", "ads",
  "analytics", "support", "billing", "projects",
  "domains", "navigation", "ops",
]);

export const skillRegistrationSchema = z.object({
  domain: SkillDomain,
  description: z.string(),                                    // What this skill does
  tools: z.array(z.string()),                                 // Tool names in this skill
  requiredRole: z.enum(["user", "admin", "internal"]).default("user"),
  requiredContext: z.array(z.enum(["projectId", "websiteId", "campaignId"])).default([]),
});

export const toolRegistrationSchema = z.object({
  name: z.string(),
  domain: SkillDomain,
  description: z.string(),
  permission: z.enum(["auto", "confirm", "admin_only"]).default("auto"),
  requiresContext: z.array(z.enum(["projectId", "websiteId", "campaignId"])).default([]),
});
```

`app/skills/skillRegistry.ts`
```typescript
// Two maps: skills and tools (same Map + register/get pattern as taskRunner.ts)
const skills = new Map<string, RegisteredSkill>();
const tools = new Map<string, RegisteredTool>();

export function registerSkill(reg: SkillRegistration) { ... }
export function registerTool(reg: ToolRegistration, tool: StructuredToolInterface) { ... }

export function getAvailableSkills(context: PermissionContext): RegisteredSkill[] {
  // Filter by role + context
}

export function getToolsForSkills(activeSkills: string[], context: PermissionContext): StructuredToolInterface[] {
  // Return tools belonging to activated skills, filtered by permission + context
}
```

### 1B. SkillsMiddleware

Uses `createMiddleware` (same API as `textEditorMiddleware` and `brainstormMiddleware`).

`app/skills/skillsMiddleware.ts`
```typescript
export function createSkillsMiddleware() {
  return createMiddleware({
    name: "skills",
    wrapModelCall: async (request, handler) => {
      const state = request.state as MasterAgentState;
      const activeSkills = state.activeSkills ?? [];

      if (activeSkills.length === 0) {
        return handler(request); // No skills active, just base tools
      }

      const context = {
        role: state.userRole,
        projectId: state.projectId,
        websiteId: state.websiteId,
        campaignId: state.campaignId,
      };

      const skillTools = getToolsForSkills(activeSkills, context);

      return handler({
        ...request,
        tools: [...request.tools, ...skillTools],
      });
    },
  });
}
```

### 1C. Base Tools

`app/skills/baseTools.ts`
```typescript
// use_skill: Activate a skill domain (like ToolSearch)
const useSkillTool = tool(async (args, config) => {
  const state = getCurrentTaskInput<MasterAgentState>(config);
  const skill = skills.get(args.skill);

  if (!skill) {
    const available = getAvailableSkills({ role: state.userRole, ... });
    return `Unknown skill "${args.skill}". Available: ${available.map(s => s.domain).join(", ")}`;
  }

  // Permission check
  if (!hasPermission(state.userRole, skill)) {
    return `Permission denied for skill: ${args.skill}`;
  }

  // Return Command to update activeSkills in state
  const newSkills = [...new Set([...(state.activeSkills || []), args.skill])];
  return new Command({
    update: { activeSkills: newSkills },
  });
}, {
  name: "use_skill",
  description: "Activate a skill domain to access its tools. Call list_skills first to see what's available.",
  schema: z.object({ skill: z.string().describe("The skill domain to activate") }),
});

// list_skills: Show available skill domains
const listSkillsTool = tool(async (args, config) => {
  const state = getCurrentTaskInput<MasterAgentState>(config);
  const available = getAvailableSkills({ role: state.userRole, ... });
  return JSON.stringify(available.map(s => ({
    domain: s.domain,
    description: s.description,
    active: (state.activeSkills || []).includes(s.domain),
    toolCount: s.tools.length,
  })));
}, { name: "list_skills", ... });
```

### 1D. Subagent Tool Factory

`app/skills/subagentTool.ts`
```typescript
// Wraps a compiled graph as a callable tool
export function createSubagentTool({ name, description, inputSchema, graph, mapInput, mapOutput }) {
  return tool(async (args, config) => {
    const masterState = getCurrentTaskInput<MasterAgentState>(config);
    const subagentInput = mapInput(args, masterState);
    const result = await graph.invoke(subagentInput, config);
    return mapOutput(result);
  }, { name, description, schema: inputSchema });
}
```

### 1E. Master Agent Annotation

`app/annotation/masterAnnotation.ts`
```typescript
export const MasterAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  userRole: Annotation<"user" | "admin" | "internal">({ default: () => "user", ... }),
  activeSkills: Annotation<string[]>({ default: () => [], reducer: (_, b) => b }),
  campaignId: Annotation<PrimaryKeyType | undefined>({ ... }),
  pendingApproval: Annotation<PendingApproval | null>({ ... }),
});
```

### 1F. Master Agent Graph

`app/graphs/master.ts`
```typescript
const masterGraph = new StateGraph(MasterAnnotation)
  .addNode("agent", masterAgentNode)          // ReAct: LLM + base tools + SkillsMiddleware
  .addNode("approval", approvalGateNode)      // Human confirmation checkpoint
  .addEdge(START, "agent")
  .addConditionalEdges("agent", (state) => {
    if (state.pendingApproval) return "approval";
    return END;
  })
  .addEdge("approval", "agent");              // After approval, agent continues
```

### 1G. Master Agent Node

`app/nodes/master/masterAgent.ts`
```typescript
export const masterAgentNode = NodeMiddleware.use(
  { context: { nodeName: "masterAgent", graphName: "master" } },
  async (state: MasterAgentState, config) => {
    const llm = createLLM({ model: "claude-sonnet-4-5-20250929" });
    const baseTools = [useSkillTool, listSkillsTool, listProjectsTool, navigateUiTool];

    const agent = await createAgent({
      model: llm,
      tools: baseTools,
      middleware: [
        createPromptCachingMiddleware(),
        createSkillsMiddleware(),  // Injects skill tools dynamically
      ],
    });

    return agent.invoke(state, config);
  }
);
```

### 1H. Register Website as First Skill

`app/skills/domains/website.ts`
```typescript
import { compiledWebsiteGraph } from "@api";

const editWebsiteTool = createSubagentTool({
  name: "edit_website",
  description: "Build or edit the user's landing page. Delegates to the website builder agent.",
  graph: compiledWebsiteGraph,
  inputSchema: z.object({ intent: z.string().optional() }),
  mapInput: (args, masterState) => ({
    messages: masterState.messages,
    threadId: masterState.threadId,
    jwt: masterState.jwt,
    websiteId: masterState.websiteId,
    projectId: masterState.projectId,
    intent: args.intent ? { type: args.intent } : undefined,
  }),
  mapOutput: (result) => JSON.stringify({ success: !result.error }),
});

// Register skill + its tools
registerSkill({
  domain: "website",
  description: "Build and edit landing pages. Tools: edit_website, get_website",
  tools: ["edit_website", "get_website"],
  requiredRole: "user",
  requiredContext: ["projectId"],
});
registerTool({ name: "edit_website", domain: "website", permission: "auto" }, editWebsiteTool);
```

### 1I. API + Route

Same patterns as `api/website.ts` and `server/routes/website.ts`:

`app/api/master.ts` -- compile graph + bind bridge
`app/server/routes/master.ts` -- POST/GET `/api/agent/stream`

### Files to create (Phase 1)

| File | Purpose |
|------|---------|
| `app/skills/schemas.ts` | Skill + tool metadata Zod schemas |
| `app/skills/skillRegistry.ts` | Registry (Map + register/get for skills & tools) |
| `app/skills/skillsMiddleware.ts` | LangChain middleware for dynamic tool injection |
| `app/skills/subagentTool.ts` | Factory to wrap graphs as callable tools |
| `app/skills/baseTools.ts` | use_skill, list_skills (always-available meta-tools) |
| `app/skills/domains/website.ts` | Website skill registration |
| `app/skills/domains/index.ts` | Import all skill registrations |
| `app/skills/index.ts` | Exports |
| `app/annotation/masterAnnotation.ts` | Master agent state |
| `app/graphs/master.ts` | Master agent graph |
| `app/nodes/master/masterAgent.ts` | Agent node (LLM + base tools + SkillsMiddleware) |
| `app/nodes/master/approvalGate.ts` | Human approval checkpoint |
| `app/nodes/master/index.ts` | Exports |
| `app/api/master.ts` | Compiled graph + bridge |
| `app/server/routes/master.ts` | Hono routes |
| Update `server.ts` | Mount master routes |

**After Phase 1:** Master agent starts with 4 base tools. User says "help me build a landing page" -> agent calls `use_skill("website")` -> website tools appear -> agent delegates to website graph. All existing routes work unchanged.

---

## Phase 2: All Graphs as Skills

**Goal:** Wrap remaining 5 graphs as skill domains.

### New skill domain files

| File | Skill | Tools | Permission |
|------|-------|-------|-----------|
| `skills/domains/brainstorm.ts` | brainstorm | `brainstorm` (subagent) | auto |
| `skills/domains/deploy.ts` | deploy | `deploy_project` (subagent) | confirm |
| `skills/domains/ads.ts` | ads | `create_campaign` (subagent) | confirm |
| `skills/domains/analytics.ts` | analytics | `generate_insights` (subagent) | auto |
| `skills/domains/support.ts` | support | `get_support` (subagent) | auto |

**After Phase 2:** "Brainstorm my idea then build a website" -> agent activates brainstorm skill -> runs brainstorm -> activates website skill -> builds page. Cross-domain orchestration in one conversation.

---

## Phase 3: Rails API Tools as Skills

**Goal:** Wrap the 20 existing Rails API services (`shared/lib/api/services/`) as direct tool skills.

### Skill groups from existing API services

| Skill | API Service | Tools | Permission |
|-------|------------|-------|-----------|
| `projects` | `ProjectsAPIService` | list, get, delete, restore | auto / confirm for delete |
| `domains` | `DomainsAPIService` | search, create, verify_dns | auto |
| `billing` | `CreditsAPIService` | check_credits, usage_history | auto |
| `campaigns` | `CampaignAPIService` | get, update, advance_stage | auto / confirm |
| `deploys` | `DeployAPIService` | get, rollback | auto / confirm |

### Pattern for wrapping an API service

```typescript
// skills/domains/domains.ts
const searchDomainsTool = tool(async (args, config) => {
  const state = getCurrentTaskInput<MasterAgentState>(config);
  const api = new DomainsAPIService({ jwt: state.jwt! });
  return JSON.stringify(await api.search(args.query));
}, { name: "search_domains", ... });

registerSkill({
  domain: "domains",
  description: "Search, register, and verify custom domains",
  tools: ["search_domains", "create_domain", "verify_dns"],
});
registerTool({ name: "search_domains", domain: "domains", permission: "auto" }, searchDomainsTool);
```

**After Phase 3:** "How many credits do I have?" -> agent activates billing skill -> calls check_credits. "Is funky-startup.launch10.site available?" -> activates domains skill -> searches.

---

## Phase 4: Permission Layer

**Goal:** Full role-based, context-based, and approval-based permission system.

### Role-based filtering

| Role | Available Skills |
|------|-----------------|
| `user` | All except ops |
| `admin` | All |
| `internal` | All + ops (proactive agent tools) |

### Context-based filtering

Tools within skills are filtered based on available context:
- `edit_website` only appears if `state.websiteId` is set
- `create_campaign` only appears if `state.projectId` is set
- Missing context = tool hidden, not errored

### Approval gates

Tools with `permission: "confirm"` trigger the approval flow:
1. Tool returns `Command({ update: { pendingApproval: { action, args, toolName } } })`
2. Graph routes to `approval` node
3. Approval node uses `interrupt()` to pause for human confirmation
4. On approval, graph routes back to `agent` to continue

**After Phase 4:** Internal team can use all skills. Users see role-appropriate skills. Dangerous ops require confirmation.

---

## Phase 5: Agent -> UI Intent System

**Goal:** Agent can drive the frontend (navigate, show modals, refresh data, notify).

### Navigation as a base tool

`navigate_ui` is a base tool (always available, not skill-gated):

```typescript
const navigateUiTool = tool(async (args, config) => {
  return new Command({
    update: { agentIntents: [{ type: "navigate", payload: { path: args.path } }] },
  });
}, { name: "navigate_ui", description: "Navigate the user's browser to a page in the app" });
```

### Frontend processing

`agentIntents` streams to frontend via the bridge. A `useAgentIntents` hook processes:
- `navigate` -> `router.visit(path)` (Inertia)
- `show_modal` -> open modal
- `refresh_data` -> invalidate/refetch
- `notify` -> show toast

**After Phase 5:** "I've deployed your site" -> agent navigates to deploy page automatically.

---

## Phase 6: Proactive Agents (Background Ops)

**Goal:** Agents that run on schedules, using the same skills system.

Uses Worker Batch Pattern: `ProactiveAgentCoordinatorWorker` fans out to `ProactiveAgentProjectWorker` per project. Each worker invokes the master agent with a system message and `role: "internal"` (full skill access).

| Task | Schedule | Skills Used |
|------|----------|-------------|
| `analytics_check` | Every 4h | analytics |
| `deploy_health` | Every 1h | deploys |
| `campaign_performance` | Daily | ads, analytics |

---

## Critical Files Reference

| Existing File | How It's Used |
|--------------|--------------|
| `app/tools/website/textEditorMiddleware.ts` | Pattern for SkillsMiddleware -- dynamic tool injection via `wrapModelCall` |
| `app/nodes/brainstorm/agent.ts` | `createBrainstormMiddleware` -- state-driven middleware that reacts to changes mid-turn |
| `app/nodes/ads/helpers/tools.ts` | Conditional tool loading based on state |
| `app/nodes/deploy/taskRunner.ts:167-179` | Map + register/get pattern for registry |
| `app/annotation/base.ts` | Base annotation -- master annotation extends this |
| `app/tools/brainstorm/saveAnswers.ts` | Tool pattern: `getCurrentTaskInput` + `Command` for state updates |
| `app/graphs/shared/createIntentGraph.ts` | Intent routing -- master agent uses skills+tools instead |
| `app/api/middleware/appBridge.ts` | Bridge factory -- master agent gets its own bridge |
| `app/server/routes/website.ts` | Route pattern for master routes |
| `app/api/website.ts` | API pattern (compile graph + bind bridge) |
| `shared/lib/api/services/*.ts` | 20 typed API clients to wrap as skill tools |

---

## Verification Plan

### Phase 1 Verification
1. Start dev server: `pnpm run dev`
2. POST to `/api/agent/stream`: "Help me build a landing page"
3. Verify agent calls `use_skill("website")` -> then `edit_website`
4. Verify `state.activeSkills` contains `["website"]` after skill activation
5. Verify existing `/api/website/stream` still works independently
6. Write tests: `tests/tests/graphs/master/master.test.ts`

### Phase 2+ Verification
1. Cross-domain: "Brainstorm then build" -> brainstorm skill -> website skill
2. Permission: user role cannot activate `ops` skill
3. Approval: `deploy_project` pauses for confirmation
4. Tool count: verify agent never has >10 tools active simultaneously
5. Existing test suites pass (no changes to existing graphs)

---

## Summary

| Phase | What | Value |
|-------|------|-------|
| 1 | Skills infra + SkillsMiddleware + website skill | Proves progressive disclosure architecture |
| 2 | All graphs as skills | Cross-domain orchestration |
| 3 | Rails API tools as skills | Direct data access |
| 4 | Permission layer | Role/context/approval gating |
| 5 | Agent -> UI intents | Agent drives the experience |
| 6 | Proactive agents | Background automation |

Phase 1 alone gives you a working master agent with progressive skill discovery.
