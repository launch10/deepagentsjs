# NicheFinder

NicheFinder consists of two main components that work together:

1. The Rails repo (built off Jumpstart Pro + inertia rails frontend)
2. The Langgraph repo (builds the landing pages, SEO plans, and deployments)

## Running Frontend

```bash
cd rails_app
bin/dev
```

## Running Rails Backend

```bash
cd rails_app
bundle exec rails s
```

## Running Langgraph Backend

```bash
cd langgraph_app
bin/dev # or directly run langdev dev
```

## Installation

```bash
cd langgraph_app
pnpm install
cd ../rails_app
bundle install
bundle exec rake db:create db:migrate db:seed
```
