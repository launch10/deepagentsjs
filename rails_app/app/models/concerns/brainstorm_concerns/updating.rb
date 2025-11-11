module BrainstormConcerns
  module Updating
    extend ActiveSupport::Concern

    class_methods do
      def update_brainstorm!(brainstorm, update_params)
        transaction do
          if update_params[:name].present?
            project = brainstorm.website.project
            website = brainstorm.website
            chat = brainstorm.chat

            project.update!(name: update_params[:name])
            website.update!(name: update_params[:name])
            chat.update!(name: update_params[:name]) if chat
          end

          brainstorm_fields = update_params.except(:thread_id, :account_id)
          brainstorm.update!(update_params)

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
