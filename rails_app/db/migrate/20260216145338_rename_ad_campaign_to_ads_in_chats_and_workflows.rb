class RenameAdCampaignToAdsInChatsAndWorkflows < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute <<~SQL
        UPDATE chats SET chat_type = 'ads' WHERE chat_type = 'ad_campaign';
      SQL

      execute <<~SQL
        UPDATE project_workflows SET step = 'ads' WHERE step = 'ad_campaign';
      SQL
    end
  end

  def down
    safety_assured do
      execute <<~SQL
        UPDATE chats SET chat_type = 'ad_campaign' WHERE chat_type = 'ads';
      SQL

      execute <<~SQL
        UPDATE project_workflows SET step = 'ad_campaign' WHERE step = 'ads';
      SQL
    end
  end
end
