#!/usr/bin/env node
// Use tsx to run this: npm run debug:graph -- --prompt "Your prompt here"

import { createProject } from "../app/lib/server/langgraph/services/saveProject";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { type GraphState } from "../app/lib/shared/state/graph"; 

dotenv.config();

async function main() {
    const snapshotFilePath = path.resolve(process.cwd(), '.cache', 'graphStateSnapshot.json');
    
    try {
        if (!fs.existsSync(snapshotFilePath)) {
            console.error(`Error: Snapshot file not found at ${snapshotFilePath}`);
            process.exit(1);
        }

        const fileContent = fs.readFileSync(snapshotFilePath, 'utf-8');
        const state: GraphState = JSON.parse(fileContent);

        if (!state || !state.app || !state.app.project) {
            console.error("Error: Invalid state loaded from snapshot. Missing 'app' or 'app.project'.");
            process.exit(1);
        }

        console.log(`Loaded project: ${state.app.project.projectName} from snapshot.`);
        console.log("Calling saveProject service...");

        await createProject(state);

        console.log("saveProject service call completed.");

    } catch (error) {
        console.error("An error occurred in the test script:", error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error("Unhandled error in main function:", error);
    process.exit(1);
});
