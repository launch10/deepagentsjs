class Cloudflare
  module FirewallStatuses
    STATUS = %w[inactive blocked].freeze

    def blocked?
      status == "blocked"
    end

    def inactive?
      status == "inactive"
    end
  end
end