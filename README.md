# NicheFinder

NicheFinder consists of two main components that work together:

1. The Rails repo (built off Jumpstart Pro + inertia rails frontend)
2. The Langgraph repo (builds the landing pages, SEO plans, and deployments)

## Running Rails

```bash
cd rails
bin/dev
```

## Running Langgraph

```bash
cd langgraph
bin/dev
```

## Installation

```bash
cd langgraph_app
pnpm install
cd ../rails_app
bundle install
bundle exec rake db:create db:migrate db:seed
```
