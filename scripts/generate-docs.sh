#!/bin/bash
# Generate Swagger/OpenAPI documentation from Rails request specs

set -e

cd "$(dirname "$0")/.."

echo "🔄 Generating Swagger documentation..."
cd rails_app
bundle exec rake rswag:specs:swaggerize

echo "✅ Swagger documentation generated successfully!"
echo "📄 Location: rails_app/swagger/v1/swagger.yaml"