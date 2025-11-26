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
        @deletions_to_perform = []
        @saves_to_perform = []
      end

      def update
        validation_errors = []

        result = Campaign.transaction do
          prepare_regular_attrs!
          prepare_idempotent_attrs!
          execute_deletions!
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
        location_targets_data = regular_params.delete(:location_targets)

        campaign.assign_attributes(regular_params)
        @objects_to_validate << campaign
        @saves_to_perform << -> { campaign.save! }

        if location_targets_data.present?
          @saves_to_perform << -> { campaign.update_location_targets(location_targets_data) }
        end
      end

      def prepare_idempotent_attrs!
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

      def execute_deletions!
        @deletions_to_perform.each(&:call)
      end

      def execute_saves!
        @saves_to_perform.each(&:call)
      end

      def queue_deletion(relation, attrs_array)
        submitted_ids = attrs_array.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)
        @deletions_to_perform << -> { relation.where.not(id: submitted_ids).delete_all }
      end

      def prepare_headlines(ad, headlines_attrs)
        queue_deletion(ad.headlines, headlines_attrs)

        headlines_to_update = []
        headlines_to_create = []
        all_headlines = []
        existing_headlines = ad.headlines.reload.index_by(&:id)

        headlines_attrs.each do |attrs|
          if attrs[:id]
            headline = existing_headlines[attrs[:id]]
            if headline
              headline.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              headline.skip_position_uniqueness_validation = true
              headlines_to_update << headline
              all_headlines << headline
              @objects_to_validate << headline
            end
          else
            new_headline = AdHeadline.new(
              ad_id: ad.id,
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings]
            )
            new_headline.skip_position_uniqueness_validation = true
            headlines_to_create << new_headline
            all_headlines << new_headline
            @objects_to_validate << new_headline
          end
        end

        validate_position_uniqueness(all_headlines, "must be unique within ad")
        batch_upsert_and_insert(AdHeadline, headlines_to_update, headlines_to_create)
      end

      def prepare_descriptions(ad, descriptions_attrs)
        queue_deletion(ad.descriptions, descriptions_attrs)

        descriptions_to_update = []
        descriptions_to_create = []
        all_descriptions = []
        existing_descriptions = ad.descriptions.reload.index_by(&:id)

        descriptions_attrs.each do |attrs|
          if attrs[:id]
            description = existing_descriptions[attrs[:id]]
            if description
              description.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              descriptions_to_update << description
              all_descriptions << description
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
            all_descriptions << new_description
            @objects_to_validate << new_description
          end
        end

        validate_position_uniqueness(all_descriptions, "must be unique within ad")
        batch_upsert_and_insert(AdDescription, descriptions_to_update, descriptions_to_create)
      end

      def prepare_callouts(callouts_attrs)
        queue_deletion(campaign.callouts, callouts_attrs)

        callouts_to_update = []
        callouts_to_create = []
        all_callouts = []
        existing_callouts = campaign.callouts.reload.index_by(&:id)

        callouts_attrs.each do |attrs|
          if attrs[:id]
            callout = existing_callouts[attrs[:id]]
            if callout
              callout.assign_attributes(text: attrs[:text], position: attrs[:position], platform_settings: attrs[:platform_settings])
              callouts_to_update << callout
              all_callouts << callout
              @objects_to_validate << callout
            end
          else
            new_callout = AdCallout.new(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              campaign_id: campaign.id,
              ad_group_id: campaign.ad_groups.first.id
            )
            callouts_to_create << new_callout
            all_callouts << new_callout
            @objects_to_validate << new_callout
          end
        end

        validate_position_uniqueness(all_callouts, "must be unique within campaign")
        batch_upsert_and_insert(AdCallout, callouts_to_update, callouts_to_create)
      end

      def prepare_structured_snippet(snippet_attrs)
        if snippet_attrs[:_destroy] || snippet_attrs["_destroy"]
          @saves_to_perform << -> { campaign.structured_snippet&.destroy }
          return
        end

        if campaign.structured_snippet.present?
          campaign.structured_snippet.assign_attributes(category: snippet_attrs[:category], values: snippet_attrs[:values])
          @objects_to_validate << campaign.structured_snippet
          @saves_to_perform << -> { campaign.structured_snippet.save! }
        else
          new_snippet = campaign.build_structured_snippet(category: snippet_attrs[:category], values: snippet_attrs[:values])
          @objects_to_validate << new_snippet
          @saves_to_perform << -> { new_snippet.save! }
        end
      end

      def prepare_keywords(ad_group, keywords_attrs)
        queue_deletion(ad_group.keywords, keywords_attrs)

        keywords_to_update = []
        keywords_to_create = []
        all_keywords = []
        existing_keywords = ad_group.keywords.reload.index_by(&:id)

        keywords_attrs.each do |attrs|
          if attrs[:id]
            keyword = existing_keywords[attrs[:id]]
            if keyword
              keyword.assign_attributes(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
              keywords_to_update << keyword
              all_keywords << keyword
              @objects_to_validate << keyword
            end
          else
            new_keyword = AdKeyword.new(
              ad_group_id: ad_group.id,
              text: attrs[:text],
              match_type: attrs[:match_type],
              position: attrs[:position]
            )
            keywords_to_create << new_keyword
            all_keywords << new_keyword
            @objects_to_validate << new_keyword
          end
        end

        validate_position_uniqueness(all_keywords, "must be unique within ad group")
        batch_upsert_and_insert(AdKeyword, keywords_to_update, keywords_to_create)
      end

      def validate_position_uniqueness(records, error_message)
        positions = records.map(&:position).compact
        return if positions.empty?

        if positions.length != positions.uniq.length
          duplicate_positions = positions.select { |p| positions.count(p) > 1 }.uniq
          duplicate_positions.each do |pos|
            records.select { |r| r.position == pos }.each do |record|
              record.errors.add(:position, error_message)
            end
          end
        end
      end

      def batch_upsert_and_insert(model_class, to_update, to_create)
        @saves_to_perform << -> {
          if to_update.any?
            model_class.upsert_all(
              to_update.map(&:attributes).map { |attrs| attrs.except("created_at", "updated_at") }
            )
          end
          if to_create.any?
            model_class.insert_all(
              to_create.map { |r| r.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end
    end
  end
end
