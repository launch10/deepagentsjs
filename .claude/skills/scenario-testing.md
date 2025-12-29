# Scenario Testing (Browser Error Capture)

## When to Use

When you need to:
- Test how the AI handles real browser errors
- Create reproducible error scenarios
- Capture console errors from running websites
- Build test cases for error recovery

## What Is a Scenario?

A scenario is a known error state applied to a working website:
- Missing icon
- Broken import
- Broken links
- Runtime errors

The scenario system captures **real browser console errors** and feeds them to Langgraph for testing error handling.

## Commands

### Create a new scenario

```bash
cd langgraph_app
pnpm run create:scenario
```

This will:
1. Open a code editor
2. Track your changes
3. Persist the scenario for reuse

### Edit an existing scenario

```bash
pnpm run edit:scenario
```

## Using Scenarios in Tests

```typescript
testGraph()
  .withGraph(routerGraph)
  .withWebsite("space-quest")
  .withScenario("import_errors")  // Apply the error scenario
  .withPrompt("Fix the import errors")
  .execute();
```

## How It Works

```
Base Snapshot (working website)
         │
         ▼
File Modifications (apply scenario changes)
         │
         ▼
File Export (to isolated directory)
         │
         ▼
Website Runner (pnpm install && dev)
         │
         ▼
Browser Capture (Playwright captures errors)
         │
         ▼
Graph Input (errors fed to AI for fixing)
```

## Key Components

### FileExporter

Exports website files to isolated directory:

```typescript
const exporter = new FileExporter(websiteId);
const outputDir = await exporter.export();
```

### WebsiteRunner

Runs the website in development mode:

```typescript
const runner = new WebsiteRunner(projectDir);
await runner.install();  // pnpm install
await runner.start();    // pnpm dev
await runner.stop();
```

### BrowserErrorCapture

Captures console errors using Playwright:

```typescript
const capture = new BrowserErrorCapture(url);
await capture.start();
await capture.waitForErrors({ timeout: 5000 });
const errors = capture.getConsoleErrors();
```

## Scenario Files

Scenarios stored in `langgraph_app/app/services/editor/scenarios/`

## Important Notes

- Scenarios build on top of database snapshots
- Use Playwright to capture real browser behavior
- Errors include stack traces and source locations
- See `langgraph_app/app/services/editor/scenarios/README.md` for details
