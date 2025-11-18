module ProjectConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      {
        id: id,
        website_id: website&.id,
        account_id: account_id,
        name: name,
        created_at: created_at,
        updated_at: updated_at
      }
    end
  end
end
