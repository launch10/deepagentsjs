module GoogleAds
  module Resources
    class AccountInvitation
      include FieldMappable
      extend Memoist

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :email_address,
        local: :email_address,
        remote: :email_address

      field_mapping :access_role,
        local: :google_access_role,
        remote: :access_role,
        transform: Transforms::TO_SYMBOL

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # PUBLIC API
      # ═══════════════════════════════════════════════════════════════

      def synced?
        remote_resource.present?
      end
      memoize :synced?

      def sync
        return sync_result if remote_resource&.accepted?

        if remote_resource&.pending?
          sync_result
        else
          create_invitation
        end
      end

      def delete
        not_found_result(:customer_user_access_invitation)
      end

      def fetch
        fetch_remote
      end

      def refresh_status
        flush_cache(:remote_resource)
        flush_cache(:synced?)

        remote = fetch_remote
        return not_found_result(:customer_user_access_invitation) unless remote

        resource_type = remote.accepted? ? :customer_user_access : :customer_user_access_invitation

        Sync::SyncResult.new(
          resource_type: resource_type,
          resource_name: remote.resource_name,
          action: status_action(remote),
          comparisons: []
        )
      end

      def sync_result
        return not_found_result(:customer_user_access_invitation) unless remote_resource

        resource_type = remote_resource.accepted? ? :customer_user_access : :customer_user_access_invitation

        Sync::SyncResult.new(
          resource_type: resource_type,
          resource_name: remote_resource.resource_name,
          action: :unchanged,
          comparisons: []
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # PRIVATE METHODS
      # ═══════════════════════════════════════════════════════════════

      private

      def client
        GoogleAds.client
      end

      def customer_id
        record.customer_id
      end
      memoize :customer_id

      def remote_resource
        fetch_remote
      end
      memoize :remote_resource

      def fetch_remote
        return nil unless customer_id.present?

        user_access = fetch_user_access
        return RemoteInvitation.from_user_access(user_access) if user_access

        invitation = fetch_invitation
        return RemoteInvitation.from_invitation(invitation) if invitation

        nil
      end

      def status_action(remote)
        case remote.status
        when :ACCEPTED then :updated
        when :PENDING then :unchanged
        when :DECLINED then :declined
        when :EXPIRED then :expired
        else :unchanged
        end
      end

      def fetch_user_access
        query = <<~QUERY
          SELECT
            customer_user_access.resource_name,
            customer_user_access.email_address,
            customer_user_access.access_role,
            customer_user_access.access_creation_date_time
          FROM customer_user_access
          WHERE customer_user_access.email_address = '#{record.email_address.gsub("'", "\\\\'")}'
        QUERY

        response = client.service.google_ads.search(
          customer_id: customer_id,
          query: query
        )

        response.first&.customer_user_access
      end

      def fetch_invitation
        query = <<~QUERY
          SELECT
            customer_user_access_invitation.resource_name,
            customer_user_access_invitation.email_address,
            customer_user_access_invitation.access_role,
            customer_user_access_invitation.invitation_status,
            customer_user_access_invitation.creation_date_time
          FROM customer_user_access_invitation
          WHERE customer_user_access_invitation.email_address = '#{record.email_address.gsub("'", "\\\\'")}'
        QUERY

        response = client.service.google_ads.search(
          customer_id: customer_id,
          query: query
        )

        response.first&.customer_user_access_invitation
      end

      def create_invitation
        raise ArgumentError, "Customer ID is required" unless customer_id.present?
        raise ArgumentError, "Email address is required" unless record.email_address.present?

        invitation = client.resource.customer_user_access_invitation do |i|
          i.email_address = record.email_address
          i.access_role = record.google_access_role.to_sym
        end

        operation = client.operation.create_resource.customer_user_access_invitation(invitation)

        response = client.service.customer_user_access_invitation.mutate_customer_user_access_invitation(
          customer_id: customer_id,
          operation: operation
        )

        result = Sync::SyncResult.new(
          resource_type: :customer_user_access_invitation,
          resource_name: response.result.resource_name,
          action: :created,
          comparisons: []
        )

        # Callback: update the record after successful sync
        update_record_from_sync_result(result) if result.success?

        result
      end

      def update_record_from_sync_result(result)
        return unless result.resource_name.present?

        if result.resource_type == :customer_user_access_invitation
          record.google_invitation_id = result.resource_name.split("/").last
          record.google_status = "sent"
          record.google_sent_at = Time.current.iso8601
        elsif result.resource_type == :customer_user_access
          record.google_user_access_id = result.resource_name.split("/").last
          record.google_status = "accepted"
          record.google_accepted_at = Time.current.iso8601
        end

        record.save!
      end

      def not_found_result(resource_type)
        Sync::SyncResult.new(
          resource_type: resource_type,
          resource_name: nil,
          action: :not_found,
          comparisons: []
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # REMOTE INVITATION VALUE OBJECT
      # ═══════════════════════════════════════════════════════════════

      class RemoteInvitation
        attr_reader :resource_name, :email_address, :access_role, :status, :created_at

        def initialize(resource_name:, email_address:, access_role:, status:, created_at:)
          @resource_name = resource_name
          @email_address = email_address
          @access_role = access_role
          @status = status
          @created_at = created_at
        end

        def self.from_user_access(user_access)
          return nil unless user_access

          new(
            resource_name: user_access.resource_name,
            email_address: user_access.email_address,
            access_role: user_access.access_role,
            status: :ACCEPTED,
            created_at: user_access.access_creation_date_time
          )
        end

        def self.from_invitation(invitation)
          return nil unless invitation

          new(
            resource_name: invitation.resource_name,
            email_address: invitation.email_address,
            access_role: invitation.access_role,
            status: invitation.invitation_status,
            created_at: invitation.creation_date_time
          )
        end

        def accepted?
          status == :ACCEPTED
        end

        def pending?
          status == :PENDING
        end

        def declined?
          status == :DECLINED
        end

        def expired?
          status == :EXPIRED
        end
      end
    end
  end
end
