#!/usr/bin/env node
// Use tsx to run this: npm run debug:query-icons -- -q "search query"

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { SearchIconsService } from '~/lib/.server/langgraph/services/searchIconsService';
import type { IconResult } from '~/lib/.server/langgraph/services/searchIconsService';

// Load environment variables
dotenv.config();

async function parseArgs() {
    return await yargs(hideBin(process.argv))
        .option('query', {
            alias: 'q',
            type: 'string',
            description: 'The search query for finding icons',
            demandOption: true,
        })
        .option('limit', {
            alias: 'l',
            type: 'number',
            description: 'Maximum number of results to return',
            default: 5,
        })
        .help()
        .alias('help', 'h')
        .argv;
}

async function main() {
    const argv = await parseArgs();
    const query = argv.query as string;
    const limit = argv.limit as number;

    try {
        console.log(`--- Searching Icons for: "${query}" (limit: ${limit}) ---`);
        const iconService = new SearchIconsService();
        
        const results = await iconService.searchIcons([query], limit);
        
        console.log('\n--- Search Results ---');
        if (results && results[query]) {
            results[query].forEach((result: IconResult, index: number) => {
                console.log(`\n[${index + 1}] ${result.name} (similarity: ${result.similarity.toFixed(4)})`);
                console.log(`Tags: ${result.metadata.tags.join(', ')}`);
                console.log(`Categories: ${result.metadata.categories.join(', ')}`);
            });
        } else {
            console.log('No results found');
        }
        console.log('\n------------------');

    } catch (error) {
        console.error("\n--- Search Error ---");
        console.error(error);
        console.error("------------------");
        process.exit(1);
    }
}

main();
