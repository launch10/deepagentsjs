require "rails_helper"

RSpec.describe Users::OmniauthCallbacksController, type: :controller do
  include Devise::Test::ControllerHelpers

  let(:user) { create(:user) }
  let(:account) { user.owned_account }

  before do
    @request.env["devise.mapping"] = Devise.mappings[:user]
  end

  describe "#google_oauth2_connected" do
    let(:connected_account) do
      create(:connected_account,
        owner: user,
        provider: "google_oauth2",
        auth: { "info" => { "email" => "test@gmail.com" } })
    end

    context "when thread_id is present in session" do
      let!(:job_run) do
        create(:job_run,
          account: account,
          job_class: "GoogleOAuthConnect",
          status: "running",
          langgraph_thread_id: "thread_123")
      end

      before do
        sign_in user
        session[:langgraph_thread_id] = "thread_123"
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
      end

      it "completes the job run with google_email result" do
        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(
            job_run_id: job_run.id,
            thread_id: "thread_123",
            status: "completed",
            result: { google_email: "test@gmail.com" }
          )
        )

        controller.send(:google_oauth2_connected, connected_account)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data).to eq({ "google_email" => "test@gmail.com" })
      end

      it "removes thread_id from session" do
        allow(LanggraphCallbackWorker).to receive(:perform_async)

        controller.send(:google_oauth2_connected, connected_account)

        expect(session[:langgraph_thread_id]).to be_nil
      end
    end

    context "when thread_id is not present in session" do
      let!(:job_run) do
        create(:job_run,
          account: account,
          job_class: "GoogleOAuthConnect",
          status: "running",
          langgraph_thread_id: "thread_123")
      end

      before do
        sign_in user
      end

      it "does not complete any job run" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        controller.send(:google_oauth2_connected, connected_account)

        job_run.reload
        expect(job_run.status).to eq("running")
      end
    end

    context "when no matching job run exists" do
      before do
        sign_in user
        session[:langgraph_thread_id] = "thread_nonexistent"
      end

      it "does not raise an error" do
        expect { controller.send(:google_oauth2_connected, connected_account) }.not_to raise_error
      end

      it "removes thread_id from session" do
        controller.send(:google_oauth2_connected, connected_account)
        expect(session[:langgraph_thread_id]).to be_nil
      end
    end

    context "when job run is already completed" do
      let!(:job_run) do
        create(:job_run,
          account: account,
          job_class: "GoogleOAuthConnect",
          status: "completed",
          langgraph_thread_id: "thread_123")
      end

      before do
        sign_in user
        session[:langgraph_thread_id] = "thread_123"
      end

      it "does not update the already completed job run" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        controller.send(:google_oauth2_connected, connected_account)

        job_run.reload
        expect(job_run.status).to eq("completed")
      end
    end

    context "when job run is pending" do
      let!(:job_run) do
        create(:job_run,
          account: account,
          job_class: "GoogleOAuthConnect",
          status: "pending",
          langgraph_thread_id: "thread_123")
      end

      before do
        sign_in user
        session[:langgraph_thread_id] = "thread_123"
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
      end

      it "completes the pending job run" do
        allow(LanggraphCallbackWorker).to receive(:perform_async)

        controller.send(:google_oauth2_connected, connected_account)

        job_run.reload
        expect(job_run.status).to eq("completed")
      end
    end

    context "when connected_account owner has no owned_account" do
      let(:orphan_user) { User.new(id: 999, email: "orphan@test.com") }
      let(:orphan_connected_account) do
        instance_double(ConnectedAccount, owner: orphan_user, email: "test@gmail.com")
      end

      before do
        sign_in user
        session[:langgraph_thread_id] = "thread_123"
        allow(orphan_user).to receive(:owned_account).and_return(nil)
      end

      it "does not raise an error" do
        expect { controller.send(:google_oauth2_connected, orphan_connected_account) }.not_to raise_error
      end

      it "removes thread_id from session" do
        controller.send(:google_oauth2_connected, orphan_connected_account)
        expect(session[:langgraph_thread_id]).to be_nil
      end
    end
  end
end
