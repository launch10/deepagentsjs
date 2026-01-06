require "rails_helper"

RSpec.describe GoogleAds::Resources::StructuredSnippet do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:structured_snippet) do
    create(:ad_structured_snippet,
      campaign: campaign,
      category: "services",
      values: ["Web Design", "SEO", "Marketing"])
  end
  let(:resource) { described_class.new(structured_snippet) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  # ═══════════════════════════════════════════════════════════════
  # CLASS METHODS
  # ═══════════════════════════════════════════════════════════════

  describe ".synced?" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    context "when no structured snippet exists" do
      it "returns true" do
        structured_snippet.destroy!
        expect(described_class.synced?(campaign)).to be true
      end
    end

    context "when structured snippet is synced" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "returns true when remote matches" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(described_class.synced?(campaign)).to be true
      end
    end

    context "when structured snippet is not synced" do
      it "returns false when asset exists but remote not found" do
        structured_snippet # ensure it exists
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        expect(described_class.synced?(campaign)).to be false
      end
    end

    context "when soft-deleted snippet has google_asset_id" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
        structured_snippet.destroy
      end

      it "returns false (needs cleanup)" do
        expect(described_class.synced?(campaign)).to be false
      end
    end
  end

  describe ".sync_all" do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it "returns a CollectionSyncResult" do
      structured_snippet.platform_settings["google"]["asset_id"] = "88888"
      structured_snippet.save!

      asset_response = mock_search_response_with_structured_snippet_asset(
        asset_id: 88888,
        customer_id: 1234567890,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

      result = described_class.sync_all(campaign)
      expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end

    it "deletes soft-deleted snippets with asset_ids" do
      structured_snippet.platform_settings["google"]["asset_id"] = "88888"
      structured_snippet.save!
      structured_snippet.destroy

      # Stub campaign methods on all campaigns to handle the reloaded associations
      allow_any_instance_of(Campaign).to receive(:google_customer_id).and_return("1234567890")
      allow_any_instance_of(Campaign).to receive(:google_campaign_id).and_return(789)

      mock_remove_operation = double("RemoveOperation")
      allow(@mock_remove_resource).to receive(:campaign_asset)
        .with("customers/1234567890/campaignAssets/789~88888~STRUCTURED_SNIPPET")
        .and_return(mock_remove_operation)
      allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
        .and_return(double("MutateResponse"))

      result = described_class.sync_all(campaign)
      expect(result.results.first.deleted?).to be true
    end
  end

  describe ".sync_plan" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service)
      )
    end

    it "returns a Plan with operations" do
      structured_snippet # ensure it exists
      allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

      plan = described_class.sync_plan(campaign)
      expect(plan).to be_a(GoogleAds::Sync::Plan)
      expect(plan.operations.first[:action]).to eq(:create)
    end

    it "includes delete operations for soft-deleted snippets" do
      structured_snippet.platform_settings["google"]["asset_id"] = "88888"
      structured_snippet.save!
      structured_snippet.destroy

      plan = described_class.sync_plan(campaign)
      expect(plan.operations.any? { |op| op[:action] == :delete }).to be true
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # INSTANCE METHODS
  # ═══════════════════════════════════════════════════════════════

  describe "#synced?" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service)
      )
    end

    context "when remote exists and matches" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "returns true" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(resource.synced?).to be true
      end
    end

    context "when values mismatch" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.values = ["Different", "Values", "Here"]
        structured_snippet.save!
      end

      it "returns false" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(resource.synced?).to be false
      end
    end

    context "when remote does not exist" do
      it "returns false" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        expect(resource.synced?).to be false
      end
    end
  end

  describe "#sync" do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context "when already synced" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "returns unchanged result" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = resource.sync
        expect(result.unchanged?).to be true
        expect(result.resource_name).to eq("88888")
      end
    end

    context "when remote does not exist" do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it "creates asset and links to campaign" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_asset = mock_asset_with_structured_snippet_resource
        mock_snippet_asset = mock_structured_snippet_asset_resource
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 99999, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets).and_return(mutate_asset_response)

        mock_campaign_asset = mock_campaign_asset_resource
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
          asset_id: 99999,
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets).and_return(mutate_campaign_asset_response)

        result = resource.sync
        expect(result.created?).to be true
        expect(result.resource_name).to eq(99999)
        expect(structured_snippet.reload.google_asset_id).to eq("99999")
      end
    end

    context "when remote exists but values changed (recreate needed)" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.values = ["New", "Values", "Here"]
        structured_snippet.save!
      end

      it "unlinks old asset, creates new asset and links" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        # Unlink old
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_asset)
          .with("customers/1234567890/campaignAssets/789~88888~STRUCTURED_SNIPPET")
          .and_return(mock_remove_operation)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(double("MutateResponse"))

        # Create new
        mock_asset = mock_asset_with_structured_snippet_resource
        mock_snippet_asset = mock_structured_snippet_asset_resource
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 99999, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets).and_return(mutate_asset_response)

        mock_campaign_asset = mock_campaign_asset_resource
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
          asset_id: 99999,
          campaign_id: 789,
          customer_id: 1234567890
        )

        result = resource.sync
        expect(result.created?).to be true
        expect(result.resource_name).to eq(99999)
      end
    end

    context "when API call fails" do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it "returns error result" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_asset = mock_asset_with_structured_snippet_resource
        mock_snippet_asset = mock_structured_snippet_asset_resource
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_raise(mock_google_ads_error(message: "Asset creation failed"))

        result = resource.sync
        expect(result.error?).to be true
      end
    end
  end

  describe "#sync_plan" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service)
      )
    end

    context "when remote does not exist" do
      it "returns plan with create operation" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        plan = resource.sync_plan
        expect(plan.operations.length).to eq(1)
        expect(plan.operations.first[:action]).to eq(:create)
        expect(plan.operations.first[:header]).to eq("Service catalog")
        expect(plan.operations.first[:values]).to eq(["Web Design", "SEO", "Marketing"])
      end
    end

    context "when remote exists but needs recreate" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.values = ["Different", "Values", "Here"]
        structured_snippet.save!
      end

      it "returns plan with recreate operation" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        plan = resource.sync_plan
        expect(plan.operations.first[:action]).to eq(:recreate)
        expect(plan.operations.first[:reason]).to eq("assets are immutable")
      end
    end

    context "when already synced" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "returns empty plan" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        plan = resource.sync_plan
        expect(plan.operations).to be_empty
      end
    end
  end

  describe "#delete" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    context "when asset_id is not present" do
      it "returns not_found result" do
        result = resource.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_asset)
      end
    end

    context "when asset_id is present" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "unlinks campaign asset and clears asset_id" do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_asset)
          .with("customers/1234567890/campaignAssets/789~88888~STRUCTURED_SNIPPET")
          .and_return(mock_remove_operation)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(double("MutateResponse"))

        result = resource.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_asset)
        expect(structured_snippet.reload.google_asset_id).to be_nil
      end

      it "clears asset_id on RESOURCE_NOT_FOUND error" do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_asset).and_return(mock_remove_operation)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_raise(mock_google_ads_error(
            message: "Resource not found",
            error_type: :mutate_error,
            error_value: :RESOURCE_NOT_FOUND
          ))

        result = resource.delete
        expect(result.deleted?).to be true
        expect(structured_snippet.reload.google_asset_id).to be_nil
      end

      it "returns error on other API failures" do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_asset).and_return(mock_remove_operation)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_raise(mock_google_ads_error(message: "Other error"))

        result = resource.delete
        expect(result.error?).to be true
      end
    end
  end

  describe "#fetch" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service)
      )
    end

    context "when asset exists by ID" do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = "88888"
        structured_snippet.save!
      end

      it "returns RemoteStructuredSnippet" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = resource.fetch
        expect(remote).to be_a(described_class::RemoteStructuredSnippet)
        expect(remote.id).to eq(88888)
        expect(remote.header).to eq("Service catalog")
        expect(remote.values).to eq(["Web Design", "SEO", "Marketing"])
      end
    end

    context "when asset exists by content (backfill)" do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it "returns RemoteStructuredSnippet and backfills asset_id" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = resource.fetch
        expect(remote.id).to eq(88888)
        expect(structured_snippet.reload.google_asset_id).to eq("88888")
      end
    end

    context "when asset does not exist" do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it "returns nil" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        expect(resource.fetch).to be_nil
      end
    end
  end

  describe "#compare_fields" do
    it "compares header and values" do
      remote = described_class::RemoteStructuredSnippet.new(
        resource_name: "customers/123/assets/456",
        id: 456,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )

      comparison = resource.compare_fields(remote)
      expect(comparison.match?).to be true
    end

    it "detects values mismatch" do
      remote = described_class::RemoteStructuredSnippet.new(
        resource_name: "customers/123/assets/456",
        id: 456,
        header: "Service catalog",
        values: ["Different", "Values", "Here"]
      )

      comparison = resource.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:values)
    end

    it "detects header mismatch" do
      structured_snippet.update!(category: "amenities")

      remote = described_class::RemoteStructuredSnippet.new(
        resource_name: "customers/123/assets/456",
        id: 456,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )

      comparison = resource.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:header)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FIELD MAPPABLE
  # ═══════════════════════════════════════════════════════════════

  describe ".field_mappings" do
    it "registers all expected fields" do
      expect(described_class.field_mappings.keys).to contain_exactly(:header, :values)
    end

    it "has no immutable fields" do
      immutable_fields = described_class.field_mappings.select { |_, m| m[:immutable] }.keys
      expect(immutable_fields).to be_empty
    end

    it "returns all fields as mutable" do
      expect(described_class.mutable_fields).to contain_exactly(:header, :values)
    end
  end

  describe "#to_google_json" do
    it "transforms category to header using StructuredSnippetCategoriesConfig" do
      result = resource.to_google_json
      expect(result[:header]).to eq("Service catalog")
    end

    it "passes through values unchanged" do
      result = resource.to_google_json
      expect(result[:values]).to eq(["Web Design", "SEO", "Marketing"])
    end

    it "transforms different categories correctly" do
      structured_snippet.update!(category: "amenities")
      result = resource.to_google_json
      expect(result[:header]).to eq("Amenities")
    end
  end

  describe "#from_google_json" do
    it "returns header and values from remote" do
      remote = described_class::RemoteStructuredSnippet.new(
        resource_name: "customers/123/assets/456",
        id: 456,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )

      result = resource.from_google_json(remote)
      expect(result[:header]).to eq("Service catalog")
      expect(result[:values]).to eq(["Web Design", "SEO", "Marketing"])
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # MODEL INTEGRATION
  # ═══════════════════════════════════════════════════════════════

  describe "AdStructuredSnippet helper methods" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    describe "#google_synced?" do
      context "when asset exists remotely but we don't have asset_id locally" do
        it "returns true after content-based discovery and backfill" do
          asset_response = mock_search_response_with_structured_snippet_asset(
            asset_id: 88888,
            customer_id: 1234567890,
            header: "Service catalog",
            values: ["Web Design", "SEO", "Marketing"]
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

          expect(structured_snippet.google_asset_id).to be_nil
          expect(structured_snippet.google_synced?).to be true
          expect(structured_snippet.reload.google_asset_id).to eq("88888")
        end
      end

      context "when asset does not exist remotely" do
        it "returns false" do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          expect(structured_snippet.google_synced?).to be false
        end
      end

      context "when we have asset_id and remote matches" do
        before do
          structured_snippet.platform_settings["google"]["asset_id"] = "88888"
          structured_snippet.save!
        end

        it "returns true" do
          asset_response = mock_search_response_with_structured_snippet_asset(
            asset_id: 88888,
            customer_id: 1234567890,
            header: "Service catalog",
            values: ["Web Design", "SEO", "Marketing"]
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

          expect(structured_snippet.google_synced?).to be true
        end
      end
    end

    describe "#google_sync" do
      it "returns unchanged when asset found via content search with matching values" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(structured_snippet.google_asset_id).to be_nil
        result = structured_snippet.google_sync
        # Asset found via content search with matching values = unchanged
        expect(result.unchanged?).to be true

        # asset_id is backfilled during fetch_by_content
        expect(structured_snippet.google_asset_id).to eq("88888")
      end
    end

    describe "#google_fetch" do
      it "fetches the remote resource" do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = structured_snippet.google_fetch
        expect(remote.id).to eq(88888)
      end
    end

    describe "#google_syncer" do
      it "returns the resource instance" do
        expect(structured_snippet.google_syncer).to be_a(described_class)
      end
    end
  end

  describe "Campaign collection methods" do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service)
      )
    end

    describe "#structured_snippets_synced?" do
      it "delegates to the resource class" do
        structured_snippet # ensure snippet exists
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        expect(campaign.structured_snippets_synced?).to be false
      end
    end

    describe "#structured_snippets_sync_plan" do
      it "returns a sync plan" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        plan = campaign.structured_snippets_sync_plan
        expect(plan).to be_a(GoogleAds::Sync::Plan)
      end
    end
  end
end
