FactoryBot.define do
  factory :template do
    sequence(:name) { |n| "Template #{n}" }

    trait :with_index_css do
      after(:create) do |template|
        index_css_content = File.read(Rails.root.join("templates/default/src/index.css"))
        template.files.create!(path: "src/index.css", content: index_css_content)
      end
    end
  end
end
