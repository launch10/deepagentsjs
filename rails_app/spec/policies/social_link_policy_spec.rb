require 'rails_helper'

RSpec.describe SocialLinkPolicy do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:account_user) { account.account_users.find_by(user: user) }
  let(:project) { create(:project, account: account) }
  let(:social_link) { create(:social_link, :twitter, project: project) }

  let(:other_user) { create(:user) }
  let(:other_account) { other_user.owned_account }
  let(:other_project) { create(:project, account: other_account) }
  let(:other_social_link) { create(:social_link, :instagram, project: other_project) }

  subject { described_class }

  describe 'project_member?' do
    context 'when user belongs to the account that owns the project' do
      it 'allows index' do
        expect(subject.new(account_user, social_link).index?).to be true
      end

      it 'allows show' do
        expect(subject.new(account_user, social_link).show?).to be true
      end

      it 'allows create' do
        expect(subject.new(account_user, social_link).create?).to be true
      end

      it 'allows update' do
        expect(subject.new(account_user, social_link).update?).to be true
      end

      it 'allows destroy' do
        expect(subject.new(account_user, social_link).destroy?).to be true
      end

      it 'allows bulk_upsert' do
        expect(subject.new(account_user, social_link).bulk_upsert?).to be true
      end
    end

    context 'when user does not belong to the account that owns the project' do
      it 'denies index' do
        expect(subject.new(account_user, other_social_link).index?).to be false
      end

      it 'denies show' do
        expect(subject.new(account_user, other_social_link).show?).to be false
      end

      it 'denies create' do
        expect(subject.new(account_user, other_social_link).create?).to be false
      end

      it 'denies update' do
        expect(subject.new(account_user, other_social_link).update?).to be false
      end

      it 'denies destroy' do
        expect(subject.new(account_user, other_social_link).destroy?).to be false
      end

      it 'denies bulk_upsert' do
        expect(subject.new(account_user, other_social_link).bulk_upsert?).to be false
      end
    end
  end
end
