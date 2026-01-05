module PlatformSettings
  extend ActiveSupport::Concern

  included do
    class_attribute :_platform_settings_validations, default: []

    validate :validate_platform_settings

    after_initialize :ensure_platform_settings_initialized
  end

  def ensure_platform_settings_initialized
    self.platform_settings ||= { "meta" => {}, "google" => {} }
  end

  class_methods do
    def platform_setting(platform, attribute, options = {})
      getter_name = "#{platform}_#{attribute}"
      setter_name = "#{platform}_#{attribute}="

      define_method(getter_name) do
        value = platform_settings.dig(platform.to_s, attribute.to_s)
        if value.nil? && options.key?(:default)
          default_value = options[:default].respond_to?(:call) ? instance_exec(&options[:default]) : options[:default]
          send(setter_name, default_value)
          save! if persisted?
          default_value
        else
          value
        end
      end

      define_method(setter_name) do |value|
        # Immediate validation if :in option is specified
        if options[:in] && value.present?
          allowed = options[:in].map(&:to_s)
          if options[:array]
            invalid = Array(value).map(&:to_s) - allowed
            if invalid.any?
              raise ArgumentError, "Invalid #{attribute}: #{invalid.join(', ')}. Allowed values: #{allowed.join(', ')}"
            end
          elsif !allowed.include?(value.to_s)
            raise ArgumentError, "Invalid #{attribute}: #{value}. Allowed values: #{allowed.join(', ')}"
          end
        end

        platform_settings[platform.to_s] ||= {}
        platform_settings[platform.to_s][attribute.to_s] = value
      end

      attribute_name = "#{platform}_#{attribute}"
      self._platform_settings_attributes ||= []
      self._platform_settings_attributes << attribute_name

      if options[:in]
        self._platform_settings_validations = _platform_settings_validations + [{
          attribute: getter_name,
          in: options[:in],
          array: options[:array]
        }]
      end
    end

    def _platform_settings_attributes
      @_platform_settings_attributes ||= []
    end

    def _platform_settings_attributes=(value)
      @_platform_settings_attributes = value
    end
  end

  def assign_attributes(new_attributes)
    platform_attrs, regular_attrs = new_attributes.to_h.stringify_keys.partition do |key, _|
      self.class._platform_settings_attributes.include?(key.to_s.delete_suffix("="))
    end

    platform_attrs.each do |key, value|
      send("#{key.to_s.delete_suffix("=")}=", value)
    end

    super(regular_attrs.to_h)
  end

  private

  def validate_platform_settings
    self.class._platform_settings_validations.each do |validation|
      value = send(validation[:attribute])
      next if value.blank?

      allowed = validation[:in].map(&:to_s)

      if validation[:array]
        invalid = Array(value).map(&:to_s) - allowed
        if invalid.any?
          errors.add(validation[:attribute], "contains invalid values: #{invalid.join(", ")}")
        end
      elsif !allowed.include?(value.to_s)
        errors.add(validation[:attribute], "is not a valid option")
      end
    end
  end
end
