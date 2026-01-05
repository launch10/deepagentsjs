module GoogleAds
  # Error raised when sync verification fails (remote doesn't match expected state)
  class SyncVerificationError < StandardError
    attr_reader :comparison

    def initialize(message, comparison: nil)
      @comparison = comparison
      super(message)
    end
  end
end
