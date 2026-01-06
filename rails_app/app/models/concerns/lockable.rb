module Lockable
  extend ActiveSupport::Concern

  class LockNotAcquiredError < StandardError; end

  # Static class methods - can be used without including the concern
  class << self
    def with_lock(key, wait_timeout: 0.1, stale_timeout: 60 * 10, resources: 1)
      client = lock_client(key, wait_timeout: wait_timeout, stale_timeout: stale_timeout, resources: resources)
      token = client.lock
      raise LockNotAcquiredError, "Could not acquire lock for #{key}" unless token

      begin
        yield client
      ensure
        client.unlock(token)
      end
    end

    def lock_client(key, wait_timeout: 0.1, stale_timeout: 60 * 10, resources: 1)
      Suo::Client::Redis.new(key, {
        acquisition_lock: wait_timeout,
        stale_lock_expiration: stale_timeout,
        resources: resources,
        client: redis_client
      })
    end

    def locked?(key)
      lock_client(key).locked?
    end

    def locks(key)
      lock_client(key).locks
    end

    # Force-unlock all locks for a key - useful for cleanup/stuck jobs
    def unlock!(key)
      client = lock_client(key)
      client.locks.map(&:last).each do |lock_token|
        client.unlock(lock_token)
      end
    end

    def redis_client
      @redis_client ||= Redis.new(host: ENV.fetch("REDIS_HOST", "localhost"))
    end
  end

  # Instance methods available when included as concern
  class_methods do
    def with_lock(key, wait_timeout: 0.1, stale_timeout: 60 * 10, resources: 1, &)
      Lockable.with_lock(key, wait_timeout: wait_timeout, stale_timeout: stale_timeout, resources: resources, &)
    end

    def lock_client(key, **)
      Lockable.lock_client(key, **)
    end

    def locked?(key)
      Lockable.locked?(key)
    end

    def unlock!(key)
      Lockable.unlock!(key)
    end
  end
end
