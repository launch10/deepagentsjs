module Deploys
  class AutoSupportTicketService
    def initialize(deploy, sentry_event_id: nil)
      @deploy = deploy
      @sentry_event_id = sentry_event_id
    end

    def call
      return if @deploy.support_request.present?

      account = @deploy.project.account
      SupportRequest.create!(
        user: account.owner,
        account: account,
        supportable: @deploy,
        category: "Report a bug",
        subject: "Deploy ##{@deploy.id} failed",
        description: build_description,
        submitted_from_url: "/projects/#{@deploy.project.uuid}/deploy"
      )
    end

    private

    def build_description
      [
        "Automated ticket: deploy ##{@deploy.id} failed.",
        "Project: #{@deploy.project.name} (#{@deploy.project.uuid})",
        ("Step: #{@deploy.current_step}" if @deploy.current_step.present?),
        ("Error: #{@deploy.stacktrace}" if @deploy.stacktrace.present?),
        ("Sentry: #{sentry_url}" if sentry_url.present?)
      ].compact.join("\n")
    end

    def sentry_url
      @sentry_url ||= sentry_event_id_to_url(@sentry_event_id) || report_to_sentry
    end

    def sentry_event_id_to_url(event_id)
      "https://sentry.io/organizations/launch10/issues/?query=#{event_id}" if event_id.present?
    end

    def report_to_sentry
      event = Sentry.capture_message(
        "Deploy ##{@deploy.id} failed",
        extra: {
          deploy_id: @deploy.id,
          project_id: @deploy.project_id,
          project_uuid: @deploy.project.uuid,
          current_step: @deploy.current_step,
          stacktrace: @deploy.stacktrace
        }
      )
      event_id = event&.event_id
      sentry_event_id_to_url(event_id)
    rescue => e
      Rails.logger.warn("Failed to report deploy failure to Sentry: #{e.message}")
      nil
    end
  end
end
