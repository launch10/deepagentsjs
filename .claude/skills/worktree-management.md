# Git Worktree Management

## Creating a New Worktree

Use the `scripts/create-worktree.sh` script to create new worktrees with properly symlinked `.env` files:

```bash
./scripts/create-worktree.sh <worktree-name> [branch-name] [base-branch]
```

### Examples

```bash
# Create worktree "launch10-feature" with branch "feature-branch" based on "main"
./scripts/create-worktree.sh launch10-feature feature-branch main

# Create worktree with same name as branch
./scripts/create-worktree.sh my-feature

# Create worktree from existing branch
./scripts/create-worktree.sh launch10-hotfix hotfix-branch
```

### What it does

1. Creates a git worktree at `~/programming/business/<worktree-name>`
2. Symlinks `rails_app/.env` from the main `launch10` repo
3. Symlinks `langgraph_app/.env` from the main `launch10` repo

## Worktree Structure

- **Main repo**: `~/programming/business/launch10`
- **Worktrees**: `~/programming/business/launch10-<name>` (e.g., `launch10-google-ads`)

## Important Notes

- All worktrees share `.env` files via symlinks to the main `launch10` repo
- Run commands from the appropriate subdirectory (e.g., `cd rails_app` before running `bundle exec`)
- The main repo at `~/programming/business/launch10` contains the canonical `.env` files

## Manual .env Symlinking

If a worktree was created without the script, manually symlink:

```bash
ln -sf ~/programming/business/launch10/rails_app/.env <worktree>/rails_app/.env
ln -sf ~/programming/business/launch10/langgraph_app/.env <worktree>/langgraph_app/.env
```
