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
          campaign1.reload
          ad = campaign1.ad_groups.first.ads.first

          expect(ad.headlines.count).to eq(2)
          expect(ad.headlines.order(:position).pluck(:text)).to eq(["Headline 2 Updated", "Headline 3"])
          expect(AdHeadline.exists?(initial_headlines[0].id)).to be false
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
          campaign1.reload
          ad = campaign1.ad_groups.first.ads.first

          expect(ad.descriptions.count).to eq(2)
          expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 1", "Description 2"])
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
          campaign1.reload
          ad = campaign1.ad_groups.first.ads.first

          expect(ad.descriptions.count).to eq(2)
          expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 2 Updated", "Description 3"])
          expect(AdDescription.exists?(initial_descriptions[0].id)).to be false
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
          campaign1.reload
          ad = campaign1.ad_groups.first.ads.first

          expect(ad.headlines.count).to eq(2)
          expect(ad.headlines.order(:position).pluck(:text)).to eq(["Headline 2 Updated", "Headline 3"])
          expect(AdHeadline.exists?(initial_content[:headlines][0].id)).to be false

          expect(ad.descriptions.count).to eq(2)
          expect(ad.descriptions.order(:position).pluck(:text)).to eq(["Description 1 Updated", "Description 3"])
          expect(AdDescription.exists?(initial_content[:descriptions][1].id)).to be false
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
