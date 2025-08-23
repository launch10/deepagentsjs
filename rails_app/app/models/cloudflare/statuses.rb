class Cloudflare
  class Statuses < ApplicationRecord
    STATUS = %w[inactive blocked]
    enum status: STATUS

    def blocked?
      status == "blocked"
    end

    def inactive?
      status == "inactive"
    end
  end
end