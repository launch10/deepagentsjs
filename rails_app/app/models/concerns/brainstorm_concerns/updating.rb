module BrainstormConcerns
  module Updating
    extend ActiveSupport::Concern

    class_methods do
      def update_brainstorm!(brainstorm, update_params)
        transaction do
          project = brainstorm.website.project
          chat = brainstorm.chat

          if update_params[:name].present?
            project.update!(name: update_params[:name])
            chat&.update!(name: update_params[:name])
          end

          brainstorm_fields = update_params.except(:thread_id, :account_id, :name)
          brainstorm.update!(brainstorm_fields)

          {
            project: project,
            brainstorm: brainstorm,
            chat: chat
          }
        end
      end
    end
  end
end
