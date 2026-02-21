module Langgraph
  class ReadonlyRecord < ApplicationRecord
    self.abstract_class = true
    self.record_timestamps = false
    self.inheritance_column = nil

    def readonly?
      true
    end
  end
end
