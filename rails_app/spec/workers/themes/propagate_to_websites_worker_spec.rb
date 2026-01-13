# frozen_string_literal: true

require "rails_helper"
require "sidekiq/testing"

RSpec.describe Themes::PropagateToWebsitesWorker, type: :worker do
  let(:account) { create(:account) }
  let(:theme) { create(:theme, :official) }
  let(:template_index_css) { File.read(Rails.root.join("templates/default/src/index.css")) }
  let(:worker) { described_class.new }

  before do
    Sidekiq::Testing.fake!
  end

  after do
    Sidekiq::Worker.clear_all
  end

  describe "configuration" do
    it "uses the default queue" do
      expect(described_class.sidekiq_options["queue"]).to eq(:default)
    end

    it "has 3 retries" do
      expect(described_class.sidekiq_options["retry"]).to eq(3)
    end
  end

  describe "#perform" do
    context "with a valid theme" do
      it "enqueues PerformOne jobs for each website" do
        project1 = create(:project, account: account)
        project2 = create(:project, account: account)
        website1 = create(:website, project: project1, account: account, theme: theme)
        website2 = create(:website, project: project2, account: account, theme: theme)

        Themes::PropagateToWebsitesWorker::PerformOne.jobs.clear

        worker.perform(theme.id)

        expect(Themes::PropagateToWebsitesWorker::PerformOne.jobs.size).to eq(2)
        job_args = Themes::PropagateToWebsitesWorker::PerformOne.jobs.map { |j| j["args"].first }
        expect(job_args).to contain_exactly(website1.id, website2.id)
      end
    end

    context "when theme is not found" do
      it "returns early without error" do
        expect { worker.perform(999999) }.not_to raise_error
        expect(Themes::PropagateToWebsitesWorker::PerformOne.jobs.size).to eq(0)
      end
    end

    context "when theme has no websites" do
      it "does not enqueue any jobs" do
        Themes::PropagateToWebsitesWorker::PerformOne.jobs.clear

        worker.perform(theme.id)

        expect(Themes::PropagateToWebsitesWorker::PerformOne.jobs.size).to eq(0)
      end
    end
  end

  describe "async enqueueing" do
    it "can be enqueued" do
      theme_id = theme.id
      described_class.jobs.clear

      expect {
        described_class.perform_async(theme_id)
      }.to change(described_class.jobs, :size).by(1)
    end

    it "enqueues with correct arguments" do
      theme_id = theme.id
      described_class.jobs.clear
      described_class.perform_async(theme_id)

      job = described_class.jobs.last
      expect(job["args"]).to eq([theme_id])
      expect(job["queue"]).to eq("default")
    end
  end
end

RSpec.describe Themes::PropagateToWebsitesWorker::PerformOne, type: :worker do
  let(:account) { create(:account) }
  let(:theme) { create(:theme, :official) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account, theme: theme) }
  let(:template_index_css) { File.read(Rails.root.join("templates/default/src/index.css")) }
  let(:worker) { described_class.new }

  before do
    Sidekiq::Testing.fake!
  end

  after do
    Sidekiq::Worker.clear_all
  end

  describe "#perform" do
    it "injects theme CSS into the website" do
      website.website_files.create!(path: "src/index.css", content: template_index_css)

      worker.perform(website.id)

      css_file = website.website_files.find_by(path: "src/index.css").reload
      expect(css_file.content).to include("--primary:")
    end

    it "raises RecordNotFound when website does not exist" do
      expect { worker.perform(999999) }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
