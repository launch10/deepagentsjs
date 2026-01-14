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
  get "database/first_website", to: "database#first_website"

  get "tracking/stats", to: "tracking#stats"
  get "tracking/page", to: "tracking#page"
  get "tracking/info", to: "tracking#info"
  get "tracking/built", to: "tracking#built"
  get "tracking/built/*path", to: "tracking#built", format: false
end
