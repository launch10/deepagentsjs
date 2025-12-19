namespace :api, defaults: {format: :json} do
  namespace :v1 do
    # Endpoint for authenticated (via session) users to obtain a JWT
    post "jwt", to: "jwts#create"
    resource :auth
    resource :me, controller: :me
    resource :password
    resources :accounts
    resources :users
    resources :notification_tokens, param: :token, only: [:create, :destroy]
    resources :templates
    resources :themes, only: [:index, :create]
    resources :brainstorms, param: :thread_id, only: [:show, :create, :update]
    resources :uploads, only: [:create, :index, :show]
    patch "projects/:project_uuid/workflows/:id", to: "project_workflows#update"
    patch "projects/:project_uuid/workflows/:id/next", to: "project_workflows#next"

    resources :campaigns, only: [:create, :update] do
      post :advance, on: :member
      post :back, on: :member
    end

    resources :geo_target_constants, only: [:index]
    resources :domains, only: [:index, :show, :create]
    resources :website_urls, only: [:index, :show, :create, :update]
  end
end

resources :api_tokens
