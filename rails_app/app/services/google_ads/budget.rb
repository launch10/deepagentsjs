module GoogleAds
  class Budget < Sync::Syncable
    def local_resource
      campaign.budget
    end

    def fetch_remote
      fetch_by_id || fetch_by_name
    end

    def fetch_by_id
      return nil unless budget_id.present?

      query = %Q(
        SELECT campaign_budget.resource_name, campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method
        FROM campaign_budget
        WHERE campaign_budget.id = #{budget_id}
      )

      results = client.service.google_ads.search(customer_id: campaign.google_customer_id.to_s, query: query)
      results.first&.campaign_budget
    end

    def fetch_by_name
      budget_name = local_resource&.google_budget_name
      return nil unless budget_name.present?

      query = %Q(
        SELECT campaign_budget.resource_name, campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method
        FROM campaign_budget
        WHERE campaign_budget.name = '#{budget_name}'
      )

      results = client.service.google_ads.search(customer_id: campaign.google_customer_id.to_s, query: query)
      budget = results.first&.campaign_budget
      return nil unless budget

      local_resource.google_budget_id = budget.id
      budget
    end

    def sync_result
      return not_found_result(:campaign_budget) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return true if synced?

      if remote_resource
        update_budget
      else
        create_budget
      end
    end

  private
    def budget_id
      campaign.budget&.google_budget_id
    end
    memoize :budget_id

    def attrs
      local_resource&.to_google_json || {}
    end

    def create_budget
      operation = client.operation.create_resource.campaign_budget do |budget|
        budget.name = attrs[:name]
        budget.amount_micros = attrs[:amount_micros]
        budget.delivery_method = :STANDARD
        budget.period = :DAILY
      end

      begin
        response = client.service.campaign_budget.mutate_campaign_budgets(
          customer_id: campaign.google_customer_id.to_s,
          operations: [operation]
        )
      rescue => e
        return error_result(:budget, e)
      end

      Sync::SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: response.results.first.resource_name,
        action: :created,
        comparisons: []
      )
    end

    def update_budget
      comparisons = build_comparisons

      operation = client.operation.update_resource.campaign_budget(remote_resource.resource_name) do |budget|
        comparisons.each do |comparison|
          next if comparison.values_match?
          case comparison.their_field
          when :amount_micros
            budget.amount_micros = comparison.transformed_our_value
          when :delivery_method
            budget.delivery_method = comparison.transformed_our_value
          when :name
            budget.name = comparison.transformed_our_value
          end
        end
      end

      client.service.campaign_budget.mutate_campaign_budgets(
        customer_id: campaign.google_customer_id.to_s,
        operations: [operation]
      )

      Sync::SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: remote_resource.resource_name,
        action: :updated,
        comparisons: comparisons
      )
    end
  end
end