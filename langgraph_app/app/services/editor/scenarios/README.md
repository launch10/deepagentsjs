# Real Browser Error Scenario System

A testing framework that captures **real browser console errors** from actual running websites and feeds them back to the LangGraph application for testing error handling and recovery.

## 🏗️ Architecture

```
┌─────────────────┐
│ Base Snapshot   │  Single database state with working website
└────────┬────────┘
         │
┌────────▼────────┐
│ File Mods       │  Apply modifications to websiteFiles in DB
└────────┬────────┘
         │
┌────────▼────────┐
│ File Export     │  Export files to isolated directory
└────────┬────────┘
         │
┌────────▼────────┐
│ Website Runner  │  Run pnpm install & dev server
└────────┬────────┘
         │
┌────────▼────────┐
│ Browser Capture │  Playwright captures console errors
└────────┬────────┘
         │
┌────────▼────────┐
│ Graph Input     │  Feed real errors to LangGraph for fixing
└─────────────────┘
```

## 🚀 Key Components

### 1. Scenarios

Allows you to define specific scenarios, like:

1. Missing Icon
2. Broken Import
3. Broken Links

To do this, we use CLI to modify an existing website into the desired state:

```bash
pnpm run create:scenario
pnpm run edit:scenario
```

This will open a code editor, track your changes, and then persist a scenario.

### 2. Running Scenarios

We can use the basic testing infrastructure to run scenarios.

```typescript
testGraph()
  .withGraph(routerGraph)
  .withWebsite("space-quest")
  .withScenario("import_errors") // Will automatically pipe console errors to the graph
  .withPrompt("Fix the import errors")
  .execute();
```

## Under the Hood:

The `withScenario` method will load the scenario from the filesystem and
apply the modifications to the website files:

### 1. FileExporter

Loads the specified scenario from the filesystem the existing website to
match the scenario.

```typescript
const exporter = new FileExporter(websiteId);
const outputDir = await exporter.export();
```

### 2. WebsiteRunner

Runs the website in a development server, and captures the console errors.

```typescript
const runner = new WebsiteRunner(projectDir);
await runner.install(); // pnpm install
await runner.start(); // pnpm dev
// Server running at http://localhost:5173
await runner.stop();
```

### 3. BrowserErrorCapture

Uses Playwright to capture real browser errors, allowing us to pipe them
back into Langgraph.

```typescript
const capture = new BrowserErrorCapture(url);
await capture.start();
await capture.waitForErrors({ timeout: 5000 });
const errors = capture.getConsoleErrors();
// Returns actual console.error() messages
```
