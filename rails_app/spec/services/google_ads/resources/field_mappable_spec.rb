require "rails_helper"

RSpec.describe GoogleAds::Resources::FieldMappable do
  # Define test class outside of let block so field_mapping DSL works
  before(:all) do
    # Create test class in GoogleAds::Resources namespace
    test_klass = Class.new do
      include GoogleAds::Resources::FieldMappable

      attr_reader :record

      def initialize(record)
        @record = record
      end

      # Simple field mapping
      field_mapping :name,
        local: :name,
        remote: :name

      # Field with transform
      field_mapping :status,
        local: :google_status,
        remote: :status,
        transform: GoogleAds::Resources::Transforms::UPCASE_SYMBOL,
        reverse_transform: GoogleAds::Resources::Transforms::DOWNCASE_STRING

      # Field with lambda extractors
      field_mapping :budget_micros,
        local: ->(r) { r.daily_budget_cents },
        remote: ->(r) { r.amount_micros },
        transform: GoogleAds::Resources::Transforms::CENTS_TO_MICROS,
        reverse_transform: GoogleAds::Resources::Transforms::MICROS_TO_CENTS

      # Immutable field
      field_mapping :type,
        local: :google_type,
        remote: :type,
        transform: GoogleAds::Resources::Transforms::UPCASE_SYMBOL,
        immutable: true

      def fetch
        nil
      end
    end

    # Store for use in specs
    GoogleAds::Resources.const_set(:TestFieldMappableResource, test_klass)
  end

  after(:all) do
    GoogleAds::Resources.send(:remove_const, :TestFieldMappableResource)
  end

  let(:test_class) { GoogleAds::Resources::TestFieldMappableResource }

  let(:record) do
    double(
      "Record",
      name: "Test Campaign",
      google_status: "enabled",
      daily_budget_cents: 1000,
      google_type: "search"
    )
  end

  let(:remote) do
    double(
      "Remote",
      name: "Test Campaign",
      status: :ENABLED,
      amount_micros: 10_000_000,
      type: :SEARCH
    )
  end

  let(:resource) { test_class.new(record) }

  describe ".field_mapping" do
    it "registers field mappings" do
      expect(test_class.field_mappings).to include(:name, :status, :budget_micros, :type)
    end

    it "stores all mapping options" do
      mapping = test_class.field_mappings[:status]
      expect(mapping[:local]).to eq(:google_status)
      expect(mapping[:remote]).to eq(:status)
      expect(mapping[:transform]).to be_a(Proc)
      expect(mapping[:reverse_transform]).to be_a(Proc)
      expect(mapping[:immutable]).to be false
    end
  end

  describe ".immutable_fields" do
    it "returns list of immutable fields" do
      expect(test_class.immutable_fields).to eq([:type])
    end
  end

  describe ".mutable_fields" do
    it "returns list of mutable fields" do
      expect(test_class.mutable_fields).to eq([:name, :status, :budget_micros])
    end
  end

  describe "#local_value" do
    it "extracts simple field with symbol" do
      expect(resource.local_value(:name)).to eq("Test Campaign")
    end

    it "applies transform when present" do
      expect(resource.local_value(:status)).to eq(:ENABLED)
    end

    it "extracts field with lambda extractor" do
      expect(resource.local_value(:budget_micros)).to eq(10_000_000)
    end

    it "raises ArgumentError for unknown field" do
      expect { resource.local_value(:unknown) }.to raise_error(ArgumentError, /Unknown field mapping/)
    end
  end

  describe "#remote_value" do
    it "extracts simple field with symbol" do
      expect(resource.remote_value(remote, :name)).to eq("Test Campaign")
    end

    it "returns raw value by default (no reverse_transform)" do
      expect(resource.remote_value(remote, :status)).to eq(:ENABLED)
    end

    it "applies reverse_transform when explicitly requested" do
      expect(resource.remote_value(remote, :status, apply_reverse_transform: true)).to eq("enabled")
    end

    it "extracts field with lambda extractor (raw)" do
      expect(resource.remote_value(remote, :budget_micros)).to eq(10_000_000)
    end

    it "extracts field with lambda extractor (normalized)" do
      expect(resource.remote_value(remote, :budget_micros, apply_reverse_transform: true)).to eq(1000)
    end

    it "handles missing method gracefully" do
      remote_without_name = double("Remote", status: :ENABLED)
      expect(resource.remote_value(remote_without_name, :name)).to be_nil
    end
  end

  describe "#to_google_json" do
    it "returns hash of local values with transforms applied" do
      result = resource.to_google_json

      expect(result).to eq(
        name: "Test Campaign",
        status: :ENABLED,
        budget_micros: 10_000_000,
        type: :SEARCH
      )
    end
  end

  describe "#from_google_json" do
    it "returns hash of remote values in local format (reverse_transforms applied)" do
      result = resource.from_google_json(remote)

      expect(result).to eq(
        name: "Test Campaign",
        status: "enabled",
        budget_micros: 1000,
        type: :SEARCH
      )
    end

    it "returns nil when remote is nil" do
      expect(resource.from_google_json(nil)).to be_nil
    end
  end

  describe "#compare_fields" do
    it "returns FieldCompare with all fields checked" do
      comparison = resource.compare_fields(remote)

      expect(comparison).to be_a(GoogleAds::FieldCompare)
      expect(comparison.to_h.keys).to include(:name, :status, :budget_micros, :type)
    end
    it "marks matching fields as matched" do
      comparison = resource.compare_fields(remote)

      expect(comparison.match?).to be true
      expect(comparison.failures).to be_empty
    end

    context "with mismatched fields" do
      let(:mismatched_remote) do
        double(
          "Remote",
          name: "Different Name",
          status: :PAUSED,
          amount_micros: 10_000_000,
          type: :SEARCH
        )
      end
      it "identifies failures" do
        comparison = resource.compare_fields(mismatched_remote)

        expect(comparison.match?).to be false
        expect(comparison.failures).to include(:name, :status)
      end
    end
  end

  describe "#fields_match?" do
    it "returns true when all fields match" do
      expect(resource.fields_match?(remote)).to be true
    end

    it "returns false when fields differ" do
      different_remote = double(
        "Remote",
        name: "Different",
        status: :PAUSED,
        amount_micros: 10_000_000,
        type: :SEARCH
      )

      expect(resource.fields_match?(different_remote)).to be false
    end
  end

  describe "#immutable_fields" do
    it "delegates to class method" do
      expect(resource.immutable_fields).to eq([:type])
    end
  end

  describe "#mutable_fields" do
    it "delegates to class method" do
      expect(resource.mutable_fields).to eq([:name, :status, :budget_micros])
    end
  end

  describe "transform types" do
    before(:all) do
      hash_klass = Class.new do
        include GoogleAds::Resources::FieldMappable

        attr_reader :record

        def initialize(record)
          @record = record
        end

        field_mapping :day,
          local: :day_of_week,
          remote: :day,
          transform: { "Monday" => :MONDAY, "Tuesday" => :TUESDAY },
          reverse_transform: { MONDAY: "Monday", TUESDAY: "Tuesday" }

        def fetch
          nil
        end
      end

      GoogleAds::Resources.const_set(:TestHashTransformResource, hash_klass)
    end

    after(:all) do
      GoogleAds::Resources.send(:remove_const, :TestHashTransformResource)
    end

    let(:hash_transform_class) { GoogleAds::Resources::TestHashTransformResource }

    it "supports hash transforms" do
      rec = double("Record", day_of_week: "Monday")
      resource = hash_transform_class.new(rec)

      expect(resource.local_value(:day)).to eq(:MONDAY)
    end

    it "supports hash reverse_transforms" do
      rec = double("Record", day_of_week: "Monday")
      remote = double("Remote", day: :TUESDAY)
      resource = hash_transform_class.new(rec)

      expect(resource.remote_value(remote, :day, apply_reverse_transform: true)).to eq("Tuesday")
    end
  end

  describe "nil handling" do
    it "does not apply transform to nil values" do
      rec = double("Record", name: nil, google_status: nil, daily_budget_cents: nil, google_type: nil)
      resource = test_class.new(rec)

      expect(resource.local_value(:name)).to be_nil
      expect(resource.local_value(:status)).to be_nil
    end
  end
end
