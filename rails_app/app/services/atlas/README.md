# Atlas Admin Service Integration

This module provides a Ruby/Rails client for the Atlas admin service (Cloudflare Worker).

You DO NOT need to interact with this service directly. Models that inherit from `Atlas::Syncable` will automatically sync to Atlas when they are created, updated, or destroyed.

This allows us to create websites for users, and have them automatically registered into Cloudflare KV when they are deployed.

## Configuration

Configure in `config/initializers/atlas.rb` or via environment variables:

```ruby
Atlas.configure do |config|
  config.base_url = 'https://atlas-admin.your-domain.com'
  config.api_secret = 'your-shared-secret'
  config.timeout = 30
end
```

Environment variables:

- `ATLAS_BASE_URL` - Base URL of the Atlas service
- `ATLAS_API_SECRET` - Shared secret for HMAC authentication
- `ATLAS_TIMEOUT` - Request timeout in seconds

## Usage Examples

### User Management

```ruby
# List all accounts
accounts = Atlas.accounts.list(limit: 10)

# Get a specific account
account = Atlas.accounts.find(1)

# Create a new account
account = Atlas.accounts.create(
  id: 'account-456',
  plan_id: 'plan-pro'
)

# Update a user
Atlas.accounts.update(1, planId: 'plan-enterprise')

# Delete a user
Atlas.accounts.destroy(1)
```

### Website Management

```ruby
# List websites
websites = Atlas.websites.list(account_id: 1)

# Find website by URL
website = Atlas.websites.find_by_url('https://example.com')

# Get a specific website
website = Atlas.websites.find(1)

# Create a new website
website = Atlas.websites.create(
  id: 1,
  url: 'https://mywebsite.com',
  account_id: 1
)

# Update a website
Atlas.websites.update(1, url: 'https://newdomain.com')

# Delete a website
Atlas.websites.destroy(1)
```

### Plan Management

```ruby
# List all plans
plans = Atlas.plans.list

# Get a specific plan
plan = Atlas.plans.find(1)

# Create a new plan
plan = Atlas.plans.create(
  id: 1,
  name: 'Enterprise',
  usage_limit: 10000
)

# Update a plan
Atlas.plans.update(1, usage_limit: 20000)

# Delete a plan
Atlas.plans.destroy(1)
```
