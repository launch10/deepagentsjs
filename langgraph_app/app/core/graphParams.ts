import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { pool } from "./postgres";
import { env } from "./env";

// Singleton instances
let checkpointer: PostgresSaver | null = null;

// We only setup checkpointer if we're not running inside Langgraph server
if (env.LANGGRAPH_SERVER !== true) {
    checkpointer = new PostgresSaver(pool);
    await checkpointer.setup(); // Run migrations only once
}

export const graphParams = { checkpointer };