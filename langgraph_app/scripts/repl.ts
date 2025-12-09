#!/usr/bin/env tsx

/**
 * Interactive REPL for testing and exploring the codebase
 *
 * Usage:
 *   pnpm repl              # Start REPL with default environment
 *   NODE_ENV=test pnpm repl  # Start REPL with test environment
 *
 * Available globals:
 *   - All @types exports
 *   - Common services
 *   - Utility functions
 */

import repl from "node:repl";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import commonly used modules that will be available globally in REPL
import * as types from "@types";
import * as core from "@core";
import * as prompts from "@prompts";
import * as services from "@services";
import * as nodes from "@nodes";
import * as tools from "@tools";
import * as graphs from "@graphs";
import * as utils from "@utils";
import { env } from "@app";

// Get current directory for module resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Utility function to clear console
const clear = () => console.clear();

// Utility function to pretty print JSON
const pp = (obj: any, depth: number = 2) => {
  console.log(JSON.stringify(obj, null, depth));
};

// Utility function to reload a module
const reload = async (modulePath: string) => {
  const fullPath = path.resolve(projectRoot, modulePath);
  delete require.cache[fullPath];
  return import(fullPath + "?" + Date.now());
};

// Start REPL
console.log(`
╔══════════════════════════════════════════════╗
║     🚀 LangGraph App Development REPL 🚀      ║
╠══════════════════════════════════════════════╣
║  Environment: ${process.env.NODE_ENV || "development"}
║  Project: ${projectRoot}
╚══════════════════════════════════════════════╝

Available globals:
  • types         - All type definitions
  • prompts       - All prompt templates
  • core          - Core utilities, such as core.getLLM
  • services      - All services
  • nodes         - All Langgraph nodes
  • tools         - All tools
  • graphs        - All Langgraph graph parameters
  • utils         - All utils

Utility functions:
  • clear()       - Clear console
  • pp(obj)       - Pretty print JSON
  • reload(path)  - Reload a module
  • help()        - Show this help message

Example usage:
  > const service = new services.PlanComponentService()
  > await service.execute(mock)
  
  > const llm = core.getLLM(core."planning")
  > await llm.invoke("Hello!")

Type .exit to quit
`);

// Create help function
const help = () => {
  console.log(`
📚 REPL Help
============

Common Tasks:
-------------
1. Test a service:
   const service = new PlanComponentService()
   const result = await service.execute(mockInput)

2. Test LLM:
   const llm = getLLM("writing", "fast")
   const response = await llm.invoke("Test prompt")

3. Work with types:
   const hero: types.Website.Component.HeroComponentPlan = { ... }
   
4. Test prompts:
   const prompt = await prompts.planComponentPrompt(props)
   console.log(prompt)

Tips:
-----
• Use await for async operations
• Tab completion works for exploring objects
• Use .break to cancel multiline input
• Use .clear to reset context
• Use .load <filename> to load a script file
• Use .save <filename> to save session history
`);
};

// Create the REPL server
const server = repl.start({
  prompt: "> ",
  useGlobal: true,
  breakEvalOnSigint: true,
  preview: false,
});

// Add context (globally available variables)
Object.assign(server.context, {
  types,
  prompts,
  services,
  core,
  nodes,
  tools,
  graphs,
  utils,
  clear,
  pp,
  reload,
  help,
  projectRoot,
});

server.defineCommand("env", {
  help: "Show current environment variables",
  action: async () => {
    try {
      console.log("\n📋 Environment Variables:");
      console.log("========================");
      Object.entries(env).forEach(([key, value]) => {
        // Mask sensitive values
        if (key.includes("KEY") || key.includes("TOKEN") || key.includes("PASSWORD")) {
          console.log(`  ${key}: ***${String(value).slice(-4)}`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });
      console.log("");
    } catch (error) {
      console.error("Failed to load environment:", error);
    }
    (this as any).displayPrompt();
  },
});

// Handle cleanup
server.on("exit", () => {
  console.log("\n👋 Goodbye!\n");
  process.exit(0);
});
