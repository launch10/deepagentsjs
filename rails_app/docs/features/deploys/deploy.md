# Deploys

Users can deploy their own websites via our Cloudflare account.

## Background

The `atlas` project in this monorepo is responsible for serving the user's pages.

A few of our core models (User, Website, Domain, Plan) are synced to Atlas via the `Atlas::Syncable` mixin, which
enqueues Sidekiq jobs to sync the models to Cloudflare's KV store.

We have R2 buckets that serve the user's built pages, which are organized into folders for each environment (development, production, staging).

## How It Fits Together

1. Edit credentials for Atlas

```bash
rails credentials:edit --environment=development

# Set
atlas:
    base_url: "https://development.admin.abeverything.com"
    api_key: "development_api_key"
```

2. Run Sidekiq, so Atlas jobs will sync to our Cloudflare KV store (in development KV)

3. Open a Rails console, and create the necessary objects

```ruby
u = User.create(email: "test@example.com", password: "password", password_confirmation: "password", name: "Test User")
project = Project.create(name: "Test Project", user: u)
website = Website.create(
    project: project,
    name: "Test Website",
    thread_id: "thread_id",
    template_id: 1
) # In reality, thread_id comes from Langchain
plan = Plan.create(name: "Test Plan", price: 10)
subscribe_user(u, plan) # Use helpers from spec/support/subscription_helpers.rb
domain = Domain.create(domain: "example.abeverything.com", user: u, website: website) # Domain must be in the abeverything.com zone
```

If any of this fails, or you forgot to run Sidekiq, you can run the Rake task to sync the models to Cloudflare's KV store

```bash
bundle exec rake atlas:sync
```

4. Make fixture files for the website (e.g. just a simple landing page)

```ruby
website.make_fixture_files
```

5. Deploy the website

```ruby
website.deploy! # Runs in Sidekiq by default, so ensure Sidekiq is still running
```

You should now see the files in the R2 bucket for the website

6. Visit the website

```bash
https://example.abeverything.com
```
