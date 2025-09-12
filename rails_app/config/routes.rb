require 'sidekiq/web'
require "zhong/web"

ADMIN_ONLY ||= lambda do |request|
  request.env["warden"].authenticate!(scope: :user)
  request.env["warden"].user(:user).admin?
end

TEST_ENV_ONLY ||= lambda do |request|
  Rails.env.test?
end

Rails.application.routes.draw do
  constraints ADMIN_ONLY do
    mount Sidekiq::Web => "/sidekiq"
    mount Zhong::Web => "/zhong"
  end

  constraints TEST_ENV_ONLY do
    namespace :test do
      post "database/truncate", to: "database#truncate"
      post "database/snapshots", to: "database#create_snapshot"
      post "database/restore_snapshot", to: "database#restore_snapshot"
    end
  end

  draw :accounts
  draw :api
  draw :billing
  draw :hotwire_native
  draw :users
  draw :dev if Rails.env.local?

  authenticated :user, lambda { |u| u.admin? } do
    draw :madmin
  end

  resources :announcements, only: [:index, :show]

  namespace :action_text do
    resources :embeds, only: [:create], constraints: {id: /[^\/]+/} do
      collection do
        get :patterns
      end
    end
  end

  scope controller: :static do
    get :about
    get :terms
    get :privacy
    get :pricing
    get :reset_app
  end

  match "/404", via: :all, to: "errors#not_found"
  match "/500", via: :all, to: "errors#internal_server_error"

  authenticated :user do
    root to: "projects#index", as: :user_home
  end
  get "up" => "rails/health#show", :as => :rails_health_check
  root to: "static#index"

  resources :templates
  resources :projects, controller: :projects, param: :thread_id do 
    get :files, on: :member
  end
  resources :websites, only: [:create, :update]

end
