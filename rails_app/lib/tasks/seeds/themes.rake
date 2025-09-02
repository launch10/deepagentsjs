namespace :seeds do
  desc "Load template seeds"
  task themes: :environment do
    Rake::Task["db:import_sql_file"].invoke(Rails.root.join("db/seeds/themes.sql").to_s)
  end
end