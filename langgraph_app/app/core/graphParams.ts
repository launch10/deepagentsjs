import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { pool } from "./postgres";

const checkpointer = new PostgresSaver(pool);
await checkpointer.setup();

export const graphParams = { checkpointer };