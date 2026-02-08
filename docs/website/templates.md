# Templates

Templates provide the base file structure for every website. Currently there is one template ("default") — a React + TypeScript + Vite + Tailwind project with shadcn/ui components. Templates are stored on disk and synced to the database. Websites inherit template files as a base layer, with website-specific files overriding them.

## How It Works

```
Disk (rails_app/templates/default/)
       │
       │  TemplateSyncer.sync!
       ▼
Database (template_files table)
       │
       │  code_files view (UNION ALL)
       ▼
┌──────────────────────────────┐
│  template_files (base layer) │ ← files NOT overridden by website
│  website_files (overrides)   │ ← AI-generated/edited files
└──────────────────────────────┘
       │
       │  Langgraph syncFilesNode
       ▼
FileMap → WebContainer (browser preview)
```

1. **Template on disk**: Full project in `rails_app/templates/default/` with package.json, config files, shadcn/ui components, and starter source files
2. **Synced to DB**: `TemplateSyncer.sync!("default")` upserts all text files into `template_files` table (skips binaries, node_modules, .git)
3. **Merged via view**: PostgreSQL `code_files` view unions template_files and website_files, with website_files taking precedence for matching paths
4. **AI writes to website_files**: When the coding agent creates or edits files, they go into `website_files`, overriding the template base
5. **Loaded into WebContainer**: `syncFilesNode` reads merged `code_files` into a `FileMap` for the browser preview

## Default Template Structure

```
templates/default/
├── src/
│   ├── App.tsx              # Router (minimal)
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind + theme CSS vars
│   ├── components/ui/       # shadcn/ui components
│   ├── pages/               # Page components
│   ├── hooks/               # React hooks
│   └── lib/                 # Utilities (tracking, etc.)
├── public/                  # Static assets
├── package.json             # Dependencies (React, Vite, Tailwind)
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # Tailwind configuration
├── tsconfig.json            # TypeScript config
└── index.html               # HTML entry point
```

## File Override Strategy

The `code_files` view implements a layered file system:

```sql
-- Website files take precedence (not soft-deleted)
SELECT ... FROM website_files WHERE deleted_at IS NULL
UNION ALL
-- Template files fill in gaps (where no website override exists)
SELECT ... FROM template_files
WHERE NOT EXISTS (
  SELECT 1 FROM website_files
  WHERE website_files.path = template_files.path
    AND website_files.website_id = websites.id
    AND website_files.deleted_at IS NULL
)
```

This means a fresh website gets all template files. As the AI edits `src/pages/IndexPage.tsx`, that file moves to `website_files` while template files like `src/components/ui/button.tsx` remain unchanged.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/template.rb` | Template model (`has_many :files`) |
| `rails_app/app/models/template_file.rb` | Individual template file (path, content, shasum) |
| `rails_app/app/models/code_file.rb` | Read-only model backed by merged view |
| `rails_app/app/services/template_syncer.rb` | Disk → database sync (idempotent upsert) |
| `rails_app/app/services/code_files_view_service.rb` | Creates the PostgreSQL union view |
| `rails_app/app/models/website.rb` | `belongs_to :template`, `set_default_template` |
| `rails_app/app/controllers/templates_controller.rb` | API: list templates, show template files |
| `rails_app/templates/default/` | Default template files on disk |
| `langgraph_app/app/nodes/website/syncFiles.ts` | Reads code_files into graph state FileMap |

## Gotchas

- **Only one template exists** ("default"). The system supports multiple templates, but only one is seeded. Websites always default to `Template.first`.
- **No user-facing template selection**: Templates are auto-assigned. The UI doesn't offer template choice.
- **Binary files are skipped** by TemplateSyncer (lockfiles, images, fonts). The snapshot system handles node_modules separately.
- **`CodeFile.source_type`** distinguishes origin: `"TemplateFile"` or `"WebsiteFile"`. This enables querying which files the AI has modified.
- **Full-text search** is available on both template and website files via `content_tsv` (GIN index + trigram on path).
