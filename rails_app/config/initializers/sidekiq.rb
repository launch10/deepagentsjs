Sidekiq.strict_args!(false)

# In test environment, run jobs inline so E2E tests don't need Sidekiq running
if Rails.env.test?
  require "sidekiq/testing"
  Sidekiq::Testing.inline!
end
