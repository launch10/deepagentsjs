# Launch10

Launch10 consists of three main components that work together:

1. The Rails repo (built off Jumpstart Pro + inertia rails frontend)
2. The Langgraph repo (builds the landing pages, SEO plans, and deployments)
3. The Atlas repo (user-deployed landing pages built on Cloudflare Workers)

## After Pulling from GitHub

Run the prepare script in the root of the project, which will install dependencies for all three repos:

```bash
./scripts/prepare.sh
```

## Install Shared Dependencies

1. Install Redis

```bash
brew install redis
brew services start redis
```

2. Install Postgres

Recommended to install via Postgres.app. We use Postgres 16:

https://postgresapp.com/

3. Install Postgres Extensions

```bash
brew install pgvector
```

4. Install Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

## Running Frontend

```bash
cd rails_app
nvm use && pnpm install
bin/dev
```

## Running Rails Backend

```bash
cd rails_app
bundle exec rails s
```

## Running Rails Workers

```bash
cd rails_app
bundle exec sidekiq
```

## Running Langgraph Backend

```bash
cd langgraph_app
nvm use && pnpm install
pnpm run dev
```

## Running Langgraph Workers

```bash
cd langgraph_app
pnpm worker
```

## Installation

```bash
cd langgraph_app
nvm use && pnpm install
cd ../rails_app
bundle install
bundle exec rake db:create db:migrate db:seed
```
