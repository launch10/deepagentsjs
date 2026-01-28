# frozen_string_literal: true

module APISchemas
  module Credit
    # Credit check response schema
    def self.check_response
      {
        type: :object,
        properties: {
          ok: {type: :boolean, description: "Whether the account can proceed (has positive balance)"},
          balance_millicredits: {type: :integer, description: "Total balance in millicredits"},
          plan_millicredits: {type: :integer, description: "Plan credits in millicredits (expire at renewal)"},
          pack_millicredits: {type: :integer, description: "Pack credits in millicredits (persist until used)"}
        },
        required: %w[ok balance_millicredits plan_millicredits pack_millicredits]
      }
    end
  end
end
