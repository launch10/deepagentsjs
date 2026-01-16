---
name: streamline-plan
description: Rewrite messy plan documents into clean, standalone documentation
argument-hint: "[path/to/plan.md]"
---

# Streamline Plan

Rewrite a messy, iterative plan document into clean, standalone documentation that assumes zero prior context.

## When to Use

Use this command when a plan file has accumulated cruft from multiple rounds of feedback, assumes the reader has been following along, or contains references to reviewers, historical decisions, or "what we discovered."

## Workflow

### Step 1: Read the Plan

Read the plan file at: `$ARGUMENTS`

### Step 2: Identify Cruft to Remove

Look for and remove:

- "Review Feedback Incorporated" sections listing what reviewers said
- References to reviewers by name (e.g., "Kieran suggested...", "DHH + Kieran")
- Phrases like "we discovered", "after investigation", "it turns out"
- Assumptions that the reader knows the codebase or prior issues
- Historical context about how the plan evolved
- Comments like "# Add this" that assume knowledge of what existed before

### Step 3: Restructure for Zero Context

Rewrite the document with this structure:

```markdown
# [Clear Title]

## Problem

[What is broken and why it matters - written for someone who has never seen the code]

## Solution

[High-level approach in 2-3 sentences]

## Implementation

### [Component/File 1]

[What it does and the complete code]

### [Component/File 2]

[What it does and the complete code]

## Verification

[How to test that it works]
```

### Step 4: Make Code Blocks Self-Contained

- Show complete file contents or clearly mark what's being added/changed
- Replace `# ... existing code ...` comments with actual content or clear descriptions
- Include all necessary imports at the top of code blocks

### Step 5: Write for Future You

Assume the reader:

- Has never seen this codebase before
- Does not know why past decisions were made
- Needs to understand the full context from this document alone

### Step 6: Save the Cleaned Plan

Overwrite the original file with the cleaned version (unless user specified a different output path).

## Example Transformation

**Before (cruft):**

```markdown
### Issue 2: Current.account uses `||=` (won't recalculate)

- If `Current.account` is already set, it stays as admin's account
- ActsAsTenant continues scoping to admin's account

## Review Feedback Incorporated

- **Nil account guard** in `refresh_jwt` (Kieran - critical)
- **`User#default_account`** method to avoid duplication (DHH + Kieran)
```

**After (clean):**

```markdown
### Problem: Account Context Not Updated

When impersonating a user, `Current.account` may retain the admin's account
due to memoization (`||=`). This causes ActsAsTenant to scope queries to
the wrong account.

### Solution: Explicit Account Override

The `refresh_jwt` method accepts an explicit `account:` parameter that
bypasses the memoized value. Guard against nil accounts to prevent errors
when users have no associated accounts.
```

## Success Criteria

- [ ] All reviewer names and feedback sections removed
- [ ] No assumptions about prior context
- [ ] Code blocks are self-contained with imports
- [ ] Document follows the Problem → Solution → Implementation → Verification structure
- [ ] A newcomer could understand and implement from this document alone
