# frozen_string_literal: true

require 'json-schema'

module InertiaPropsHelper
  def validate_inertia_props_against_schema(schema)
    props = inertia.props.deep_stringify_keys
    json_schema = convert_to_json_schema(schema)

    errors = JSON::Validator.fully_validate(json_schema, props)

    if errors.any?
      raise RSpec::Expectations::ExpectationNotMetError,
        "Inertia props do not match schema:\n#{errors.join("\n")}\n\nActual props:\n#{JSON.pretty_generate(props)}"
    end

    true
  end

  def expect_inertia_props_to_match_schema(schema)
    expect(validate_inertia_props_against_schema(schema)).to be true
  end

  private

  def convert_to_json_schema(schema)
    result = deep_convert(schema)
    result['$schema'] = 'http://json-schema.org/draft-04/schema#'
    result
  end

  def deep_convert(obj)
    case obj
    when Hash
      nullable = obj[:nullable] == true || obj['nullable'] == true
      result = {}

      obj.each do |key, value|
        str_key = key.to_s
        next if str_key == 'nullable'

        if str_key == 'type'
          converted_type = deep_convert(value)
          result['type'] = nullable ? [converted_type, 'null'] : converted_type
        else
          result[str_key] = deep_convert(value)
        end
      end

      result
    when Symbol
      obj.to_s
    when Array
      obj.map { |v| deep_convert(v) }
    else
      obj
    end
  end
end

RSpec.configure do |config|
  config.include InertiaPropsHelper, type: :request, inertia: true
end
