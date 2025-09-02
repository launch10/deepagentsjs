namespace :seeds do
  desc "Load template seeds"
  task icons: :environment do
    Rake::Task["db:import_sql_file"].invoke(Rails.root.join("db/seeds/icon_embeddings.sql").to_s)
  end
end