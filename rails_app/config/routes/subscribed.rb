authenticated :user do
  root to: "projects#new", as: :onboarding

  resource :settings, only: [:show, :update] do
    patch :update_password, on: :member
  end

  get "dashboard", to: "dashboard#show"

  resources :projects, only: [:new, :show], param: :uuid do
    resources :workflows, only: [:show]

    member do
      get :brainstorm
      get :website
      get :performance

      scope :campaigns do
        WorkflowConfig.substeps_for("launch", "ad_campaign").each do |substep|
          get substep, to: "projects#campaigns_#{substep}", as: "campaigns_#{substep}"
        end
      end

      get :deploy
    end

    resources :leads, only: [:index], controller: "leads" do
      collection do
        get :export
      end
    end
  end
end
