module GoogleAds
  class Keyword < Sync::Syncable
    def ad_group
      local_resource.ad_group
    end

    def campaign
      ad_group.campaign
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_criterion_id.present?

      query = %(
        SELECT ad_group_criterion.resource_name, ad_group_criterion.criterion_id, ad_group_criterion.ad_group, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status
        FROM ad_group_criterion
        WHERE ad_group_criterion.criterion_id = #{remote_criterion_id}
        AND ad_group_criterion.ad_group = 'customers/#{google_customer_id}/adGroups/#{google_ad_group_id}'
        AND ad_group_criterion.type = 'KEYWORD'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      criterion = results.first&.ad_group_criterion
      return nil unless criterion

      RemoteKeyword.new(
        resource_name: criterion.resource_name,
        criterion_id: criterion.criterion_id,
        ad_group: criterion.ad_group,
        text: criterion.keyword.text,
        match_type: criterion.keyword.match_type,
        status: criterion.status
      )
    end

    def sync_result
      return not_found_result(:ad_group_criterion) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :ad_group_criterion,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_criterion
      else
        create_criterion
      end
    end

    def delete
      return not_found_result(:ad_group_criterion) unless remote_resource

      resource_name = remote_resource.resource_name

      operation = client.operation.remove_resource.ad_group_criterion(resource_name)

      begin
        client.service.ad_group_criterion.mutate_ad_group_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_criterion, e)
      end

      local_resource.google_criterion_id = nil
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :ad_group_criterion,
        resource_name: nil,
        action: :deleted,
        comparisons: []
      )
    end

    private

    def remote_criterion_id
      local_resource.google_criterion_id
    end
    memoize :remote_criterion_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_ad_group_id
      ad_group.google_ad_group_id.to_s
    end

    def ad_group_resource_name
      "customers/#{google_customer_id}/adGroups/#{google_ad_group_id}"
    end

    def create_criterion
      operation = client.operation.create_resource.ad_group_criterion do |agc|
        agc.ad_group = ad_group_resource_name
        agc.keyword = client.resource.keyword_info do |k|
          k.text = local_resource.text
          k.match_type = local_resource.match_type.upcase.to_sym
        end
        agc.status = :ENABLED
      end

      begin
        response = client.service.ad_group_criterion.mutate_ad_group_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_criterion, e)
      end

      resource_name = response.results.first.resource_name
      criterion_id = resource_name.split("~").last.to_i
      local_resource.google_criterion_id = criterion_id

      verify_sync(:created, resource_name)
    end

    def update_criterion
      comparisons = build_comparisons
      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.ad_group_criterion(resource_name) do |agc|
        comparisons.each do |comparison|
          next if comparison.values_match?
          case comparison.their_field
          when :match_type
            agc.keyword = client.resource.keyword_info do |k|
              k.match_type = comparison.transformed_our_value
            end
          when :text
            agc.keyword = client.resource.keyword_info do |k|
              k.text = comparison.transformed_our_value
            end
          when :status
            agc.status = comparison.transformed_our_value
          end
        end
      end

      begin
        client.service.ad_group_criterion.mutate_ad_group_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_criterion, e)
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :ad_group_criterion,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_criterion_id)
    end

    class RemoteKeyword
      attr_reader :resource_name, :criterion_id, :ad_group, :text, :match_type, :status

      def initialize(resource_name:, criterion_id:, ad_group:, text:, match_type:, status:)
        @resource_name = resource_name
        @criterion_id = criterion_id
        @ad_group = ad_group
        @text = text
        @match_type = match_type
        @status = status
      end

      def keyword
        self
      end

      def synced?
        status != :REMOVED
      end
    end
  end
end
