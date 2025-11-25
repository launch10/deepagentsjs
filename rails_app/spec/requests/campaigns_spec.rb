require 'swagger_helper'

RSpec.describe "Campaigns API", type: :request do
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_account) { user1.owned_account }
  let!(:user2_account) { user2.owned_account }

  let!(:template) { create(:template) }
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
    subscribe_account(user1_account, plan_name: 'pro')
    subscribe_account(user2_account, plan_name: 'pro')
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
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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
        end
      end

      response '200', 'campaign already exists and is returned' do
        schema APISchemas::Campaign.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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

      response '422', 'invalid request - missing website_id' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:campaign_params) do
          {
            campaign: {
              name: "Test Campaign",
              project_id: project1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
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

      let!(:campaign1) do
        result = Campaign.create_campaign!(user1_account, {
          name: "User 1 Campaign",
          project_id: project1.id,
          website_id: website1.id
        })
        result[:campaign]
      end

      let!(:campaign2) do
        result = Campaign.create_campaign!(user2_account, {
          name: "User 2 Campaign",
          project_id: project2.id,
          website_id: website2.id
        })
        result[:campaign]
      end

      response '200', 'campaign updated' do
        schema APISchemas::Campaign.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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

      response '200', 'campaign updated with nested ad group attributes' do
        schema APISchemas::Campaign.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:id) { campaign1.id }
        let(:campaign_params) do
          ad_group = campaign1.ad_groups.first
          {
            campaign: {
              ad_groups_attributes: [
                {
                  id: ad_group.id,
                  name: "Renamed Ad Group"
                }
              ]
            }
          }
        end

        run_test! do |response|
          campaign1.reload
          expect(campaign1.ad_groups.first.name).to eq("Renamed Ad Group")
        end
      end

      response '404', 'cannot access another users campaign' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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

      describe "Content stage" do
        let!(:content_stage_campaign) do
          result = Campaign.create_campaign!(user1_account, {
            name: "Content Stage Campaign",
            project_id: project1.id,
            website_id: website1.id
          })
          campaign = result[:campaign]
          ad = campaign.ad_groups.first.ads.first
          create_list(:ad_headline, 3, ad: ad)
          create_list(:ad_description, 2, ad: ad)
          campaign.advance_stage!
          campaign.reload
        end

        let(:id) { content_stage_campaign.id }

        response '200', 'idempotently creates headlines on first update' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        headlines_attributes: [
                          {text: "Headline 1", position: 0},
                          {text: "Headline 2", position: 1}
                        ]
                      }
                    ]
                  }
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

            expect(data["ad_groups"]).to be_present
            expect(data["ad_groups"].first["ads"]).to be_present
            headlines = data["ad_groups"].first["ads"].first["headlines"]
            expect(headlines.length).to eq(2)
            expect(headlines[0]["id"]).to be_present
            expect(headlines[0]["text"]).to eq("Headline 1")
            expect(headlines[0]["position"]).to eq(0)
            expect(headlines[1]["id"]).to be_present
            expect(headlines[1]["text"]).to eq("Headline 2")
            expect(headlines[1]["position"]).to eq(1)
          end
        end

        response '200', 'ready_for_next_stage is true after creating 3 headlines and 2 descriptions' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        headlines_attributes: [
                          {text: "Headline 1", position: 0},
                          {text: "Headline 2", position: 1},
                          {text: "Headline 3", position: 2}
                        ],
                        descriptions_attributes: [
                          {text: "Description 1", position: 0},
                          {text: "Description 2", position: 1}
                        ]
                      }
                    ]
                  }
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

            ad_data = data["ad_groups"].first["ads"].first
            expect(ad_data["headlines"].length).to eq(3)
            expect(ad_data["headlines"].all? { |h| h["id"].present? }).to be true
            expect(ad_data["descriptions"].length).to eq(2)
            expect(ad_data["descriptions"].all? { |d| d["id"].present? }).to be true
          end
        end

        response '200', 'idempotently replaces headlines - delete and update' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
          let(:id) { campaign1.id }

          let!(:initial_headlines) do
            ad = campaign1.ad_groups.first.ads.first
            [
              create(:ad_headline, ad: ad, text: "Headline 1", position: 0),
              create(:ad_headline, ad: ad, text: "Headline 2", position: 1)
            ]
          end

          let(:campaign_params) do
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        headlines_attributes: [
                          {id: initial_headlines[1].id, text: "Headline 2 Updated", position: 0},
                          {text: "Headline 3", position: 1}
                        ]
                      }
                    ]
                  }
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
            expect(AdHeadline.exists?(initial_headlines[0].id)).to be false

            headlines = data["ad_groups"].first["ads"].first["headlines"]
            expect(headlines.length).to eq(2)
            expect(headlines[0]["id"]).to eq(initial_headlines[1].id)
            expect(headlines[0]["text"]).to eq("Headline 2 Updated")
            expect(headlines[1]["id"]).to be_present
            expect(headlines[1]["text"]).to eq("Headline 3")
          end
        end

        response '200', 'idempotently creates descriptions on first update' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
          let(:id) { campaign1.id }
          let(:campaign_params) do
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        descriptions_attributes: [
                          {text: "Description 1", position: 0},
                          {text: "Description 2", position: 1}
                        ]
                      }
                    ]
                  }
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

            descriptions = data["ad_groups"].first["ads"].first["descriptions"]
            expect(descriptions.length).to eq(2)
            expect(descriptions.all? { |d| d["id"].present? }).to be true
            expect(descriptions[0]["text"]).to eq("Description 1")
            expect(descriptions[1]["text"]).to eq("Description 2")
          end
        end

        response '200', 'idempotently replaces descriptions - delete and update' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
          let(:id) { campaign1.id }

          let!(:initial_descriptions) do
            ad = campaign1.ad_groups.first.ads.first
            [
              create(:ad_description, ad: ad, text: "Description 1", position: 0),
              create(:ad_description, ad: ad, text: "Description 2", position: 1)
            ]
          end

          let(:campaign_params) do
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        descriptions_attributes: [
                          {id: initial_descriptions[1].id, text: "Description 2 Updated", position: 0},
                          {text: "Description 3", position: 1}
                        ]
                      }
                    ]
                  }
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
            expect(AdDescription.exists?(initial_descriptions[0].id)).to be false

            descriptions = data["ad_groups"].first["ads"].first["descriptions"]
            expect(descriptions.length).to eq(2)
            expect(descriptions[0]["id"]).to eq(initial_descriptions[1].id)
            expect(descriptions[0]["text"]).to eq("Description 2 Updated")
            expect(descriptions[1]["id"]).to be_present
            expect(descriptions[1]["text"]).to eq("Description 3")
          end
        end

        response '200', 'idempotently replaces both headlines and descriptions together' do
          schema APISchemas::Campaign.response
          let(:Authorization) { auth_headers_for(user1)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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
            ad = campaign1.ad_groups.first.ads.first
            {
              campaign: {
                ad_groups_attributes: [
                  {
                    id: campaign1.ad_groups.first.id,
                    ads_attributes: [
                      {
                        id: ad.id,
                        headlines_attributes: [
                          {id: initial_content[:headlines][1].id, text: "Headline 2 Updated", position: 0},
                          {text: "Headline 3", position: 1}
                        ],
                        descriptions_attributes: [
                          {id: initial_content[:descriptions][0].id, text: "Description 1 Updated", position: 0},
                          {text: "Description 3", position: 1}
                        ]
                      }
                    ]
                  }
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
            expect(AdHeadline.exists?(initial_content[:headlines][0].id)).to be false

            expect(ad.descriptions.count).to eq(2)
            expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 1 Updated", "Description 3"])
            expect(AdDescription.exists?(initial_content[:descriptions][1].id)).to be false

            ad_data = data["ad_groups"].first["ads"].first
            expect(ad_data["headlines"].length).to eq(2)
            expect(ad_data["headlines"][0]["id"]).to eq(initial_content[:headlines][1].id)
            expect(ad_data["headlines"][1]["id"]).to be_present
            expect(ad_data["descriptions"].length).to eq(2)
            expect(ad_data["descriptions"][0]["id"]).to eq(initial_content[:descriptions][0].id)
            expect(ad_data["descriptions"][1]["id"]).to be_present
          end
        end
      end

      describe "Highlights stage" do
        context 'highlights stage - callouts' do
          let!(:highlights_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Highlights Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!
            campaign.reload
          end

          let(:id) { highlights_campaign.id }

          response '200', 'idempotently creates callouts on first update' do
            schema APISchemas::Campaign.response
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts_attributes: [
                    {text: "Free Shipping", position: 0}
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
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts_attributes: [
                    {text: "Free Shipping", position: 0},
                    {text: "24/7 Support", position: 1}
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

          response '200', 'idempotently replaces callouts - delete and update' do
            schema APISchemas::Campaign.response
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }

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
                  callouts_attributes: [
                    {id: initial_callouts[1].id, text: "Callout 2 Updated", position: 0},
                    {text: "Callout 3", position: 1}
                  ]
                }
              }
            end

            run_test! do |response|
              data = JSON.parse(response.body)
              highlights_campaign.reload

              expect(highlights_campaign.callouts.count).to eq(2)
              expect(highlights_campaign.callouts.order(:position).pluck(:text)).to eq(["Callout 2 Updated", "Callout 3"])
              expect(AdCallout.exists?(initial_callouts[0].id)).to be false

              expect(data["callouts"].length).to eq(2)
              expect(data["callouts"][0]["id"]).to eq(initial_callouts[1].id)
              expect(data["callouts"][0]["text"]).to eq("Callout 2 Updated")
              expect(data["callouts"][1]["id"]).to be_present
              expect(data["callouts"][1]["text"]).to eq("Callout 3")
            end
          end
        end

        context 'highlights stage - structured snippets' do
          let!(:highlights_campaign) do
            result = Campaign.create_campaign!(user1_account, {
              name: "Highlights Campaign",
              project_id: project1.id,
              website_id: website1.id
            })
            campaign = result[:campaign]
            ad = campaign.ad_groups.first.ads.first
            create_list(:ad_headline, 3, ad: ad)
            create_list(:ad_description, 2, ad: ad)
            campaign.advance_stage!
            campaign.reload
          end

          let(:id) { highlights_campaign.id }

          response '200', 'idempotently creates structured snippet on first update' do
            schema APISchemas::Campaign.response
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet_attributes: {
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
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }

            let!(:initial_snippet) do
              create(:ad_structured_snippet, campaign: highlights_campaign, category: "brands", values: ["Nike", "Adidas", "Puma"])
            end

            let(:campaign_params) do
              {
                campaign: {
                  structured_snippet_attributes: {
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

          response '200', 'ready_for_next_stage works with callouts and structured snippet', focus: true do
            schema APISchemas::Campaign.response
            let(:Authorization) { auth_headers_for(user1)['Authorization'] }
            let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
            let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
            let(:campaign_params) do
              {
                campaign: {
                  callouts_attributes: [
                    {text: "Free Shipping", position: 0},
                    {text: "24/7 Support", position: 1}
                  ],
                  structured_snippet_attributes: {
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

      response '200', 'campaign advanced to next stage' do
        schema APISchemas::Campaign.advance_response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
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

      response '200', 'campaign advanced from highlights to keywords stage' do
        schema APISchemas::Campaign.advance_response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }

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
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }

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

      response '404', 'campaign not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Campaign not found")
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

      let!(:campaign1) do
        result = Campaign.create_campaign!(user1_account, {
          name: "User 1 Campaign",
          project_id: project1.id,
          website_id: website1.id
        })
        campaign = result[:campaign]

        ad = campaign.ad_groups.first.ads.first
        create_list(:ad_headline, 3, ad: ad)
        create_list(:ad_description, 2, ad: ad)

        campaign.advance_stage!
        expect(campaign.launch_workflow.reload.substep).to eq("highlights")
        campaign
      end

      response '200', 'campaign stepped back to previous stage' do
        schema APISchemas::Campaign.advance_response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:id) { campaign1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["stage"]).to eq("content")

          campaign1.reload
          expect(campaign1.stage).to eq("content")
          expect(campaign1.launch_workflow.substep).to eq("content")
        end
      end

      response '422', 'cannot go back - already at first stage' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }

        let!(:first_stage_campaign) do
          result = Campaign.create_campaign!(user1_account, {
            name: "First Stage Campaign",
            project_id: project1.id,
            website_id: website1.id
          })
          result[:campaign]
        end

        let(:id) { first_stage_campaign.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
          expect(data["errors"]).to include("Stage Already at first stage")

          first_stage_campaign.reload
          expect(first_stage_campaign.stage).to eq("content")
        end
      end

      response '404', 'campaign not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Campaign not found")
        end
      end
    end
  end
end
