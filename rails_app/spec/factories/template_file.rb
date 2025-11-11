FactoryBot.define do
  factory :template_file do
    template
    path { "/template.html" }
    content { "<div>Template Content</div>" }
  end
end
