require "rails_helper"

RSpec.describe GoogleAds::Sync::Syncable do
  before(:all) do
    Database::Snapshotter.restore_snapshot("campaign_complete")
  end

  let(:campaign) { Campaign.first }
  let(:account) { campaign.account }
  let(:ads_account) do
    account.ads_accounts.find_or_create_by!(platform: "google") do |aa|
      aa.google_descriptive_name = "Test Ads Account"
      aa.google_currency_code = "USD"
      aa.google_time_zone = "America/New_York"
      aa.google_customer_id = "1234567890"
    end
  end

  describe "#build_comparisons" do
    context "with basic field mappings" do
      let(:remote_resource) do
        double("RemoteAccount",
          descriptive_name: ads_account.google_descriptive_name,
          currency_code: ads_account.google_currency_code,
          time_zone: ads_account.google_time_zone,
          status: :ENABLED,
          auto_tagging_enabled: true
        )
      end

      let(:syncable) { GoogleAds::Account.new(ads_account) }

      before do
        allow(syncable).to receive(:remote_resource).and_return(remote_resource)
      end

      it "builds comparisons for each field in the mapping" do
        comparisons = syncable.build_comparisons

        expect(comparisons).to be_an(Array)
        expect(comparisons.length).to be >= 1
      end

      it "creates FieldComparison objects with correct our_value" do
        comparisons = syncable.build_comparisons
        name_comparison = comparisons.find { |c| c.our_field == :google_descriptive_name }

        expect(name_comparison.our_value).to eq(ads_account.google_descriptive_name)
      end

      it "creates FieldComparison objects with correct their_value" do
        comparisons = syncable.build_comparisons
        name_comparison = comparisons.find { |c| c.our_field == :google_descriptive_name }

        expect(name_comparison.their_value).to eq(ads_account.google_descriptive_name)
      end

      it "includes fields with nil our_value to detect sync differences" do
        local = double("LocalResource",
          class: AdsAccount,
          google_descriptive_name: "Test",
          google_currency_code: nil,
          google_time_zone: nil,
          google_status: nil,
          google_auto_tagging_enabled: nil
        )
        allow(local).to receive(:respond_to?).with(anything).and_return(true)
        allow(local).to receive(:send) do |method|
          case method
          when :google_descriptive_name then "Test"
          else nil
          end
        end

        syncable_class = Class.new(described_class) { def fetch_remote; nil; end }
        no_currency_syncable = syncable_class.new(local)
        allow(no_currency_syncable).to receive(:remote_resource).and_return(remote_resource)

        comparisons = no_currency_syncable.build_comparisons

        currency_comparison = comparisons.find { |c| c.our_field == :google_currency_code }
        expect(currency_comparison).not_to be_nil
        expect(currency_comparison.our_value).to be_nil
        expect(currency_comparison.their_value).to eq(ads_account.google_currency_code)
      end
    end

    context "with nested_field (single level nesting)" do
      let(:keyword) { campaign.ad_groups.first.keywords.first }

      let(:keyword_info) do
        double("KeywordInfo", text: keyword.text, match_type: keyword.match_type.upcase.to_sym)
      end

      let(:remote_resource) do
        double("RemoteCriterion",
          resource_name: "customers/123/adGroupCriteria/456~789",
          criterion_id: 789,
          keyword: keyword_info,
          status: :ENABLED
        )
      end

      let(:syncable) { GoogleAds::Keyword.new(keyword) }

      before do
        allow(syncable).to receive(:remote_resource).and_return(remote_resource)
      end

      it "extracts nested field values" do
        comparisons = syncable.build_comparisons

        text_comparison = comparisons.find { |c| c.our_field == :text }
        expect(text_comparison.their_value).to eq(keyword.text)
      end

      it "handles nested match_type field" do
        comparisons = syncable.build_comparisons

        match_comparison = comparisons.find { |c| c.our_field == :match_type }
        expect(match_comparison.their_value).to eq(keyword.match_type.upcase.to_sym)
      end
    end

    context "with nested_fields (multi-level nesting)" do
      let(:ad) { campaign.ad_groups.first.ads.first }

      let(:responsive_search_ad) do
        double("ResponsiveSearchAd", path1: ad.display_path_1, path2: ad.display_path_2)
      end

      let(:ad_resource) do
        double("AdResource",
          id: ad.google_ad_id,
          final_urls: ad.final_urls,
          responsive_search_ad: responsive_search_ad
        )
      end

      let(:remote_resource) do
        double("RemoteAdGroupAd",
          resource_name: "customers/123/adGroupAds/222~#{ad.google_ad_id}",
          ad: ad_resource,
          status: :ENABLED
        )
      end

      let(:syncable) { GoogleAds::Ad.new(ad) }

      before do
        allow(syncable).to receive(:remote_resource).and_return(remote_resource)
      end

      it "extracts deeply nested field values" do
        comparisons = syncable.build_comparisons

        path1_comparison = comparisons.find { |c| c.our_field == :display_path_1 }
        expect(path1_comparison.their_value).to eq(ad.display_path_1) if ad.display_path_1.present?

        path2_comparison = comparisons.find { |c| c.our_field == :display_path_2 }
        expect(path2_comparison.their_value).to eq(ad.display_path_2) if ad.display_path_2.present?
      end
    end

    context "with ignore_when" do
      let(:remote_resource) do
        double("RemoteAccount",
          descriptive_name: ads_account.google_descriptive_name,
          currency_code: ads_account.google_currency_code,
          time_zone: ads_account.google_time_zone,
          status: :ENABLED,
          auto_tagging_enabled: true
        )
      end

      let(:syncable) { GoogleAds::Account.new(ads_account) }

      before do
        ads_account.google_status = "ENABLED"
        ads_account.save!
        allow(syncable).to receive(:remote_resource).and_return(remote_resource)
        allow(GoogleAds).to receive(:is_test_mode?).and_return(true)
      end

      it "skips fields where ignore_when is true" do
        comparisons = syncable.build_comparisons

        status_comparison = comparisons.find { |c| c.our_field == :google_status }
        expect(status_comparison).to be_nil
      end
    end

    context "with their_value_transform" do
      let(:remote_resource) do
        double("RemoteCampaign",
          resource_name: "customers/123/campaigns/#{campaign.google_campaign_id}",
          id: campaign.google_campaign_id,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH,
          contains_eu_political_advertising: :UNSPECIFIED
        )
      end

      let(:syncable) { GoogleAds::Campaign.new(campaign) }

      before do
        campaign.google_contains_eu_political_advertising = false
        campaign.save!
        allow(syncable).to receive(:remote_resource).and_return(remote_resource)
      end

      it "applies their_value_transform when comparing" do
        comparisons = syncable.build_comparisons

        eu_comparison = comparisons.find { |c| c.our_field == :google_contains_eu_political_advertising }
        expect(eu_comparison).not_to be_nil
        expect(eu_comparison.transformed_their_value).to eq(:DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
      end
    end

    context "when local_resource is nil" do
      let(:syncable_class) do
        Class.new(described_class) do
          def fetch_remote
            nil
          end
        end
      end

      let(:syncable) { syncable_class.new(nil) }

      it "returns empty array" do
        expect(syncable.build_comparisons).to eq([])
      end
    end

    context "when remote_resource is nil" do
      let(:syncable) { GoogleAds::Account.new(ads_account) }

      before do
        allow(syncable).to receive(:remote_resource).and_return(nil)
      end

      it "returns empty array" do
        expect(syncable.build_comparisons).to eq([])
      end
    end
  end

  describe "#extract_remote_value" do
    let(:syncable) { GoogleAds::Account.new(ads_account) }

    context "with no nesting" do
      let(:remote) { double("Remote", name: "Test Name") }
      let(:mapping) { { their_field: :name } }

      it "returns the direct field value" do
        result = syncable.send(:extract_remote_value, remote, mapping)
        expect(result).to eq("Test Name")
      end
    end

    context "with nested_field" do
      let(:nested) { double("Nested", text: "nested value") }
      let(:remote) { double("Remote", keyword: nested) }
      let(:mapping) { { their_field: :text, nested_field: :keyword } }

      it "returns the nested field value" do
        result = syncable.send(:extract_remote_value, remote, mapping)
        expect(result).to eq("nested value")
      end
    end

    context "with nested_fields array" do
      let(:deeply_nested) { double("DeeplyNested", path1: "deep value") }
      let(:nested) { double("Nested", responsive_search_ad: deeply_nested) }
      let(:remote) { double("Remote", ad: nested) }
      let(:mapping) { { their_field: :path1, nested_fields: [:ad, :responsive_search_ad] } }

      it "returns the deeply nested field value" do
        result = syncable.send(:extract_remote_value, remote, mapping)
        expect(result).to eq("deep value")
      end
    end

    context "when nested object is nil" do
      let(:remote) { double("Remote", keyword: nil) }
      let(:mapping) { { their_field: :text, nested_field: :keyword } }

      it "returns nil" do
        result = syncable.send(:extract_remote_value, remote, mapping)
        expect(result).to be_nil
      end
    end

    context "when remote is nil" do
      let(:mapping) { { their_field: :name } }

      it "returns nil" do
        result = syncable.send(:extract_remote_value, nil, mapping)
        expect(result).to be_nil
      end
    end
  end
end
