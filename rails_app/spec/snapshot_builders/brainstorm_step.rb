class BrainstormStep < BaseBuilder
  def base_snapshot
    "basic_account"
  end

  def output_name
    "brainstorm_step"
  end

  def build
    account = Account.first
    unless account
      user = create(:user, name: "Test User")
      account = user.owned_account
    end

    Brainstorm.create_brainstorm!(account, name: "Test Project", thread_id: SecureRandom.uuid)
  end
end