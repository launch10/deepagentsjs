/**
 * Define the configurable parameters for the agent.
 */
import { Annotation } from "@langchain/langgraph";
import { type RunnableConfig } from "@langchain/core/runnables";

export const ConfigurationAnnotation = Annotation.Root({
  thread_id: Annotation<string>,
});

export function ensureConfiguration(
  config: RunnableConfig,
): typeof ConfigurationAnnotation.State {

  const configurable = config.configurable ?? {};

  return {
    thread_id: configurable.thread_id ?? "",
  };
}