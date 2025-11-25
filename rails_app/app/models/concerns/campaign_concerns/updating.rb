module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    def update_idempotently!(update_params, raw_params)
      transaction do
        update!(update_params)

        if raw_params[:ad_groups_attributes].present?
          raw_params[:ad_groups_attributes].each do |ad_group_attrs|
            next unless ad_group_attrs[:ads_attributes].present?

            ad_group = ad_groups.find_by(id: ad_group_attrs[:id])
            next unless ad_group

            ad_group_attrs[:ads_attributes].each do |ad_attrs|
              next unless ad_attrs[:id]

              ad = ad_group.ads.find_by(id: ad_attrs[:id])
              next unless ad

              replace_ad_headlines(ad, ad_attrs[:headlines_attributes]) if ad_attrs[:headlines_attributes]
              replace_ad_descriptions(ad, ad_attrs[:descriptions_attributes]) if ad_attrs[:descriptions_attributes]
            end
          end
        end
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
  end
end
