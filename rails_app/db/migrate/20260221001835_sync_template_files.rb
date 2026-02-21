class SyncTemplateFiles < ActiveRecord::Migration[8.0]
  def up
    TemplateSyncer.sync_all!
  end

  def down
    # no-op: template files are upserted, no rollback needed
  end
end
