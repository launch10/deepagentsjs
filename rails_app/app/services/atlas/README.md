# Atlas Admin Service Integration

This module provides a Ruby/Rails client for the Atlas admin service (Cloudflare Worker).

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
# List all users
users = Atlas.users.list(limit: 10)

# Get a specific user
user = Atlas.users.find('user-123')

# Create a new user
user = Atlas.users.create(
  id: 'user-456',
  plan_id: 'plan-pro'
)

# Update a user
Atlas.users.update('user-456', planId: 'plan-enterprise')

# Delete a user
Atlas.users.destroy('user-456')
```

### Website Management

```ruby
# List websites
websites = Atlas.websites.list(user_id: 'user-123')

# Find website by URL
website = Atlas.websites.find_by_url('https://example.com')

# Get a specific website
website = Atlas.websites.find('website-123')

# Create a new website
website = Atlas.websites.create(
  id: 'website-456',
  url: 'https://mywebsite.com',
  user_id: 'user-123'
)

# Update a website
Atlas.websites.update('website-456', url: 'https://newdomain.com')

# Delete a website
Atlas.websites.destroy('website-456')
```

### Plan Management

```ruby
# List all plans
plans = Atlas.plans.list

# Get a specific plan
plan = Atlas.plans.find('plan-pro')

# Create a new plan
plan = Atlas.plans.create(
  id: 'plan-enterprise',
  name: 'Enterprise',
  usage_limit: 10000
)

# Update a plan
Atlas.plans.update('plan-enterprise', usage_limit: 20000)

# Delete a plan
Atlas.plans.destroy('plan-enterprise')
```

### Deployment

```ruby
# Simple deployment
Atlas.deploy(
  website_id: 'website-123',
  files: {
    'index.html' => { content: '<h1>Hello World</h1>', type: 'text/html' },
    'style.css' => { content: 'body { color: red; }', type: 'text/css' }
  }
)

# Deploy a Rails project
project = Project.find(123)
Atlas.deployments.deploy_project(project)

# Deploy with custom config
Atlas.deployments.deploy(
  website_id: 'website-123',
  files: files_hash,
  config: {
    projectId: project.id,
    version: '2.0.0',
    metadata: { environment: 'production' }
  }
)
```

### Health Checks

```ruby
# Check service health
status = Atlas.health.check
# => { status: 'healthy' }

# Root health check
status = Atlas.health.root_check
```

## Error Handling

```ruby
begin
  website = Atlas.websites.find('website-123')
rescue Atlas::BaseService::NotFoundError => e
  # Handle 404 errors
  Rails.logger.error "Website not found: #{e.message}"
rescue Atlas::BaseService::ValidationError => e
  # Handle validation errors (400)
  Rails.logger.error "Invalid request: #{e.message}"
rescue Atlas::BaseService::AuthenticationError => e
  # Handle auth errors (401/403)
  Rails.logger.error "Authentication failed: #{e.message}"
rescue Atlas::BaseService::ServerError => e
  # Handle server errors (500+)
  Rails.logger.error "Server error: #{e.message}"
rescue Atlas::BaseService::Error => e
  # Handle any other Atlas errors
  Rails.logger.error "Atlas error: #{e.message}"
end
```

## Testing

In your specs, you can mock the Atlas services:

```ruby
# spec/support/atlas_helpers.rb
RSpec.configure do |config|
  config.before(:each) do
    Atlas.reset!
  end
end

# In your specs
RSpec.describe MyController do
  before do
    allow(Atlas.websites).to receive(:create).and_return({ id: 'website-123' })
  end

  it 'creates a website' do
    # Your test
  end
end
```

## Logging

All requests are automatically logged with timing information:

```
[Atlas] GET /api/internal/websites - 125.5ms
[Atlas] POST /api/internal/deploy - 2500.0ms
```

Debug logging (with params) is available in development mode.

## Integration with ActiveJob

For long-running deployments, consider using background jobs:

```ruby
class DeployProjectJob < ApplicationJob
  def perform(project_id)
    project = Project.find(project_id)

    result = Atlas.deployments.deploy_project(project)

    project.update!(
      deployment_status: 'deployed',
      deployed_at: Time.current,
      deployment_result: result
    )
  rescue Atlas::BaseService::Error => e
    project.update!(
      deployment_status: 'failed',
      deployment_error: e.message
    )
    raise # Re-raise for job retry logic
  end
end
```
