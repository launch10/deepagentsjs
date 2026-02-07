# LLM Configuration

The LLM system provides a provider-agnostic model selection API. `getLLM()` accepts desired skill, speed, and cost parameters, then returns the best available model from a preferences chain fetched from Rails. All models are wrapped in a custom `StructuredOutputRunnableBinding` that preserves callback factories (usage tracking) through `.withConfig()` calls.

## How It Works

```
Rails API (/api/v1/model_configuration)
       │  [Redis cache: 5 min TTL]
       ▼
LLMManager.fetchConfig()
       │
       ▼
preferences: {
  free/paid → {
    blazing/fast/slow → {
      planning/writing/coding/reasoning → [model_keys]
    }
  }
}
       │
       ▼
getLLM({ skill, speed, cost, maxTier })
       │  Filter: enabled, usage %, price_tier
       ▼
StructuredOutputRunnableBinding (primary + fallbacks)
       │  .withConfig({ tags: ["notify"] })
       ▼
Attached: usageTracker callback factory
```

## Model Selection Parameters

| Param | Options | Default |
|-------|---------|---------|
| `skill` | planning, writing, coding, reasoning | coding |
| `speed` | blazing, fast, slow | fast |
| `cost` | free, paid | paid |
| `maxTier` | 1 (premium) → 5 (cheapest) | none |

Selection priority: first match from preference chain, falling back to cheapest available model.

## Prompt Caching

Three-tier caching via `createPromptCachingMiddleware()`:

1. **System prompt breakpoint** — cached across conversations (~11K tokens reused)
2. **Tools breakpoint** — caches tool definitions (system + tools prefix)
3. **Last-message breakpoint** — caches conversation prefix within a single conversation

Each breakpoint adds `cache_control: { type: "ephemeral" }` to content blocks. Cache reads cost 10% of input token price. TTL: 5 minutes (configurable to 1 hour).

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/core/llm/service.ts` | `LLMService`: model creation, `maxTokens: 4096` |
| `langgraph_app/app/core/llm/llm.ts` | `getLLM()`: model selection with preference chains |
| `langgraph_app/app/core/llm/types.ts` | `ModelConfig`, `ModelPreferences` types |
| `langgraph_app/app/core/llm/promptCachingMiddleware.ts` | Three-tier prompt caching (199 lines) |
| `langgraph_app/app/core/llm/structuredOutputRunnableBinding.ts` | Custom binding that preserves `configFactories` |
| `rails_app/app/controllers/api/v1/model_configuration_controller.rb` | Model config API endpoint |

## Gotchas

- **`RunnableBinding.withConfig()` loses `configFactories`**: Our `StructuredOutputRunnableBinding` subclass overrides this to preserve the usage tracking callback. Without this, token tracking breaks silently.
- **`maxTokens: 4096`** is set in `createModel()`, not in `getLLM()`. Increase it there to prevent output truncation.
- **Temperature quirks**: GPT-5/GPT-5-mini get `undefined` temperature (their default). All others get `0` for deterministic output.
- **Anthropic workaround**: The code manually unsets `topP`/`topK` defaults that LangChain's Anthropic adapter incorrectly sets.
- **Provider support**: Anthropic, OpenAI, Groq, Ollama. Each uses its respective LangChain adapter (`ChatAnthropic`, `ChatOpenAI`, `ChatGroq`, `ChatOllama`).
