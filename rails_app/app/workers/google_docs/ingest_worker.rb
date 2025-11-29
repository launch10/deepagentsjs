module GoogleDocs
  class IngestWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    def perform(job_run_id = nil)
      @job_run = job_run_id ? JobRun.find(job_run_id) : nil
      @job_run&.start!

      service = GoogleDocs::SyncService.new
      results = service.sync_all

      log_results(results)
      @job_run&.complete!
    rescue => e
      Rails.logger.error("[GoogleDocs::IngestWorker] Failed: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      @job_run&.fail!(e)
      raise
    end

    def self.enqueue_with_tracking
      job_run = JobRun.create_for(self.name)
      perform_async(job_run.id)
      job_run
    end

    private

    def log_results(results)
      Rails.logger.info("[GoogleDocs::IngestWorker] Sync completed:")
      Rails.logger.info("  Synced: #{results[:synced].count}")
      Rails.logger.info("  Skipped: #{results[:skipped].count}")
      Rails.logger.info("  Failed: #{results[:failed].count}")

      results[:failed].each do |failure|
        Rails.logger.warn("  - #{failure[:file]}: #{failure[:error]}")
      end
    end
  end
end
