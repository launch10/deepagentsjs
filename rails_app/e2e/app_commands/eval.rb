# rubocop:disable Security/Eval -- cypress-on-rails test infrastructure
Kernel.eval(command_options) unless command_options.nil?
# rubocop:enable Security/Eval
