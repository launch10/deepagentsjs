module CampaignConcerns
  module Stages
    extend ActiveSupport::Concern

    STAGES = WorkflowConfig.substeps_for("launch", "ad_campaign")

    included do
      const_set(:STAGES, CampaignConcerns::Stages::STAGES)
    end

    # validates :done_stage?, if: { stage_will_change? && stage.present? }

    def advance_stage!
      case stage.to_s
      when 'content'
        if done_content_stage?
          update!(stage: 'highlights')
        else
          raise ActiveRecord::RecordInvalid.new(self)
        end
      when 'highlights'
        if done_highlights_stage?
          update!(stage: 'plan')
        else
          raise ActiveRecord::RecordInvalid.new(self)
        end
      when 'plan'
        if done_plan_stage?
          update!(stage: 'ready')
        else
          raise ActiveRecord::RecordInvalid.new(self)
        end
      end
    end

    # Stage-based validation methods
    def done_content_stage?
      errors.clear

      # Must have at least one ad group
      if ad_groups.empty?
        errors.add(:base, "Campaign must have at least one ad group")
        return false
      end

      # Validate each ad group
      ad_groups.each do |ad_group|
        if ad_group.name.blank?
          errors.add(:ad_group_name, "can't be blank")
        end

        # Must have at least one ad
        if ad_group.ads.empty?
          errors.add(:base, "Each ad group must have at least one ad")
        end

        # Validate each ad
        ad_group.ads.each do |ad|
          headline_count = ad.headlines.count
          unless headline_count.between?(3, 15)
            errors.add(:headlines, "must have between 3-15 headlines (currently has #{headline_count})")
          end

          description_count = ad.descriptions.count
          unless description_count.between?(2, 4)
            errors.add(:descriptions, "must have between 2-4 descriptions (currently has #{description_count})")
          end
        end
      end

      errors.empty?
    end

    def done_highlights_stage?
      errors.clear

      callout_count = callouts.count
      unless callout_count.between?(2, 10)
        errors.add(:callouts, "must have between 2-10 unique features (currently has #{callout_count})")
      end

      # Structured snippets are optional, but if present, should have at least 2
      snippet_count = structured_snippets.count
      if snippet_count > 0 && snippet_count < 2
        errors.add(:structured_snippets, "must have at least 2 items if any are provided")
      end

      errors.empty?
    end

    def done_plan_stage?
      errors.clear

      # Validate keywords for each ad group
      ad_groups.each do |ad_group|
        keyword_count = ad_group.keywords.count
        unless keyword_count.between?(5, 15)
          errors.add(:keywords, "must have between 5-15 keywords per ad group (currently has #{keyword_count})")
        end
      end

      # Validate targeting and budget
      if location_targeting.blank? || location_targeting.empty?
        errors.add(:location_targeting, "must be configured")
      end

      if schedule.blank? || schedule.empty?
        errors.add(:schedule, "must be configured")
      end

      unless daily_budget_cents&.positive?
        errors.add(:daily_budget, "must be greater than 0")
      end

      errors.empty?
    end

    def done_launch?
      errors.clear

      if name.blank?
        errors.add(:name, "can't be blank")
      end

      done_highlights_stage?
      done_plan_stage?

      errors.empty?
    end
  end
end