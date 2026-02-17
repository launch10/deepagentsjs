module Deploys
  class AutoSupportTicketService
    def initialize(deploy, rollbar_uuid: nil)
      @deploy = deploy
      @rollbar_uuid = rollbar_uuid
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
        ("Rollbar: #{rollbar_url}" if rollbar_url.present?)
      ].compact.join("\n")
    end

    def rollbar_url
      @rollbar_url ||= rollbar_uuid_to_url(@rollbar_uuid) || report_to_rollbar
    end

    def rollbar_uuid_to_url(uuid)
      "https://rollbar.com/occurrence/uuid/?uuid=#{uuid}" if uuid.present?
    end

    def report_to_rollbar
      response = Rollbar.error(
        "Deploy ##{@deploy.id} failed",
        deploy_id: @deploy.id,
        project_id: @deploy.project_id,
        project_uuid: @deploy.project.uuid,
        current_step: @deploy.current_step,
        stacktrace: @deploy.stacktrace
      )
      uuid = response.is_a?(Hash) && response["uuid"]
      rollbar_uuid_to_url(uuid)
    rescue => e
      Rails.logger.warn("Failed to report deploy failure to Rollbar: #{e.message}")
      nil
    end
  end
end
