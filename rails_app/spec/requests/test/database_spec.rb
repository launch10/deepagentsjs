require 'swagger_helper'

RSpec.describe "Test Database API", type: :request do
  before do
    allow(Rails.env).to receive(:local?).and_return(true)
  end

  after(:all) do
    Database::Snapshotter.delete_test_snapshots
  end

  path '/test/database/truncate' do
    post 'Truncates the database' do
      tags 'Test Database'
      produces 'application/json'
      description 'Truncates all tables in the database. Only available in development/test environments.'

      response '200', 'database truncated successfully' do
        schema APISchemas::Database.operation_response

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('ok')
          expect(data['message']).to eq('Database truncated')
        end
      end

      response '500', 'internal server error' do
        schema APISchemas::Database.error_response

        before do
          # Mock instance method since controller calls Database::Snapshotter.new.truncate
          allow_any_instance_of(Database::Snapshotter).to receive(:truncate).and_raise(StandardError.new("Something went wrong"))
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('error')
          expect(data['errors'].first).to include('Failed to truncate database')
        end
      end
    end
  end

  path '/test/database/snapshots' do
    get 'Lists available database snapshots' do
      tags 'Test Database'
      produces 'application/json'
      description 'Returns a list of all available database snapshot names. Only available in development/test environments.'

      response '200', 'snapshots listed successfully' do
        schema APISchemas::Database.snapshots_response

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to have_key('snapshots')
          expect(data['snapshots']).to be_an(Array)
        end
      end
    end

    post 'Creates a database snapshot' do
      tags 'Test Database'
      consumes 'application/json'
      produces 'application/json'
      description 'Creates a new database snapshot with the specified name. Only available in development/test environments.'

      parameter name: :snapshot_params, in: :body, schema: APISchemas::Database.snapshot_params

      response '201', 'snapshot created successfully' do
        schema APISchemas::Database.operation_response

        let(:snapshot_params) do
          {
            snapshot: {
              name: "test_snapshot_#{Time.now.to_i}"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('ok')
          expect(data['message']).to include('created')
        end
      end

      response '422', 'missing required parameters' do
        schema APISchemas::Database.error_response

        let(:snapshot_params) { {} }

        run_test! do |response|
          expect(response.status).to be >= 400
        end
      end
    end
  end

  path '/test/database/restore_snapshot' do
    post 'Restores a database snapshot' do
      tags 'Test Database'
      consumes 'application/json'
      produces 'application/json'
      description 'Restores the database from a snapshot. Optionally truncates the database before restoring. Only available in development/test environments.'

      parameter name: :snapshot_params, in: :body, schema: APISchemas::Database.snapshot_params

      response '200', 'snapshot restored successfully' do
        schema APISchemas::Database.operation_response

        let(:snapshot_name) { "restore_test_#{Time.now.to_i}" }
        let(:snapshot_params) do
          {
            snapshot: {
              name: snapshot_name,
              truncate_first: false
            }
          }
        end

        before do
          Database::Snapshotter.create_snapshot(snapshot_name)
        end

        after do
          snapshot_file = Database::Snapshotter.snapshot_path(snapshot_name)
          snapshot_file.delete if snapshot_file.exist?
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('ok')
          expect(data['message']).to include('restored')
        end
      end

      response '422', 'snapshot restore failed - snapshot not found' do
        schema APISchemas::Database.error_response

        let(:snapshot_params) do
          {
            snapshot: {
              name: "nonexistent_snapshot_#{SecureRandom.hex(8)}"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('error')
          expect(data['errors'].first).to include('Failed to restore snapshot')
        end
      end

      response '422', 'missing required parameters' do
        schema APISchemas::Database.error_response

        let(:snapshot_params) { {} }

        run_test! do |response|
          expect(response.status).to be >= 400
        end
      end
    end
  end

  path '/test/database/set_credits' do
    post 'Sets credits for an account' do
      tags 'Test Database'
      consumes 'application/json'
      produces 'application/json'
      description 'Sets plan and pack millicredits for a user account. Only available in development/test environments.'

      parameter name: :credits_params, in: :body, schema: APISchemas::Database.credits_params

      response '200', 'credits set successfully' do
        schema APISchemas::Database.credits_response

        let!(:user) { create(:user) }
        let(:credits_params) do
          {
            credits: {
              email: user.email,
              plan_millicredits: 1000,
              pack_millicredits: 500
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('ok')
          expect(data['account']['plan_millicredits']).to eq(1000)
          expect(data['account']['pack_millicredits']).to eq(500)
        end
      end

      response '404', 'user not found' do
        schema APISchemas::Database.error_response

        let(:credits_params) do
          {
            credits: {
              email: 'nonexistent@example.com',
              plan_millicredits: 1000
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('error')
          expect(data['errors'].first).to include('User not found')
        end
      end

      response '422', 'missing required parameters' do
        schema APISchemas::Database.error_response

        let(:credits_params) { {} }

        run_test! do |response|
          expect(response.status).to be >= 400
        end
      end
    end
  end
end
