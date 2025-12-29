require "rails_helper"

RSpec.describe SocialLink, type: :model do
  describe "associations" do
    it { should belong_to(:project) }
  end

  describe "validations" do
    subject { build(:social_link, platform: "twitter") }

    it { should validate_presence_of(:platform) }
    it { should validate_inclusion_of(:platform).in_array(SocialLink::PLATFORMS) }

    describe "platform uniqueness" do
      it "validates uniqueness scoped to project" do
        project = create(:project)
        create(:social_link, project: project, platform: "twitter")
        duplicate = build(:social_link, project: project, platform: "twitter")

        expect(duplicate).not_to be_valid
        expect(duplicate.errors[:platform]).to include("has already been taken")
      end

      it "allows same platform for different projects" do
        project1 = create(:project)
        project2 = create(:project)
        create(:social_link, project: project1, platform: "twitter")
        other = build(:social_link, project: project2, platform: "twitter")

        expect(other).to be_valid
      end
    end

    describe "url format" do
      it "allows valid URLs" do
        social_link = build(:social_link, url: "https://twitter.com/example")
        expect(social_link).to be_valid
      end

      it "allows blank URLs" do
        social_link = build(:social_link, url: "")
        expect(social_link).to be_valid
      end

      it "allows nil URLs" do
        social_link = build(:social_link, url: nil)
        expect(social_link).to be_valid
      end

      it "rejects invalid URLs" do
        social_link = build(:social_link, url: "not-a-url")
        expect(social_link).not_to be_valid
        expect(social_link.errors[:url]).to be_present
      end
    end
  end

  describe "PLATFORMS" do
    it "includes expected platforms" do
      expect(SocialLink::PLATFORMS).to include("twitter", "instagram", "facebook", "linkedin")
    end
  end

  describe ".platform_options" do
    it "returns array of title/value pairs" do
      options = SocialLink.platform_options
      expect(options).to include(["Twitter", "twitter"])
      expect(options).to include(["Instagram", "instagram"])
    end
  end
end
