namespace :test do
  namespace :tracking do
    desc "Build the tracking-test website for E2E tests"
    task build: :environment do
      require Rails.root.join("spec/support/analytics/tracking_test_builder")
      TrackingTestBuilder.build!
    end

    desc "Clean the tracking-test build artifacts"
    task clean: :environment do
      require Rails.root.join("spec/support/analytics/tracking_test_builder")
      TrackingTestBuilder.clean!
    end
  end
end
