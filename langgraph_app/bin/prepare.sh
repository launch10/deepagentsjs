#!/bin/bash

set -eo pipefail

pnpm install
pnpm run db:reflect
pnpm run api:generate