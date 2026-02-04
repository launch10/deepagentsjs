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
require "rails_helper"

RSpec.describe FAQ, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:question) }
    it { is_expected.to validate_presence_of(:answer) }
    it { is_expected.to validate_presence_of(:category) }
    it { is_expected.to validate_inclusion_of(:category).in_array(FAQ::CATEGORIES) }

    it "validates uniqueness of slug" do
      create(:faq, slug: "test-slug")
      faq = build(:faq, slug: "test-slug")
      expect(faq).not_to be_valid
      expect(faq.errors[:slug]).to include("has already been taken")
    end
  end

  describe "CATEGORIES" do
    it "includes expected categories" do
      expect(FAQ::CATEGORIES).to contain_exactly(
        "getting_started",
        "credits_billing",
        "landing_pages",
        "google_ads",
        "account"
      )
    end
  end

  describe "CATEGORY_LABELS" do
    it "has a label for each category" do
      FAQ::CATEGORIES.each do |cat|
        expect(FAQ::CATEGORY_LABELS[cat]).to be_present
      end
    end
  end

  describe "scopes" do
    let!(:published_faq) { create(:faq, published: true) }
    let!(:unpublished_faq) { create(:faq, published: false) }
    let!(:ads_faq) { create(:faq, category: "google_ads") }
    let!(:billing_faq) { create(:faq, category: "credits_billing") }

    describe ".published" do
      it "returns only published FAQs" do
        results = FAQ.published
        expect(results).to include(published_faq)
        expect(results).not_to include(unpublished_faq)
      end
    end

    describe ".by_category" do
      it "returns FAQs for the given category" do
        results = FAQ.by_category("credits_billing")
        expect(results).to include(billing_faq)
        expect(results).not_to include(ads_faq)
      end
    end

    describe ".search" do
      it "finds FAQs matching question text" do
        faq = create(:faq, question: "How do I set up my campaign?")
        results = FAQ.search("campaign")
        expect(results).to include(faq)
      end

      it "finds FAQs matching answer text" do
        faq = create(:faq, answer: "Click the deploy button to publish your page.")
        results = FAQ.search("deploy")
        expect(results).to include(faq)
      end

      it "is case-insensitive" do
        faq = create(:faq, question: "How do Headlines work?")
        results = FAQ.search("headlines")
        expect(results).to include(faq)
      end
    end
  end

  describe "#generate_slug" do
    it "auto-generates slug from question on create" do
      faq = create(:faq, question: "What is an Ad Group?", slug: nil)
      expect(faq.slug).to eq("what-is-an-ad-group")
    end

    it "handles duplicate slugs" do
      create(:faq, slug: "what-is-an-ad-group")
      faq = create(:faq, question: "What is an Ad Group?", slug: nil)
      expect(faq.slug).to eq("what-is-an-ad-group-1")
    end

    it "does not overwrite an existing slug" do
      faq = create(:faq, slug: "custom-slug")
      expect(faq.slug).to eq("custom-slug")
    end
  end

  describe "#category_label" do
    it "returns the display label for the category" do
      faq = build(:faq, category: "google_ads")
      expect(faq.category_label).to eq("Google Ads")
    end
  end

  describe "factory" do
    it "creates a valid FAQ" do
      faq = create(:faq)
      expect(faq).to be_valid
    end
  end
end
