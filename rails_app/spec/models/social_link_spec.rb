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

      it "rejects blank URLs" do
        social_link = build(:social_link, platform: "facebook", url: "")
        expect(social_link).not_to be_valid
        expect(social_link.errors[:url]).to be_present
      end

      it "rejects nil URLs" do
        social_link = build(:social_link, platform: "facebook", url: nil)
        expect(social_link).not_to be_valid
        expect(social_link.errors[:url]).to be_present
      end

      it "rejects invalid URLs for non-normalizable platforms" do
        # For non-normalizable platforms (facebook, linkedin, etc.), invalid URLs should be rejected
        social_link = build(:social_link, platform: "facebook", url: "not-a-url")
        expect(social_link).not_to be_valid
        expect(social_link.errors[:url]).to be_present
      end

      it "accepts usernames for normalizable platforms (treated as usernames)" do
        # For normalizable platforms, plain usernames are converted to full URLs
        social_link = build(:social_link, platform: "twitter", url: "myusername")
        expect(social_link).to be_valid
        expect(social_link.url).to eq("https://twitter.com/myusername")
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

  describe "URL normalization" do
    describe "Twitter" do
      let(:project) { create(:project) }

      it "normalizes http://twitter.com/username to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "http://twitter.com/johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes https://www.twitter.com/username to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "https://www.twitter.com/johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes http://www.twitter.com/username to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "http://www.twitter.com/johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes plain username to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes @username to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "@johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes x.com URLs to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "https://x.com/johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "normalizes http://x.com URLs to https://twitter.com/username" do
        link = create(:social_link, project: project, platform: "twitter", url: "http://x.com/johndoe")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end

      it "rejects blank URLs" do
        link = build(:social_link, project: project, platform: "twitter", url: "")
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "rejects nil URLs" do
        link = build(:social_link, project: project, platform: "twitter", url: nil)
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "handles URLs with trailing slashes" do
        link = create(:social_link, project: project, platform: "twitter", url: "https://twitter.com/johndoe/")
        expect(link.url).to eq("https://twitter.com/johndoe")
      end
    end

    describe "Instagram" do
      let(:project) { create(:project) }

      it "normalizes http://instagram.com/username to https://instagram.com/username" do
        link = create(:social_link, project: project, platform: "instagram", url: "http://instagram.com/johndoe")
        expect(link.url).to eq("https://instagram.com/johndoe")
      end

      it "normalizes https://www.instagram.com/username to https://instagram.com/username" do
        link = create(:social_link, project: project, platform: "instagram", url: "https://www.instagram.com/johndoe")
        expect(link.url).to eq("https://instagram.com/johndoe")
      end

      it "normalizes plain username to https://instagram.com/username" do
        link = create(:social_link, project: project, platform: "instagram", url: "johndoe")
        expect(link.url).to eq("https://instagram.com/johndoe")
      end

      it "normalizes @username to https://instagram.com/username" do
        link = create(:social_link, project: project, platform: "instagram", url: "@johndoe")
        expect(link.url).to eq("https://instagram.com/johndoe")
      end

      it "rejects blank URLs" do
        link = build(:social_link, project: project, platform: "instagram", url: "")
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "rejects nil URLs" do
        link = build(:social_link, project: project, platform: "instagram", url: nil)
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "handles URLs with trailing slashes" do
        link = create(:social_link, project: project, platform: "instagram", url: "https://instagram.com/johndoe/")
        expect(link.url).to eq("https://instagram.com/johndoe")
      end
    end

    describe "YouTube" do
      let(:project) { create(:project) }

      it "normalizes http://youtube.com/@username to https://youtube.com/@username" do
        link = create(:social_link, project: project, platform: "youtube", url: "http://youtube.com/@johndoe")
        expect(link.url).to eq("https://youtube.com/@johndoe")
      end

      it "normalizes https://www.youtube.com/@username to https://youtube.com/@username" do
        link = create(:social_link, project: project, platform: "youtube", url: "https://www.youtube.com/@johndoe")
        expect(link.url).to eq("https://youtube.com/@johndoe")
      end

      it "normalizes @username to https://youtube.com/@username" do
        link = create(:social_link, project: project, platform: "youtube", url: "@johndoe")
        expect(link.url).to eq("https://youtube.com/@johndoe")
      end

      it "normalizes plain username (assumes @ handle) to https://youtube.com/@username" do
        link = create(:social_link, project: project, platform: "youtube", url: "johndoe")
        expect(link.url).to eq("https://youtube.com/@johndoe")
      end

      it "preserves channel URLs with channel ID" do
        link = create(:social_link, project: project, platform: "youtube", url: "https://youtube.com/channel/UC1234567890")
        expect(link.url).to eq("https://youtube.com/channel/UC1234567890")
      end

      it "normalizes www.youtube.com/channel URLs" do
        link = create(:social_link, project: project, platform: "youtube", url: "https://www.youtube.com/channel/UC1234567890")
        expect(link.url).to eq("https://youtube.com/channel/UC1234567890")
      end

      it "preserves custom channel URLs (/c/name)" do
        link = create(:social_link, project: project, platform: "youtube", url: "https://youtube.com/c/mychannel")
        expect(link.url).to eq("https://youtube.com/c/mychannel")
      end

      it "rejects blank URLs" do
        link = build(:social_link, project: project, platform: "youtube", url: "")
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "rejects nil URLs" do
        link = build(:social_link, project: project, platform: "youtube", url: nil)
        expect(link).not_to be_valid
        expect(link.errors[:url]).to be_present
      end

      it "handles URLs with trailing slashes" do
        link = create(:social_link, project: project, platform: "youtube", url: "https://youtube.com/@johndoe/")
        expect(link.url).to eq("https://youtube.com/@johndoe")
      end
    end

    describe "other platforms" do
      let(:project) { create(:project) }

      it "does not modify URLs for unsupported platforms like facebook" do
        link = create(:social_link, project: project, platform: "facebook", url: "https://facebook.com/johndoe")
        expect(link.url).to eq("https://facebook.com/johndoe")
      end

      it "does not modify URLs for linkedin" do
        link = create(:social_link, project: project, platform: "linkedin", url: "https://linkedin.com/in/johndoe")
        expect(link.url).to eq("https://linkedin.com/in/johndoe")
      end
    end
  end
end
