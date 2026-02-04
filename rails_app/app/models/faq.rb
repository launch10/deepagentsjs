# frozen_string_literal: true

# == Schema Information
#
# Table name: faqs
#
#  id          :bigint           not null, primary key
#  answer      :text             not null
#  category    :string           not null
#  position    :integer          default(0), not null
#  published   :boolean          default(TRUE), not null
#  question    :string           not null
#  slug        :string           not null
#  subcategory :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_faqs_on_category                (category)
#  index_faqs_on_published_and_position  (published,position)
#  index_faqs_on_slug                    (slug) UNIQUE
#
class FAQ < ApplicationRecord
  self.table_name = "faqs"

  CATEGORIES = %w[
    getting_started
    credits_billing
    landing_pages
    google_ads
    account
  ].freeze

  CATEGORY_LABELS = {
    "getting_started" => "Getting Started",
    "credits_billing" => "Credits & Billing",
    "landing_pages" => "Landing Pages",
    "google_ads" => "Google Ads",
    "account" => "Account"
  }.freeze

  validates :question, presence: true
  validates :answer, presence: true
  validates :category, presence: true, inclusion: {in: CATEGORIES}
  validates :slug, presence: true, uniqueness: true

  before_validation :generate_slug, on: :create

  scope :published, -> { where(published: true) }
  scope :by_category, ->(cat) { where(category: cat) }
  scope :ordered, -> { order(:category, :position) }
  scope :search, ->(query) {
    where("question ILIKE :q OR answer ILIKE :q", q: "%#{sanitize_sql_like(query)}%")
  }

  def category_label
    CATEGORY_LABELS[category]
  end

  private

  def generate_slug
    return if slug.present?
    return if question.blank?

    base = question.parameterize
    self.slug = base

    counter = 1
    while FAQ.where(slug: slug).where.not(id: id).exists?
      self.slug = "#{base}-#{counter}"
      counter += 1
    end
  end
end
