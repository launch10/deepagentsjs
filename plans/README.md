# Launch10 Plans

This directory contains all feature plans and architectural decisions for Launch10.

## Quick Navigation

| Feature | Description | Plans |
|---------|-------------|-------|
| [Architecture](./architecture/) | System-wide architecture & implementation order | 2 |
| [Coding Agent](./coding-agent/) | Landing page generation AI | 5 |
| [Deploy](./deploy/) | Deployment orchestration & build infrastructure | 8 |
| [Analytics](./analytics/) | Tracking, analytics & lead capture | 3 |
| [Themes](./themes/) | Theme system & design tokens | 2 |
| [Google Ads](./google-ads/) | Ads platform integration | 2 |
| [Billing](./billing/) | Credits & subscription billing | 1 |
| [SDK](./sdk/) | Langgraph SDK enhancements | 1 |
| [Infrastructure](./infrastructure/) | Background jobs & system infrastructure | 1 |
| [Archive](./_archive/) | Completed plans | 1 |

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
