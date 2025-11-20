# == Schema Information
#
# Table name: themes
#
#  id         :bigint           not null, primary key
#  colors     :jsonb
#  name       :string           not null
#  theme      :jsonb
#  theme_type :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  author_id  :bigint
#
# Indexes
#
#  index_themes_on_author_id   (author_id)
#  index_themes_on_name        (name)
#  index_themes_on_theme_type  (theme_type)
#

class Theme < ApplicationRecord
  has_many :theme_to_theme_labels, dependent: :destroy
  has_many :theme_labels, through: :theme_to_theme_labels
  belongs_to :author, class_name: "Account", optional: true

  alias_method :labels, :theme_labels

  validates :theme_type, presence: true, inclusion: { in: %w[community official] }
  validate :community_theme_must_have_author

  scope :official, -> { where(theme_type: "official") }
  scope :community, -> { where(theme_type: "community") }
  scope :author, ->(account_id) { where(author_id: account_id) }

  scope :with_label, ->(label) do
    joins(theme_labels: :theme_to_theme_labels)
      .where("theme_labels.name = ?", label)
  end

  def author=(account)
    return if account.nil?

    unless account.is_a?(Account)
      raise ArgumentError, "Author must be an Account"
    end
    self.theme_type = "community"
    
    super
  end

  private

  def community_theme_must_have_author
    if theme_type == "community" && author.nil?
      errors.add(:author, "must be present for community themes")
    end
  end
end
