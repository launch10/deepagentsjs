module CampaignConcerns
  module ShasumHashable
    extend ActiveSupport::Concern

    def generate_shasum
      Digest::SHA256.hexdigest(campaign_hash.to_json)
    end

    def campaign_changed?
      current_shasum = generate_shasum

      latest_deploy = campaign_deploys.completed.order(created_at: :desc).first
      return true unless latest_deploy&.shasum

      current_shasum != latest_deploy.shasum
    end

    private

    def campaign_hash
      {
        campaign: {
          name: name,
          time_zone: time_zone,
          start_date: start_date&.iso8601,
          end_date: end_date&.iso8601,
          status: status
        },
        budget: budget_hash,
        location_targets: location_targets.order(:id).map { |lt| location_target_hash(lt) },
        ad_schedules: ad_schedules.order(:id).map { |s| ad_schedule_hash(s) },
        callouts: callouts.order(:id).map { |c| callout_hash(c) },
        structured_snippet: structured_snippet_hash,
        ad_groups: ad_groups.order(:id).map { |ag| ad_group_hash(ag) }
      }
    end

    def budget_hash
      return nil unless budget

      { daily_budget_cents: budget.daily_budget_cents }
    end

    def location_target_hash(lt)
      {
        target_type: lt.target_type,
        targeted: lt.targeted,
        location_name: lt.location_name,
        location_type: lt.location_type,
        country_code: lt.country_code,
        address_line_1: lt.address_line_1,
        city: lt.city,
        state: lt.state,
        postal_code: lt.postal_code,
        latitude: lt.latitude&.to_f,
        longitude: lt.longitude&.to_f,
        radius: lt.radius&.to_f,
        radius_units: lt.radius_units,
        location_identifier: lt.location_identifier
      }
    end

    def ad_schedule_hash(s)
      {
        always_on: s.always_on,
        day_of_week: s.day_of_week,
        start_hour: s.start_hour,
        start_minute: s.start_minute,
        end_hour: s.end_hour,
        end_minute: s.end_minute
      }
    end

    def callout_hash(c)
      { text: c.text, position: c.position }
    end

    def structured_snippet_hash
      return nil unless structured_snippet

      { category: structured_snippet.category, values: structured_snippet.values }
    end

    def ad_group_hash(ag)
      {
        name: ag.name,
        ads: ag.ads.order(:id).map { |ad| ad_hash(ad) },
        keywords: ag.keywords.order(:id).map { |kw| keyword_hash(kw) }
      }
    end

    def ad_hash(ad)
      {
        display_path_1: ad.display_path_1,
        display_path_2: ad.display_path_2,
        status: ad.status,
        headlines: ad.headlines.order(:id).map { |h| { text: h.text, position: h.position } },
        descriptions: ad.descriptions.order(:id).map { |d| { text: d.text, position: d.position } }
      }
    end

    def keyword_hash(kw)
      { text: kw.text, match_type: kw.match_type, position: kw.position }
    end
  end
end
