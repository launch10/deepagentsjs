class JobErrorConfig
  CONFIG_PATH = Rails.root.join("../shared/exports/jobErrors.json").freeze

  class << self
    def recoverable?(job_name, error_type)
      overrides = config.dig("overrides", job_name)
      return overrides[error_type] if overrides&.key?(error_type)

      default = config.dig("defaults", error_type)
      default.nil? ? false : default
    end

    def error_types
      config["errorTypes"]
    end

    def job_names
      config["jobNames"]
    end

    private

    def config
      @config ||= load_config!
    end

    def load_config!
      unless File.exist?(CONFIG_PATH)
        raise "jobErrors.json not found at #{CONFIG_PATH}. Run `cd shared && pnpm run config:export`."
      end

      parsed = JSON.parse(File.read(CONFIG_PATH))

      unless parsed.key?("defaults") && parsed.key?("errorTypes") && parsed.key?("jobNames")
        raise "jobErrors.json is malformed — missing required keys (defaults, errorTypes, jobNames)."
      end

      parsed
    end
  end
end
