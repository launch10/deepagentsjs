# Architecture Plans

System-wide architecture decisions and implementation order for Launch10.

## Plans

| Plan | Description |
|------|-------------|
| [architecture-overview.md](./architecture-overview.md) | Core system architecture: LangGraph as orchestrators, Rails as workers |
| [00-implementation-order.md](./00-implementation-order.md) | Implementation phases and dependency graph |

## Key Files

- `langgraph_app/app/graphs/` - Graph definitions
- `rails_app/app/controllers/` - Rails controllers
- `CLAUDE.md` - Project documentation

## Related

- [Deploy](../deploy/) - Deployment orchestration
- [Coding Agent](../coding-agent/) - Page generation
