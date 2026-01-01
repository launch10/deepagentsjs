class SocialLinkPolicy < ApplicationPolicy
  def index?
    project_member?
  end

  def show?
    project_member?
  end

  def create?
    project_member?
  end

  def update?
    project_member?
  end

  def destroy?
    project_member?
  end

  def bulk_upsert?
    project_member?
  end

  private

  def project_member?
    record.project.account_id == account_user.account_id
  end
end
