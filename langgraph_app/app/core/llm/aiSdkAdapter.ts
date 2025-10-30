import { z } from "zod";
import { anthropic } from '@ai-sdk/anthropic';
import { streamObject, streamText, parsePartialJson } from 'ai';
import { 
  type LanguageModelV2, 
  type LanguageModelV2Prompt, 
  type LanguageModelV2Message, 
  type LanguageModelV2StreamPart,
  type LanguageModelV2CallOptions,
} from '@ai-sdk/provider'
import { 
  type ParseResult,
  convertAsyncIteratorToReadableStream
} from "@ai-sdk/provider-utils";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { StateGraph, END, START, messagesStateReducer, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic"; 
import { ChatOllama } from "@langchain/ollama";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import type { CompiledStateGraph } from '@langchain/langgraph';
import type { IterableReadableStream } from "@langchain/core/utils/stream";

type StreamMessageOutput = [BaseMessage, Record<string, any>];

const stateSchema = z.object({
  messages: z.array(z.object({ content: z.string(), length: z.number() })).min(1)
})
class LangGraphModel<TState extends { messages: BaseMessage[] }> implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider = 'langgraph' as const;
  modelId: string;
  defaultObjectGenerationMode = 'json' as const;
  readonly supportedUrls = {};
  
  constructor(
    private graph: CompiledStateGraph<TState, LangGraphRunnableConfig>,
    modelId = 'langgraph'
  ) {
    this.graph = graph;
    this.modelId = modelId;
  }
  
  async doGenerate(
    options: Parameters<LanguageModelV2['doGenerate']>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    const result = await this.graph.invoke({
      messages: this.toLanggraphMessages(options.prompt),
    });

    if (!result || typeof result !== 'object' || !('messages' in result) || !Array.isArray(result.messages)) {
      throw new Error("Graph must have messages key")
    }
    const lastMessage = state.messages[state.messages.length - 1] || { content: '' };
    
    return {
      content: [
        {
          type: "text",
          text: lastMessage.content
        }
      ],
      finishReason: 'stop' as const,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      warnings: []
    };
  }

  toLanggraphMessage(message: LanguageModelV2Message): BaseMessage {
    const content = message.content[0];
    let body: string | undefined;
    if (!content) {
      throw new Error("Message has no content")
    }
    if (content && typeof content === 'string') {
      body = content;
    } else if (typeof content === 'object' && 'text' in content) {
      body = content.text;
    }
    if (!body) { throw new Error("Don't know how to parse message") }

    switch (message.role) {
      case "user":
        return new HumanMessage(body);
      case "system":
        return new SystemMessage(body);
      case "assistant":
        return new AIMessage(body);
      default:
        throw new Error(`Don't know how to map message with role ${message.role}`)
    }
  }

  toLanggraphMessages(messages: LanguageModelV2Prompt): BaseMessage[] {
    if (messages.length === 0) {
      throw new Error("No prompt!")
    }

    return messages.map(this.toLanggraphMessage);
  }
  
  async doStream(
    options: Parameters<LanguageModelV2['doStream']>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    console.log(`about to stream...`)
    const stream = await this.graph.stream(
      {
        messages: this.toLanggraphMessages(options.prompt),
      },
      { streamMode: 'messages' } // Important: stream messages
    );
    
    const aiSDKIterator = this.convertToAISDKStream(stream);

    return {
      stream: aiSDKIterator
    };
  }
 private convertToAISDKStream(
    langGraphStream: IterableReadableStream<StreamMessageOutput>
  ): ReadableStream<LanguageModelV2StreamPart> {
    let isFirstChunk = true;
    let inCodeBlock = false;
    let buffer = '';

    return convertAsyncIteratorToReadableStream(langGraphStream).pipeThrough(
      new TransformStream<any, LanguageModelV2StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'response-metadata', id: '0' });
        },

        transform(chunk: StreamMessageOutput, controller) {
          // chunk is [AIMessage, metadata]
          const [message, _metadata] = chunk;

          if (message?.content) {
            let textDelta = typeof message.content === 'string'
              ? message.content
              : '';

            buffer += textDelta;

            // Skip opening code fence
            if (buffer.includes('```json')) {
              buffer = buffer.replace('```json', '').trim();
              inCodeBlock = true;
              textDelta = buffer;
              buffer = '';
            } else if (buffer.includes('```') && !inCodeBlock) {
              buffer = buffer.replace('```', '').trim();
              inCodeBlock = true;
              textDelta = buffer;
              buffer = '';
            }

            // Check for closing fence
            if (textDelta.includes('```')) {
              textDelta = textDelta.split('```')[0] as string;
            }

            if (textDelta && isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({ type: 'text-start', id: '0' });
            }

            if (textDelta) {
              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: textDelta
              });
            }
          }
        },

        flush(controller) {
          if (!isFirstChunk) {
            controller.enqueue({ type: 'text-end', id: '0' });
          }

          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          });
        },
      })
    );
  }
}

// // Usage:
// export async function POST(req: Request) {
//   const { messages, schema } = await req.json();
  
//   const langGraphModel = new LangGraphModel(yourCompiledGraph);
  
//   return streamObject({
//     model: langGraphModel,
//     schema: schema,
//     prompt: messages,
//   });
// }

const structuredResponseSchema = z.object({
  intro: z.string(),
  examples: z.array(z.string()),  
  conclusion: z.string(),
});
type StructuredResponseType = z.infer<typeof structuredResponseSchema>;

const GraphAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[], BaseMessageLike[]>({ 
        default: () => [],
        reducer: messagesStateReducer
    }),
    response: Annotation<StructuredResponseType | undefined, StructuredResponseType>({ 
        default: () => undefined,
        reducer: (curr, next) => structuredResponseSchema.parse(next),
    }),
});

interface StateType {
  messages: BaseMessage[];
  response: StructuredResponseType | undefined;
} 

// const llm = new ChatOllama({
//   model: 'gpt-oss:20b',
//   temperature: 0,
// });
const llm = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: `claude-haiku-4-5`,
  temperature: 0,
  streaming: true,
});

interface StructuredResponseParams {
  llm: any;
  prompt: string;
  schema: z.ZodSchema;
}

// export const withStructuredResponse = async ({llm, prompt, schema}: StructuredResponseParams) => {
//   const unstructuredResponse = await llm.invoke(prompt) as AIMessage
//   const parser = StructuredOutputParser.fromZodSchema(schema);
//   const result = await parser.parse(unstructuredResponse.content as string)

//   return result;
// }

const streamPrompt = async<TSchema extends z.ZodSchema<any>>(prompt: string, schema: TSchema): Promise<AIMessage> => {
  const parser = StructuredOutputParser.fromZodSchema(schema);
  let promptWithInstructions = `${prompt} $${parser.getFormatInstructions()}`

  return await llm.invoke(promptWithInstructions);
  // let fullText = '';
  
  // for await (const chunk of stream) {
  //   fullText += chunk.content;
  // }
  
  // // Strip markdown code blocks if present
  // let cleanedText = fullText.trim();
  // if (cleanedText.startsWith('```json')) {
  //   cleanedText = cleanedText.slice(7);
  // }
  // // if (cleanedText.startsWith('```')) {
  // //   cleanedText = cleanedText.slice(3);
  // // }
  // if (cleanedText.endsWith('```')) {
  //   cleanedText = cleanedText.slice(0, -3);
  // }
  // cleanedText = cleanedText.trim();
  
  // const output: TSchema = await parser.parse(cleanedText);
  // return { };
  // return {fullText}
}

const structuredResponseNode = async (state: StateType, config: LangGraphRunnableConfig<StateType>) => {
  if (state.messages.length < 1) {
    throw new Error(`Not enough messages`)
  }
  const userPrompt = state.messages[state.messages.length - 1]
  if (!userPrompt) {
    throw new Error("Need user prompt")
  }
  const prompt = `
    <instructions>
      Answer the user's question, using an intro, 3 examples, and a conclusion.
      Output ONLY valid JSON matching the schema. Do not include any explanation or thinking.
    </instructions>

    <question>
      ${userPrompt.content}
    </question>
  `
  const message = await streamPrompt(prompt, structuredResponseSchema)
  
  return { messages: [message] };
}

export const structuredResponseGraph = new StateGraph(GraphAnnotation)
    .addNode("responseNode", structuredResponseNode)
    .addEdge(START, "responseNode")
    .addEdge("responseNode", END)
    .compile()

const langGraphModel = new LangGraphModel<StateType>(structuredResponseGraph);

const stream = streamObject({
  model: langGraphModel,
  schema: structuredResponseSchema,
  prompt: `How do I define an audience for a YouTube channel? I specifically want to make a cooking channel`,
});

for await (const chunk of stream.partialObjectStream) {
  console.clear();
  console.log(chunk)
}