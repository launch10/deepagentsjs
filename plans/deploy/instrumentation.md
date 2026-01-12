     │ Deploy Graph Test Improvements Plan                                                                           │
     │                                                                                                               │
     │ Context                                                                                                       │
     │                                                                                                               │
     │ Current State:                                                                                                │
     │ - instrumentationNode uses custom LLM prompt + deterministic code injection (fragile)                         │
     │ - bugFixNode uses createCodingAgent() pattern (robust, consistent)                                            │
     │ - User wants instrumentationNode to also use createCodingAgent() for consistency                              │
     │                                                                                                               │
     │ Goal: Refactor instrumentationNode to use codingAgent, then write focused tests for:                          │
     │ 1. Proper instrumentation (L10.conversion for conversions)                                                    │
     │ 2. Deployment failure handling                                                                                │
     │                                                                                                               │
     │ Key Insight                                                                                                   │
     │                                                                                                               │
     │ With codingAgent, we test outcomes not mechanics:                                                             │
     │ - ❌ Don't test: "did we add import at line X"                                                                │
     │ - ✅ Do test: "is L10.conversion present after form submission"                                               │
     │                                                                                                               │
     │ ---                                                                                                           │
     │ Implementation Plan                                                                                           │
     │                                                                                                               │
     │ Phase 1: Refactor instrumentationNode to use codingAgent                                                      │
     │                                                                                                               │
     │ File: app/nodes/deploy/instrumentationNode.ts                                                                 │
     │                                                                                                               │
     │ Replace custom LLM logic with createCodingAgent() call:                                                       │
     │                                                                                                               │
     │ const instrumentationSystemPrompt = `                                                                         │
     │ You are a pre-deployment agent. Add Google Ads conversion tracking to the PRIMARY conversion form.            │
     │                                                                                                               │
     │ Tasks:                                                                                                        │
     │ 1. Find the primary conversion form (signup, waitlist, purchase, lead capture)                                │
     │ 2. Import L10 from '@/lib/tracking' if not already imported                                                   │
     │ 3. Add L10.conversion({ label: '<type>' }) after successful form submission                                   │
     │                                                                                                               │
     │ Labels to use:                                                                                                │
     │ - "signup" - Email signups, waitlist forms, account creation                                                  │
     │ - "lead" - Contact forms, demo requests, consultation booking                                                 │
     │ - "purchase" - Checkout, payment confirmation                                                                 │
     │ - "download" - Resource downloads (PDF, ebook)                                                                │
     │                                                                                                               │
     │ Rules:                                                                                                        │
     │ - Only instrument ONE primary conversion per page                                                             │
     │ - Fire conversion on SUCCESS (after API success, before thank you state)                                      │
     │ - Do NOT track navigation clicks, scrolls, or non-conversion interactions                                     │
     │ `;                                                                                                            │
     │                                                                                                               │
     │ export const instrumentationNode = NodeMiddleware.use({}, async (state, config) => {                          │
     │   const task = Task.findTask(state.tasks, TASK_NAME);                                                         │
     │   if (task?.status === "completed") return {};                                                                │
     │                                                                                                               │
     │   const agent = await createCodingAgent(                                                                      │
     │     { websiteId: state.websiteId, jwt: state.jwt },                                                           │
     │     instrumentationSystemPrompt                                                                               │
     │   );                                                                                                          │
     │                                                                                                               │
     │   await agent.invoke({                                                                                        │
     │     messages: [new HumanMessage("Add conversion tracking to the primary form.")]                              │
     │   });                                                                                                         │
     │                                                                                                               │
     │   return { tasks: [{ ...task, status: "completed" }] };                                                       │
     │ });                                                                                                           │
     │                                                                                                               │
     │ ---                                                                                                           │
     │ Phase 2: Write Tests                                                                                          │
     │                                                                                                               │
     │ A. Instrumentation Tests (NEW FILE)                                                                           │
     │                                                                                                               │
     │ File: tests/tests/nodes/deploy/instrumentationNode.test.ts                                                    │
     │ ┌─────────────────────────────────────────────┬───────────────────────────────────────────────────────────────│
     │ ──┐                                                                                                           │
     │ │                    Test                     │                        What it verifies                       │
     │   │                                                                                                           │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ instruments signup form with L10.conversion │ Form with email signup gets L10.conversion({ label: 'signup'  │
     │ }) │                                                                                                          │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ instruments lead capture form correctly     │ Contact form gets L10.conversion({ label: 'lead' })           │
     │   │                                                                                                           │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ only instruments primary form               │ Website with 2 forms → only 1 gets instrumented               │
     │   │                                                                                                           │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ handles website with no form                │ Completes with note, no errors                                │
     │   │                                                                                                           │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ is idempotent - skips already instrumented  │ Re-running doesn't double-instrument                          │
     │   │                                                                                                           │
     │ ├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────│
     │ ──┤                                                                                                           │
     │ │ adds L10 import if missing                  │ Import added when not present                                 │
     │   │                                                                                                           │
     │ └─────────────────────────────────────────────┴───────────────────────────────────────────────────────────────│
     │ ──┘                                                                                                           │
     │                                                                                                               │
     │                                                                                                               │
     │                                                                                                               │
     │                                                                                                               │
     │                                                                                                               │
     │                                                                                                               │
     │ Test Strategy:                                                                                                │
     │ - Use database snapshots with specific website fixtures                                                       │
     │ - Verify by reading code files after instrumentation                                                          │
     │ - Check for presence of L10.conversion with correct label                                                     │
     │                                                                                                               │
     │ B. Deployment Failure Tests (ADD TO EXISTING)                                                                 │
     │                                                                                                               │
     │ File: tests/tests/graphs/deploy/deployWebsite.test.ts                                                         │
     │ ┌────────────────────────────────────────────────┬────────────────────────────────────────┐                   │
     │ │                      Test                      │            What it verifies            │                   │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────┤                   │
     │ │ marks task failed when webhook returns error   │ Webhook error → task.status = "failed" │                   │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────┤                   │
     │ │ preserves error details from failed deployment │ task.error contains useful info        │                   │
     │ └────────────────────────────────────────────────┴────────────────────────────────────────┘                   │
     │ ---                                                                                                           │
     │ Phase 3: Create Test Fixtures (Database Snapshots)                                                            │
     │                                                                                                               │
     │ Use DatabaseSnapshotter pattern (same as bugFix tests use website_with_import_errors).                        │
     │                                                                                                               │
     │ Snapshot: website_with_signup_form                                                                            │
     │ - Simple website with one signup form (email input + submit)                                                  │
     │ - No existing L10.conversion instrumentation                                                                  │
     │ - Used by: instruments signup form, adds L10 import                                                           │
     │                                                                                                               │
     │ Snapshot: website_with_multiple_forms                                                                         │
     │ - Website with signup form + contact form                                                                     │
     │ - Tests that only primary form gets instrumented                                                              │
     │                                                                                                               │
     │ Snapshot: website_already_instrumented                                                                        │
     │ - Website with L10.conversion already present                                                                 │
     │ - Tests idempotency                                                                                           │
     │                                                                                                               │
     │ Snapshot: website_without_form                                                                                │
     │ - Static content page, no form                                                                                │
     │ - Tests graceful handling                                                                                     │
     │                                                                                                               │
     │ ---                                                                                                           │
     │ Files to Modify                                                                                               │
     │ ┌──────────────────────────────────────────────────────┬────────────────────────────────────────┐             │
     │ │                         File                         │                 Change                 │             │
     │ ├──────────────────────────────────────────────────────┼────────────────────────────────────────┤             │
     │ │ app/nodes/deploy/instrumentationNode.ts              │ Refactor to use createCodingAgent      │             │
     │ ├──────────────────────────────────────────────────────┼────────────────────────────────────────┤             │
     │ │ tests/tests/nodes/deploy/instrumentationNode.test.ts │ NEW: Instrumentation tests             │             │
     │ ├──────────────────────────────────────────────────────┼────────────────────────────────────────┤             │
     │ │ tests/tests/graphs/deploy/deployWebsite.test.ts      │ ADD: Deployment failure tests          │             │
     │ ├──────────────────────────────────────────────────────┼────────────────────────────────────────┤             │
     │ │ tests/fixtures/database/snapshots/                   │ ADD: New snapshots for instrumentation │             │
     │ └──────────────────────────────────────────────────────┴────────────────────────────────────────┘             │
     │ ---                                                                                                           │
     │ Verification                                                                                                  │
     │                                                                                                               │
     │ 1. Run existing deployWebsite tests → all pass                                                                │
     │ 2. Run new instrumentation tests:                                                                             │
     │ pnpm test tests/tests/nodes/deploy/instrumentationNode.test.ts                                                │
     │ 3. Manual verification:                                                                                       │
     │   - Create a website with signup form                                                                         │
     │   - Run deployWebsite graph                                                                                   │
     │   - Verify L10.conversion appears in code files                                                               │
     │                                                                                                               │
     │ ---                                                                                                           │
     │ Test Count Summary                                                                                            │
     │                                                                                                               │
     │ Instrumentation Node: 6 new tests                                                                             │
     │ Deployment Failure: 2 new tests                                                                               │
     │ Total: 8 new tests                                                                                            │
     │                                                                                                               │
     │ This provides meaningful coverage while staying simple and maintainable.                                      │
