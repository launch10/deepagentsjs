import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { env } from "@core";

export const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
try {
  await checkpointer.setup();
} catch (e) {
  console.error(e);
}

export const graphParams = { checkpointer };
