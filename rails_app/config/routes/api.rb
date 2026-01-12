namespace :api, defaults: {format: :json} do
  namespace :v1 do
    # Public endpoint for lead capture from deployed landing pages
    resources :leads, only: [:create]

    # Endpoint for authenticated (via session) users to obtain a JWT
    post "jwt", to: "jwts#create"
    resource :auth
    resource :me, controller: :me
    resource :password
    resources :accounts
    resources :users
    resources :notification_tokens, param: :token, only: [:create, :destroy]
    resources :templates
    resources :themes, only: [:index, :show, :create]
    resources :brainstorms, param: :thread_id, only: [:show, :create, :update]
    resources :uploads, only: [:create, :index, :show, :destroy]

    resources :websites, only: [] do
      resource :context, only: [:show], controller: "context"
    end
    patch "projects/:project_uuid/workflows/:id", to: "project_workflows#update"
    patch "projects/:project_uuid/workflows/:id/next", to: "project_workflows#next"

    resources :campaigns, only: [:create, :update] do
      post :advance, on: :member
      post :back, on: :member
    end

    resources :geo_target_constants, only: [:index]
    resources :domains, only: [:index, :show, :create]
    resources :website_urls, only: [:index, :show, :create, :update]
    resources :job_runs, only: [:create]

    scope "projects/:project_uuid" do
      resource :website, only: [:show, :update]
      resources :social_links, only: [:index, :show, :create, :update, :destroy] do
        collection do
          post :bulk_upsert
        end
      end
    end

    resources :websites, only: [] do
      post "files/write", to: "website_files#write"
      patch "files/edit", to: "website_files#edit"
    end
  end
end

resources :api_tokens
