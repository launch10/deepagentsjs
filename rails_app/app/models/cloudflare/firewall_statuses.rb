class Cloudflare
  module FirewallStatuses
    STATUS = %w[inactive blocked].freeze
    INACTIVE = "inactive"
    BLOCKED = "blocked"

    def blocked?
      status == "blocked"
    end

    def inactive?
      status == "inactive"
    end
  end
end
