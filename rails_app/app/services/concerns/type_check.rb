module TypeCheck
  def expect_type(value, type, allow_nil: false)
    return value if allow_nil && value.nil?
    raise ArgumentError, "#{value} must be a #{type.name}" unless value.is_a?(type)
    value
  end
end
