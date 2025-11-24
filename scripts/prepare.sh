#!/bin/bash

set -eo pipefail

echo "Preparing shared..."
cd shared && ./bin/prepare.sh
cd ..
echo "Preparing rails_app..."
cd rails_app && ./bin/prepare.sh
cd ..
echo "Preparing langgraph_app..."
cd langgraph_app && ./bin/prepare.sh
cd ..
echo "Preparing atlas..."
cd atlas && ./bin/prepare.sh
atlas/bin/prepare.sh