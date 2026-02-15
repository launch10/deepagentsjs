module Deploys
  class AutoSupportTicketService
    def initialize(deploy)
      @deploy = deploy
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
        ("Error: #{@deploy.stacktrace}" if @deploy.stacktrace.present?)
      ].compact.join("\n")
    end
  end
end
