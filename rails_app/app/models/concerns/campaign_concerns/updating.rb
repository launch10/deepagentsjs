module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    class UpdateResult
      attr_reader :success, :campaign, :errors

      def initialize(success:, campaign:, errors: [])
        @success = success
        @campaign = campaign
        @errors = errors
      end

      def success?
        @success
      end

      def failed?
        !@success
      end
    end

    def update_idempotently!(params)
      result = update_idempotently(params)
      if result.failed?
        result.errors.each { |e| errors.add(:base, e) }
        raise ActiveRecord::RecordInvalid.new(self)
      end
      result
    end

    def update_idempotently(params)
      IdempotentCampaignUpdater.new(self, params).update
    end

    class IdempotentCampaignUpdater
      attr_reader :campaign, :params

      def initialize(campaign, params={})
        @campaign = campaign
        @params = params
        @objects_to_validate = []
        @objects_to_save = []
      end

      def update
        validation_errors = []

        result = Campaign.transaction do
          prepare_regular_attrs!
          perform_deletions!
          prepare_objects_for_save!
          validation_errors = validate_all_objects!

          if validation_errors.any?
            raise ActiveRecord::Rollback
          end

          execute_saves!
          :success
        end

        if result == :success
          UpdateResult.new(success: true, campaign: campaign.reload)
        else
          UpdateResult.new(success: false, campaign: campaign, errors: validation_errors)
        end
      end

      private

      def collect_validation_errors
        @objects_to_validate.flat_map do |obj|
          obj.errors.full_messages.map { |msg| "#{obj.class.name}: #{msg}" }
        end
      end

      def prepare_regular_attrs!
        regular_params = params.deep_dup
        regular_params[:ad_groups_attributes]&.each do |ag_attrs|
          ag_attrs.delete(:keywords_attributes)
          ag_attrs[:ads_attributes]&.each do |ad_attrs|
            ad_attrs.delete(:headlines_attributes)
            ad_attrs.delete(:descriptions_attributes)
          end
        end

        regular_params.delete(:callouts_attributes)
        regular_params.delete(:structured_snippet_attributes)

        campaign.assign_attributes(regular_params)
        @objects_to_validate << campaign
        @objects_to_save << campaign
      end

      def perform_deletions!
        idempotent_params = params.deep_dup

        if idempotent_params[:ad_groups_attributes].present?
          idempotent_params[:ad_groups_attributes].each do |ad_group_attrs|
            ad_group = campaign.ad_groups.find_by(id: ad_group_attrs[:id])
            next unless ad_group

            if ad_group_attrs[:ads_attributes].present?
              ad_group_attrs[:ads_attributes].each do |ad_attrs|
                next unless ad_attrs[:id]
                ad = ad_group.ads.find_by(id: ad_attrs[:id])
                next unless ad

                delete_headlines(ad, ad_attrs[:headlines_attributes]) if ad_attrs[:headlines_attributes]
                delete_descriptions(ad, ad_attrs[:descriptions_attributes]) if ad_attrs[:descriptions_attributes]
              end
            end

            delete_keywords(ad_group, ad_group_attrs[:keywords_attributes]) if ad_group_attrs[:keywords_attributes]
          end
        end

        delete_callouts(idempotent_params[:callouts_attributes]) if idempotent_params[:callouts_attributes]
      end

      def prepare_objects_for_save!
        idempotent_params = params.deep_dup

        if idempotent_params[:ad_groups_attributes].present?
          idempotent_params[:ad_groups_attributes].each do |ad_group_attrs|
            ad_group = campaign.ad_groups.find_by(id: ad_group_attrs[:id])
            next unless ad_group

            if ad_group_attrs[:ads_attributes].present?
              ad_group_attrs[:ads_attributes].each do |ad_attrs|
                next unless ad_attrs[:id]
                ad = ad_group.ads.find_by(id: ad_attrs[:id])
                next unless ad

                prepare_headlines(ad, ad_attrs[:headlines_attributes]) if ad_attrs[:headlines_attributes]
                prepare_descriptions(ad, ad_attrs[:descriptions_attributes]) if ad_attrs[:descriptions_attributes]
              end
            end

            prepare_keywords(ad_group, ad_group_attrs[:keywords_attributes]) if ad_group_attrs[:keywords_attributes]
          end
        end

        prepare_callouts(idempotent_params[:callouts_attributes]) if idempotent_params[:callouts_attributes]
        prepare_structured_snippet(idempotent_params[:structured_snippet_attributes]) if idempotent_params[:structured_snippet_attributes]
      end

      def validate_all_objects!
        errors = []
        @objects_to_validate.each do |obj|
          unless obj.valid?
            obj.errors.full_messages.each do |message|
              errors << "#{obj.class.name}: #{message}"
            end
          end
        end
        errors
      end

      def execute_saves!
        puts "[UPDATING] execute_saves! objects_to_save count: #{@objects_to_save.count}"
        @objects_to_save.each_with_index do |obj, i|
          puts "[UPDATING] execute_saves! item #{i}: #{obj.class.name}"
          if obj.is_a?(Proc)
            obj.call
          else
            obj.save!
          end
        end
      end

      def delete_headlines(ad, headlines_attrs)
        submitted_ids = headlines_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)
        AdHeadline.where(ad_id: ad.id).where.not(id: submitted_ids).delete_all
      end

      def delete_descriptions(ad, descriptions_attrs)
        submitted_ids = descriptions_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)
        AdDescription.where(ad_id: ad.id).where.not(id: submitted_ids).delete_all
      end

      def delete_callouts(callouts_attrs)
        submitted_ids = callouts_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)
        before_count = AdCallout.where(campaign_id: campaign.id).count
        deleted_count = AdCallout.where(campaign_id: campaign.id).where.not(id: submitted_ids).delete_all
        puts "[UPDATING] delete_callouts: campaign_id=#{campaign.id}, submitted_ids=#{submitted_ids.inspect}, before=#{before_count}, deleted=#{deleted_count}"
      end

      def delete_keywords(ad_group, keywords_attrs)
        submitted_ids = keywords_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)
        AdKeyword.where(ad_group_id: ad_group.id).where.not(id: submitted_ids).delete_all
      end

      def prepare_headlines(ad, headlines_attrs)
        headlines_to_update = []
        headlines_to_create = []

        existing_headlines = ad.headlines.reload.index_by(&:id)

        headlines_attrs.each do |attrs|
          if attrs[:id]
            headline = existing_headlines[attrs[:id]]
            if headline
              headline.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              headlines_to_update << headline
              @objects_to_validate << headline
            end
          else
            new_headline = AdHeadline.new(
              ad_id: ad.id,
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings]
            )
            headlines_to_create << new_headline
            @objects_to_validate << new_headline
          end
        end

        @objects_to_save << -> {
          if headlines_to_update.any?
            AdHeadline.upsert_all(
              headlines_to_update.map { |h| h.attributes.slice("id", "ad_id", "text", "position", "platform_settings") },
              update_only: [:text, :position, :platform_settings]
            )
          end
          if headlines_to_create.any?
            AdHeadline.insert_all(
              headlines_to_create.map { |h| h.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end

      def prepare_descriptions(ad, descriptions_attrs)
        descriptions_to_update = []
        descriptions_to_create = []

        existing_descriptions = ad.descriptions.reload.index_by(&:id)

        descriptions_attrs.each do |attrs|
          if attrs[:id]
            description = existing_descriptions[attrs[:id]]
            if description
              description.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              descriptions_to_update << description
              @objects_to_validate << description
            end
          else
            new_description = AdDescription.new(
              ad_id: ad.id,
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings]
            )
            descriptions_to_create << new_description
            @objects_to_validate << new_description
          end
        end

        @objects_to_save << -> {
          if descriptions_to_update.any?
            AdDescription.upsert_all(
              descriptions_to_update.map { |d| d.attributes.slice("id", "ad_id", "text", "position", "platform_settings") },
              update_only: [:text, :position, :platform_settings]
            )
          end
          if descriptions_to_create.any?
            AdDescription.insert_all(
              descriptions_to_create.map { |d| d.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end

      def prepare_callouts(callouts_attrs)
        callouts_to_update = []
        callouts_to_create = []

        existing_callouts = campaign.callouts.reload.index_by(&:id)

        callouts_attrs.each do |attrs|
          if attrs[:id]
            callout = existing_callouts[attrs[:id]]
            if callout
              callout.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              callouts_to_update << callout
              @objects_to_validate << callout
            end
          else
            ad_group = campaign.ad_groups.first
            new_callout = AdCallout.new(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              campaign_id: campaign.id,
              ad_group_id: ad_group.id
            )
            callouts_to_create << new_callout
            @objects_to_validate << new_callout
          end
        end

        @objects_to_save << -> {
          if callouts_to_update.any?
            AdCallout.upsert_all(
              callouts_to_update.map { |c| c.attributes.slice("id", "campaign_id", "ad_group_id", "text", "position", "platform_settings") },
              update_only: [:text, :position, :platform_settings]
            )
          end
          if callouts_to_create.any?
            before_count = AdCallout.where(campaign_id: campaign.id).count
            puts "[UPDATING] BEFORE insert: #{before_count} callouts in campaign"
            insert_data = callouts_to_create.map { |c| c.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            puts "[UPDATING] insert callouts: count=#{callouts_to_create.count}, data=#{insert_data.inspect}"
            AdCallout.insert_all(insert_data)
            after_count = AdCallout.where(campaign_id: campaign.id).count
            puts "[UPDATING] AFTER insert: #{after_count} callouts in campaign"
          end
        }
      end

      def prepare_structured_snippet(snippet_attrs)
        if snippet_attrs[:_destroy] || snippet_attrs["_destroy"]
          @objects_to_save << -> { campaign.structured_snippet&.destroy }
          return
        end

        if campaign.structured_snippet.present?
          campaign.structured_snippet.assign_attributes(category: snippet_attrs[:category], values: snippet_attrs[:values])
          @objects_to_validate << campaign.structured_snippet
          @objects_to_save << campaign.structured_snippet
        else
          new_snippet = campaign.build_structured_snippet(category: snippet_attrs[:category], values: snippet_attrs[:values])
          @objects_to_validate << new_snippet
          @objects_to_save << new_snippet
        end
      end

      def prepare_keywords(ad_group, keywords_attrs)
        keywords_to_update = []
        keywords_to_create = []

        existing_keywords = ad_group.keywords.reload.index_by(&:id)

        keywords_attrs.each do |attrs|
          if attrs[:id]
            keyword = existing_keywords[attrs[:id]]
            if keyword
              keyword.assign_attributes(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
              keywords_to_update << keyword
              @objects_to_validate << keyword
            end
          else
            new_keyword = ad_group.keywords.new(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
            keywords_to_create << new_keyword
            @objects_to_validate << new_keyword
          end
        end

        @objects_to_save << -> {
          if keywords_to_update.any?
            AdKeyword.upsert_all(
              keywords_to_update.map { |k| k.attributes.slice("id", "ad_group_id", "text", "match_type", "position", "platform_settings") },
              update_only: [:text, :match_type, :position]
            )
          end
          if keywords_to_create.any?
            AdKeyword.insert_all(
              keywords_to_create.map { |k| k.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end
    end
  end
end
