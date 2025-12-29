# Template Management

## When to Use

When you need to:
- Edit the landing page templates users start from
- Add new template variants
- Fix issues in base template files
- Sync template changes to the database

## Template Location

Source of truth: `rails_app/templates/`

```
rails_app/templates/
├── default/           # Default React + Vite template
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
└── [other templates]/
```

## Editing Templates

1. Edit files directly in `rails_app/templates/`
2. Sync to database:

```bash
cd rails_app
bundle exec rake seeds:template
```

## How Templates Work

1. **Source files** in `templates/` directory
2. **Rake task** reads files and creates/updates Template records
3. **Website creation** copies template files to new project
4. **WebContainers** run the template in browser

## Key Template Files

### `index.html`

Contains the `__BASENAME__` detection for subpath deployment:

```html
<script>
  window.__BASENAME__ = "/" + (window.location.pathname.split("/")[1] || "");
</script>
```

### `src/App.tsx`

Uses basename for React Router:

```tsx
<BrowserRouter basename={window.__BASENAME__ || '/'}>
```

### `vite.config.ts`

Uses relative paths for deployment:

```typescript
export default defineConfig({
  base: "./",  // Relative asset paths
});
```

## Creating a New Template

1. Create directory: `rails_app/templates/my-template/`
2. Add required files (package.json, vite.config.ts, src/, etc.)
3. Run sync: `bundle exec rake seeds:template`
4. Template now available for website creation

## Important Notes

- Always edit source files in `templates/`, not the database
- Run `rake seeds:template` after changes
- Templates use React + Vite stack
- See `docs/decisions/webcontainers.md` for architecture
