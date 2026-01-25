import { FakeListChatModel } from "@langchain/core/utils/testing";
import { getNodeContext } from "@middleware";

export interface MockResponses {
  [graphName: string]: {
    [nodeName: string]: (string | object)[];
  };
}
class StructuredOutputAwareFakeModel extends FakeListChatModel {
  private useStructuredOutput = false;

  override withStructuredOutput(schema: any, config?: any): any {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.useStructuredOutput = true;
    return clone;
  }

  override async invoke(input: any, options?: any): Promise<any> {
    const response = await super.invoke(input, options);

    if (this.useStructuredOutput && typeof response.content === "string") {
      const stripped = response.content
        .replace(/```json\n?/g, "")
        .replace(/```/g, "")
        .trim();
      try {
        const parsed = JSON.parse(stripped);
        return { raw: response, parsed };
      } catch (e) {
        return { raw: response, parsed: response.content };
      }
    }

    return response;
  }
}

// Mock response manager - stores normalized (string) responses
class TestResponder {
  responses: { [graphName: string]: { [nodeName: string]: string[] } } = {};

  reset() {
    this.responses = {};
  }

  configure(responses: MockResponses) {
    // Normalize all responses to string format
    const normalizedResponses: { [graphName: string]: { [nodeName: string]: string[] } } = {};

    for (const [graphName, graphResponses] of Object.entries(responses)) {
      normalizedResponses[graphName] = {};
      for (const [nodeName, nodeResponses] of Object.entries(graphResponses)) {
        normalizedResponses[graphName][nodeName] = nodeResponses.map(this.normalizeResponse);
      }
    }

    this.responses = normalizedResponses;
  }

  get(): StructuredOutputAwareFakeModel {
    const nodeContext = getNodeContext();
    const graphName = nodeContext?.graphName;
    const nodeName = nodeContext?.name;

    if (!graphName || !nodeName) {
      throw new Error(
        "Graph name or node name is missing! Cannot get test LLM without proper context."
      );
    }

    const graphResponses = this.responses[graphName];
    if (!graphResponses || !graphResponses[nodeName]) {
      throw new Error("No responses configured for this graph/node combination.");
    }

    return new StructuredOutputAwareFakeModel({
      responses: graphResponses[nodeName],
    });
  }

  /**
   * Convert a response value to a string format suitable for FakeListChatModel
   * - Objects are converted to ```json ... ``` format
   * - Strings are returned as-is
   */
  private normalizeResponse(response: string | object): string {
    if (typeof response === "string") {
      return response;
    }

    // Convert object to JSON and wrap in markdown code block
    const jsonString = JSON.stringify(response, null, 2);
    return `\`\`\`json\n${jsonString}\n\`\`\``;
  }
}

export const LLMTestResponder = new TestResponder();
