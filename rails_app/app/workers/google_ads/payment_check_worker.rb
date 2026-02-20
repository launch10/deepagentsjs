module GoogleAds
  # Checks if Google Ads account has a payment method configured
  #
  # This worker is fired by checkPaymentNode in Langgraph.
  # It queries the Google Ads API for billing setup status and
  # notifies Langgraph of the result via webhook.
  class PaymentCheckWorker
    include Sidekiq::Worker
    include ::DeployJobHandler

    sidekiq_options queue: :default, retry: 3

    def perform(job_run_id)
      job_run = JobRun.find(job_run_id)
      job_run.start!

      account = job_run.account
      ads_account = account.ads_account

      # No ads account = no payment
      unless ads_account
        complete_with_status(job_run, has_payment: false, status: "none")
        return
      end

      # Check billing status via Google API
      billing = GoogleAds::Resources::Billing.new(ads_account)
      billing.fetch_status

      complete_with_status(job_run,
        has_payment: billing.has_payment?,
        status: billing.status)
    rescue => e
      handle_deploy_error(job_run, e)
    end

    private

    def complete_with_status(job_run, has_payment:, status:)
      result = { has_payment: has_payment, status: status }
      job_run.complete!(result)
      job_run.notify_langgraph(status: "completed", result: result)
    end
  end
end
