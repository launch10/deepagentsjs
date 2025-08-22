namespace :atlas do
  desc "Sync all models to Atlas"
  task sync: :environment do
    [
      User,
      Domain,
      Plan,
      Website
    ].each do |model|
      model.all.each do |record|
        record.sync_to_atlas
      end
    end
  end
end