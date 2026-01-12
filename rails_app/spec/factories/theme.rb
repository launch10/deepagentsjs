FactoryBot.define do
  factory :theme do
    sequence(:name) { |n| "Theme #{n}" }
    colors { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
    theme { {"--primary" => "197 37% 24%", "--background" => "43 74% 66%"} }
    theme_type { "official" }
    author { nil }

    trait :official do
      theme_type { "official" }
      author { nil }
      theme { {"--primary" => "197 37% 24%", "--background" => "43 74% 66%"} }
    end

    trait :official_without_theme do
      theme_type { "official" }
      author { nil }
      theme { nil }
      colors { nil }
    end

    trait :community do
      theme_type { "community" }
      author { association :account }
      # Let the callback generate the theme
      theme { nil }
    end

    trait :with_expanded_theme do
      after(:build) do |theme|
        theme.theme = Themes::ColorExpander.expand(theme.colors) if theme.colors.present?
      end
    end
  end

  factory :theme_label do
    sequence(:name) { |n| "Label #{n}" }
  end
end
