#!/usr/bin/env node
// Use tsx to run this: npm run debug:update-graph -- -n <projectName> -prompt "<userRequest>"

import dotenv from 'dotenv';
import { graph as runnableGraph } from "./app/lib/server/langgraph/graphs/mapReduce";
import { Store } from "./app/lib/server/langgraph/store/store";

// Load environment variables
dotenv.config();

async function main() {

    // const threadId = '12345';
    // const config = { configurable: { thread_id: threadId } };
    try {
        // console.log(`--- Running Update Graph for Thread ID: ${threadId} ---`);
        // const finalState = await runnableGraph.invoke({ }, config);
        // console.log('\n--- Final State ---');
        // console.log(JSON.stringify(finalState, null, 2));
        // console.log('------------------');
        // const state = (await runnableGraph.getState(config));
        // console.log('\n--- State ---');
        // console.log(JSON.stringify(state, null, 2));
        // console.log('------------------');

    } catch (error) {
        console.error("\n--- Graph Execution Error ---");
        console.error(error);
        console.error("---------------------------");
        process.exit(1);
    }
}

main();
