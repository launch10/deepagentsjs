module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    FLAT_PARAM_KEYS = %i[headlines descriptions keywords callouts structured_snippet ad_group].freeze

    def update_idempotently!(params)
      normalized_params = normalize_flat_params(params)
      result = IdempotentCampaignUpdater.new(self, normalized_params).update
      if result.failed?
        raise UpdateValidationError.new(self, result.errors)
      end
      result
    end

    private

    def normalize_flat_params(params)
      params = params.deep_dup.with_indifferent_access
      return params unless uses_flat_params?(params)

      ad_group_record = ad_groups.first
      ad_record = ad_group_record&.ads&.first

      normalized = params.except(*FLAT_PARAM_KEYS)

      ad_level_attrs = {}
      ad_level_attrs[:headlines_attributes] = params[:headlines] if params[:headlines]
      ad_level_attrs[:descriptions_attributes] = params[:descriptions] if params[:descriptions]

      ad_group_level_attrs = {}
      ad_group_level_attrs[:keywords_attributes] = params[:keywords] if params[:keywords]

      if params[:ad_group].present?
        flat_ad_group = params[:ad_group].with_indifferent_access
        ad_group_level_attrs[:name] = flat_ad_group[:name] if flat_ad_group[:name]
        ad_group_level_attrs[:keywords_attributes] = flat_ad_group[:keywords_attributes] if flat_ad_group[:keywords_attributes]

        if flat_ad_group[:ad].present?
          flat_ad = flat_ad_group[:ad].with_indifferent_access
          ad_level_attrs[:headlines_attributes] = flat_ad[:headlines_attributes] if flat_ad[:headlines_attributes]
          ad_level_attrs[:descriptions_attributes] = flat_ad[:descriptions_attributes] if flat_ad[:descriptions_attributes]
        end
      end

      if ad_level_attrs.any? || ad_group_level_attrs.any?
        ad_group_attrs = { id: ad_group_record.id }
        ad_group_attrs[:ads_attributes] = [{ id: ad_record.id }.merge(ad_level_attrs)] if ad_level_attrs.any?
        ad_group_attrs.merge!(ad_group_level_attrs)
        normalized[:ad_groups_attributes] = [ad_group_attrs]
      end

      normalized[:callouts_attributes] = params[:callouts] if params[:callouts]
      normalized[:structured_snippet_attributes] = params[:structured_snippet] if params[:structured_snippet]

      normalized
    end

    def uses_flat_params?(params)
      FLAT_PARAM_KEYS.any? { |key| params.key?(key) }
    end

    class IdempotentCampaignUpdater # rubocop:disable Metrics/ClassLength
      attr_reader :campaign, :params

      def initialize(campaign, params = {})
        @campaign = campaign
        @params = params
        @objects_to_validate = []
        @deletions_to_perform = []
        @saves_to_perform = []
        @validation_context = []
      end

      def update
        validation_errors = []

        did_execute = Campaign.transaction do
          prepare_regular_attrs!
          prepare_idempotent_attrs!
          execute_deletions!
          validation_errors = validate_all_objects!

          if validation_errors.any?
            raise ActiveRecord::Rollback
          end

          execute_saves!
          true
        end

        if did_execute
          UpdateResult.new(success: true, campaign: campaign.reload)
        else
          UpdateResult.new(success: false, campaign: campaign, errors: validation_errors)
        end
      end

      private

      def prepare_regular_attrs!
        regular_params = params.deep_dup.deep_symbolize_keys
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
        ad_schedules_data = regular_params.delete(:ad_schedules)

        campaign.assign_attributes(regular_params)
        add_to_validation(campaign, "campaign")
        @saves_to_perform << -> { campaign.save! }

        if location_targets_data.present?
          prepare_location_targets(location_targets_data)
        end

        if ad_schedules_data.present?
          prepare_ad_schedules(ad_schedules_data)
        end
      end

      def prepare_idempotent_attrs!
        idempotent_params = params.deep_dup.deep_symbolize_keys

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
        ValidationErrorFormatter.new(@validation_context).format_errors
      end

      def execute_deletions!
        @deletions_to_perform.each(&:call)
      end

      def execute_saves!
        @saves_to_perform.each(&:call)
      end

      def queue_soft_deletion(relation, attrs_array)
        submitted_positions = attrs_array.map { |attrs| attrs.with_indifferent_access[:position] }.compact.map(&:to_i)
        @deletions_to_perform << -> {
          relation.where.not(position: submitted_positions).update_all(deleted_at: Time.current)
        }
      end

      # asset_hashes is an array of headline/description attributes hashes
      def add_positions(asset_hashes)
        asset_hashes.each_with_index do |asset, index|
          asset[:position] = index
        end
      end

      def prepare_headlines(ad, headline_attrs)
        add_positions(headline_attrs)
        queue_soft_deletion(ad.headlines, headline_attrs)

        headlines_to_update = []
        all_headlines = []
        existing_headlines = AdHeadline.unscoped.where(ad_id: ad.id).index_by(&:position) # Include soft-deleted records
        ad_group_index = find_ad_group_index(ad.ad_group_id)
        ad_index = find_ad_index(ad.ad_group_id, ad.id)

        headline_attrs.each_with_index do |attrs, idx|
          path = "ad_groups[#{ad_group_index}].ads[#{ad_index}].headlines[#{idx}]"

          headline = existing_headlines[attrs[:position]]
          if headline
            headline.assign_attributes(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              deleted_at: nil
            )
            headline.skip_position_uniqueness_validation = true
            headlines_to_update << headline
            all_headlines << headline
            add_to_validation(headline, path)
          else
            new_headline = AdHeadline.new(
              ad_id: ad.id,
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings]
            )
            new_headline.skip_position_uniqueness_validation = true
            headlines_to_update << new_headline
            all_headlines << new_headline
            add_to_validation(new_headline, path)
          end
        end

        validate_position_uniqueness(all_headlines, "must be unique within ad")
        batch_upsert(AdHeadline, headlines_to_update)
      end

      def prepare_descriptions(ad, descriptions_attrs)
        add_positions(descriptions_attrs)
        queue_soft_deletion(ad.descriptions, descriptions_attrs)

        descriptions_to_update = []
        all_descriptions = []
        existing_descriptions = AdDescription.unscoped.where(ad_id: ad.id).index_by(&:position)
        ad_group_index = find_ad_group_index(ad.ad_group_id)
        ad_index = find_ad_index(ad.ad_group_id, ad.id)

        descriptions_attrs.each_with_index do |attrs, idx|
          path = "ad_groups[#{ad_group_index}].ads[#{ad_index}].descriptions[#{idx}]"

          description = existing_descriptions[attrs[:position]]
          if description
            description.assign_attributes(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              deleted_at: nil
            )
            descriptions_to_update << description
            all_descriptions << description
            add_to_validation(description, path)
          else
            new_description = AdDescription.new(
              ad_id: ad.id,
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings]
            )
            descriptions_to_update << new_description
            all_descriptions << new_description
            add_to_validation(new_description, path)
          end
        end

        validate_position_uniqueness(all_descriptions, "must be unique within ad")
        batch_upsert(AdDescription, descriptions_to_update)
      end

      def prepare_callouts(callouts_attrs)
        add_positions(callouts_attrs)
        queue_soft_deletion(campaign.callouts, callouts_attrs)

        callouts_to_update = []
        all_callouts = []
        existing_callouts = AdCallout.unscoped.where(campaign_id: campaign.id).index_by(&:position)

        callouts_attrs.each_with_index do |attrs, idx|
          path = "callouts[#{idx}]"

          callout = existing_callouts[attrs[:position]]
          if callout
            callout.assign_attributes(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              deleted_at: nil
            )
            callouts_to_update << callout
            all_callouts << callout
            add_to_validation(callout, path)
          else
            new_callout = AdCallout.new(
              text: attrs[:text],
              position: attrs[:position],
              platform_settings: attrs[:platform_settings],
              campaign_id: campaign.id,
              ad_group_id: campaign.ad_groups.first.id
            )
            callouts_to_update << new_callout
            all_callouts << new_callout
            add_to_validation(new_callout, path)
          end
        end

        validate_position_uniqueness(all_callouts, "must be unique within campaign")
        batch_upsert(AdCallout, callouts_to_update)
      end

      def prepare_location_targets(location_targets_data)
        targets = Array(location_targets_data).map.with_index do |target_data, idx|
          target = campaign.location_targets.new(target_data)
          path = "location_targets[#{idx}]"
          add_to_validation(target, path)
          target
        end

        @saves_to_perform << -> {
          campaign.location_targets.destroy_all
          if targets.any?
            AdLocationTarget.insert_all(
              targets.map { |t| t.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end

      def prepare_ad_schedules(schedule_data)
        if schedule_data[:time_zone].present?
          campaign.time_zone = schedule_data[:time_zone]
        end

        schedules = campaign.schedule.build(schedule_data)

        schedules.each do |schedule|
          # ad_schedules is a single object in the API, not an array
          # so all schedule errors map to "ad_schedules.attribute"
          add_to_validation(schedule, "ad_schedules")
        end

        @saves_to_perform << -> { campaign.schedule.update(schedule_data) }
      end

      def prepare_structured_snippet(snippet_attrs)
        if snippet_attrs[:_destroy] || snippet_attrs["_destroy"]
          @saves_to_perform << -> { campaign.structured_snippet&.destroy }
          return
        end

        path = "structured_snippet"

        if campaign.structured_snippet.present?
          campaign.structured_snippet.assign_attributes(category: snippet_attrs[:category], values: snippet_attrs[:values])
          add_to_validation(campaign.structured_snippet, path)
          @saves_to_perform << -> { campaign.structured_snippet.save! }
        else
          new_snippet = campaign.build_structured_snippet(category: snippet_attrs[:category], values: snippet_attrs[:values])
          add_to_validation(new_snippet, path)
          @saves_to_perform << -> { new_snippet.save! }
        end
      end

      def prepare_keywords(ad_group, keywords_attrs)
        add_positions(keywords_attrs)
        queue_soft_deletion(ad_group.keywords, keywords_attrs)

        keywords_to_update = []
        all_keywords = []
        existing_keywords = AdKeyword.unscoped.where(ad_group_id: ad_group.id).index_by(&:position)
        ad_group_index = find_ad_group_index(ad_group.id)

        keywords_attrs.each_with_index do |attrs, idx|
          path = "ad_groups[#{ad_group_index}].keywords[#{idx}]"

          keyword = existing_keywords[attrs[:position]]
          if keyword
            keyword.assign_attributes(
              text: attrs[:text],
              match_type: attrs[:match_type],
              position: attrs[:position],
              deleted_at: nil
            )
            keywords_to_update << keyword
            all_keywords << keyword
            add_to_validation(keyword, path)
          else
            new_keyword = AdKeyword.new(
              ad_group_id: ad_group.id,
              text: attrs[:text],
              match_type: attrs[:match_type],
              position: attrs[:position]
            )
            keywords_to_update << new_keyword
            all_keywords << new_keyword
            add_to_validation(new_keyword, path)
          end
        end

        validate_position_uniqueness(all_keywords, "must be unique within ad group")
        batch_upsert(AdKeyword, keywords_to_update)
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

      def batch_upsert(model_class, records)
        @saves_to_perform << -> {
          return if records.empty?

          new_records = records.select { |r| r.new_record? }
          existing_records = records.reject { |r| r.new_record? }

          if existing_records.any?
            model_class.upsert_all(
              existing_records.map(&:attributes).map { |attrs| attrs.except("created_at", "updated_at") }
            )
          end

          if new_records.any?
            model_class.insert_all(
              new_records.map { |r| r.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
            )
          end
        }
      end

      def add_to_validation(object, path)
        @objects_to_validate << object
        @validation_context << { object: object, path: path }
      end

      def find_ad_group_index(ad_group_id)
        params[:ad_groups_attributes]&.find_index { |ag| ag[:id] == ad_group_id } || 0
      end

      def find_ad_index(ad_group_id, ad_id)
        ad_group_attrs = params[:ad_groups_attributes]&.find { |ag| ag[:id] == ad_group_id }
        ad_group_attrs&.dig(:ads_attributes)&.find_index { |ad| ad[:id] == ad_id } || 0
      end
    end

    class ValidationErrorFormatter
      def initialize(validation_context)
        @validation_context = validation_context
      end

      def format_errors
        errors = {}

        @validation_context.each do |context|
          object = context[:object]
          path = context[:path]

          next if object.valid?

          object.errors.each do |error|
            key = "#{path}.#{error.attribute}"
            errors[key] ||= []
            errors[key] << error.message
          end
        end

        errors
      end
    end

    class UpdateValidationError < StandardError
      attr_reader :record, :errors

      def initialize(record, errors)
        @record = record
        @errors = errors
        super("Validation failed")
      end
    end

    class UpdateResult
      attr_reader :success, :campaign, :errors

      def initialize(success:, campaign:, errors: {})
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
  end
end
