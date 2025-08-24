require 'sidekiq/web'
require "zhong/web"

Rails.application.routes.draw do
  ADMIN_ONLY ||= lambda do |request|
    request.env["warden"].authenticate!(scope: :user)
    request.env["warden"].user(:user).admin?
  end

  constraints ADMIN_ONLY do
    mount Sidekiq::Web => "/sidekiq"
    mount Zhong::Web => "/zhong"
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
  resources :websites, only: [:create]
end
