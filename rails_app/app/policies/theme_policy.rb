class ThemePolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.official.or(scope.community.author(account_user.account_id))
    end
  end

  def show?
    record.official? || record.account_id == account_user.account_id
  end

  def update?
    record.account_id == account_user.account_id
  end

  def destroy?
    record.account_id == account_user.account_id
  end
end
