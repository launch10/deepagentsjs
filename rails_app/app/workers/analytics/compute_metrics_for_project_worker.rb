# frozen_string_literal: true

module Analytics
  # Computes daily metrics for a single project.
  #
  # Called by ComputeDailyMetricsWorker for each project, enabling granular retries.
  # Delegates to ComputeMetricsService for the actual computation.
  #
  class ComputeMetricsForProjectWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    # @param project_id [Integer] The Project ID to compute metrics for
    # @param date_string [String] ISO8601 date string
    #
    def perform(project_id, date_string)
      project = Project.find(project_id)
      target_date = Date.parse(date_string)

      Analytics::ComputeMetricsService.new(project, date: target_date).call
    end
  end
end
