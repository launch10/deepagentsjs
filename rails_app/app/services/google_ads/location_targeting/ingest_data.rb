require "zip"

# Every 90 days or so, Google Ads releases a new set of location targeting data
# As a CSV. As long as we ingest it to our database, we can use it to power
# our location targeting features.
module GoogleAds
  module LocationTargeting
    class IngestData
      LOOKBACK_DAYS = 90

      class << self
        def call
          new.call
        end
      end

      def call
        csv_content = download_latest_csv
        return { success: false, error: "No CSV found in lookback period" } unless csv_content

        upsert_records(csv_content)
      end

      private

      def client
        @client ||= GoogleAdsDataClient.new
      end

      def download_latest_csv
        zip_content = client.find_latest_geo_targets_zip(lookback_days: LOOKBACK_DAYS)
        return nil unless zip_content

        extract_csv_from_zip_content(zip_content)
      end

      def extract_csv_from_zip_content(zip_content)
        Dir.mktmpdir do |tmpdir|
          zip_path = File.join(tmpdir, "geotargets.zip")
          File.binwrite(zip_path, zip_content)

          ::Zip::File.open(zip_path) do |zip_file|
            csv_entry = zip_file.glob("**/*.csv").first
            return nil unless csv_entry

            csv_entry.get_input_stream.read
          end
        end
      end

      def upsert_records(csv_content)
        rows = parse_csv(csv_content)
        Rails.logger.info "[GoogleAds::LocationTargeting::IngestData] Parsed #{rows.size} rows"

        batches = rows.each_slice(1000).to_a
        total_upserted = 0

        batches.each_with_index do |batch, index|
          records = batch.map { |row| build_record(row) }
          result = GeoTargetConstant.upsert_all(
            records,
            unique_by: :criteria_id,
            update_only: %i[name canonical_name parent_id country_code target_type status]
          )
          total_upserted += result.length
          Rails.logger.info "[GoogleAds::LocationTargeting::IngestData] Upserted batch #{index + 1}/#{batches.size}"
        end

        { success: true, upserted: total_upserted }
      end

      def parse_csv(content)
        CSV.parse(content, headers: true, liberal_parsing: true).map(&:to_h)
      end

      def build_record(row)
        {
          criteria_id: row["Criteria ID"].to_i,
          name: row["Name"],
          canonical_name: row["Canonical Name"],
          parent_id: row["Parent ID"].presence&.to_i,
          country_code: row["Country Code"].presence,
          target_type: row["Target Type"],
          status: row["Status"],
          created_at: Time.current,
          updated_at: Time.current
        }
      end
    end
  end
end
