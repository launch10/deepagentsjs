require_relative "google_ads_responses"

module Testing
  class E2eGoogleAdsClient
    attr_accessor :invite_status

    def service
      E2eService.new(self)
    end

    def resource
      E2eResourceBuilder.new
    end

    def operation
      E2eOperationBuilder.new
    end

    class E2eService
      def initialize(client)
        @client = client
      end

      def google_ads
        E2eGoogleAdsService.new(@client)
      end

      def customer_user_access_invitation
        E2eInvitationService.new(@client)
      end
    end

    class E2eGoogleAdsService
      def initialize(client)
        @client = client
      end

      def search(customer_id:, query:)
        status = @client.invite_status

        if query.include?("customer_user_access") && !query.include?("invitation")
          (status == "accepted") ? [GoogleAdsResponses.user_access_row] : []
        elsif query.include?("customer_user_access_invitation")
          (status && status != "accepted") ? [GoogleAdsResponses.invitation_row(status: status)] : []
        else
          []
        end
      end
    end

    class E2eInvitationService
      def initialize(client)
        @client = client
      end

      def mutate_customer_user_access_invitation(customer_id:, operation:)
        GoogleAdsResponses.mutate_invitation_response(customer_id: customer_id)
      end
    end

    class E2eResourceBuilder
      def customer_user_access_invitation
        invitation = OpenStruct.new
        yield invitation if block_given?
        invitation
      end
    end

    class E2eOperationBuilder
      def create_resource
        E2eCreateResource.new
      end
    end

    class E2eCreateResource
      def customer_user_access_invitation(invitation)
        invitation
      end
    end
  end
end
