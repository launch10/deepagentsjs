module CampaignConcerns
  module Stages
    extend ActiveSupport::Concern

    STAGES = WorkflowConfig.substeps_for("launch", "ad_campaign")

    included do
      const_set(:STAGES, CampaignConcerns::Stages::STAGES)

      validate :prev_stage_must_be_complete, if: :stage_changed?
    end

    def ready_for_next_stage?
      return false if stage.blank?
      send("done_#{stage}_stage?")
    end

    def prev_stage
      return nil if stage.blank?
      stage_index = STAGES.index(stage)
      return nil if stage_index.nil? || stage_index.zero?
      STAGES[stage_index - 1]
    end

    def next_stage
      return nil if stage.blank?
      stage_index = STAGES.index(stage)
      return nil if stage_index.nil? || stage_index >= STAGES.length - 1
      STAGES[stage_index + 1]
    end

    def be_done_prev_stage?
      prev = prev_stage
      return true if prev.nil?
      send("done_#{prev}_stage?")
    end

    def advance_stage!
      current_done_method = "done_#{stage}_stage?"

      unless respond_to?(current_done_method) && send(current_done_method)
        raise ActiveRecord::RecordInvalid.new(self)
      end

      next_stage_name = next_stage
      if next_stage_name
        update!(stage: next_stage_name)
        sync_workflow_substep
      end
    end

    def back_stage!
      if can_go_back?
        update!(stage: prev_stage)
        sync_workflow_substep
      else
        back_to_previous_project_step
      end
    end

    def sync_workflow_substep
      workflow = project&.launch_workflow
      return unless workflow

      workflow.advance_to(step: "ad_campaign", substep: stage)
    end

    def can_go_back?
      prev_stage.present?
    end

    def back_to_previous_project_step
      workflow = project&.launch_workflow
      return unless workflow

      prev_step, prev_substep = workflow.prev_step
      workflow.update!(step: prev_step, substep: prev_substep)
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

      # Structured snippets validation
      if structured_snippet.present?
        snippet_values = structured_snippet.values

        if snippet_values.blank? || !snippet_values.is_a?(Array)
          errors.add(:structured_snippet, "must have values")
        elsif !snippet_values.length.between?(3, 10)
          errors.add(:structured_snippet, "must have between 3-10 items (currently has #{snippet_values.length})")
        else
          snippet_values.each_with_index do |value, index|
            unless value.to_s.length.between?(1, 25)
              errors.add(:structured_snippet, "item #{index + 1} must be between 1-25 characters (currently #{value.to_s.length})")
            end
          end
        end
      end

      errors.empty?
    end

    def done_keywords_stage?
      errors.clear

      # Validate keywords for each ad group
      ad_groups.each do |ad_group|
        keyword_count = ad_group.keywords.count
        unless keyword_count.between?(5, 15)
          errors.add(:keywords, "must have between 5-15 keywords per ad group (currently has #{keyword_count})")
        end
      end

      errors.empty?
    end

    def done_settings_stage?
      errors.clear

      # Validate keywords for each ad group
      ad_groups.each do |ad_group|
        keyword_count = ad_group.keywords.count
        unless keyword_count.between?(5, 15)
          errors.add(:keywords, "must have between 5-15 keywords per ad group (currently has #{keyword_count})")
        end
      end

      # # Validate targeting and budget
      if location_targeting.empty?
        errors.add(:location_targeting, "must be configured")
      end

      if location_targeting.invalid?
        errors.add(:location_targeting, "must have at least 1 included location")
      end

      if schedule.blank? || schedule.empty?
        errors.add(:schedule, "must be configured")
      end

      unless daily_budget_cents&.positive?
        errors.add(:daily_budget, "must be greater than 0")
      end

      errors.empty?
    end

    def done_launch_stage?
      errors.clear

      if google_advertising_channel_type.blank?
        errors.add(:google_advertising_channel_type, "must be configured")
      end

      if google_bidding_strategy.blank?
        errors.add(:google_bidding_strategy, "must be configured")
      end

      if start_date.blank?
        errors.add(:start_date, "must be configured")
      end

      errors.empty?
    end

    def deployable?
      done_launch_stage? &&
        google_customer_id.present? &&
        google_conversion_id.present? &&
        google_conversion_label.present?
    end

    def can_go_live?
      deployable? && google_ready_to_enable?
    end

    def billing_enabled?
      false # set this up somewhere else
    end

    def done_review_stage?
      true
    end

    private

    def prev_stage_must_be_complete
      return if be_done_prev_stage?

      prev = prev_stage
      errors.add(:stage, "cannot advance to #{stage} until #{prev} stage is complete")
    end
  end
end
