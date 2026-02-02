mount Jumpstart::Engine, at: "/jumpstart"
mount Mailbin::Engine, at: "/mailbin"

mount Rswag::Ui::Engine => "/api-docs"
mount Rswag::Api::Engine => "/api-docs"

authenticated :user do
  resources :uploads, only: [:index]
end

namespace :test do
  # Database snapshot operations (true database concerns)
  post "database/truncate", to: "database#truncate"
  post "database/snapshots", to: "database#create_snapshot"
  post "database/restore_snapshot", to: "database#restore_snapshot"
  get "database/snapshots", to: "database#index"

  # Test data scenarios and queries are handled by cypress-on-rails middleware
  # POST /__e2e__/command with { name: "scenarios/fill_subdomain_limit", options: { email: "..." } }
  # POST /__e2e__/command with { name: "queries/first_project" }
  # See e2e/app_commands/ for available commands

  get "tracking/stats", to: "tracking#stats"
  get "tracking/leads", to: "tracking#leads"
  get "tracking/info", to: "tracking#info"
  get "tracking/built", to: "tracking#built"
  get "tracking/built/*path", to: "tracking#built", format: false

  post "e2e/set_invite_status", to: "e2e#set_invite_status"
  delete "e2e/reset", to: "e2e#reset"
end
