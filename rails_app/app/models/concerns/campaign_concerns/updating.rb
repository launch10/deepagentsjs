module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    def update_idempotently!(params)
      transaction do
        # Separate params into regular attributes and idempotent attributes
        idempotent_params = params.deep_dup
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

        # Update regular attributes (location_targets and ad_schedules handled by custom setters)
        update!(regular_params)

        # Handle idempotent attributes
        if idempotent_params[:ad_groups_attributes].present?
          idempotent_params[:ad_groups_attributes].each do |ad_group_attrs|
            ad_group = ad_groups.find_by(id: ad_group_attrs[:id])
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
      end
    end

    private

    def replace_ad_headlines(ad, headlines_attrs)
      submitted_ids = headlines_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      ad.headlines.where.not(id: submitted_ids).delete_all
      ad.headlines.reset

      headlines_to_update = []
      headlines_to_create = []

      headlines_attrs.each do |attrs|
        if attrs[:id]
          headline = ad.headlines.find_by(id: attrs[:id])
          if headline
            headline.text = attrs[:text]
            headline.position = attrs[:position]
            headlines_to_update << headline
          end
        else
          headlines_to_create << ad.headlines.new(text: attrs[:text], position: attrs[:position])
        end
      end

      AdHeadline.import(headlines_to_update, on_duplicate_key_update: [:text, :position], validate: false) if headlines_to_update.any?
      AdHeadline.import(headlines_to_create, validate: false) if headlines_to_create.any?
    end

    def replace_ad_descriptions(ad, descriptions_attrs)
      submitted_ids = descriptions_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      ad.descriptions.where.not(id: submitted_ids).delete_all
      ad.descriptions.reset

      descriptions_to_update = []
      descriptions_to_create = []

      descriptions_attrs.each do |attrs|
        if attrs[:id]
          description = ad.descriptions.find_by(id: attrs[:id])
          if description
            description.text = attrs[:text]
            description.position = attrs[:position]
            descriptions_to_update << description
          end
        else
          descriptions_to_create << ad.descriptions.new(text: attrs[:text], position: attrs[:position])
        end
      end

      AdDescription.import(descriptions_to_update, on_duplicate_key_update: [:text, :position], validate: false) if descriptions_to_update.any?
      AdDescription.import(descriptions_to_create, validate: false) if descriptions_to_create.any?
    end

    def replace_callouts(callouts_attrs)
      submitted_ids = callouts_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      callouts.where.not(id: submitted_ids).delete_all
      callouts.reset

      callouts_to_update = []
      callouts_to_create = []

      callouts_attrs.each do |attrs|
        if attrs[:id]
          callout = callouts.find_by(id: attrs[:id])
          if callout
            callout.text = attrs[:text]
            callout.position = attrs[:position]
            callouts_to_update << callout
          end
        else
          ad_group = ad_groups.first
          callouts_to_create << callouts.new(ad_group: ad_group, text: attrs[:text], position: attrs[:position])
        end
      end

      AdCallout.import(callouts_to_update, on_duplicate_key_update: [:text, :position], validate: false) if callouts_to_update.any?
      AdCallout.import(callouts_to_create, validate: false) if callouts_to_create.any?
    end

    def replace_structured_snippet(snippet_attrs)
      if snippet_attrs[:_destroy] || snippet_attrs["_destroy"]
        structured_snippet&.destroy
        return
      end

      if structured_snippet.present?
        structured_snippet.update!(
          category: snippet_attrs[:category],
          values: snippet_attrs[:values]
        )
      else
        create_structured_snippet!(
          category: snippet_attrs[:category],
          values: snippet_attrs[:values]
        )
      end
    end

    def replace_keywords(ad_group, keywords_attrs)
      submitted_ids = keywords_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      ad_group.keywords.where.not(id: submitted_ids).delete_all
      ad_group.keywords.reset

      keywords_to_update = []
      keywords_to_create = []

      keywords_attrs.each do |attrs|
        if attrs[:id]
          keyword = ad_group.keywords.find_by(id: attrs[:id])
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

      AdKeyword.import(keywords_to_update, on_duplicate_key_update: [:text, :match_type, :position], validate: false) if keywords_to_update.any?
      AdKeyword.import(keywords_to_create, validate: false) if keywords_to_create.any?
    end
  end
end
