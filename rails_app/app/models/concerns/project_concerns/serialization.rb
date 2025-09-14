module ProjectConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      {
        id: id,
        website_id: website.id,
        name: name,
        thread_id: thread_id,
        created_at: created_at,
        updated_at: updated_at
      }
    end
  end
end
