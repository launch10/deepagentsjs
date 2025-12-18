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

    def build_comparisons
      return [] unless local_resource && remote_resource

      field_mappings = Sync::FieldMappings.for(local_resource.class)
      comparisons = []

      field_mappings.each do |_key, mapping|
        our_field = mapping[:our_field]
        our_value = local_resource.respond_to?(our_field) ? local_resource.send(our_field) : nil
        next if our_value.nil?

        their_value = if mapping[:nested_field]
          nested = remote_resource.respond_to?(mapping[:nested_field]) ? remote_resource.send(mapping[:nested_field]) : nil
          nested&.respond_to?(mapping[:their_field]) ? nested.send(mapping[:their_field]) : nil
        else
          remote_resource.respond_to?(mapping[:their_field]) ? remote_resource.send(mapping[:their_field]) : nil
        end

        comparisons << Sync::FieldComparison.new(
          field: our_field,
          our_field: mapping[:our_field],
          our_value: our_value,
          their_field: mapping[:their_field],
          their_value: their_value,
          transform: mapping[:transform]
        )
      end

      comparisons
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
      results.first&.ad_group_criterion
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
  end
end
