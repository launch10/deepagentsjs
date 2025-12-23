module GoogleAds
  class LocationTarget < Sync::Syncable
    def campaign
      local_resource.campaign
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
        SELECT campaign_criterion.resource_name, campaign_criterion.criterion_id, campaign_criterion.campaign, campaign_criterion.location.geo_target_constant, campaign_criterion.negative
        FROM campaign_criterion
        WHERE campaign_criterion.criterion_id = #{remote_criterion_id}
        AND campaign_criterion.campaign = 'customers/#{google_customer_id}/campaigns/#{google_campaign_id}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.campaign_criterion
    end

    def sync_result
      return not_found_result(:campaign_criterion) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
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
      return not_found_result(:campaign_criterion) unless remote_resource

      resource_name = "customers/#{google_customer_id}/campaignCriteria/#{google_campaign_id}~#{remote_criterion_id}"

      operation = client.operation.remove_resource.campaign_criterion(resource_name)

      begin
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      local_resource.google_remote_criterion_id = nil
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
        resource_name: resource_name,
        action: :deleted,
        comparisons: []
      )
    end

    private

    def remote_criterion_id
      local_resource.google_remote_criterion_id
    end
    memoize :remote_criterion_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def create_criterion
      operation = client.operation.create_resource.campaign_criterion do |cc|
        cc.campaign = campaign_resource_name
        cc.location = client.resource.location_info do |li|
          li.geo_target_constant = local_resource.google_criterion_id
        end
        cc.negative = !local_resource.targeted
      end

      begin
        response = client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      resource_name = response.results.first.resource_name
      criterion_id = resource_name.split("~").last.to_i
      local_resource.google_remote_criterion_id = criterion_id

      verify_sync(:created, resource_name)
    end

    def update_criterion
      comparisons = build_comparisons
      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.campaign_criterion(resource_name) do |cc|
        comparisons.each do |comparison|
          next if comparison.values_match?
          case comparison.their_field
          when :negative
            cc.negative = comparison.transformed_our_value
          end
        end
      end

      begin
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
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
