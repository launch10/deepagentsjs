
authenticated :user do
  root to: "projects#new", as: :onboarding
  resources :projects, only: [:show], param: :uuid do
    resources :workflows, only: [:show]
  end
end