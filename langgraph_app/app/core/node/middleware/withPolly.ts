import type { NodeFunction } from "../types";
import type { CoreGraphState } from "@types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { startPolly, persistRecordings, getPollyNamespace } from "@utils";
import { kebabCase } from "change-case";
import { env } from "@core";

// withPolly doesn't take any config
type WithPollyConfig = Record<string, never>;

/**
 * Wraps a node function with polly (for testing, when we don't want to use fixtures)
 */
export const withPolly = <TState extends CoreGraphState>(
  nodeFunction: NodeFunction<TState>,
  options: WithPollyConfig
): NodeFunction<TState> => {
  return async (state: TState, config: LangGraphRunnableConfig) => {
    if (env.NODE_ENV !== "test") {
      return nodeFunction(state, config);
    }

    // Read the node name directly from LangGraph config metadata.
    // Previously this used getNodeContext() (AsyncLocalStorage), but withContext
    // is the innermost middleware while withPolly is outermost — so the store
    // was always empty here, causing every recording to land in "unknown-node-execution".
    const nodeName = (config?.metadata?.langgraph_node as string) || "unknown-node-execution";
    const namespace = getPollyNamespace();
    const baseName = kebabCase(nodeName);
    const recordingName = namespace ? `${namespace}/${baseName}` : baseName;

    await startPolly(recordingName);

    try {
      return await nodeFunction(state, config);
    } catch (error) {
      throw error; // Allow withError to handle the error
    } finally {
      await persistRecordings();
    }
  };
};
