#!/usr/bin/env node

import dotenv from 'dotenv';
import { hexToCssHsl } from "@services/theme/service";

// Load environment variables (if your LLM needs API keys)
dotenv.config();

async function main() {
    debugger;
    console.log(hexToCssHsl("#000000"));
}

main().catch(console.error);
