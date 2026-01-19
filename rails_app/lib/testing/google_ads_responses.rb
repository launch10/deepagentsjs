module Testing
  module GoogleAdsResponses
    def self.invitation_row(status:, email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access_invitation: OpenStruct.new(
          resource_name: "customers/123/customerUserAccessInvitations/456",
          email_address: email,
          access_role: :ADMIN,
          invitation_status: status.to_s.upcase.to_sym,
          creation_date_time: Time.current.iso8601
        ),
        customer_user_access: nil
      )
    end

    def self.user_access_row(email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access: OpenStruct.new(
          resource_name: "customers/123/customerUserAccess/789",
          email_address: email,
          access_role: :ADMIN,
          access_creation_date_time: Time.current.iso8601
        ),
        customer_user_access_invitation: nil
      )
    end

    def self.mutate_invitation_response(customer_id:)
      OpenStruct.new(
        result: OpenStruct.new(
          resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{rand(10000)}"
        )
      )
    end
  end
end
