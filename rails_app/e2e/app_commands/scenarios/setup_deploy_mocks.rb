# Sets up E2E deploy mocks so website deploys don't hit Cloudflare R2.
#
# Usage: await appScenario('setup_deploy_mocks')
#
# This configures an in-memory S3 client that replaces the real
# Aws::S3::Client inside Cloudflare::R2. All R2 operations (put, list,
# copy, delete) succeed in-memory.

require_relative "#{Rails.root}/lib/testing/e2e_s3_client"

Cloudflare.e2e_mock_s3_client = Testing::E2eS3Client.new

{ status: "ok" }
