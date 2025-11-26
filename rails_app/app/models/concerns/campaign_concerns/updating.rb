module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    def update_idempotently!(params)
      IdempotentCampaignUpdater.new(self, params).update!
    end

    # Update inside class to avoid exposing tons of instance methods to the main campaign class
    class IdempotentCampaignUpdater
      attr_reader :campaign, :params

      def initialize(campaign, params={})
        @campaign = campaign
        @params = params
      end

      def update!
        Campaign.transaction do
          update_regular_attrs!
          update_idempotent_attrs!
        end
      end

      def update_regular_attrs!
        regular_params = params.deep_dup
        # Remove idempotent attributes from regular_params (they need special handling)
        regular_params[:ad_groups_attributes]&.each do |ag_attrs|
          ag_attrs.delete(:keywords_attributes)

          ag_attrs[:ads_attributes]&.each do |ad_attrs|
            ad_attrs.delete(:headlines_attributes)
            ad_attrs.delete(:descriptions_attributes)
          end
        end

        regular_params.delete(:callouts_attributes)
        regular_params.delete(:structured_snippet_attributes)

        campaign.update!(regular_params)
      end

      def update_idempotent_attrs!
        idempotent_params = params.deep_dup

        # Handle idempotent attributes
        if idempotent_params[:ad_groups_attributes].present?
          idempotent_params[:ad_groups_attributes].each do |ad_group_attrs|
            ad_group = campaign.ad_groups.find_by(id: ad_group_attrs[:id])
            next unless ad_group

            if ad_group_attrs[:ads_attributes].present?
              ad_group_attrs[:ads_attributes].each do |ad_attrs|
                next unless ad_attrs[:id]

                ad = ad_group.ads.find_by(id: ad_attrs[:id])
                next unless ad

                replace_ad_headlines(ad, ad_attrs[:headlines_attributes]) if ad_attrs[:headlines_attributes]
                replace_ad_descriptions(ad, ad_attrs[:descriptions_attributes]) if ad_attrs[:descriptions_attributes]
              end
            end

            replace_keywords(ad_group, ad_group_attrs[:keywords_attributes]) if ad_group_attrs[:keywords_attributes]
          end
        end

        replace_callouts(idempotent_params[:callouts_attributes]) if idempotent_params[:callouts_attributes]
        replace_structured_snippet(idempotent_params[:structured_snippet_attributes]) if idempotent_params[:structured_snippet_attributes]

        true
      end

      def replace_ad_headlines(ad, headlines_attrs)
        submitted_ids = headlines_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

        all_headlines = ad.headlines
        headlines_by_id = all_headlines.index_by(&:id)

        headlines_to_destroy = all_headlines - headlines_by_id.values_at(*submitted_ids)

        headlines_to_update = []
        headlines_to_create = []

        headlines_attrs.each do |attrs|
          if attrs[:id]
            headline = headlines_by_id[attrs[:id]]
            if headline
              headline.text = attrs[:text]
              headline.position = attrs[:position]
              headline.platform_settings = attrs[:platform_settings]
              headlines_to_update << headline
            end
          else
            headlines_to_create << ad.headlines.new(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
          end
        end

        AdHeadline.where(id: headlines_to_destroy.map(&:id)).delete_all if headlines_to_destroy.any?
        AdHeadline.import(headlines_to_update, on_duplicate_key_update: [:text, :position, :platform_settings]) if headlines_to_update.any?
        AdHeadline.import(headlines_to_create) if headlines_to_create.any?
      end

      def replace_ad_descriptions(ad, descriptions_attrs)
        submitted_ids = descriptions_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

        all_descriptions = ad.descriptions
        descriptions_by_id = all_descriptions.index_by(&:id)

        descriptions_to_destroy = all_descriptions - descriptions_by_id.values_at(*submitted_ids)
        descriptions_to_update = []
        descriptions_to_create = []

        descriptions_attrs.each do |attrs|
          if attrs[:id]
            description = descriptions_by_id[attrs[:id]]
            if description
              description.text = attrs[:text]
              description.position = attrs[:position]
              description.platform_settings = attrs[:platform_settings]
              descriptions_to_update << description
            end
          else
            descriptions_to_create << ad.descriptions.new(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
          end
        end

        AdDescription.where(id: descriptions_to_destroy.map(&:id)).delete_all if descriptions_to_destroy.any?
        AdDescription.import(descriptions_to_update, on_duplicate_key_update: [:text, :position]) if descriptions_to_update.any?
        AdDescription.import(descriptions_to_create) if descriptions_to_create.any?
      end

      def replace_callouts(callouts_attrs)
        submitted_ids = callouts_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

        all_callouts = campaign.callouts
        callouts_by_id = all_callouts.index_by(&:id)

        callouts_to_destroy = all_callouts - callouts_by_id.values_at(*submitted_ids)
        callouts_to_update = []
        callouts_to_create = []

        callouts_attrs.each do |attrs|
          if attrs[:id]
            callout = callouts_by_id[attrs[:id]]
            if callout
              callout.text = attrs[:text]
              callout.position = attrs[:position]
              callout.platform_settings = attrs[:platform_settings]
              callouts_to_update << callout
            end
          else
            ad_group = campaign.ad_groups.first
            callouts_to_create << ad_group.callouts.new(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings], campaign: campaign)
          end
        end

        AdCallout.where(id: callouts_to_destroy.map(&:id)).delete_all if callouts_to_destroy.any?
        AdCallout.import(callouts_to_update, on_duplicate_key_update: [:text, :position]) if callouts_to_update.any?
        AdCallout.import(callouts_to_create) if callouts_to_create.any?
      end

      def replace_structured_snippet(snippet_attrs)
        if snippet_attrs[:_destroy] || snippet_attrs["_destroy"]
          campaign.structured_snippet&.destroy
          return
        end

        if campaign.structured_snippet.present?
          campaign.structured_snippet.update!(
            category: snippet_attrs[:category],
            values: snippet_attrs[:values]
          )
        else
          campaign.create_structured_snippet!(
            category: snippet_attrs[:category],
            values: snippet_attrs[:values]
          )
        end
      end

      def replace_keywords(ad_group, keywords_attrs)
        submitted_ids = keywords_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

        all_keywords = ad_group.keywords
        keywords_by_id = all_keywords.index_by(&:id)

        keywords_to_destroy = all_keywords - keywords_by_id.values_at(*submitted_ids)
        keywords_to_update = []
        keywords_to_create = []

        keywords_attrs.each do |attrs|
          if attrs[:id]
            keyword = keywords_by_id[attrs[:id]]
            if keyword
              keyword.text = attrs[:text]
              keyword.match_type = attrs[:match_type]
              keyword.position = attrs[:position]
              keywords_to_update << keyword
            end
          else
            keywords_to_create << ad_group.keywords.new(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
          end
        end

        AdKeyword.where(id: keywords_to_destroy.map(&:id)).delete_all if keywords_to_destroy.any?
        AdKeyword.import(keywords_to_update, on_duplicate_key_update: [:text, :match_type, :position], validate: false) if keywords_to_update.any?
        AdKeyword.import(keywords_to_create, validate: false) if keywords_to_create.any?
      end
    end
  end

end
