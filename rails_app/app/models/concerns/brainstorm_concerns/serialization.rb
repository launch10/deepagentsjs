module BrainstormConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      project = website.project
      {
        id: id,
        website_id: website_id,
        project_id: project_id,
        name: name,
        thread_id: thread_id,
        account_id: project.account_id,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    end

    # Full brainstorm content for context API
    def to_json
      {
        id: id,
        idea: idea,
        audience: audience,
        solution: solution,
        social_proof: social_proof,
        look_and_feel: look_and_feel
      }
    end
  end
end
