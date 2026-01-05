module GoogleAds
  module Resources
    class Budget
      attr_reader :record

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(campaign)
          # Soft-deleted with budget_id means NOT synced (needs delete from Google)
          return false if campaign.budget&.deleted? && campaign.budget&.google_budget_id.present?

          # Active budget must be synced
          budget = campaign.budget
          return true unless budget # No budget = vacuously synced

          new(budget).synced?
        end

        def sync_all(campaign)
          results = []

          # Delete soft-deleted budget with Google ID
          if campaign.budget&.deleted? && campaign.budget&.google_budget_id
            results << new(campaign.budget).delete
          end

          # Sync active budget
          budget = campaign.budget
          results << new(budget).sync if budget && !budget.deleted?

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(campaign)
          operations = []

          # Plan deletion for soft-deleted budget
          if campaign.budget&.deleted? && campaign.budget&.google_budget_id
            operations << {
              action: :delete,
              record: campaign.budget,
              budget_id: campaign.budget.google_budget_id
            }
          end

          # Plan sync for active budget
          budget = campaign.budget
          if budget && !budget.deleted?
            operations.concat(new(budget).sync_plan.operations)
          end

          Sync::Plan.new(operations)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 methods)
      # ═══════════════════════════════════════════════════════════════

      def synced?
        remote = fetch
        return false unless remote

        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:campaign_budget, record.google_budget_id) if synced?

        if record.google_budget_id && fetch
          update
        else
          create
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_budget, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create, record: record }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          operations << { action: :update, record: record, fields: comparison.failures }
        else
          operations << { action: :unchanged, record: record }
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_budget) unless record.google_budget_id

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "budget_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_budget)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_budget, e)
      end

      def fetch
        fetch_by_id || fetch_by_name
      end

      def compare_fields(remote)
        FieldCompare.build do |c|
          c.check(:amount_micros, local: cents_to_micros, remote: remote.amount_micros) { cents_to_micros == remote.amount_micros }
          c.check(:name, local: record.google_budget_name, remote: remote.name) { record.google_budget_name == remote.name }
        end
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create
        operation = client.operation.create_resource.campaign_budget do |budget|
          budget.name = record.google_budget_name
          budget.amount_micros = cents_to_micros
          budget.delivery_method = :STANDARD
          budget.period = :DAILY
        end

        response = client.service.campaign_budget.mutate_campaign_budgets(
          customer_id: customer_id,
          operations: [operation]
        )

        save_budget_id(response)
        GoogleAds::SyncResult.created(:campaign_budget, record.google_budget_id)
      end

      def update
        remote = fetch
        resource_name = remote.resource_name

        operation = client.operation.update_resource.campaign_budget(resource_name) do |budget|
          comparison = compare_fields(remote)
          comparison.to_h.each do |field, result|
            next if result[:match]

            case field
            when :amount_micros
              budget.amount_micros = cents_to_micros
            when :name
              budget.name = record.google_budget_name
            end
          end
        end

        client.service.campaign_budget.mutate_campaign_budgets(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:campaign_budget, record.google_budget_id)
      end

      def remove_from_google
        remote = fetch
        raise Google::Ads::GoogleAds::Errors::GoogleAdsError.new("Budget not found in Google") unless remote

        operation = client.operation.remove_resource.campaign_budget(remote.resource_name)
        client.service.campaign_budget.mutate_campaign_budgets(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless record.google_budget_id.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_id_query
        )
        results.first&.campaign_budget
      end

      def fetch_by_name
        return nil unless record.google_budget_name.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_name_query
        )
        row = results.first
        return nil unless row

        # Backfill the ID if found by name
        backfill_budget_id(row.campaign_budget.id)
        row.campaign_budget
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def cents_to_micros
        (record.daily_budget_cents || 0) * 10_000
      end

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def save_budget_id(response)
        resource_name = response.results.first.resource_name
        budget_id = resource_name.split("/").last.to_i
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "budget_id" => budget_id }))
      end

      def backfill_budget_id(id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "budget_id" => id }))
      end

      def client
        GoogleAds.client
      end

      def customer_id
        campaign.google_customer_id.to_s
      end

      def campaign
        record.campaign
      end

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT campaign_budget.resource_name, campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method
          FROM campaign_budget
          WHERE campaign_budget.id = #{record.google_budget_id}
        GAQL
      end

      def fetch_by_name_query
        <<~GAQL.squish
          SELECT campaign_budget.resource_name, campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method
          FROM campaign_budget
          WHERE campaign_budget.name = '#{record.google_budget_name.gsub("'", "\\'")}'
        GAQL
      end
    end
  end
end
