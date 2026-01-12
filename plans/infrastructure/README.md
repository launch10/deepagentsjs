# Infrastructure Plans

Background jobs and system infrastructure.

## Plans

| Plan | Description |
|------|-------------|
| [sidekiq-to-goodjob.md](./sidekiq-to-goodjob.md) | Migration from Sidekiq to GoodJob for batch support |

## Key Files

- `rails_app/config/sidekiq.yml`
- `rails_app/app/jobs/`
- `rails_app/Gemfile`

## Related

- [Deploy](../deploy/) - Uses jobs for async deployment
- [Billing](../billing/) - Credit processing jobs
