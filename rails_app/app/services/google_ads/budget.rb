module GoogleAds
  class Budget < Sync::Syncable
    def sync_result
      remote_budget = fetch_budget
      return not_found_result(:campaign_budget) unless remote_budget

      comparisons = build_comparisons(:campaign_budget, expected_values, remote_budget)

      SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: remote_budget.resource_name,
        action: :unchanged,
        comparisons: comparisons
      )
    end

    def sync
      return true if synced?

      existing = fetch_budget
      if existing
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

    def fetch_budget
      return nil unless budget_id.present?

      query = %Q(
        SELECT campaign_budget.resource_name, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method
        FROM campaign_budget
        WHERE campaign_budget.id = #{budget_id}
      )

      results = client.service.google_ads.search(customer_id: customer_id, query: query)
      results.first&.campaign_budget
    end

    def attrs
      campaign.budget&.to_google_json || {}
    end

    def create_budget
      operation = client.operation.create_resource.campaign_budget do |budget|
        budget.amount_micros = attrs[:amount_micros]
      end

      response = client.service.campaign_budget.mutate_campaign_budgets(
        customer_id: customer_id,
        operations: [operation]
      )

      SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: response.results.first.resource_name,
        action: :created,
        comparisons: []
      )
    end

    def update_budget(existing, attrs, comparisons)
      operation = client.operation.update_resource.campaign_budget(existing.resource_name) do |budget|
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
        customer_id: customer_id,
        operations: [operation]
      )

      SyncResult.new(
        resource_type: :campaign_budget,
        resource_name: existing.resource_name,
        action: :updated,
        comparisons: comparisons
      )
    end
  end
end