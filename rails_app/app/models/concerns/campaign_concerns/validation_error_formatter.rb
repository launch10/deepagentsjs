module CampaignConcerns
  class ValidationErrorFormatter
    def initialize(validation_context)
      @validation_context = validation_context
    end

    def format_errors
      errors = {}
      
      @validation_context.each do |context|
        object = context[:object]
        path = context[:path]
        
        next if object.valid?
        
        object.errors.each do |error|
          key = "#{path}.#{error.attribute}"
          errors[key] ||= []
          errors[key] << error.message
        end
      end
      
      errors
    end
  end
end
