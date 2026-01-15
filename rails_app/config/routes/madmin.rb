namespace :madmin, path: :admin do
  # Unified model configuration page
  resources :models, only: [:index] do
    collection do
      patch "configs/:id", to: "models#update_config", as: :config
      patch "preferences/:id", to: "models#update_preference", as: :preference
    end
  end

  resource :theme_playground, only: [:show]

  if defined?(Sidekiq)
    require "sidekiq/web"
    mount Sidekiq::Web => "/sidekiq"
  end
  mount Zhong::Web => "/zhong"
  mount MissionControl::Jobs::Engine, at: "/jobs" if defined?(::MissionControl::Jobs::Engine)
  mount Flipper::UI.app(Flipper) => "/flipper" if defined?(::Flipper::UI)

  resources :announcements
  namespace :active_storage do
    resources :attachments
    resources :blobs
    resources :variant_records
  end
  resources :users do
    resource :impersonate, module: :user
  end
  resources :connected_accounts
  resources :accounts
  resources :account_users
  resources :account_invitations
  resources :plans
  namespace :pay do
    resources :customers
    resources :charges
    resources :payment_methods
    resources :subscriptions
  end

  root to: "dashboard#show"
end
