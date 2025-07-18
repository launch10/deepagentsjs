#!/usr/bin/env node
// Use tsx to run this: npm run debug:graph -- --prompt "Your prompt here"

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { graph as router } from './app/lib/server/langgraph/graphs/router';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

async function parseArgs() {
    return await yargs(hideBin(process.argv))
        .option('projectName', {
            alias: 'n',
            type: 'string',
            description: 'The name of the project',
            demandOption: false,
        })
        .option('prompt', {
            alias: 'p',
            type: 'string',
            description: 'The user\'s request for code updates',
            demandOption: true,
        })
        .option('currentError', {
            alias: 'e',
            type: 'string',
            description: 'The current error',
            demandOption: false,
        })
        .help()
        .alias('help', 'h')
        .argv;
}

async function main() {
    const argv = await parseArgs();
    const projectName = argv.projectName as string;
    const userRequest = argv.prompt as string;
    const currentError = argv.currentError as string | undefined;
    const threadId = projectName; // Using projectName as threadId for debugging

    // Construct the initial state
    // Note: Ensure initialPrompt matches the structure expected by GraphStateAnnotation
    // Provide only the strictly necessary input fields without defaults
    const initialState = {
        tenantId: 1,
        projectName: projectName,
        userRequest: new HumanMessage(userRequest),
        currentError: currentError,
    };
    // Types for other fields like chatHistory will be handled by LangGraph defaults

    console.log("Initial State:", JSON.stringify(initialState, null, 2));
    console.log("\nInvoking graph...\n");

    // Set a breakpoint here in your IDE/debugger
    try {
        // Invoke with the minimal initial state. LangGraph should handle defaults.
        // const { graph, config, state } = await router(initialState);
        const finalState = await router.invoke(initialState);
        console.log("\n--- Graph Execution Complete ---");
        console.log("Final State:");
        // Using console.dir for potentially better object inspection
        console.dir(finalState, { depth: null });

    } catch (error) {
        debugger;
        console.error("\n--- Graph Execution Failed ---");
        console.error(error);
        process.exit(1); // Exit with error code
    }

     console.log("\n--- Debug Script Finished ---");
}

main().catch(console.error);
