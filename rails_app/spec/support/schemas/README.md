# Shared Rswag Schema Definitions

This directory contains reusable schema definitions for rswag/OpenAPI documentation.

## Why Use Shared Schemas?

1. **DRY Principle** - Define schemas once, use them everywhere
2. **Consistency** - Ensures all endpoints document responses the same way
3. **Maintainability** - Update schema in one place, affects all usages
4. **Type Safety** - Centralized definitions reduce errors

## Problem with Helper Methods

You cannot use instance methods or `let` blocks for schemas because they're evaluated at the class level:

```ruby
# ❌ This DOESN'T work:
def brainstorm_response
  { type: :object, properties: { id: { type: :integer } } }
end

response '200', 'success' do
  schema **brainstorm_response  # ERROR: method not available here!
end
```

## Solution: Module-Based Schemas

Use class methods in modules that return schema hashes:

```ruby
# ✅ This WORKS:
module ApiSchemas
  module Brainstorm
    def self.response
      { type: :object, properties: { id: { type: :integer } } }
    end
  end
end

response '200', 'success' do
  schema ApiSchemas::Brainstorm.response  # ✅ Works perfectly!
end
```

## Available Schemas

### Base Schemas (`base_schemas.rb`)

Common building blocks for all API schemas:

- `ApiSchemas.id_field` - Standard ID field with description
- `ApiSchemas.timestamp_field` - Timestamp with date-time format
- `ApiSchemas.uuid_field` - UUID field with format validation
- `ApiSchemas.timestamps` - created_at and updated_at fields
- `ApiSchemas.error_response` - Standard error response format
- `ApiSchemas.success_response` - Standard success response format

### Brainstorm Schemas (`brainstorm_schemas.rb`)

Brainstorm-specific schemas:

- `ApiSchemas::Brainstorm.response` - Brainstorm object response
- `ApiSchemas::Brainstorm.params_schema` - Create/update parameters

### Database Schemas (`database_schemas.rb`)

Test database API schemas:

- `ApiSchemas::Database.snapshots_response` - List of snapshots
- `ApiSchemas::Database.snapshot_params` - Snapshot parameters
- `ApiSchemas::Database.operation_response` - Success response
- `ApiSchemas::Database.error_response` - Error response

## Usage Examples

### Basic Usage

```ruby
require 'swagger_helper'

RSpec.describe "API Endpoint", type: :request do
  path '/brainstorms' do
    post 'Creates a brainstorm' do
      # Use shared parameter schema
      parameter name: :brainstorm_params,
                in: :body,
                schema: ApiSchemas::Brainstorm.params_schema

      # Use shared response schema
      response '201', 'brainstorm created' do
        schema ApiSchemas::Brainstorm.response

        run_test! do |response|
          # Test implementation
        end
      end
    end
  end
end
```

### Composing Schemas

Combine base schemas with resource-specific fields:

```ruby
module ApiSchemas
  module MyResource
    def self.response
      {
        type: :object,
        properties: {
          id: ApiSchemas.id_field,
          name: { type: :string },
          **ApiSchemas.timestamps  # Spread timestamps
        },
        required: ['id', 'name']
      }
    end
  end
end
```

### Error Responses

Use standard error schemas for consistency:

```ruby
response '404', 'not found' do
  schema ApiSchemas.error_response
end

response '422', 'validation failed' do
  schema ApiSchemas.error_response
end
```

## Creating New Schemas

When adding new API endpoints:

1. **Determine if you need a new schema file:**
   - For new resources, create a new file: `spec/support/schemas/my_resource_schemas.rb`
   - For one-off schemas, add to an existing file if related

2. **Follow the naming convention:**
   ```ruby
   module ApiSchemas
     module MyResource
       def self.response
         # schema definition
       end

       def self.params_schema
         # parameter schema
       end
     end
   end
   ```

3. **Reuse base schemas when possible:**
   - Use `ApiSchemas.id_field` instead of `{ type: :integer }`
   - Use `ApiSchemas.timestamps` for created_at/updated_at
   - Use `ApiSchemas.error_response` for error responses

4. **Document with descriptions:**
   ```ruby
   {
     type: :object,
     properties: {
       name: {
         type: :string,
         description: 'Human-readable name for the resource'
       }
     }
   }
   ```

## Loading Schemas

Schemas are automatically loaded by RSpec through the support directory. No explicit requires needed in spec files.

## Testing

To verify schemas work correctly:

```bash
# Test a specific spec
bundle exec rspec spec/requests/my_resource_spec.rb

# Generate Swagger docs (validates all schemas)
bundle exec rake rswag:specs:swaggerize

# View generated docs
# Start Rails server, then visit http://localhost:3000/api-docs
```

## Common Patterns

### List Response

```ruby
def self.list_response
  {
    type: :object,
    properties: {
      items: {
        type: :array,
        items: response  # Reuse single item schema
      },
      total: { type: :integer }
    }
  }
end
```

### Nested Resources

```ruby
def self.response
  {
    type: :object,
    properties: {
      id: ApiSchemas.id_field,
      user: ApiSchemas::User.response,  # Nested user
      **ApiSchemas.timestamps
    }
  }
end
```

### Optional Fields

```ruby
def self.response
  {
    type: :object,
    properties: {
      id: { type: :integer },
      optional_field: { type: :string }
    },
    required: ['id']  # Only id is required
  }
end
```

## Benefits

✅ **Consistency** - All endpoints document the same fields the same way
✅ **Maintainability** - Update once, fixes everywhere
✅ **Discoverability** - Developers know where to find schema definitions
✅ **Validation** - rswag validates responses match schemas during tests
✅ **Documentation** - Auto-generated API docs are always accurate

## Troubleshooting

### "Method not available" error

If you see this error, you're trying to use an instance method at class level. Use module class methods instead:

```ruby
# ❌ Wrong
def my_schema
  { ... }
end

# ✅ Right
module ApiSchemas
  def self.my_schema
    { ... }
  end
end
```

### Schema not found

Ensure your schema file is in `spec/support/schemas/` and follows the naming pattern `*_schemas.rb`.

### Changes not reflected

After modifying schemas, regenerate docs:

```bash
bundle exec rake rswag:specs:swaggerize
```
