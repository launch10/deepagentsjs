#!/usr/bin/env node
// Use tsx to run this: npm run debug:graph -- --prompt "Your prompt here"

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { graph } from './app/lib/.server/langgraph/graphs/createPage/createPage';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('prompt', {
            alias: 'p',
            type: 'string',
            description: 'The initial prompt for the graph',
            demandOption: true, // Make the prompt required
        })
        .help()
        .alias('help', 'h')
        .argv;

    const initialPromptContent = argv.prompt;

    console.log(`--- Starting Graph Debug ---`);
    console.log(`Initial Prompt: ${initialPromptContent}`);

    // Construct the initial state
    // Note: Ensure initialPrompt matches the structure expected by GraphStateAnnotation
    // Provide only the strictly necessary input fields without defaults
    const initialState = {
         userRequest: new HumanMessage(initialPromptContent)
    };
    // Types for other fields like chatHistory will be handled by LangGraph defaults

    console.log("Initial State:", JSON.stringify(initialState, null, 2));
    console.log("\nInvoking graph...\n");

    // Set a breakpoint here in your IDE/debugger
    try {
        // Invoke with the minimal initial state. LangGraph should handle defaults.
        const finalState = await graph.invoke(initialState);
        console.log("\n--- Graph Execution Complete ---");
        console.log("Final State:");
        // Using console.dir for potentially better object inspection
        console.dir(finalState, { depth: null });

    } catch (error) {
        console.error("\n--- Graph Execution Failed ---");
        console.error(error);
        process.exit(1); // Exit with error code
    }

     console.log("\n--- Debug Script Finished ---");
}

main().catch(console.error);
