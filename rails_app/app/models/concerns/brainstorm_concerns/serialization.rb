module BrainstormConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      project = website.project
      {
        id: project.id,
        website_id: website_id,
        name: name,
        thread_id: thread_id,
        account_id: project.account_id,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    end
  end
end
