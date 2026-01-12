# Deploy Plans

Deployment orchestration and build infrastructure for websites and campaigns.

## Plans

| Plan | Description |
|------|-------------|
| [website-deploy-graph.md](./website-deploy-graph.md) | Unified LangGraph for deployment orchestration |
| [deploy-graph-refactor.md](./deploy-graph-refactor.md) | Subgraph architecture for website/campaign deploy |
| [deploy-graph-testing.md](./deploy-graph-testing.md) | Testing strategy for deploy and tracking |
| [pre-deployment-validation.md](./pre-deployment-validation.md) | Browser-based runtime validation before deploy |
| [instrumentation.md](./instrumentation.md) | Instrumentation node refactoring |
| [atlas-spa-fallback.md](./atlas-spa-fallback.md) | SPA fallback for React Router on Cloudflare |
| [environment-variables.md](./environment-variables.md) | Build-time env var injection |
| [browser-pool.md](./browser-pool.md) | Bounded concurrency for browser validation |

## Key Files

- `langgraph_app/app/graphs/deployGraph.ts`
- `langgraph_app/app/nodes/deploy/`
- `atlas/` - Cloudflare deployment

## Related

- [Coding Agent](../coding-agent/) - Page generation
- [Analytics](../analytics/) - Tracking integration
