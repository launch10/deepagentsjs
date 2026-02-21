# frozen_string_literal: true

module APISchemas
  module CreditPackCheckout
    def self.create_response
      {
        type: :object,
        properties: {
          client_secret: {type: :string, description: "Stripe checkout session client secret"}
        },
        required: %w[client_secret]
      }
    end
  end
end
