module GoogleAds
  class FieldCompare
    attr_reader :failures, :skipped

    def initialize
      @failures = []
      @skipped = []
      @comparisons = {}
    end

    def self.build
      compare = new
      yield compare
      compare
    end

    def check(field, local: nil, remote: nil, &block)
      return self if @skipped.include?(field)

      matched = block.call
      @failures << field unless matched
      @comparisons[field] = { local: local, remote: remote, match: matched }
      self
    end

    # Skip a field from comparison
    def skip(field)
      @skipped << field
      @comparisons.delete(field)
      @failures.delete(field)
      self
    end

    # Skip multiple fields
    def skip_all(*fields)
      fields.each { |f| skip(f) }
      self
    end

    def match?
      @failures.empty?
    end

    def to_h
      @comparisons
    end

    # Get local values as hash
    def local_values
      @comparisons.transform_values { |v| v[:local] }
    end

    # Get remote values as hash
    def remote_values
      @comparisons.transform_values { |v| v[:remote] }
    end

    # Summary for debugging
    def summary
      {
        match: match?,
        failures: @failures,
        skipped: @skipped,
        local: local_values,
        remote: remote_values,
        comparisons: @comparisons
      }
    end

    # Pretty print for console debugging
    def inspect_diff
      lines = ["FieldCompare (#{match? ? "MATCH" : "MISMATCH"})"]

      if @skipped.any?
        lines << "  Skipped: #{@skipped.join(", ")}"
      end

      @comparisons.each do |field, data|
        status = data[:match] ? "✓" : "✗"
        lines << "  #{status} #{field}:"
        lines << "      local:  #{data[:local].inspect}"
        lines << "      remote: #{data[:remote].inspect}"
      end

      lines.join("\n")
    end

    # Float comparison with tolerance
    def self.float_match?(local, remote, tolerance: 0.001)
      l = local || 0.0
      r = remote || 0.0
      (l - r).abs < tolerance
    end

    # Integer comparison with tolerance (for cents/micros)
    def self.int_match?(local, remote, tolerance: 100)
      l = local || 0
      r = remote || 0
      (l - r).abs <= tolerance
    end
  end
end
