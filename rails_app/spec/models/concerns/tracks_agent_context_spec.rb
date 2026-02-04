require "rails_helper"

RSpec.describe TracksAgentContext, type: :model do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account) }

  before do
    Current.account = account
    Current.user = user
  end

  after do
    Current.account = nil
    Current.user = nil
  end

  describe "WebsiteUpload integration" do
    let(:upload) { create(:upload, account: account) } # Factory creates image by default

    it "creates images.created event on create" do
      expect {
        WebsiteUpload.create!(website: website, upload: upload)
      }.to change(AgentContextEvent, :count).by(1)

      event = AgentContextEvent.last
      expect(event.event_type).to eq("images.created")
      expect(event.project).to eq(project)
      expect(event.account).to eq(account)
      expect(event.user).to eq(user)
      expect(event.payload["upload_id"]).to eq(upload.id)
      expect(event.payload["filename"]).to eq(upload.original_filename)
    end

    it "creates images.deleted event on destroy" do
      website_upload = WebsiteUpload.create!(website: website, upload: upload)
      AgentContextEvent.destroy_all # Clear the create event

      expect {
        website_upload.destroy!
      }.to change(AgentContextEvent, :count).by(1)

      event = AgentContextEvent.last
      expect(event.event_type).to eq("images.deleted")
      expect(event.project).to eq(project)
      expect(event.payload["upload_id"]).to eq(upload.id)
    end

    it "does not create event for non-image uploads" do
      # Create an upload and stub it as non-image
      non_image_upload = create(:upload, account: account)
      allow(non_image_upload).to receive(:image?).and_return(false)

      expect {
        WebsiteUpload.create!(website: website, upload: non_image_upload)
      }.not_to change(AgentContextEvent, :count)
    end

    it "sets eventable to the WebsiteUpload record" do
      website_upload = WebsiteUpload.create!(website: website, upload: upload)

      event = AgentContextEvent.last
      expect(event.eventable).to eq(website_upload)
    end
  end
end
