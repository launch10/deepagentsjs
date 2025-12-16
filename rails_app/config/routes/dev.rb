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
end
