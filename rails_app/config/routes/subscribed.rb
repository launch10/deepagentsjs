authenticated :user do
  root to: "projects#new", as: :onboarding

  resources :projects, only: [:show], param: :uuid do
    resources :workflows, only: [:show]

    member do
      get :brainstorm
      get :website

      scope :campaigns do
        WorkflowConfig.substeps_for("launch", "ad_campaign").each do |substep|
          get substep, to: "projects#campaigns_#{substep}", as: "campaigns_#{substep}"
        end
      end

      scope :launch do
        WorkflowConfig.substeps_for("launch", "launch").each do |substep|
          get substep, to: "projects#launch_#{substep}", as: "launch_#{substep}"
        end
      end
    end
  end
end
