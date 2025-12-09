import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { pool } from "./postgres";

export const checkpointer = new PostgresSaver(pool);
try {
  await checkpointer.setup();
} catch (e) {
  console.error(e);
}

export const graphParams = { checkpointer };
