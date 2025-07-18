#!/usr/bin/env node
// Use tsx to run this: npm run debug:update-graph -- -n <projectName> -prompt "<userRequest>"

import dotenv from 'dotenv';
import { graph as runnableGraph } from "./app/lib/server/langgraph/graphs/updateStyles";
import { CodeTaskType } from "@models/codeTask";
import { BaseMessage } from "@langchain/core/messages";
import { Project } from "@langgraph/models/project";

// Load environment variables
dotenv.config();

async function main() {
    const threadId = '12345';
    const config = { configurable: { thread_id: threadId } };
    const projectName = "ai-report-newsletter";
    const project = Project.create({ projectName })
    const files = await project.getFiles();
    try {
        console.log(`--- Running Update Graph for Thread ID: ${threadId} ---`);
        const finalState = await runnableGraph.invoke(
            { 
                userRequest: { content: "Make the entire page POP more" },
                app: {
                    files,
                },
                task: { 
                    type: CodeTaskType.UPDATE_STYLES, 
                    instruction: "Update the colors of the page to make it more visually appealing" ,
                } 
            }, config);
        console.log('\n--- Final State ---');
        console.log(JSON.stringify(finalState, null, 2));
        console.log('------------------');
        const state = (await runnableGraph.getState(config));
        console.log('\n--- State ---');
        console.log(JSON.stringify(state, null, 2));
        console.log('------------------');

    } catch (error) {
        console.error("\n--- Graph Execution Error ---");
        console.error(error);
        console.error("---------------------------");
        process.exit(1);
    }
}

main();
