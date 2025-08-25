FactoryBot.define do
  factory :website_file do
    website
    path { "/index.html" }
    content { "<h1>Hello World</h1>" }
  end
end