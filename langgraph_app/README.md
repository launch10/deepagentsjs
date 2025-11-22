# Launch10

AI-powered A/B tests for solo founders and marketers.

## Quick Start

```bash
nvm use && pnpm install
cp .env.example .env
cp .env.test.example .env.test
pnpm test
```

### Run Database Schema Generation (For Drizzle)

- We don't manage the database in this application, we manage it in Rails
- In order to generate the database schema, run:

```bash
bundle exec rake db:migrate # In the Rails app
pnpm db:reflect # In this app
```

We have to perform a handful of database normalizations in order to make the schema consistent. If you need to add new
ones, you add them to `scripts/db/preserve-relations.ts`.

### Generating Rails API Types

Rails uses RSwag to document its API. We use `openapi-typescript` to generate types from the API documentation.

```bash
pnpm api:generate
```

This ensures we have up-to-date types for the Rails API.

```typescript
import { createRailsApiClient, type paths } from "@rails_api";

const client = createRailsApiClient({ jwt: this.jwt });

// Response is properly typed, and will generate typescript errors if the API changes
const response = await client.POST("/brainstorms", {
  body: {
    brainstorm: {
      thread_id: threadId,
      ...(name ? { name } : {}),
    },
  },
});
```

### REPL

Run `pnpm repl` to start a REPL.

```bash
pnpm repl
```

### Editing AI-Generated Websites / Creating Test Scenarios

You may want to edit a generated website for debugging, or to manually create
test scenarios.

Run `pnpm run edit:website` to start the editor.

Workflow:

1. Runs in `NODE_ENV=test`
2. Uses `DatabaseSnapshotter` to load an existing snapshot
3. Opens a dev server so you can preview the website
4. Opens a code editor, so you can make changes.
5. Preview your changes in the dev server.
6. Make changes, such as creating new components or introducing bugs for testing
7. Once you're done, the script will create a list of modifications that it
   can replay (instead of generating a completely new snapshot, which is heavy).

To use your scenario in tests, you can load it like this:

```typescript
// This will load your original snapshot
// Apply the changes you made in the editor
// Then give you the test database in the correct state
scenario = await runScenario({ name: "my-scenario" });
```

## Testing

Running tests:

```typescript
vitest tests --no-file-parallelism # Essential to get all tests to run in isolation!
```

We have 3 levels of testing, from highest to lowest:

1. Langgraph Integration Tests (tests nodes + graphs end-to-end with Polly for mocking API calls)
2. LLM Evals (test individual LLM calls with Evalite)
3. Unit Tests (tests individual LLM services + prompts)

#e Langgraph Integration Tests

1. Uses Polly to mock both LLM calls + Rails API calls separately

- When using this, will automatically decorate `test-jwt` plus a timestamped header signed with `JWT_SECRET` from the environment
- Rails will validate this in test + development environments, so ensure your Rails app is configured with the same `JWT_SECRET`
- Run the Rails server

2. Use the special `testGraph` helper to run tests:

- Use `withPrompt` to mock the user's prompt
- Use `stopAfter` to stop the graph at a specific node
- Use `execute` to run the graph
- Will return the state of the graph at the stopped node, allowing us to assert on the output of the graph

```typescript
const result = await testGraph()
  .withGraph(routerGraph)
  .withPrompt(`Create a website about space exploration`)
  .stopAfter("saveInitialProject")
  .execute();
```

## LLM Evals with Evalite

These allow us to assert the QUALITY of the output of an LLM call.

> This is how we do service integration tests. Test individual nodes with expected outputs.

```bash
pnpm eval:dev
```

Name your files `xyz.eval.ts`.

- Tips:
  - Autoeval has helpful scorers pre-built.

## 🏗️ Architecture

### Services

Services handle business logic and AI interactions:

- `PlanComponentService` - Plans website components
- `CreateComponentService` - Generates React code
- `SearchIconsService` - Finds appropriate icons

### Prompts

AI prompts are organized by domain:

- `websites/` - Website generation prompts
- `state/` - State management prompts
- `components/` - Reusable prompt components

### Registries

Component registries define available website elements:

- `SectionRegistry` - Website sections (Hero, Features, etc.)
- `LayoutRegistry` - Layout components (Nav, Footer, etc.)
- `FileSpecRegistry` - File specifications
- `TemplateRegistry` - Project templates

## 📝 Scripts

```bash
# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
# Required for AI services
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

### TypeScript Paths

The project uses path aliases for cleaner imports:

```typescript
@services    → app/services
@prompts     → app/prompts
@types       → app/shared/types
@registries  → app/registries
```

## 🧩 Key Components

### Website Generation Flow

1. **Plan Component** - AI plans the content and structure
2. **Write Code** - AI generates React/TypeScript code
3. **File Management** - Code is organized into proper files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:

- [LangGraph](https://github.com/langchain-ai/langgraph)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Commander.js](https://github.com/tj/commander.js)
