# == Schema Information
#
# Table name: themes
#
#  id                         :bigint           not null, primary key
#  colors                     :jsonb
#  name                       :string           not null
#  pairings                   :jsonb
#  theme                      :jsonb
#  theme_type                 :string           not null
#  typography_recommendations :jsonb
#  created_at                 :datetime         not null
#  updated_at                 :datetime         not null
#  author_id                  :bigint
#
# Indexes
#
#  index_themes_on_author_id   (author_id)
#  index_themes_on_name        (name)
#  index_themes_on_theme_type  (theme_type)
#

class Theme < ApplicationRecord
  include ThemeConcerns::SemanticVariables
  include ThemeConcerns::TypographyRecommendations

  has_many :theme_to_theme_labels, dependent: :destroy
  has_many :theme_labels, through: :theme_to_theme_labels
  has_many :websites
  belongs_to :author, class_name: "Account", optional: true

  alias_method :labels, :theme_labels

  validates :theme_type, presence: true, inclusion: { in: %w[community official] }
  validate :community_theme_must_have_author

  before_save :save_semantic_variables, if: :should_save_semantic_variables?

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

  # Compute WCAG-compliant color pairings for the theme's colors.
  # Delegates to the SemanticVariables concern.
  #
  # @param min_contrast [Float] Minimum contrast ratio (default: WCAG AA 4.5:1)
  # @return [Hash] Pairings hash mapping each color to its accessible pairs
  def compute_pairings(min_contrast: ThemeConcerns::SemanticVariables::WCAG_AA_NORMAL_TEXT)
    ThemeConcerns::SemanticVariables.compute_pairings(colors, min_contrast: min_contrast)
  end

  # Format typography recommendations as human-readable text for AI prompts.
  # Includes guidance on which colors to use for headlines, subheadlines, and body text.
  #
  # @return [String] Formatted typography guidance
  def typography_guide_for_prompt
    recs = typography_recommendations.presence || ThemeConcerns::TypographyRecommendations.compute_recommendations(colors, pairings)
    ThemeConcerns::TypographyRecommendations.format_for_prompt(recs, colors)
  end

  private

  def should_save_semantic_variables?
    colors_changed? && colors.present?
  end

  def save_semantic_variables
    self.theme = ThemeConcerns::SemanticVariables.create_semantic_variables(colors)
    self.pairings = ThemeConcerns::SemanticVariables.compute_pairings(colors)
    self.typography_recommendations = ThemeConcerns::TypographyRecommendations.compute_recommendations(colors, pairings)
  end

  def community_theme_must_have_author
    if theme_type == "community" && author.nil?
      errors.add(:author, "must be present for community themes")
    end
  end
end
