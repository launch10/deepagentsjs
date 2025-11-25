module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    def update_idempotently!(update_params, raw_params)
      transaction do
        # Handle location_targets and ad_schedules before regular update
        # since they use their own methods (not accepts_nested_attributes)
        if update_params[:location_targets]
          targets_array = Array(update_params[:location_targets]).map do |target|
            target.is_a?(Hash) ? target : target.to_unsafe_h
          end
          update_location_targets(targets_array)
        end

        if update_params[:ad_schedules]
          schedule_hash = update_params[:ad_schedules].is_a?(Hash) ? update_params[:ad_schedules] : update_params[:ad_schedules].to_unsafe_h
          update_ad_schedules(schedule_hash.symbolize_keys)
        end

        # Remove location_targets and ad_schedules from update_params since they're already handled
        clean_params = update_params.except(:location_targets, :ad_schedules)
        update!(clean_params)

        if raw_params[:ad_groups_attributes].present?
          raw_params[:ad_groups_attributes].each do |ad_group_attrs|
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

        replace_callouts(raw_params[:callouts_attributes]) if raw_params[:callouts_attributes]
        replace_structured_snippet(raw_params[:structured_snippet_attributes]) if raw_params[:structured_snippet_attributes]
      end
    end

    private

    def replace_ad_headlines(ad, headlines_attrs)
      submitted_ids = headlines_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      ad.headlines.where.not(id: submitted_ids).delete_all
      ad.headlines.reset

      headlines_attrs.each do |attrs|
        if attrs[:id]
          headline = ad.headlines.find_by(id: attrs[:id])
          headline&.update!(text: attrs[:text], position: attrs[:position])
        else
          ad.headlines.create!(text: attrs[:text], position: attrs[:position])
        end
      end
    end

    def replace_ad_descriptions(ad, descriptions_attrs)
      submitted_ids = descriptions_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      ad.descriptions.where.not(id: submitted_ids).delete_all
      ad.descriptions.reset

      descriptions_attrs.each do |attrs|
        if attrs[:id]
          description = ad.descriptions.find_by(id: attrs[:id])
          description&.update!(text: attrs[:text], position: attrs[:position])
        else
          ad.descriptions.create!(text: attrs[:text], position: attrs[:position])
        end
      end
    end

    def replace_callouts(callouts_attrs)
      submitted_ids = callouts_attrs.map { |attrs| attrs[:id] || attrs["id"] }.compact.map(&:to_i)

      callouts.where.not(id: submitted_ids).delete_all
      callouts.reset

      callouts_attrs.each do |attrs|
        if attrs[:id]
          callout = callouts.find_by(id: attrs[:id])
          callout&.update!(text: attrs[:text], position: attrs[:position])
        else
          ad_group = ad_groups.first
          callouts.create!(ad_group: ad_group, text: attrs[:text], position: attrs[:position])
        end
      end
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

      keywords_attrs.each do |attrs|
        if attrs[:id]
          keyword = ad_group.keywords.find_by(id: attrs[:id])
          keyword&.update!(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
        else
          ad_group.keywords.create!(text: attrs[:text], match_type: attrs[:match_type], position: attrs[:position])
        end
      end
    end
  end
end
