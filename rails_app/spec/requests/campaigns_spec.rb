require 'swagger_helper'
require "rails_helper"
RSpec.describe "Campaigns API", type: :request do
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_account) { user1.owned_account }
  let!(:user2_account) { user2.owned_account }

  let!(:template) { create(:template) }

  # Common GeoTargetConstants used across tests
  let!(:usa_geo_target) do
    GeoTargetConstant.create!(
      criteria_id: 2840,
      name: "United States",
      canonical_name: "United States",
      target_type: "Country",
      status: "Active",
      country_code: "US"
    )
  end

  let!(:canada_geo_target) do
    GeoTargetConstant.create!(
      criteria_id: 2124,
      name: "Canada",
      canonical_name: "Canada",
      target_type: "Country",
      status: "Active",
      country_code: "CA"
    )
  end

  let!(:mexico_geo_target) do
    GeoTargetConstant.create!(
      criteria_id: 2484,
      name: "Mexico",
      canonical_name: "Mexico",
      target_type: "Country",
      status: "Active",
      country_code: "MX"
    )
  end

  let!(:project1) {
    data = Brainstorm.create_brainstorm!(user1_account, name: "Project 1", thread_id: "thread_id_1")
    data[:project]
  }
  let!(:website1) { project1.website }
  let!(:project2) {
    data = Brainstorm.create_brainstorm!(user2_account, name: "Project 2", thread_id: "thread_id_2")
    data[:project]
  }
  let!(:website2) { project2.website }

  before do
    ensure_plans_exist
    subscribe_account(user1_account, plan_name: "growth_monthly")
    subscribe_account(user2_account, plan_name: "growth_monthly")
  end

  path '/api/v1/campaigns' do
    post 'Creates a campaign' do
      tags 'Campaigns'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :campaign_params, in: :body, schema: APISchemas::Campaign.create_params_schema

      response '201', 'campaign created with ad group and ad' do
        schema APISchemas::Campaign.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:campaign_params) do
          {
            campaign: {
              name: "Test Campaign",
              project_id: project1.id,
              website_id: website1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          campaign = Campaign.find(data["id"])

          expect(campaign.name).to eq("Test Campaign")
          expect(campaign.account_id).to eq(user1_account.id)
          expect(campaign.project_id).to eq(project1.id)
          expect(campaign.website_id).to eq(website1.id)
          expect(campaign.stage).to eq("content")
          expect(campaign.ad_groups.count).to eq(1)
          expect(campaign.ad_groups.first.ads.count).to eq(1)
          expect(data.dig("thread_id")).to eq(campaign.thread_id)
        end
      end

      response '200', 'campaign already exists and is returned' do
        schema APISchemas::Campaign.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:campaign_params) do
          {
            campaign: {
              name: "Test Campaign",
              project_id: project1.id,
              website_id: website1.id
            }
          }
        end

        let!(:existing_campaign) do
          result = Campaign.create_campaign!(user1_account, {
            name: "Test Campaign",
            project_id: project1.id,
            website_id: website1.id
          })
          result[:campaign]
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          campaign = Campaign.find(data["id"])

          expect(campaign.id).to eq(existing_campaign.id)
          expect(campaign.project_id).to eq(project1.id)
          expect(campaign.website_id).to eq(website1.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:campaign_params) do
          {
            campaign: {
              name: "Test",
              project_id: project1.id,
              website_id: website1.id
            }
          }
        end

        run_test!
      end

      response '201', 'campaign created without website_id (falls back to project website)' do
        schema APISchemas::Campaign.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:campaign_params) do
          {
            campaign: {
              name: "Test Campaign",
              project_id: project1.id,
              thread_id: "campaign_thread_123"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["website_id"]).to eq(website1.id)
        end
      end
    end
  end

  path '/api/v1/campaigns/{id}' do
    parameter name: :id, in: :path, type: :integer, description: 'Campaign ID'

    patch 'Updates a campaign (autosave)' do
      tags 'Campaigns'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :campaign_params, in: :body, schema: APISchemas::Campaign.params_schema

      let(:campaign1) do
        result = Campaign.create_campaign!(user1_account, {
          name: "User 1 Campaign",
          project_id: project1.id,
          website_id: website1.id
        })
        result[:campaign]
      end

      let(:campaign2) do
        result = Campaign.create_campaign!(user2_account, {
          name: "User 2 Campaign",
          project_id: project2.id,
          website_id: website2.id
        })
        result[:campaign]
      end

      describe "General" do
        response '200', 'campaign updated' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            {
              campaign: {
                name: "Updated Campaign Name"
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["name"]).to eq("Updated Campaign Name")

            campaign1.reload
            expect(campaign1.name).to eq("Updated Campaign Name")
          end
        end

        response '200', 'campaign updated with flat ad group attributes' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            {
              campaign: {
                ad_group: {
                  name: "Renamed Ad Group"
                }
              }
            }
          end

          run_test! do |response|
            campaign1.reload
            expect(campaign1.ad_groups.first.name).to eq("Renamed Ad Group")
          end
        end

        response '404', 'cannot access another users campaign' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign2.id }
          let(:campaign_params) do
            {
              campaign: {
                name: "Should Not Update"
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to include("Campaign not found")

            campaign2.reload
            expect(campaign2.name).to eq("User 2 Campaign")
          end
        end

        response '404', 'campaign not found' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { 999999 }
          let(:campaign_params) do
            {
              campaign: {
                name: "Test"
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to include("Campaign not found")
          end
        end
      end

      describe "Content stage" do
        let(:content_stage_campaign) { finish_content_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
        let(:id) { content_stage_campaign.id }

        response '200', 'idempotently creates headlines on first update' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            {
              campaign: {
                headlines: [
                  {text: "Headline 1"},
                  {text: "Headline 2"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            campaign1.reload
            ad = campaign1.ad_groups.first.ads.first

            expect(ad.headlines.count).to eq(2)
            expect(ad.headlines.order(:position).pluck(:text)).to eq(["Headline 1", "Headline 2"])
            expect(data["ready_for_next_stage"]).to eq(false)

            expect(data["headlines"]).to be_present
            expect(data["headlines"].length).to eq(2)
            expect(data["headlines"][0]).to match(hash_including("id" => a_kind_of(Integer), "text" => "Headline 1", "position" => 0))
            expect(data["headlines"][1]).to match(hash_including("id" => a_kind_of(Integer), "text" => "Headline 2", "position" => 1))
          end
        end

        response '200', 'ready_for_next_stage is true after creating 3 headlines and 2 descriptions' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            {
              campaign: {
                headlines: [
                  {text: "Headline 1"},
                  {text: "Headline 2"},
                  {text: "Headline 3"}
                ],
                descriptions: [
                  {text: "Description 1"},
                  {text: "Description 2"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            campaign1.reload
            ad = campaign1.ad_groups.first.ads.first

            expect(ad.headlines.count).to eq(3)
            expect(ad.descriptions.count).to eq(2)
            expect(data["ready_for_next_stage"]).to eq(true)

            expect(data["headlines"].length).to eq(3)
            expect(data["headlines"].all? { |h| h["id"].present? }).to be true
            expect(data["descriptions"].length).to eq(2)
            expect(data["descriptions"].all? { |d| d["id"].present? }).to be true
          end
        end

        response '200', 'idempotently replaces headlines - soft delete and reify' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { content_stage_campaign.id }

          let!(:initial_headlines) do
            content_stage_campaign.headlines.order(:position).to_a
          end

          let(:campaign_params) do
            {
              campaign: {
                headlines: [
                  {text: "Headline 2 Updated"},
                  {text: "Headline 3"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            content_stage_campaign.reload
            ad = content_stage_campaign.ad_groups.first.ads.first

            expect(ad.headlines.count).to eq(2)
            expect(ad.headlines.order(:position).pluck(:text)).to eq(["Headline 2 Updated", "Headline 3"])
            expect(initial_headlines[0].reload.deleted_at).to be_nil
            expect(initial_headlines[1].reload.deleted_at).to be_nil
            expect(initial_headlines[2].reload.deleted_at).to be_present

            expect(data["headlines"].length).to eq(2)
            expect(data["headlines"][0]).to match(hash_including("id" => initial_headlines[0].id, "text" => "Headline 2 Updated", "position" => 0))
            expect(data["headlines"][1]).to match(hash_including("id" => initial_headlines[1].id, "text" => "Headline 3", "position" => 1))
          end
        end

        response '200', 'idempotently creates descriptions on first update' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            {
              campaign: {
                descriptions: [
                  {text: "Description 1"},
                  {text: "Description 2"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            campaign1.reload
            ad = campaign1.ad_groups.first.ads.first

            expect(ad.descriptions.count).to eq(2)
            expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 1", "Description 2"])

            expect(data["descriptions"].length).to eq(2)
            expect(data["descriptions"].all? { |d| d["id"].present? }).to be true
            expect(data["descriptions"][0]["text"]).to eq("Description 1")
            expect(data["descriptions"][1]["text"]).to eq("Description 2")
          end
        end

        response '200', 'idempotently replaces descriptions - soft delete and reify' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }

          let!(:initial_descriptions) do
            ad = campaign1.ad_groups.first.ads.first
            [
              create(:ad_description, ad: ad, text: "Description 1", position: 0),
              create(:ad_description, ad: ad, text: "Description 2", position: 1)
            ]
          end

          let(:campaign_params) do
            {
              campaign: {
                descriptions: [
                  {text: "Description 2 Updated"},
                  {text: "Description 3"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            campaign1.reload
            ad = campaign1.ad_groups.first.ads.first

            expect(ad.descriptions.count).to eq(2)
            expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 2 Updated", "Description 3"])
            expect(initial_descriptions[0].reload.deleted_at).to be_nil
            expect(initial_descriptions[1].reload.deleted_at).to be_nil

            expect(data["descriptions"].length).to eq(2)
            expect(data["descriptions"][0]["id"]).to eq(initial_descriptions[0].id)
            expect(data["descriptions"][0]["text"]).to eq("Description 2 Updated")
            expect(data["descriptions"][1]["id"]).to eq(initial_descriptions[1].id)
            expect(data["descriptions"][1]["text"]).to eq("Description 3")
          end
        end

        response '200', 'idempotently replaces both headlines and descriptions together' do
          schema APISchemas::Campaign.response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }

          let!(:initial_content) do
            ad = campaign1.ad_groups.first.ads.first
            {
              headlines: [
                create(:ad_headline, ad: ad, text: "Headline 1", position: 0),
                create(:ad_headline, ad: ad, text: "Headline 2", position: 1)
              ],
              descriptions: [
                create(:ad_description, ad: ad, text: "Description 1", position: 0),
                create(:ad_description, ad: ad, text: "Description 2", position: 1)
              ]
            }
          end

          let(:campaign_params) do
            {
              campaign: {
                headlines: [
                  {text: "Headline 2 Updated"},
                  {text: "Headline 3"}
                ],
                descriptions: [
                  {text: "Description 1 Updated"},
                  {text: "Description 3"}
                ]
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            campaign1.reload
            ad = campaign1.ad_groups.first.ads.first

            expect(ad.headlines.count).to eq(2)
            expect(ad.headlines.order(:position).pluck(:text)).to eq(["Headline 2 Updated", "Headline 3"])
            expect(initial_content[:headlines][0].reload.deleted_at).to be_nil
            expect(initial_content[:headlines][1].reload.deleted_at).to be_nil

            expect(ad.descriptions.count).to eq(2)
            expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 1 Updated", "Description 3"])
            expect(initial_content[:descriptions][0].reload.deleted_at).to be_nil
            expect(initial_content[:descriptions][1].reload.deleted_at).to be_nil

            expect(data["headlines"].length).to eq(2)
            expect(data["headlines"][0]["id"]).to eq(initial_content[:headlines][0].id)
            expect(data["headlines"][1]["id"]).to eq(initial_content[:headlines][1].id)
            expect(data["descriptions"].length).to eq(2)
            expect(data["descriptions"][0]["id"]).to eq(initial_content[:descriptions][0].id)
            expect(data["descriptions"][1]["id"]).to eq(initial_content[:descriptions][1].id)
          end
        end
      end

      describe "Highlights stage" do
        context 'highlights stage - callouts' do
          let!(:highlights_campaign) { finish_content_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { highlights_campaign.id }

          response '200', 'idempotently creates callouts on first update' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "Free Shipping"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.callouts.count).to eq(1)
              expect(highlights_campaign.callouts.first.text).to eq("Free Shipping")
              expect(data["ready_for_next_stage"]).to eq(false)

              expect(data["callouts"]).to be_present
              expect(data["callouts"].length).to eq(1)
              expect(data["callouts"][0]["id"]).to be_present
              expect(data["callouts"][0]["text"]).to eq("Free Shipping")
              expect(data["callouts"][0]["position"]).to eq(0)
            end
          end

          response '200', 'ready_for_next_stage is true after creating 2 callouts' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "Free Shipping"},
                    {text: "24/7 Support"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.callouts.count).to eq(2)
              expect(data["ready_for_next_stage"]).to eq(true)

              expect(data["callouts"].length).to eq(2)
              expect(data["callouts"].all? { |c| c["id"].present? }).to be true
              expect(data["callouts"][0]["text"]).to eq("Free Shipping")
              expect(data["callouts"][1]["text"]).to eq("24/7 Support")
            end
          end

          response '200', 'idempotently replaces callouts - soft delete and reify' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_callouts) do
              ad_group = highlights_campaign.ad_groups.first
              [
                create(:ad_callout, campaign: highlights_campaign, ad_group: ad_group, text: "Callout 1", position: 0),
                create(:ad_callout, campaign: highlights_campaign, ad_group: ad_group, text: "Callout 2", position: 1)
              ]
            end

            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "Callout 2 Updated"},
                    {text: "Callout 3"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.callouts.count).to eq(2)
              expect(highlights_campaign.callouts.order(:position).pluck(:text)).to eq(["Callout 2 Updated", "Callout 3"])
              expect(initial_callouts[0].reload.deleted_at).to be_nil
              expect(initial_callouts[1].reload.deleted_at).to be_nil

              expect(data["callouts"].length).to eq(2)
              expect(data["callouts"][0]["id"]).to eq(initial_callouts[0].id)
              expect(data["callouts"][0]["text"]).to eq("Callout 2 Updated")
              expect(data["callouts"][1]["id"]).to eq(initial_callouts[1].id)
              expect(data["callouts"][1]["text"]).to eq("Callout 3")
            end
          end

          response '200', 'preserves headlines and descriptions when updating callouts' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_headlines) { highlights_campaign.headlines }
            let!(:initial_descriptions) { highlights_campaign.descriptions }

            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "Free Shipping"},
                    {text: "24/7 Support"}
                  ]
                }
              }
            end

            run_test! do |response|
              JSON.parse(response.body)
              highlights_campaign.reload
              ad = highlights_campaign.ad_groups.first.ads.first

              expect(highlights_campaign.callouts.count).to eq(2)
              expect(ad.headlines.count).to eq(initial_headlines.count)
              expect(ad.descriptions.count).to eq(initial_descriptions.count)
              expect(ad.headlines.pluck(:id)).to match_array(initial_headlines.pluck(:id))
              expect(ad.descriptions.pluck(:id)).to match_array(initial_descriptions.pluck(:id))
            end
          end
        end

        context 'highlights stage - structured snippets' do
          let!(:highlights_campaign) { finish_content_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { highlights_campaign.id }

          response '200', 'idempotently creates structured snippet on first update' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "brands",
                    values: ["Nike", "Adidas", "Puma"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.structured_snippet).to be_present
              expect(highlights_campaign.structured_snippet.category).to eq("brands")
              expect(highlights_campaign.structured_snippet.values).to eq(["Nike", "Adidas", "Puma"])

              expect(data["structured_snippet"]).to be_present
              expect(data["structured_snippet"]["id"]).to be_present
              expect(data["structured_snippet"]["category"]).to eq("brands")
              expect(data["structured_snippet"]["values"]).to eq(["Nike", "Adidas", "Puma"])
            end
          end

          response '200', 'idempotently updates structured snippet' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_snippet) do
              create(:ad_structured_snippet, campaign: highlights_campaign, category: "brands", values: ["Nike", "Adidas", "Puma"])
            end

            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "services",
                    values: ["Consulting", "Design", "Development", "Marketing"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.structured_snippet.id).to eq(initial_snippet.id)
              expect(highlights_campaign.structured_snippet.category).to eq("services")
              expect(highlights_campaign.structured_snippet.values).to eq(["Consulting", "Design", "Development", "Marketing"])

              expect(data["structured_snippet"]["id"]).to eq(initial_snippet.id)
              expect(data["structured_snippet"]["category"]).to eq("services")
              expect(data["structured_snippet"]["values"]).to eq(["Consulting", "Design", "Development", "Marketing"])
            end
          end

          response '200', 'ready_for_next_stage works with callouts and structured snippet' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "Free Shipping"},
                    {text: "24/7 Support"}
                  ],
                  structured_snippet: {
                    category: "brands",
                    values: ["Nike", "Adidas", "Puma"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.callouts.count).to eq(2)
              expect(highlights_campaign.structured_snippet).to be_present
              expect(data["ready_for_next_stage"]).to eq(true)

              expect(data["callouts"].length).to eq(2)
              expect(data["callouts"].all? { |c| c["id"].present? }).to be true
              expect(data["structured_snippet"]).to be_present
              expect(data["structured_snippet"]["id"]).to be_present
            end
          end

          response '200', 'preserves headlines and descriptions when updating structured snippet' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_headlines) { highlights_campaign.headlines }
            let!(:initial_descriptions) { highlights_campaign.descriptions }

            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "brands",
                    values: ["Nike", "Adidas", "Puma"]
                  }
                }
              }
            end

            run_test! do |response|
              JSON.parse(response.body)
              highlights_campaign.reload
              ad = highlights_campaign.ad_groups.first.ads.first

              expect(highlights_campaign.structured_snippet).to be_present
              expect(ad.headlines.count).to eq(initial_headlines.count)
              expect(ad.descriptions.count).to eq(initial_descriptions.count)
              expect(ad.headlines.pluck(:id)).to match_array(initial_headlines.pluck(:id))
              expect(ad.descriptions.pluck(:id)).to match_array(initial_descriptions.pluck(:id))
            end
          end
        end
      end

      describe "Keywords stage" do
        context 'keywords' do
          let!(:keywords_campaign) { finish_highlights_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { keywords_campaign.id }

          response '200', 'idempotently creates keywords on first update' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "running shoes", match_type: "broad"},
                    {text: "athletic footwear", match_type: "phrase"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              keywords_campaign.reload
              ad_group = keywords_campaign.ad_groups.first

              expect(ad_group.keywords.count).to eq(2)
              expect(ad_group.keywords.order(:position).pluck(:text)).to eq(["running shoes", "athletic footwear"])
              expect(data["ready_for_next_stage"]).to eq(false)

              expect(data["keywords"]).to be_present
              expect(data["keywords"].length).to eq(2)
              expect(data["keywords"][0]["id"]).to be_present
              expect(data["keywords"][0]["text"]).to eq("running shoes")
              expect(data["keywords"][0]["match_type"]).to eq("broad")
              expect(data["keywords"][0]["position"]).to eq(0)
              expect(data["keywords"][1]["id"]).to be_present
              expect(data["keywords"][1]["text"]).to eq("athletic footwear")
              expect(data["keywords"][1]["match_type"]).to eq("phrase")
              expect(data["keywords"][1]["position"]).to eq(1)
            end
          end

          response '200', 'ready_for_next_stage is true after creating 5 keywords' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "running shoes", match_type: "broad"},
                    {text: "athletic footwear", match_type: "phrase"},
                    {text: "sneakers", match_type: "exact"},
                    {text: "sports shoes", match_type: "broad"},
                    {text: "training shoes", match_type: "phrase"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              keywords_campaign.reload
              ad_group = keywords_campaign.ad_groups.first

              expect(ad_group.keywords.count).to eq(5)
              expect(data["ready_for_next_stage"]).to eq(true)

              expect(data["keywords"].length).to eq(5)
              expect(data["keywords"].all? { |k| k["id"].present? }).to be true
              expect(data["keywords"].map { |k| k["match_type"] }).to eq(["broad", "phrase", "exact", "broad", "phrase"])
            end
          end

          response '200', 'idempotently replaces keywords - soft delete and reify' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_keywords) do
              ad_group = keywords_campaign.ad_groups.first
              [
                create(:ad_keyword, ad_group: ad_group, text: "keyword 1", match_type: "broad", position: 0),
                create(:ad_keyword, ad_group: ad_group, text: "keyword 2", match_type: "phrase", position: 1),
                create(:ad_keyword, ad_group: ad_group, text: "keyword 3", match_type: "exact", position: 2)
              ]
            end

            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "keyword 2 updated", match_type: "exact"},
                    {text: "keyword 4", match_type: "broad"}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              keywords_campaign.reload
              ad_group = keywords_campaign.ad_groups.first

              expect(ad_group.keywords.count).to eq(2)
              expect(ad_group.keywords.order(:position).pluck(:text)).to eq(["keyword 2 updated", "keyword 4"])
              expect(initial_keywords[0].reload.deleted_at).to be_nil
              expect(initial_keywords[1].reload.deleted_at).to be_nil
              expect(initial_keywords[2].reload.deleted_at).to be_present

              expect(data["keywords"].length).to eq(2)
              expect(data["keywords"][0]["id"]).to eq(initial_keywords[0].id)
              expect(data["keywords"][0]["text"]).to eq("keyword 2 updated")
              expect(data["keywords"][0]["match_type"]).to eq("exact")
              expect(data["keywords"][1]["id"]).to eq(initial_keywords[1].id)
              expect(data["keywords"][1]["text"]).to eq("keyword 4")
            end
          end

          response '200', 'preserves headlines, descriptions, and callouts when updating keywords' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_headlines) { keywords_campaign.headlines }
            let!(:initial_descriptions) { keywords_campaign.descriptions }
            let!(:initial_callouts) { keywords_campaign.callouts }
            let!(:initial_structured_snippet) { keywords_campaign.structured_snippet }

            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "keyword 1", match_type: "broad"},
                    {text: "keyword 2", match_type: "phrase"},
                    {text: "keyword 3", match_type: "exact"},
                    {text: "keyword 4", match_type: "broad"},
                    {text: "keyword 5", match_type: "phrase"}
                  ]
                }
              }
            end

            run_test! do |response|
              JSON.parse(response.body)
              keywords_campaign.reload
              ad = keywords_campaign.ad_groups.first.ads.first
              ad_group = keywords_campaign.ad_groups.first

              expect(ad_group.keywords.count).to eq(5)
              expect(ad.headlines.count).to eq(initial_headlines.count)
              expect(ad.descriptions.count).to eq(initial_descriptions.count)
              expect(keywords_campaign.callouts.count).to eq(initial_callouts.count)
              expect(ad.headlines.pluck(:id)).to match_array(initial_headlines.pluck(:id))
              expect(ad.descriptions.pluck(:id)).to match_array(initial_descriptions.pluck(:id))
              expect(keywords_campaign.callouts.pluck(:id)).to match_array(initial_callouts.pluck(:id))
              expect(keywords_campaign.structured_snippet&.id).to eq(initial_structured_snippet&.id)
            end
          end
        end
      end

      describe "Settings stage" do
        context 'location targets, schedules, and budget' do
          let!(:settings_campaign) { finish_keywords_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { settings_campaign.id }

          response '200', 'idempotently updates location targets' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      criteria_id: 2840,
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              settings_campaign.reload

              expect(settings_campaign.location_targets.count).to eq(1)
              expect(settings_campaign.location_targets.first.location_name).to eq('United States')
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'updates ad schedules' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  ad_schedules: {
                    always_on: false,
                    day_of_week: ['Monday', 'Tuesday', 'Wednesday'],
                    start_time: '9:00am',
                    end_time: '5:00pm',
                    time_zone: 'America/New_York'
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              settings_campaign.reload

              expect(settings_campaign.ad_schedules.count).to eq(3)
              expect(settings_campaign.schedule.always_on?).to be false
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'soft deletes ad schedules when days are removed' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_schedules) do
              settings_campaign.update_ad_schedules({
                always_on: false,
                day_of_week: ['Monday', 'Tuesday', 'Wednesday'],
                start_time: '9:00am',
                end_time: '5:00pm',
                time_zone: 'America/New_York'
              })
              settings_campaign.ad_schedules.order(:day_of_week).to_a
            end

            let(:campaign_params) do
              {
                campaign: {
                  ad_schedules: {
                    always_on: false,
                    day_of_week: ['Monday'],
                    start_time: '9:00am',
                    end_time: '5:00pm',
                    time_zone: 'America/New_York'
                  }
                }
              }
            end

            run_test! do |response|
              settings_campaign.reload

              expect(settings_campaign.ad_schedules.count).to eq(1)
              expect(settings_campaign.ad_schedules.first.day_of_week).to eq('Monday')

              monday_schedule = initial_schedules.find { |s| s.day_of_week == 'Monday' }
              tuesday_schedule = initial_schedules.find { |s| s.day_of_week == 'Tuesday' }
              wednesday_schedule = initial_schedules.find { |s| s.day_of_week == 'Wednesday' }

              expect(monday_schedule.reload.deleted_at).to be_nil
              expect(tuesday_schedule.reload.deleted_at).to be_present
              expect(wednesday_schedule.reload.deleted_at).to be_present
            end
          end

          response '200', 'reifies (un-deletes) previously deleted ad schedules' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_schedules) do
              settings_campaign.update_ad_schedules({
                always_on: false,
                day_of_week: ['Monday', 'Tuesday'],
                start_time: '9:00am',
                end_time: '5:00pm',
                time_zone: 'America/New_York'
              })
              schedules = settings_campaign.ad_schedules.order(:day_of_week).to_a
              tuesday_schedule = schedules.find { |s| s.day_of_week == 'Tuesday' }
              AdSchedule.where(id: tuesday_schedule.id).update_all(deleted_at: Time.current)
              schedules
            end

            let(:campaign_params) do
              {
                campaign: {
                  ad_schedules: {
                    always_on: false,
                    day_of_week: ['Monday', 'Tuesday'],
                    start_time: '10:00am',
                    end_time: '6:00pm',
                    time_zone: 'America/New_York'
                  }
                }
              }
            end

            run_test! do |response|
              settings_campaign.reload

              expect(settings_campaign.ad_schedules.count).to eq(2)
              expect(settings_campaign.ad_schedules.pluck(:day_of_week).sort).to eq(['Monday', 'Tuesday'])

              monday_schedule = initial_schedules.find { |s| s.day_of_week == 'Monday' }
              tuesday_schedule = initial_schedules.find { |s| s.day_of_week == 'Tuesday' }

              expect(monday_schedule.reload.deleted_at).to be_nil
              expect(monday_schedule.reload.start_hour).to eq(10)
              expect(tuesday_schedule.reload.deleted_at).to be_nil
              expect(tuesday_schedule.reload.start_hour).to eq(10)
            end
          end

          response '200', 'updates daily budget' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  daily_budget_cents: 5000
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              settings_campaign.reload

              expect(settings_campaign.daily_budget_cents).to eq(5000)
              expect(settings_campaign.budget.daily_budget_cents).to eq(5000)
              expect(data["daily_budget_cents"]).to eq(5000)
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'ready_for_next_stage is true after all settings configured' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  daily_budget_cents: 5000,
                  location_targets: [
                    {
                      criteria_id: 2840,
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    }
                  ],
                  ad_schedules: {
                    always_on: true
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              settings_campaign.reload

              expect(settings_campaign.location_targets.count).to eq(1)
              expect(settings_campaign.ad_schedules.count).to eq(1)
              expect(settings_campaign.daily_budget_cents).to eq(5000)
              expect(data["ready_for_next_stage"]).to eq(true)
            end
          end

          response '200', 'replaces location targets idempotently' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            before do
              settings_campaign.update_location_targets([
                {
                  criteria_id: 2124,
                  name: 'Canada',
                  target_type: 'Country',
                  country_code: 'CA',
                  targeted: true
                }
              ])
            end

            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      criteria_id: 2840,
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    },
                    {
                      criteria_id: 2484,
                      name: 'Mexico',
                      target_type: 'Country',
                      country_code: 'MX',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              settings_campaign.reload

              expect(settings_campaign.location_targets.count).to eq(2)
              expect(settings_campaign.location_targets.pluck(:location_name).sort).to eq(['Mexico', 'United States'])
              expect(settings_campaign.location_targets.where(location_name: 'Canada').exists?).to be false
            end
          end

          response '200', 'soft deletes location targets when removed from request' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_location_targets) do
              settings_campaign.update_location_targets([
                {
                  criteria_id: 2840,
                  name: 'United States',
                  target_type: 'Country',
                  country_code: 'US',
                  targeted: true
                },
                {
                  criteria_id: 2124,
                  name: 'Canada',
                  target_type: 'Country',
                  country_code: 'CA',
                  targeted: true
                },
                {
                  criteria_id: 2484,
                  name: 'Mexico',
                  target_type: 'Country',
                  country_code: 'MX',
                  targeted: true
                }
              ])
              settings_campaign.location_targets.order(:id).to_a
            end

            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      criteria_id: 2840,
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              settings_campaign.reload

              expect(settings_campaign.location_targets.count).to eq(1)
              expect(settings_campaign.location_targets.first.location_name).to eq('United States')

              expect(initial_location_targets[0].reload.deleted_at).to be_nil
              expect(initial_location_targets[1].reload.deleted_at).to be_present
              expect(initial_location_targets[2].reload.deleted_at).to be_present
            end
          end

          response '200', 'reifies (un-deletes) previously deleted location targets' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            # Create GeoTargetConstants for the test
            let!(:alaska_geo_target) do
              GeoTargetConstant.create!(
                criteria_id: 21132,
                name: "Alaska",
                canonical_name: "Alaska,United States",
                target_type: "State",
                status: "Active",
                country_code: "US"
              )
            end
            let!(:alabama_geo_target) do
              GeoTargetConstant.create!(
                criteria_id: 21133,
                name: "Alabama",
                canonical_name: "Alabama,United States",
                target_type: "State",
                status: "Active",
                country_code: "US"
              )
            end

            let!(:initial_location_targets) do
              settings_campaign.update_location_targets([
                { criteria_id: alaska_geo_target.criteria_id, targeted: true },
                { criteria_id: alabama_geo_target.criteria_id, targeted: true }
              ])
              targets = settings_campaign.location_targets.order(:id).to_a
              AdLocationTarget.where(id: targets[1].id).update_all(deleted_at: Time.current)
              targets
            end

            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    { criteria_id: alaska_geo_target.criteria_id, targeted: true },
                    { criteria_id: alabama_geo_target.criteria_id, targeted: true }
                  ]
                }
              }
            end

            run_test! do |response|
              settings_campaign.reload

              expect(settings_campaign.location_targets.count).to eq(2)
              expect(settings_campaign.location_targets.pluck(:location_name).sort).to eq([
                alabama_geo_target.canonical_name,
                alaska_geo_target.canonical_name
              ].sort)

              # First target should remain unchanged
              expect(initial_location_targets[0].reload.deleted_at).to be_nil
              expect(initial_location_targets[0].reload.location_name).to eq(alaska_geo_target.canonical_name)

              # Second target (was soft-deleted) should be restored
              expect(initial_location_targets[1].reload.deleted_at).to be_nil
              expect(initial_location_targets[1].reload.location_name).to eq(alabama_geo_target.canonical_name)
            end
          end

          response '200', 'preserves headlines, descriptions, callouts, and keywords when updating settings' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_headlines) { settings_campaign.headlines }
            let!(:initial_descriptions) { settings_campaign.descriptions }
            let!(:initial_callouts) { settings_campaign.callouts }
            let!(:initial_keywords) { settings_campaign.ad_groups.first.keywords }
            let!(:initial_structured_snippet) { settings_campaign.structured_snippet }

            let(:campaign_params) do
              {
                campaign: {
                  daily_budget_cents: 5000,
                  location_targets: [
                    {
                      criteria_id: 2840,
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    }
                  ],
                  ad_schedules: {
                    always_on: true
                  }
                }
              }
            end

            run_test! do |response|
              JSON.parse(response.body)
              settings_campaign.reload
              ad = settings_campaign.ad_groups.first.ads.first
              ad_group = settings_campaign.ad_groups.first

              expect(settings_campaign.daily_budget_cents).to eq(5000)
              expect(settings_campaign.location_targets.count).to eq(1)
              expect(ad.headlines.count).to eq(initial_headlines.count)
              expect(ad.descriptions.count).to eq(initial_descriptions.count)
              expect(settings_campaign.callouts.count).to eq(initial_callouts.count)
              expect(ad_group.keywords.count).to eq(initial_keywords.count)
              expect(ad.headlines.pluck(:id)).to match_array(initial_headlines.pluck(:id))
              expect(ad.descriptions.pluck(:id)).to match_array(initial_descriptions.pluck(:id))
              expect(settings_campaign.callouts.pluck(:id)).to match_array(initial_callouts.pluck(:id))
              expect(ad_group.keywords.pluck(:id)).to match_array(initial_keywords.pluck(:id))
              expect(settings_campaign.structured_snippet&.id).to eq(initial_structured_snippet&.id)
            end
          end
        end
      end
      describe "Launch stage" do
        context 'google platform settings and dates' do
          let!(:launch_campaign) { finish_settings_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { launch_campaign.id }

          response '200', 'updates google_advertising_channel_type' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  google_advertising_channel_type: 'SEARCH'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              launch_campaign.reload

              expect(launch_campaign.google_advertising_channel_type).to eq('SEARCH')
              expect(data["google_advertising_channel_type"]).to eq('SEARCH')
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'updates google_bidding_strategy' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  google_bidding_strategy: 'MAXIMIZE_CLICKS'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              launch_campaign.reload

              expect(launch_campaign.google_bidding_strategy).to eq('MAXIMIZE_CLICKS')
              expect(data["google_bidding_strategy"]).to eq('MAXIMIZE_CLICKS')
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'updates start_date' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  start_date: '2025-12-01'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              launch_campaign.reload

              expect(launch_campaign.start_date).to eq(Date.parse('2025-12-01'))
              expect(data["start_date"]).to eq('2025-12-01')
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'updates end_date' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  end_date: '2025-12-31'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              launch_campaign.reload

              expect(launch_campaign.end_date).to eq(Date.parse('2025-12-31'))
              expect(data["end_date"]).to eq('2025-12-31')
              expect(data["ready_for_next_stage"]).to eq(false)
            end
          end

          response '200', 'ready_for_next_stage is true after all launch fields are configured' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  google_advertising_channel_type: 'SEARCH',
                  google_bidding_strategy: 'MAXIMIZE_CLICKS',
                  start_date: '2025-12-01',
                  end_date: '2025-12-31'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              launch_campaign.reload

              expect(launch_campaign.google_advertising_channel_type).to eq('SEARCH')
              expect(launch_campaign.google_bidding_strategy).to eq('MAXIMIZE_CLICKS')
              expect(launch_campaign.start_date).to eq(Date.parse('2025-12-01'))
              expect(launch_campaign.end_date).to eq(Date.parse('2025-12-31'))
              expect(data["ready_for_next_stage"]).to eq(true)
            end
          end

          response '200', 'preserves all previous stage content when updating launch settings' do
            schema APISchemas::Campaign.response
            let(:auth_headers) { auth_headers_for(user1) }
            let(:Authorization) { auth_headers['Authorization'] }
            let(:"X-Signature") { auth_headers['X-Signature'] }
            let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

            let!(:initial_headlines) { launch_campaign.headlines }
            let!(:initial_descriptions) { launch_campaign.descriptions }
            let!(:initial_callouts) { launch_campaign.callouts }
            let!(:initial_keywords) { launch_campaign.ad_groups.first.keywords }
            let!(:initial_location_targets) { launch_campaign.location_targets }
            let!(:initial_structured_snippet) { launch_campaign.structured_snippet }

            let(:campaign_params) do
              {
                campaign: {
                  google_advertising_channel_type: 'SEARCH',
                  google_bidding_strategy: 'MAXIMIZE_CLICKS',
                  start_date: '2025-12-01',
                  end_date: '2025-12-31'
                }
              }
            end

            run_test! do |response|
              JSON.parse(response.body)
              launch_campaign.reload
              ad = launch_campaign.ad_groups.first.ads.first
              ad_group = launch_campaign.ad_groups.first

              expect(launch_campaign.google_advertising_channel_type).to eq('SEARCH')
              expect(launch_campaign.google_bidding_strategy).to eq('MAXIMIZE_CLICKS')
              expect(ad.headlines.count).to eq(initial_headlines.count)
              expect(ad.descriptions.count).to eq(initial_descriptions.count)
              expect(launch_campaign.callouts.count).to eq(initial_callouts.count)
              expect(ad_group.keywords.count).to eq(initial_keywords.count)
              expect(launch_campaign.location_targets.count).to eq(initial_location_targets.count)
              expect(ad.headlines.pluck(:id)).to match_array(initial_headlines.pluck(:id))
              expect(ad.descriptions.pluck(:id)).to match_array(initial_descriptions.pluck(:id))
              expect(launch_campaign.callouts.pluck(:id)).to match_array(initial_callouts.pluck(:id))
              expect(ad_group.keywords.pluck(:id)).to match_array(initial_keywords.pluck(:id))
              expect(launch_campaign.location_targets.pluck(:id)).to match_array(initial_location_targets.pluck(:id))
              expect(launch_campaign.structured_snippet&.id).to eq(initial_structured_snippet&.id)
            end
          end
        end
      end
    end
  end

  path '/api/v1/campaigns/{id}/advance' do
    parameter name: :id, in: :path, type: :integer, description: 'Campaign ID'

    post 'Advances campaign to next stage' do
      tags 'Campaigns'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let!(:campaign1) do
        result = Campaign.create_campaign!(user1_account, {
          name: "User 1 Campaign",
          project_id: project1.id,
          website_id: website1.id
        })
        result[:campaign]
      end

      response '404', 'campaign not found' do
        schema APISchemas::Campaign.error_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Campaign not found")
        end
      end
      describe "Content -> Highlights" do
        response '200', 'campaign advanced to next stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }

          before do
            ad = campaign1.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("highlights")

            campaign1.reload
            expect(campaign1.stage).to eq("highlights")
            expect(data["ready_for_next_stage"]).to eq(false)
          end
        end

        response '422', 'cannot advance - stage validation failed' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { campaign1.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to be_present

            expect(data["errors"]).to include("Headlines must have between 3-15 headlines (currently has 0)")
            expect(data["errors"]).to include("Descriptions must have between 2-4 descriptions (currently has 0)")

            campaign1.reload
            expect(campaign1.stage).to eq("content")
          end
        end
      end

      describe "Highlights -> Keywords" do
        response '200', 'campaign advanced from highlights to keywords stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:highlights_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Highlights Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)

            campaign
          end

          let(:id) { highlights_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("keywords")

            highlights_stage_campaign.reload
            expect(highlights_stage_campaign.stage).to eq("keywords")
            expect(data["ready_for_next_stage"]).to eq(false)
          end
        end

        response '422', 'cannot advance from highlights - validation failed' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:highlights_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Highlights Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!
            campaign
          end

          let(:id) { highlights_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to be_present
            expect(data["errors"]).to include("Callouts must have between 2-10 unique features (currently has 0)")

            highlights_stage_campaign.reload
            expect(highlights_stage_campaign.stage).to eq("highlights")
          end
        end
      end

      describe "Keywords -> Settings" do
        response '200', 'campaign advanced from keywords to settings stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:keywords_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Keywords Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            create_list(:ad_keyword, 5, ad_group: ad_group)

            campaign
          end

          let(:id) { keywords_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("settings")

            keywords_stage_campaign.reload
            expect(keywords_stage_campaign.stage).to eq("settings")
            expect(data["ready_for_next_stage"]).to eq(false)
          end
        end

        response '422', 'cannot advance from keywords - validation failed' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:keywords_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Keywords Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            campaign
          end

          let(:id) { keywords_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to be_present
            expect(data["errors"]).to include("Keywords must have between 5-15 keywords per ad group (currently has 0)")

            keywords_stage_campaign.reload
            expect(keywords_stage_campaign.stage).to eq("keywords")
          end
        end
      end

      describe "Settings -> Launch" do
        response '200', 'campaign advanced from settings to launch stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:settings_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Settings Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            create_list(:ad_keyword, 5, ad_group: ad_group)
            campaign.advance_stage!

            campaign.update_location_targets([{
              criteria_id: 2840,
              name: 'United States',
              target_type: 'Country',
              country_code: 'US',
              targeted: true
            }])
            campaign.update_ad_schedules({always_on: true})
            campaign.daily_budget_cents = 5000

            campaign
          end

          let(:id) { settings_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("launch")

            settings_stage_campaign.reload
            expect(settings_stage_campaign.stage).to eq("launch")
            expect(data["ready_for_next_stage"]).to eq(false)
          end
        end

        response '422', 'cannot advance from settings - validation failed (missing location)' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:settings_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Settings Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            create_list(:ad_keyword, 5, ad_group: ad_group)
            campaign.advance_stage!

            campaign
          end

          let(:id) { settings_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to be_present
            expect(data["errors"]).to include("Location targeting must be configured")

            settings_stage_campaign.reload
            expect(settings_stage_campaign.stage).to eq("settings")
          end
        end
      end

      describe "Launch -> Review" do
        response '200', 'campaign advanced from launch to review stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:launch_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Launch Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            create_list(:ad_keyword, 5, ad_group: ad_group)
            campaign.advance_stage!

            campaign.update_location_targets([{
              criteria_id: 2840,
              name: 'United States',
              target_type: 'Country',
              country_code: 'US',
              targeted: true
            }])
            campaign.update_ad_schedules({always_on: true})
            campaign.daily_budget_cents = 5000
            campaign.save!
            campaign.advance_stage!

            campaign.google_advertising_channel_type = 'SEARCH'
            campaign.google_bidding_strategy = 'MAXIMIZE_CLICKS'
            campaign.start_date = Date.parse('2025-12-01')
            campaign.end_date = Date.parse('2025-12-31')
            campaign.save!

            campaign
          end

          let(:id) { launch_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("review")

            launch_stage_campaign.reload
            expect(launch_stage_campaign.stage).to eq("review")
            expect(launch_stage_campaign.done_review_stage?).to eq(true)
            expect(data["ready_for_next_stage"]).to eq(true)
          end
        end

        response '422', 'cannot advance from launch - validation failed (missing fields)' do
          schema APISchemas::Campaign.error_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:launch_stage_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Launch Stage Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!

            ad_group = campaign.ad_groups.first
            create_list(:ad_callout, 2, campaign: campaign, ad_group: ad_group)
            campaign.advance_stage!

            create_list(:ad_keyword, 5, ad_group: ad_group)
            campaign.advance_stage!

            campaign.update_location_targets([{
              criteria_id: 2840,
              name: 'United States',
              target_type: 'Country',
              country_code: 'US',
              targeted: true
            }])
            campaign.update_ad_schedules({always_on: true})
            campaign.daily_budget_cents = 5000
            campaign.save!
            campaign.advance_stage!

            campaign
          end

          let(:id) { launch_stage_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["errors"]).to be_present
            # advertising_channel_type now has a default, so check for other missing fields
            expect(data["errors"]).to include("Google bidding strategy must be configured")

            launch_stage_campaign.reload
            expect(launch_stage_campaign.stage).to eq("launch")
          end
        end
      end
    end
  end

  path '/api/v1/campaigns/{id}/back' do
    parameter name: :id, in: :path, type: :integer, description: 'Campaign ID'

    post 'Steps back to previous stage' do
      tags 'Campaigns'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      describe "Content -> Website Builder" do
        response '200', 'goes back to previous project workflow step when at first campaign stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

          let!(:first_stage_campaign) do
            campaign, _, _ = create_campaign(user1_account)
            expect(campaign.stage).to eq("content")
            expect(campaign.launch_workflow.step).to eq("ads")
            expect(campaign.launch_workflow.substep).to eq("content")

            campaign
          end

          let(:id) { first_stage_campaign.id }

          run_test! do |response|
            JSON.parse(response.body)
            expect(response.status).to eq(200)

            first_stage_campaign.reload
            expect(first_stage_campaign.stage).to eq("content")
            expect(first_stage_campaign.launch_workflow.step).to eq("website")
            # Website now has substeps (build, domain, deploy), so going back lands on the last substep
            expect(first_stage_campaign.launch_workflow.substep).to eq("deploy")
          end
        end
      end

      describe "Highlights -> Content" do
        let!(:highlights_campaign) do
          campaign, _, _, = finish_content_stage(user1_account)
          expect(campaign.launch_workflow.reload.substep).to eq("highlights")
          campaign
        end

        response '200', 'campaign stepped back to previous stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { highlights_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("content")

            highlights_campaign.reload
            expect(highlights_campaign.stage).to eq("content")
            expect(highlights_campaign.launch_workflow.substep).to eq("content")
          end
        end
      end

      describe "Keywords -> Highlights" do
        let!(:keywords_campaign) do
          campaign, _, _, = finish_highlights_stage(user1_account)
          expect(campaign.launch_workflow.reload.substep).to eq("keywords")
          campaign
        end

        response '200', 'campaign stepped back to previous stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { keywords_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("highlights")

            keywords_campaign.reload
            expect(keywords_campaign.stage).to eq("highlights")
            expect(keywords_campaign.launch_workflow.substep).to eq("highlights")
          end
        end
      end

      describe "Settings -> Keywords" do
        let!(:settings_campaign) do
          campaign, _, _, = finish_keywords_stage(user1_account)
          expect(campaign.launch_workflow.reload.substep).to eq("settings")
          campaign
        end

        response '200', 'campaign stepped back to previous stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { settings_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("keywords")

            settings_campaign.reload
            expect(settings_campaign.stage).to eq("keywords")
            expect(settings_campaign.launch_workflow.substep).to eq("keywords")
          end
        end
      end

      describe "Launch -> Settings" do
        let!(:launch_campaign) do
          campaign, _, _, = finish_settings_stage(user1_account)
          expect(campaign.launch_workflow.reload.substep).to eq("launch")
          campaign
        end

        response '200', 'campaign stepped back to previous stage' do
          schema APISchemas::Campaign.advance_response
          let(:auth_headers) { auth_headers_for(user1) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { launch_campaign.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["stage"]).to eq("settings")

            launch_campaign.reload
            expect(launch_campaign.stage).to eq("settings")
            expect(launch_campaign.launch_workflow.substep).to eq("settings")
          end
        end
      end

      response '404', 'campaign not found' do
        schema APISchemas::Campaign.error_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Campaign not found")
        end
      end
    end
  end

  describe "Validation Errors" do
    let!(:campaign1) do
      result = Campaign.create_campaign!(user1_account, {
        name: "Test Campaign",
        project_id: project1.id,
        website_id: website1.id
      })
      result[:campaign]
    end

    path '/api/v1/campaigns/{id}' do
      parameter name: :id, in: :path, type: :integer, description: 'Campaign ID'

      patch 'Validates campaign updates' do
        tags 'Campaigns'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :campaign_params, in: :body, schema: APISchemas::Campaign.params_schema

        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { campaign1.id }

        describe 'Campaign validations' do
          response '422', 'rejects invalid time_zone' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  time_zone: 'Invalid/TimeZone'
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data["errors"]["campaign.time_zone"]).to be_present
            end
          end
        end

        describe 'Headline validations' do
          response '422', 'rejects blank headline text' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  headlines: [
                    {text: "", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].ads[0].headlines[0].text")).to be_present
            end
          end

          response '422', 'rejects headline text exceeding 30 characters' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  headlines: [
                    {text: "A" * 31, position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].ads[0].headlines[0].text")).to include("is too long (maximum is 30 characters)")
            end
          end
        end

        describe 'Description validations' do
          response '422', 'rejects blank description text' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  descriptions: [
                    {text: "", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].ads[0].descriptions[0].text")).to include("can't be blank")
            end
          end

          response '422', 'rejects description text exceeding 90 characters' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  descriptions: [
                    {text: "A" * 91, position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].ads[0].descriptions[0].text")).to include("is too long (maximum is 90 characters)")
            end
          end
        end

        describe 'Callout validations' do
          response '422', 'rejects blank callout text' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "callouts[0].text")).to include("can't be blank")
            end
          end

          response '422', 'rejects callout text exceeding 25 characters' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  callouts: [
                    {text: "A" * 26, position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "callouts[0].text")).to include("is too long (maximum is 25 characters)")
            end
          end
        end

        describe 'Keyword validations' do
          response '422', 'rejects blank keyword text' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "", match_type: "broad", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].keywords[0].text")).to include("can't be blank")
            end
          end

          response '422', 'rejects keyword text exceeding 80 characters' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "A" * 81, match_type: "broad", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].keywords[0].text")).to include("is too long (maximum is 80 characters)")
            end
          end

          response '422', 'rejects invalid keyword match_type' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "valid keyword", match_type: "invalid_type", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].keywords[0].match_type")).to include("is not included in the list")
            end
          end

          response '422', 'rejects keyword with missing match_type' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  keywords: [
                    {text: "valid keyword", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_groups[0].keywords[0].match_type")).to include("can't be blank")
            end
          end
        end

        describe 'Structured snippet validations' do
          response '422', 'rejects invalid structured snippet category' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "invalid_category",
                    values: ["Value 1", "Value 2", "Value 3"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "structured_snippet.category")).to include("is not included in the list")
            end
          end

          response '422', 'rejects structured snippet with less than 3 values' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "brands",
                    values: ["Value 1", "Value 2"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "structured_snippet.values")).to include("is too short (minimum is 3 characters)")
            end
          end

          response '422', 'rejects structured snippet with more than 10 values' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "brands",
                    values: (1..11).map { |i| "Value #{i}" }
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "structured_snippet.values")).to include("is too long (maximum is 10 characters)")
            end
          end

          response '422', 'rejects structured snippet with blank category' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet: {
                    category: "",
                    values: ["Value 1", "Value 2", "Value 3"]
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "structured_snippet.category")).to include("can't be blank")
            end
          end
        end

        describe 'Location target validations' do
          let!(:settings_campaign) { finish_keywords_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { settings_campaign.id }

          response '422', 'rejects invalid location target_type' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      target_type: 'invalid_type',
                      location_name: 'United States',
                      country_code: 'US',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "location_targets[0].target_type")).to include("is not included in the list")
            end
          end

          response '422', 'rejects invalid target_type without criteria_id' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  # Without criteria_id, target_type is validated against ['geo_location', 'radius', 'location_group']
                  # Passing an invalid target_type should fail validation
                  # Note: Not passing 'name' because it's a GeoTargetConstant field not recognized by AdLocationTarget
                  location_targets: [
                    {
                      target_type: 'INVALID_TYPE',
                      country_code: 'US',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data["errors"].to_s).to include("is not included in the list")
            end
          end

          response '422', 'rejects geo_location without criteria_id' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      # Without criteria_id, normalization doesn't apply and 'name' is unknown
                      name: 'United States',
                      target_type: 'Country',
                      country_code: 'US',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              # Without criteria_id, 'name' isn't recognized as a valid attribute
              expect(data["errors"].to_s).to include("unknown attribute")
            end
          end

          response '422', 'rejects geo_location without name' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  # Use AdLocationTarget format (without criteria_id) to test validation
                  location_targets: [
                    {
                      target_type: 'geo_location',
                      location_type: 'COUNTRY',
                      # location_name intentionally omitted
                      country_code: 'US',
                      geo_target_constant: 'geoTargetConstants/2840',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "location_targets[0].location_name")).to include("can't be blank")
            end
          end

          response '422', 'rejects geo_location without country_code' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  # Use AdLocationTarget format (without criteria_id) to test validation
                  location_targets: [
                    {
                      target_type: 'geo_location',
                      location_type: 'Country',
                      location_name: 'United States',
                      # country_code intentionally omitted
                      geo_target_constant: 'geoTargetConstants/2840',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "location_targets[0].country_code")).to include("can't be blank")
            end
          end

          response '422', 'rejects radius target without radius value' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      target_type: 'radius',
                      city: 'New York',
                      country_code: 'US',
                      radius_units: 'MILES',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "location_targets[0].radius")).to include("can't be blank")
            end
          end

          response '422', 'rejects radius target with invalid radius_units' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      # Radius params not in permitted list, so validation fails on missing required fields
                      target_type: 'radius',
                      city: 'New York',
                      country_code: 'US',
                      radius: 10,
                      radius_units: 'INVALID_UNITS',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              # Radius/city params are filtered, so we get validation errors for missing required fields
              expect(data["errors"].to_s).to include("can't be blank")
            end
          end

          response '422', 'rejects radius target without city' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      target_type: 'radius',
                      country_code: 'US',
                      radius: 10,
                      radius_units: 'MILES',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "location_targets[0].city")).to include("can't be blank")
            end
          end

          response '422', 'returns field-keyed error when GeoTargetConstant not found' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  location_targets: [
                    {
                      criteria_id: 999999,
                      name: 'Nonexistent Location',
                      target_type: 'Country',
                      country_code: 'XX',
                      targeted: true
                    }
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              # Error should be keyed to location_targets field, not returned as array
              expect(data["errors"]).to be_a(Hash)
              expect(data.dig("errors", "location_targets")).to be_present
              expect(data.dig("errors", "location_targets").first).to include("GeoTargetConstant not found")
            end
          end
        end

        describe 'Ad schedule validations' do
          let!(:settings_campaign) { finish_keywords_stage(user1_account, project_id: project1.id, website_id: website1.id)[0] }
          let(:id) { settings_campaign.id }

          response '422', 'rejects invalid day_of_week' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  ad_schedules: {
                    always_on: false,
                    day_of_week: ['InvalidDay'],
                    start_time: '9:00am',
                    end_time: '5:00pm',
                    time_zone: 'America/New_York'
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "ad_schedules.day_of_week")).to include("is not included in the list")
            end
          end

          response '422', 'rejects schedule with invalid time_zone' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  ad_schedules: {
                    always_on: false,
                    day_of_week: ['Monday'],
                    start_time: '9:00am',
                    end_time: '5:00pm',
                    time_zone: 'Invalid/TimeZone'
                  }
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data.dig("errors", "campaign.time_zone")).to include("is not included in the list")
            end
          end
        end

        describe 'Multiple validation errors' do
          response '422', 'returns all validation errors at once' do
            schema APISchemas::Campaign.error_response
            let(:campaign_params) do
              {
                campaign: {
                  time_zone: 'Invalid/TimeZone',
                  headlines: [
                    {text: "", position: 0},
                    {text: "A" * 31, position: 1},
                    {text: "Legal headline", position: 2},
                    {text: "Illegal headline" * 30, position: 3}
                  ],
                  descriptions: [
                    {text: "", position: 0}
                  ],
                  keywords: [
                    {text: "", match_type: "invalid", position: 0}
                  ],
                  callouts: [
                    {text: "", position: 0}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present
              expect(data["errors"]).to be_a(Hash)
              expect(data["errors"].keys.length).to be > 3

              expect(data["errors"].keys).to include("ad_groups[0].ads[0].headlines[0].text")
              expect(data["errors"].keys).to include("ad_groups[0].ads[0].headlines[1].text")
              expect(data["errors"].keys).to_not include("ad_groups[0].ads[0].headlines[2].text")
              expect(data["errors"].keys).to include("ad_groups[0].ads[0].headlines[3].text")
              expect(data["errors"].keys).to include(match(/ad_groups\[\d+\]\.ads\[\d+\]\.descriptions\[\d+\]\.text/))
              expect(data["errors"].keys).to include(match(/ad_groups\[\d+\]\.keywords\[\d+\]/))
              expect(data["errors"].keys).to include(match(/callouts\[\d+\]\.text/))
              expect(data["errors"].keys).to include("campaign.time_zone")
            end
          end
        end

        describe 'No partial updates on validation failure' do
          response '422', 'does not save any changes when validation fails' do
            schema APISchemas::Campaign.error_response
            let!(:initial_headlines) do
              ad = campaign1.ad_groups.first.ads.first
              [
                create(:ad_headline, ad: ad, text: "Original Headline 1", position: 0),
                create(:ad_headline, ad: ad, text: "Original Headline 2", position: 1)
              ]
            end

            let(:campaign_params) do
              {
                campaign: {
                  name: "Updated Campaign Name",
                  headlines: [
                    {id: initial_headlines[0].id, text: "Updated Headline", position: 0},
                    {text: "", position: 1}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              expect(data["errors"]).to be_present

              campaign1.reload
              expect(campaign1.name).to eq("Test Campaign")

              initial_headlines[0].reload
              expect(initial_headlines[0].text).to eq("Original Headline 1")
            end
          end
        end
      end
    end
  end
end
