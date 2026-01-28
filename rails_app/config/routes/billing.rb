namespace :checkout do
  resource :return, only: [:show]
end

resources :credit_packs, only: [] do
  member do
    get :checkout, to: "credit_pack_checkouts#show"
    post :checkout, to: "credit_pack_checkouts#create"
  end
end
get "credit_packs/complete", to: "credit_pack_checkouts#complete", as: :complete_credit_pack_checkouts

namespace :subscriptions do
  resource :paddle_billing, controller: :paddle_billing, only: [:show, :edit]
  resource :paddle_classic, controller: :paddle_classic, only: [:show]
end
resources :subscriptions do
  collection do
    patch :billing_settings
  end
  resource :payment_method, module: :subscriptions
  resource :cancel, module: :subscriptions
  resource :pause, module: :subscriptions
  resource :resume, module: :subscriptions
  resource :upcoming, module: :subscriptions
end
resources :charges do
  member do
    get :invoice
  end
end
