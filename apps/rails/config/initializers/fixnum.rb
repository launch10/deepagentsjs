# Fixnum is deprecated in Ruby 2.4 and removed in Ruby 3.0, but AnnotateModels still uses it.
if defined?(AnnotateModels)
  module AnnotateModels
    Fixnum = Integer unless defined?(Fixnum)
    Bignum = Integer unless defined?(Bignum)
  end
end