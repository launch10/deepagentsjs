require "rails_helper"

RSpec.describe Langgraph::BlobDecodable do
  describe ".decode_blob" do
    subject { Langgraph::CheckpointBlob }

    it "decodes JSON blobs" do
      result = subject.decode_blob("json", '{"key": "value"}'.encode("UTF-8"))
      expect(result).to eq("key" => "value")
    end

    it "returns raw bytes for bytes type" do
      data = "\x00\x01\x02".b
      expect(subject.decode_blob("bytes", data)).to eq(data)
    end

    it "returns nil for empty type" do
      expect(subject.decode_blob("empty", nil)).to be_nil
    end

    it "returns nil for nil type" do
      expect(subject.decode_blob(nil, nil)).to be_nil
    end

    it "returns nil on invalid JSON" do
      expect(subject.decode_blob("json", "not json{")).to be_nil
    end

    it "returns nil for json type with nil blob" do
      expect(subject.decode_blob("json", nil)).to be_nil
    end
  end
end
