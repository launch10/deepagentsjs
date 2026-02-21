# Launch10 Plans

This directory contains all feature plans and architectural decisions for Launch10.

## Quick Navigation

| Feature | Description |
|---------|-------------|
| [Next Steps](./NEXT_STEPS.md) | Active priorities (Cost Reconciliation, Agent Memory) |
| [Architecture](./architecture/) | System-wide architecture & implementation order |
| [Coding Agent](./coding-agent/) | Landing page generation AI |
| [Deploy](./deploy/) | Deployment orchestration & build infrastructure |
| [Themes](./themes/) | Theme system & design tokens |
| [Google Ads](./google-ads/) | Ads platform integration |
| [Billing](./billing/) | Credits & subscription billing |
| [SDK](./sdk/) | Langgraph SDK enhancements |
| [Infrastructure](./infrastructure/) | Background jobs & system infrastructure |
| [Agents](./agents/) | Agent architecture (future) |
| [Archive](./archive/) | Completed plans (analytics, context-engineering, website, etc.) |

## How to Use

1. **Finding plans**: Browse by feature directory or use `grep -r "keyword" plans/`
2. **Creating plans**: Add to appropriate feature directory, update its README
3. **Completing plans**: Move to `_archive/` with completion date in filename

## Creating New Plans

Use [TEMPLATE.md](./TEMPLATE.md) as a starting point for new plans.

## Plan Naming Conventions

- Use lowercase kebab-case: `deploy-graph-refactor.md`
- Prefix drafts with `draft-`: `draft-new-feature.md`
- No date prefixes (use git history for timing)
