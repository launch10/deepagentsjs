Sidekiq.strict_args!(false)

# E2E test worker execution modes:
#
# SIDEKIQ_INLINE=true
#   Workers run synchronously inside the HTTP request.
#   Fast and deterministic. Class attributes (mocks) are visible.
#
# SIDEKIQ_THREADED=true
#   Workers run in background threads (same process, shared memory).
#   API returns immediately → deploy graph yields at "wait" points →
#   frontend receives progressive SSE updates → worker completes →
#   webhook resumes graph. Mocks are visible because threads share memory.
#
if Rails.env.test? && ENV["SIDEKIQ_INLINE"] == "true"
  require "sidekiq/testing"
  Sidekiq::Testing.inline!
end

if Rails.env.test? && ENV["SIDEKIQ_THREADED"] == "true"
  require "sidekiq/testing"

  # Track spawned threads so tests can wait for worker completion
  SIDEKIQ_THREADS = [] # rubocop:disable Style/MutableConstant

  module SidekiqThreadedPerformAsync
    def perform_async(*)
      klass = self
      jid = SecureRandom.hex(12)

      thread = Thread.new do
        Thread.current.name = "sidekiq-threaded-#{klass.name}-#{jid}"
        ActiveRecord::Base.connection_pool.with_connection do
          klass.new.perform(*)
        end
      rescue => e
        Rails.logger.error(
          "[SIDEKIQ_THREADED] #{klass} failed: #{e.message}\n#{e.backtrace&.first(5)&.join("\n")}"
        )
      end

      SIDEKIQ_THREADS << thread
      jid
    end
  end

  Sidekiq::Worker::ClassMethods.prepend(SidekiqThreadedPerformAsync)
end
