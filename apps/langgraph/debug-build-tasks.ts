#!/usr/bin/env node
// Use tsx to run this: npm run debug:build-tasks -- -n <projectName> -prompt "<userRequest>"

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { graph as runnableGraph } from "./app/lib/.server/langgraph/graphs/buildTasks";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

// Load environment variables
dotenv.config();

async function parseArgs() {
    return await yargs(hideBin(process.argv))
        .option('projectName', {
            alias: 'n',
            type: 'string',
            description: 'The name of the project',
            demandOption: true,
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

    // Initial state for the graph
    const initialState  = {
        projectName: projectName, 
        userRequest: new HumanMessage(userRequest),
        currentError: currentError,
    };

    const config = { configurable: { thread_id: threadId } };
    try {
        console.log(`--- Running Build Tasks Graph for Thread ID: ${threadId} ---`);
        const finalState = await runnableGraph.invoke(initialState, config);
        console.log('\n--- Final State ---');
        console.log(JSON.stringify(finalState, null, 2));
        console.log('------------------');
        const state = (await runnableGraph.getState(config));

    } catch (error) {
        console.error("\n--- Graph Execution Error ---");
        console.error(error);
        console.error("---------------------------");
        process.exit(1);
    }
}

main();
