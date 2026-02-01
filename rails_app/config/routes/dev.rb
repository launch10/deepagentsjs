mount Jumpstart::Engine, at: "/jumpstart"
mount Mailbin::Engine, at: "/mailbin"

mount Rswag::Ui::Engine => "/api-docs"
mount Rswag::Api::Engine => "/api-docs"

authenticated :user do
  resources :uploads, only: [:index]
end

namespace :test do
  post "database/truncate", to: "database#truncate"
  post "database/snapshots", to: "database#create_snapshot"
  post "database/restore_snapshot", to: "database#restore_snapshot"
  get "database/snapshots", to: "database#index"
  get "database/first_project", to: "database#first_project"
  post "database/set_credits", to: "database#set_credits"
  post "database/set_credit_pack_stripe_price", to: "database#set_credit_pack_stripe_price"
  post "database/fill_subdomain_limit", to: "database#fill_subdomain_limit"
  get "database/first_website", to: "database#first_website"
  post "database/assign_custom_domain", to: "database#assign_custom_domain"
  post "database/assign_platform_subdomain", to: "database#assign_platform_subdomain"

  get "tracking/stats", to: "tracking#stats"
  get "tracking/leads", to: "tracking#leads"
  get "tracking/info", to: "tracking#info"
  get "tracking/built", to: "tracking#built"
  get "tracking/built/*path", to: "tracking#built", format: false

  post "e2e/set_invite_status", to: "e2e#set_invite_status"
  delete "e2e/reset", to: "e2e#reset"
end
