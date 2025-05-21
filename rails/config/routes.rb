Rails.application.routes.draw do
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
    root to: "projects#index", as: :root
  end
  get "up" => "rails/health#show", :as => :rails_health_check
  root to: "static#index"

  resources :projects, controller: :projects
end
