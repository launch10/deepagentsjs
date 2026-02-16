module Deploys
  class FullResetService
    def initialize(deploy)
      @deploy = deploy
      @account = deploy.project.account
      @project = deploy.project
    end

    def call
      cleanup_google_ads_remote
      cleanup_google_ads_local
      cleanup_oauth
      clear_campaign_sync_state
      cleanup_campaign_deploys
      cleanup_langgraph_thread
      destroy_deploy
    end

    private

    def cleanup_google_ads_remote
      @project.campaigns.each do |campaign|
        campaign.google_delete if campaign.google_campaign_id.present?
      end

      @account.dangerously_destroy_google_ads_account!
    rescue => e
      Rails.logger.warn("[FullResetService] Google API cleanup failed: #{e.message}")
    end

    def cleanup_google_ads_local
      @account.google_ads_account&.destroy
    end

    def cleanup_oauth
      @account.google_connected_account&.destroy
    end

    def clear_campaign_sync_state
      @project.campaigns.each do |campaign|
        clear_google_ids(campaign, :campaign_id, :status)
        campaign.ad_groups.with_deleted.each do |ag|
          clear_google_ids(ag, :ad_group_id, :status)
          ag.ads.with_deleted.each { |ad| clear_google_ids(ad, :ad_id) }
          ag.keywords.each { |kw| clear_google_ids(kw, :criterion_id) }
        end
        campaign.budget&.then { |b| clear_google_ids(b, :budget_id) }
      end
    end

    def clear_google_ids(record, *fields)
      return unless record.respond_to?(:platform_settings)

      google = record.platform_settings&.dig("google") || {}
      fields.each { |f| google.delete(f.to_s) }
      record.update_column(:platform_settings, record.platform_settings.merge("google" => google))
    end

    def cleanup_campaign_deploys
      @project.campaigns.each do |campaign|
        campaign.campaign_deploys.destroy_all
      end
    end

    def cleanup_langgraph_thread
      return unless @deploy.thread_id.present?

      LanggraphClient.new.delete("/api/deploy/thread/#{@deploy.thread_id}")
    rescue => e
      Rails.logger.warn("[FullResetService] Failed to delete langgraph checkpoints: #{e.message}")
    end

    def destroy_deploy
      @deploy.destroy!
    end
  end
end
