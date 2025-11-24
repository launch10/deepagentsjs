#!/bin/bash

set -eo pipefail

bundle install
bundle exec rake db:migrate
bin/rake rswag:specs:swaggerize