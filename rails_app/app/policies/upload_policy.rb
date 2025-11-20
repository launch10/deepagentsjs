class UploadPolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(account_id: account_user.account_id)
    end
  end

  def show?
    record.account_id == account_user.account_id
  end

  def update?
    record.account_id == account_user.account_id
  end

  def destroy?
    record.account_id == account_user.account_id
  end
end
