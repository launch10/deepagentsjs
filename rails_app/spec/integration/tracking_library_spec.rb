require 'rails_helper'

RSpec.describe 'Tracking Library', type: :integration do
  include GoogleAdsMocks

  # ═══════════════════════════════════════════════════════════════════════════
  # ARCHITECTURE OVERVIEW
  # ═══════════════════════════════════════════════════════════════════════════
  #
  # ┌─────────────────────────────────────────────────────────────────────────┐
  # │                         AdsAccount Creation Flow                        │
  # │                              (PREREQUISITE)                             │
  # ├─────────────────────────────────────────────────────────────────────────┤
  # │  1. Create AdsAccount (google_customer_id set)                          │
  # │  2. Create ConversionAction via Google Ads API                          │
  # │  3. Query tag_snippets to get conversion_label                          │
  # │  4. Store conversion_action_resource_name + conversion_label            │
  # └─────────────────────────────────────────────────────────────────────────┘
  #                                      │
  #                                      ▼
  # ┌─────────────────────────────────────────────────────────────────────────┐
  # │                            Website Deploy Flow                          │
  # ├─────────────────────────────────────────────────────────────────────────┤
  # │  1. buildable.rb writes VITE_GOOGLE_ADS_SEND_TO to .env                 │
  # │  2. buildable.rb injects gtag.js script into index.html <head>          │
  # │  3. Vite builds with env vars baked in                                  │
  # │  4. tracking.ts has access to google_send_to value                      │
  # └─────────────────────────────────────────────────────────────────────────┘
  #                                      │
  #                                      ▼
  # ┌─────────────────────────────────────────────────────────────────────────┐
  # │                           Lead Capture Flow                             │
  # ├─────────────────────────────────────────────────────────────────────────┤
  # │  1. User lands on page (gclid captured from URL → sessionStorage)       │
  # │  2. User submits form                                                   │
  # │  3. L10.createLead() POSTs to Rails API (includes gclid)                │
  # │  4. On success, fires gtag('event', 'conversion', { send_to: ... })     │
  # │  5. Lead record created with gclid for attribution                      │
  # └─────────────────────────────────────────────────────────────────────────┘

  let(:account) { create(:account, :with_google_account, name: "Test Account") }
  let(:ads_account) do
    account.ads_accounts.create!(platform: "google").tap do |aa|
      aa.google_descriptive_name = "Test Ads Account"
      aa.google_currency_code = "USD"
      aa.google_time_zone = "America/New_York"
      aa.google_status = "ENABLED"
      aa.google_auto_tagging_enabled = true
      aa.save!
    end
  end

  before do
    mock_google_ads_client
  end

  # ═══════════════════════════════════════════════════════════════════════════
  # PHASE 1: AdsAccount Platform Settings for Conversion Tracking
  # ═══════════════════════════════════════════════════════════════════════════

  describe 'AdsAccount conversion tracking settings' do
    describe 'platform_settings' do
      it 'stores google_conversion_action_resource_name' do
        ads_account.google_conversion_action_resource_name = "customers/123456/conversionActions/789"
        ads_account.save!

        expect(ads_account.reload.google_conversion_action_resource_name).to eq("customers/123456/conversionActions/789")
      end

      it 'stores google_conversion_label' do
        ads_account.google_conversion_label = "abc123XYZ"
        ads_account.save!

        expect(ads_account.reload.google_conversion_label).to eq("abc123XYZ")
      end
    end

    describe '#google_conversion_id' do
      it 'stores the full AW-XXXXXXXXX format directly' do
        ads_account.google_conversion_id = "AW-123456789"
        ads_account.save!

        expect(ads_account.reload.google_conversion_id).to eq("AW-123456789")
      end
    end

    describe '#google_send_to' do
      context 'when all required fields are present' do
        before do
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = "abc123XYZ"
          ads_account.save!
        end

        it 'returns the full send_to value in {conversion_id}/{label} format' do
          expect(ads_account.google_send_to).to eq("AW-123456789/abc123XYZ")
        end
      end

      context 'when google_conversion_id is missing' do
        before do
          ads_account.google_conversion_id = nil
          ads_account.google_conversion_label = "abc123XYZ"
        end

        it 'returns nil' do
          expect(ads_account.google_send_to).to be_nil
        end
      end

      context 'when google_conversion_label is missing' do
        before do
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = nil
        end

        it 'returns nil' do
          expect(ads_account.google_send_to).to be_nil
        end
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════════════════
  # PHASE 2: ConversionAction Service
  # ═══════════════════════════════════════════════════════════════════════════

  describe 'GoogleAds::Resources::ConversionAction' do
    let(:conversion_action_service) { GoogleAds::Resources::ConversionAction.new(ads_account) }

    before do
      ads_account.google_customer_id = "123456789"
      ads_account.save!
      mock_conversion_action_service
    end

    describe '#create_lead_form_conversion_action' do
      it 'creates a conversion action with correct settings' do
        mock_conversion_action = mock_conversion_action_resource
        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        response = mock_mutate_conversion_action_response(
          conversion_action_id: "456789",
          customer_id: "123456789"
        )
        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions).and_return(response)

        result = conversion_action_service.create_lead_form_conversion_action

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/123456789/conversionActions/456789")
      end

      it 'configures conversion action with WEBPAGE type' do
        mock_conversion_action = mock_conversion_action_resource
        expect(mock_conversion_action).to receive(:type=).with(:WEBPAGE)

        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        response = mock_mutate_conversion_action_response(
          conversion_action_id: "456789",
          customer_id: "123456789"
        )
        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions).and_return(response)

        conversion_action_service.create_lead_form_conversion_action
      end

      it 'configures conversion action with SUBMIT_LEAD_FORM category' do
        mock_conversion_action = mock_conversion_action_resource
        expect(mock_conversion_action).to receive(:category=).with(:SUBMIT_LEAD_FORM)

        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        response = mock_mutate_conversion_action_response(
          conversion_action_id: "456789",
          customer_id: "123456789"
        )
        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions).and_return(response)

        conversion_action_service.create_lead_form_conversion_action
      end

      it 'returns error SyncResult on API failure' do
        mock_conversion_action = mock_conversion_action_resource
        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions)
          .and_raise(mock_google_ads_error(message: "ConversionAction creation failed"))

        result = conversion_action_service.create_lead_form_conversion_action

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
      end
    end

    describe '#fetch_conversion_info' do
      it 'extracts both conversion_id and conversion_label from tag_snippets' do
        tag_snippet_response = mock_search_response_with_conversion_action_tag_snippets(
          resource_name: "customers/123456789/conversionActions/456789",
          conversion_id: "AW-999888777",
          conversion_label: "abc123XYZ"
        )

        allow(@mock_google_ads_service).to receive(:search).and_return(tag_snippet_response)

        result = conversion_action_service.fetch_conversion_info("customers/123456789/conversionActions/456789")

        expect(result[:conversion_id]).to eq("AW-999888777")
        expect(result[:conversion_label]).to eq("abc123XYZ")
      end

      it 'returns nil values when tag_snippets do not contain conversion info' do
        empty_snippet_response = mock_search_response_with_empty_tag_snippets(
          resource_name: "customers/123456789/conversionActions/456789"
        )

        allow(@mock_google_ads_service).to receive(:search).and_return(empty_snippet_response)

        result = conversion_action_service.fetch_conversion_info("customers/123456789/conversionActions/456789")

        expect(result[:conversion_id]).to be_nil
        expect(result[:conversion_label]).to be_nil
      end

      it 'returns nil values when conversion action not found' do
        allow(@mock_google_ads_service).to receive(:search).and_return([])

        result = conversion_action_service.fetch_conversion_info("customers/123456789/conversionActions/999")

        expect(result[:conversion_id]).to be_nil
        expect(result[:conversion_label]).to be_nil
      end
    end

    describe '#sync' do
      context 'when conversion action does not exist' do
        before do
          ads_account.google_conversion_action_resource_name = nil
          ads_account.google_conversion_id = nil
          ads_account.google_conversion_label = nil
          ads_account.save!
        end

        it 'creates conversion action and stores resource_name, conversion_id, and label from tag_snippets' do
          mock_conversion_action = mock_conversion_action_resource
          allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

          create_op = double("CreateOperation")
          allow(@mock_operation).to receive(:create_resource).and_return(
            double("CreateResource", conversion_action: create_op)
          )

          create_response = mock_mutate_conversion_action_response(
            conversion_action_id: "456789",
            customer_id: "123456789"
          )
          allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions).and_return(create_response)

          # tag_snippets contain both conversion_id (with AW- prefix) and label
          tag_snippet_response = mock_search_response_with_conversion_action_tag_snippets(
            resource_name: "customers/123456789/conversionActions/456789",
            conversion_id: "AW-999888777",
            conversion_label: "abc123XYZ"
          )

          allow(@mock_google_ads_service).to receive(:search).and_return(tag_snippet_response)

          result = conversion_action_service.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.created?).to be true
          expect(ads_account.reload.google_conversion_action_resource_name).to eq("customers/123456789/conversionActions/456789")
          expect(ads_account.google_conversion_id).to eq("AW-999888777")
          expect(ads_account.google_conversion_label).to eq("abc123XYZ")
        end
      end

      context 'when conversion action already exists' do
        before do
          ads_account.google_conversion_action_resource_name = "customers/123456789/conversionActions/456789"
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = "abc123XYZ"
          ads_account.save!
        end

        it 'returns unchanged SyncResult' do
          result = conversion_action_service.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.unchanged?).to be true
        end
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════════════════
  # PHASE 3: Integration with AdsAccount Sync
  # ═══════════════════════════════════════════════════════════════════════════

  describe 'AdsAccount sync creates ConversionAction' do
    let(:account_syncer) { GoogleAds::Resources::Account.new(ads_account) }

    before do
      mock_conversion_action_service
    end

    context 'when creating a new AdsAccount' do
      before do
        # Mock the customer creation flow
        mock_customer = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer).and_return(mock_customer)

        create_response = mock_create_customer_client_response(customer_id: "987654321")
        allow(@mock_customer_service).to receive(:create_customer_client).and_return(create_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)
        mutate_response = mock_mutate_customer_response_auto_tagging(customer_id: "987654321")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)
      end

      it 'creates ConversionAction after successful account creation' do
        # Mock conversion action creation
        mock_conversion_action = mock_conversion_action_resource
        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        conversion_response = mock_mutate_conversion_action_response(
          conversion_action_id: "456789",
          customer_id: "987654321"
        )
        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions).and_return(conversion_response)

        # tag_snippets contain both conversion_id (with AW- prefix) and label
        tag_snippet_response = mock_search_response_with_conversion_action_tag_snippets(
          resource_name: "customers/987654321/conversionActions/456789",
          conversion_id: "AW-111222333",
          conversion_label: "xyz789ABC"
        )

        # Mock search - only need tag_snippets query now (simplified)
        allow(@mock_google_ads_service).to receive(:search) do |**args|
          if args[:query]&.include?("tag_snippets")
            tag_snippet_response
          else
            mock_empty_search_response
          end
        end

        result = account_syncer.sync

        expect(result.created?).to be true
        expect(ads_account.reload.google_customer_id).to eq("987654321")
        expect(ads_account.google_conversion_action_resource_name).to eq("customers/987654321/conversionActions/456789")
        expect(ads_account.google_conversion_id).to eq("AW-111222333")
        expect(ads_account.google_conversion_label).to eq("xyz789ABC")
      end

      it 'still succeeds even if ConversionAction creation fails (graceful degradation)' do
        # Mock search to return empty for all queries
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        # Mock conversion action creation failure
        mock_conversion_action = mock_conversion_action_resource
        allow(@mock_resource).to receive(:conversion_action).and_yield(mock_conversion_action).and_return(mock_conversion_action)

        create_op = double("CreateOperation")
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", conversion_action: create_op)
        )

        allow(@mock_conversion_action_service).to receive(:mutate_conversion_actions)
          .and_raise(mock_google_ads_error(message: "ConversionAction creation failed"))

        result = account_syncer.sync

        # Account creation should still succeed
        expect(result.created?).to be true
        expect(ads_account.reload.google_customer_id).to eq("987654321")

        # But conversion tracking fields should be nil
        expect(ads_account.google_conversion_action_resource_name).to be_nil
        expect(ads_account.google_conversion_id).to be_nil
        expect(ads_account.google_conversion_label).to be_nil
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════════════════
  # HELPER MOCK METHODS
  # ═══════════════════════════════════════════════════════════════════════════

  def mock_conversion_action_service
    @mock_conversion_action_service = double("ConversionActionService")
    allow(@mock_client).to receive(:service).and_return(
      double("Services",
        customer: @mock_customer_service,
        google_ads: @mock_google_ads_service,
        campaign_budget: @mock_campaign_budget_service,
        campaign: @mock_campaign_service,
        ad_group: @mock_ad_group_service,
        bidding_strategy: @mock_bidding_strategy_service,
        campaign_criterion: @mock_campaign_criterion_service,
        ad_group_criterion: @mock_ad_group_criterion_service,
        ad_group_ad: @mock_ad_group_ad_service,
        asset: @mock_asset_service,
        campaign_asset: @mock_campaign_asset_service,
        conversion_action: @mock_conversion_action_service)
    )
    @mock_conversion_action_service
  end

  def mock_conversion_action_resource
    # Mock the nested resources for attribution_model_settings and value_settings
    mock_attribution_settings = double("AttributionModelSettings")
    allow(mock_attribution_settings).to receive(:attribution_model=)
    allow(@mock_resource).to receive(:attribution_model_settings).and_yield(mock_attribution_settings).and_return(mock_attribution_settings)

    mock_value_settings = double("ValueSettings")
    allow(mock_value_settings).to receive(:default_value=)
    allow(mock_value_settings).to receive(:default_currency_code=)
    allow(mock_value_settings).to receive(:always_use_default_value=)
    allow(@mock_resource).to receive(:value_settings).and_yield(mock_value_settings).and_return(mock_value_settings)

    double("ConversionAction").tap do |ca|
      allow(ca).to receive(:name=)
      allow(ca).to receive(:type=)
      allow(ca).to receive(:category=)
      allow(ca).to receive(:status=)
      allow(ca).to receive(:counting_type=)
      allow(ca).to receive(:click_through_lookback_window_days=)
      allow(ca).to receive(:view_through_lookback_window_days=)
      allow(ca).to receive(:attribution_model_settings=)
      allow(ca).to receive(:value_settings=)
    end
  end

  def mock_mutate_conversion_action_response(conversion_action_id:, customer_id:)
    result = double("MutateConversionActionResult",
      resource_name: "customers/#{customer_id}/conversionActions/#{conversion_action_id}")
    double("MutateConversionActionsResponse", results: [result])
  end

  def mock_search_response_with_conversion_action_tag_snippets(resource_name:, conversion_label:, conversion_id: "AW-123456789")
    # The event_snippet contains the send_to value like:
    # gtag('event', 'conversion', {'send_to': 'AW-123456789/abc123XYZ'});
    event_snippet = "gtag('event', 'conversion', {'send_to': '#{conversion_id}/#{conversion_label}'});"

    tag_snippet = double("TagSnippet",
      type: :WEBPAGE,
      event_snippet: event_snippet)

    conversion_action = double("ConversionAction",
      resource_name: resource_name,
      tag_snippets: [tag_snippet])

    row = double("GoogleAdsRow", conversion_action: conversion_action)
    [row]
  end

  def mock_search_response_with_empty_tag_snippets(resource_name:)
    tag_snippet = double("TagSnippet",
      type: :WEBPAGE,
      event_snippet: nil)

    conversion_action = double("ConversionAction",
      resource_name: resource_name,
      tag_snippets: [tag_snippet])

    row = double("GoogleAdsRow", conversion_action: conversion_action)
    [row]
  end

  # ═══════════════════════════════════════════════════════════════════════════
  # PHASE 4: Buildable - Environment Variable Injection for tracking.ts
  # ═══════════════════════════════════════════════════════════════════════════
  #
  # These tests verify that Buildable correctly injects environment variables
  # into the .env file so that Vite can bake them into tracking.ts at build time.
  #
  # The tracking.ts library expects:
  # - VITE_API_BASE_URL: Rails API endpoint for lead submissions
  # - VITE_SIGNUP_TOKEN: Project-specific token for authentication
  # - VITE_GOOGLE_ADS_SEND_TO: Full send_to value (AW-xxx/label) for conversions
  #
  # Additionally, buildable should inject the gtag.js script into index.html
  # when Google Ads conversion tracking is configured.

  describe 'Buildable env var injection for tracking.ts' do
    include WebsiteFileHelpers

    let(:project) { create(:project, account: account) }
    let(:template) { create(:template) }
    let(:website) { create_website_with_files(account: account, project: project, files: tracking_test_files) }
    let(:temp_dir) { Dir.mktmpdir("launch10_buildable_test") }

    # Minimal files that include tracking.ts
    let(:tracking_test_files) do
      [
        {
          path: "index.html",
          content: <<~HTML
            <!DOCTYPE html>
            <html>
            <head>
              <title>Test Page</title>
            </head>
            <body>
              <div id="app"></div>
              <script type="module" src="/src/main.ts"></script>
            </body>
            </html>
          HTML
        },
        {
          path: "src/lib/tracking.ts",
          content: File.read(Rails.root.join('templates/default/src/lib/tracking.ts'))
        },
        {
          path: "package.json",
          content: '{"name": "test", "type": "module", "scripts": {"build": "vite build"}}'
        },
        {
          path: "vite.config.ts",
          content: 'export default {}'
        }
      ]
    end

    before do
      website.snapshot
    end

    after do
      FileUtils.rm_rf(temp_dir)
    end

    describe '#write_env_file!' do
      let(:deploy) { website.deploys.create!(environment: 'development') }

      before do
        allow(deploy).to receive(:temp_dir).and_return(temp_dir)
      end

      context 'core environment variables' do
        it 'writes VITE_API_BASE_URL using production URL for deployed sites' do
          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expected_url = ENV.fetch("DEPLOY_API_BASE_URL", "https://launch10.ai")
          expect(env_content).to include("VITE_API_BASE_URL=#{expected_url}")
        end

        it 'writes VITE_SIGNUP_TOKEN from project' do
          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expect(env_content).to include("VITE_SIGNUP_TOKEN=#{project.signup_token}")
        end

        it 'writes env vars in Vite-compatible format (KEY=value, no quotes)' do
          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          lines = env_content.split("\n").reject(&:empty?)

          lines.each do |line|
            # Should be KEY=value format, no quotes
            expect(line).to match(/^VITE_[A-Z_]+=.+$/)
            expect(line).not_to include('"')
            expect(line).not_to include("'")
          end
        end
      end

      context 'with Google Ads conversion tracking configured' do
        before do
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = "abc123XYZ"
          ads_account.save!
        end

        it 'writes VITE_GOOGLE_ADS_SEND_TO with full send_to value' do
          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expect(env_content).to include("VITE_GOOGLE_ADS_SEND_TO=AW-123456789/abc123XYZ")
        end
      end

      context 'without Google Ads account' do
        it 'omits VITE_GOOGLE_ADS_SEND_TO when no ads account exists' do
          # Ensure no ads account is linked
          account.ads_accounts.destroy_all

          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expect(env_content).not_to include("VITE_GOOGLE_ADS_SEND_TO")
        end
      end

      context 'with incomplete Google Ads configuration' do
        it 'omits VITE_GOOGLE_ADS_SEND_TO when conversion_label is missing' do
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = nil
          ads_account.save!

          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expect(env_content).not_to include("VITE_GOOGLE_ADS_SEND_TO")
        end

        it 'omits VITE_GOOGLE_ADS_SEND_TO when conversion_id is missing' do
          ads_account.google_conversion_id = nil
          ads_account.google_conversion_label = "abc123XYZ"
          ads_account.save!

          deploy.send(:write_env_file!)

          env_content = File.read(File.join(temp_dir, ".env"))
          expect(env_content).not_to include("VITE_GOOGLE_ADS_SEND_TO")
        end
      end
    end

    describe '#inject_gtag_script!' do
      let(:deploy) { website.deploys.create!(environment: 'development') }

      before do
        allow(deploy).to receive(:temp_dir).and_return(temp_dir)
        # Write the index.html file to temp_dir
        FileUtils.mkdir_p(temp_dir)
        File.write(File.join(temp_dir, "index.html"), tracking_test_files.find { |f| f[:path] == "index.html" }[:content])
      end

      context 'with Google Ads conversion tracking configured' do
        before do
          ads_account.google_conversion_id = "AW-123456789"
          ads_account.google_conversion_label = "abc123XYZ"
          ads_account.save!
        end

        it 'injects gtag.js script into index.html <head>' do
          deploy.send(:inject_gtag_script!)

          html_content = File.read(File.join(temp_dir, "index.html"))
          expect(html_content).to include("googletagmanager.com/gtag/js?id=AW-123456789")
        end

        it 'configures gtag with the correct conversion ID' do
          deploy.send(:inject_gtag_script!)

          html_content = File.read(File.join(temp_dir, "index.html"))
          expect(html_content).to include("gtag('config', 'AW-123456789')")
        end

        it 'injects script before </head> closing tag' do
          deploy.send(:inject_gtag_script!)

          html_content = File.read(File.join(temp_dir, "index.html"))
          # The gtag script should appear before </head>
          head_section = html_content[/<head>.*<\/head>/m]
          expect(head_section).to include("googletagmanager.com/gtag/js")
        end
      end

      context 'without Google Ads conversion tracking' do
        before do
          account.ads_accounts.destroy_all
        end

        it 'returns early without error' do
          expect { deploy.send(:inject_gtag_script!) }.not_to raise_error
        end

        it 'leaves index.html unchanged' do
          original_content = File.read(File.join(temp_dir, "index.html"))
          deploy.send(:inject_gtag_script!)
          new_content = File.read(File.join(temp_dir, "index.html"))

          expect(new_content).to eq(original_content)
        end
      end
    end

    describe 'build! integration' do
      let(:deploy) { website.deploys.create!(environment: 'development') }

      before do
        # Mock the build process to avoid actually running pnpm
        allow(deploy).to receive(:temp_dir).and_return(temp_dir)
        allow(FileUtils).to receive(:mkdir_p).and_call_original
        allow(Dir).to receive(:chdir).and_yield
        allow(deploy).to receive(:system).and_return(true)
        # build_exists? should return false so pnpm commands run
        allow(deploy).to receive(:build_exists?).and_return(false)
        # Final dist directory check should pass
        allow(Dir).to receive(:exist?).and_wrap_original do |method, path|
          path.end_with?('/dist') || method.call(path)
        end

        # Set up Google Ads account with conversion tracking
        ads_account.google_conversion_id = "AW-123456789"
        ads_account.google_conversion_label = "abc123XYZ"
        ads_account.save!
      end

      it 'writes .env file with all tracking env vars during build' do
        env_written = false
        env_content = nil

        # Use and_wrap_original to both capture and write to disk
        allow(File).to receive(:write).and_wrap_original do |method, path, content|
          if path.end_with?('.env')
            env_written = true
            env_content = content
          end
          method.call(path, content)
        end

        deploy.build!

        expect(env_written).to be true
        expect(env_content).to include("VITE_API_BASE_URL=")
        expect(env_content).to include("VITE_SIGNUP_TOKEN=")
        expect(env_content).to include("VITE_GOOGLE_ADS_SEND_TO=AW-123456789/abc123XYZ")
      end

      it 'injects gtag.js into index.html during build' do
        files_written = {}

        # Use and_wrap_original to both capture and write to disk
        allow(File).to receive(:write).and_wrap_original do |method, path, content|
          files_written[path] = content
          method.call(path, content)
        end

        deploy.build!

        index_path = files_written.keys.find { |k| k.end_with?('index.html') }
        expect(index_path).to be_present
        expect(files_written[index_path]).to include("googletagmanager.com/gtag/js?id=AW-123456789")
      end

      context 'verification: env vars are available to tracking.ts at build time' do
        it 'writes env vars before pnpm build runs' do
          call_order = []

          # Use and_wrap_original to both capture and write to disk
          allow(File).to receive(:write).and_wrap_original do |method, path, content|
            call_order << :env_file if path.end_with?('.env')
            method.call(path, content)
          end

          allow(deploy).to receive(:system) do |cmd|
            call_order << :pnpm_build if cmd.include?('build')
            true
          end

          deploy.build!

          # .env should be written before pnpm build
          env_index = call_order.index(:env_file)
          build_index = call_order.index(:pnpm_build)

          expect(env_index).to be_present
          expect(build_index).to be_present
          expect(env_index).to be < build_index
        end
      end
    end
  end
end
