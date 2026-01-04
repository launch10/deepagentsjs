module GoogleAds
  class FieldCompare
    attr_reader :failures

    def initialize
      @failures = []
      @comparisons = {}
    end

    def self.build
      compare = new
      yield compare
      compare
    end

    def check(field, local: nil, remote: nil, &block)
      matched = block.call
      @failures << field unless matched
      @comparisons[field] = { local: local, remote: remote, match: matched }
      self
    end

    def match?
      @failures.empty?
    end

    def to_h
      @comparisons
    end

    def self.float_match?(local, remote, tolerance: 0.001)
      l = local || 0.0
      r = remote || 0.0
      (l - r).abs < tolerance
    end
  end
end
