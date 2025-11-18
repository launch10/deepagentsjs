namespace :seeds do
  desc "Load template seeds"
  task core_data: :environment do
    Rake::Task["db:import_sql_file"].invoke(Rails.root.join("db/seeds/core_data.sql").to_s)
  end
end
