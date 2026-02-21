# frozen_string_literal: true

module APISchemas
  module Google
    # GET /api/v1/google/status
    def self.status_response
      {
        type: :object,
        properties: {
          google_connected: {type: :boolean, description: "Whether the account has connected Google OAuth"},
          google_email: {type: :string, nullable: true, description: "The connected Google email address"},
          invite_accepted: {type: :boolean, description: "Whether the Google Ads invite has been accepted"},
          invite_status: {type: :string, description: "Current invite status (none, pending, accepted)"},
          invite_email: {type: :string, nullable: true, description: "The invited email address"},
          has_payment: {type: :boolean, description: "Whether Google Ads billing is enabled"},
          billing_status: {type: :string, description: "Current billing status (none, pending, approved)"}
        },
        required: %w[google_connected invite_accepted has_payment invite_status billing_status]
      }
    end

    # POST /api/v1/google/refresh_invite_status
    def self.refresh_invite_status_response
      {
        type: :object,
        properties: {
          accepted: {type: :boolean, description: "Whether the Google Ads invite has been accepted"},
          status: {type: :string, description: "Current invite status (none, pending, accepted)"},
          email: {type: :string, nullable: true, description: "The invited email address"}
        },
        required: %w[accepted status]
      }
    end
  end
end
