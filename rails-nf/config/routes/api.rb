namespace :api, defaults: {format: :json} do
  namespace :v1 do
    # Endpoint for authenticated (via session) users to obtain a JWT
    post 'jwt', to: 'jwts#create'
    resource :auth
    resource :me, controller: :me
    resource :password
    resources :accounts
    resources :users
    resources :notification_tokens, param: :token, only: [:create, :destroy]
  end
end

resources :api_tokens
