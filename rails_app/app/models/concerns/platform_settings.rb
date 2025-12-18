module PlatformSettings
  extend ActiveSupport::Concern

  class_methods do
    def platform_setting(platform, attribute, options = {})
      getter_name = "#{platform}_#{attribute}"
      setter_name = "#{platform}_#{attribute}="

      define_method(getter_name) do
        value = platform_settings.dig(platform.to_s, attribute.to_s)
        if value.nil? && options[:default]
          default_value = options[:default].respond_to?(:call) ? instance_exec(&options[:default]) : options[:default]
          send(setter_name, default_value)
          save! if persisted?
          default_value
        else
          value
        end
      end

      define_method(setter_name) do |value|
        if options[:in] && value.present?
          allowed = options[:in].map(&:to_s)

          if options[:array]
            invalid = Array(value).map(&:to_s) - allowed
            if invalid.any?
              raise ArgumentError, "Invalid #{attribute}: #{invalid.join(", ")}. Valid options: #{options[:in].join(", ")}"
            end
          elsif !allowed.include?(value.to_s)
            raise ArgumentError, "Invalid #{attribute}: #{value}. Valid options: #{options[:in].join(", ")}"
          end
        end

        platform_settings[platform.to_s] ||= {}
        platform_settings[platform.to_s][attribute.to_s] = value
      end

      attribute_name = "#{platform}_#{attribute}"
      self._platform_settings_attributes ||= []
      self._platform_settings_attributes << attribute_name
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
end
