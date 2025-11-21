FactoryBot.define do
  factory :project_workflow do
    association :project
    workflow_type { 'launch' }
    status { 'active' }
    step { nil }
    substep { nil }
  end
end
