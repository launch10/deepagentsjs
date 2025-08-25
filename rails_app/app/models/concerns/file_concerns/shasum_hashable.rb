module FileConcerns
  module ShasumHashable
    extend ActiveSupport::Concern

    included do
      before_save :update_shasum
    end

    def generate_shasum
      Digest::SHA256.hexdigest("#{path}#{content}")
    end

    def ==(other)
      if self.respond_to?(:generate_shasum) && other.respond_to?(:generate_shasum)
        self.generate_shasum == other.generate_shasum
      else
        super(other)
      end
    end

    private

    def update_shasum
      self.shasum = generate_shasum if path_changed? || content_changed? || shasum.nil?
    end
  end
end
