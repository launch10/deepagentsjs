/**
 * Brainstorm API
 *
 * Stream and load history for brainstorm conversations.
 */
import { graphParams } from "@core";
import { brainstormGraph } from "@graphs";
import { BrainstormBridge } from "@annotation";

const compiledGraph = brainstormGraph.compile({
  ...graphParams,
  name: "brainstorm",
});

export const BrainstormAPI = BrainstormBridge.bind(compiledGraph);
