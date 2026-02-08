import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { env } from "./env";
import { getLogger } from "./logger/context";

export const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
try {
  await checkpointer.setup();
} catch (e) {
  getLogger({ component: "graphParams" }).error({ err: e }, "Checkpointer setup failed");
}

export const graphParams = { checkpointer };
