FactoryBot.define do
  factory :theme do
    sequence(:name) { |n| "Theme #{n}" }
    colors { {primary: "#000000", secondary: "#ffffff"} }
    theme { {font: "Inter", spacing: "normal"} }
  end

  factory :theme_label do
    sequence(:name) { |n| "Label #{n}" }
  end
end
