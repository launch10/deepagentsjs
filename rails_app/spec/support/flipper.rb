MockFlipper = Struct.new(:enabled) do
  def enabled?(*args)
    enabled
  end

  def disabled?
    !enabled
  end
end