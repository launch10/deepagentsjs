module BrainstormConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_brainstorm!(account, brainstorm_params)
        transaction do
          # Default name is MM/DD/YYYY HH:MM:SS
          default_name = Time.current.strftime("%m/%d/%Y %H:%M:%S")
          name = brainstorm_params[:name].presence || default_name

          # Create project
          project = account.projects.create!(
            name: name
          )

          project.workflows.create!(
            workflow_type: "launch",
            step: "brainstorm",
          )

          # Create website
          website = Website.create!(
            project_id: project.id,
            name: project.name,
            account_id: project.account_id
          )

          # Create brainstorm
          brainstorm = create!(
            website_id: website.id,
            thread_id: brainstorm_params[:thread_id]
          )

          # Create chat with type 'brainstorm'
          chat = Chat.create!(
            name: project.name,
            chat_type: "brainstorm",
            thread_id: brainstorm_params[:thread_id],
            project_id: project.id,
            account_id: project.account_id,
            contextable: brainstorm
          )

          {
            project: project,
            website: website,
            brainstorm: brainstorm,
            chat: chat
          }
        end
      end
    end
  end
end
