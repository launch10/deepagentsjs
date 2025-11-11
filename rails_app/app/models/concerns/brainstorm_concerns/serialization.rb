module BrainstormConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      {
        id: website.project.id,
        website_id: website_id,
        name: website.project.name,
        thread_id: website.project.thread_id,
        account_id: website.project.account_id,
        created_at: website.project.created_at,
        updated_at: website.project.updated_at
      }
    end
  end
end
