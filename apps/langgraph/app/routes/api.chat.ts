// import { type ActionFunctionArgs } from '@remix-run/cloudflare';
// import { type Messages } from '~/lib/.server/llm/stream-text';
// import { type Message as VercelChatMessage, createDataStreamResponse, streamText } from "ai";
// import { HumanMessage, AIMessage, ChatMessage, BaseMessage } from "@langchain/core/messages";
// import { router } from "@services/router";
// import { LangChainAdapter } from 'ai';

// export async function action(args: ActionFunctionArgs) {
//   return chatAction(args);
// }

// const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
//   if (message.role === "user") {
//     return new HumanMessage(message.content);
//   } else if (message.role === "assistant") {
//     return new AIMessage(message.content);
//   } else {
//     return new ChatMessage(message.content, message.role);
//   }
// };

// const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
//   if (message._getType() === "human") {
//     return { content: message.content, role: "user" };
//   } else if (message._getType() === "ai") {
//     return {
//       content: message.content,
//       role: "assistant",
//       tool_calls: (message as AIMessage).tool_calls,
//     };
//   } else {
//     return { content: message.content, role: message._getType() };
//   }
// };

// interface StreamDataPayload {
//   // Contains specific data like tool name, args, artifactId, error message etc.
//   [key: string]: any;
// }

// async function chatAction({ context, request }: ActionFunctionArgs) {
//   const messages = (await request.json<{ messages: Messages }>()).messages.filter(
//     (message) => message.role !== "system"
//   ).map(convertVercelMessageToLangChainMessage);

//   const tenantId = 1; // TODO: Get user ID from session
//   const projectName = undefined; // TODO: Get project name from session
//   const currentError = undefined; // TODO: Get current error from session
//   const threadId = projectName;

//   const initialState = {
//     tenantId,
//     projectName,
//     userRequest: messages[messages.length - 1],
//     currentError,
//     threadId,
//   };

//   const { graph: workflow, config, state } = await router(initialState);
//   config.version = "v2";

//   try {
//     const eventStream = await workflow.streamEvents(state, config);
//     const projectNodes = ['projectPlan', 'load', 'createStyles', 'planPageNode', 
//                           'createSectionGraph', 'createLayoutGraph', 'queuePageNode', 
//                           'assemblePageNode'];
//     const importantNodes = [
//       '__start__', 
//       '__end__',
//       // 'startCreate', 
//       'notifyCreateStart',
//       'projectPlan', 
//       // 'createPageGraph', 
//       'applyUpdates',
//       // 'startCreatePage',
//       'planPage', 
//       // 'createStylesGraph', 
//       'planCreateStyles', 
//       'createStyles',
//       // 'waitForStylesAndPlan', 
//       // 'createSectionGraph',
//       // 'waitForAllSections',
//       // 'createLayoutGraph',
//       // 'queuePage',
//       // 'queuePageNode',
//       'assemblePageNode',
//       // 'queueNextTask', 
//       // 'startCreateSection',
//       'planCreateSection', 
//       'createSection', 
//       'createLayout',
//       'assemblePage',
//       'startUpdate',
//       'backupProject',
//       'buildTasks',
//       'updateCode',
//       // 'createPageGraph',
//       // 'createSectionGraph',
//       // 'waitForUpdates',
//       'applyUpdates',
//       'save',
//       // 'agent', 
//       'tools'
//     ];

//     const userMessagingNodes = ['notifyCreateStart'];
//     const textEncoder = new TextEncoder();

//     const transformStream = new ReadableStream({
//       async start(controller) {
//           try {
//             let currentArtifactId: string | null = null; // Track context
//             for await (const event of eventStream) {
//               const { event: eventType, name, tags, run_id, data, metadata } = event;
//               const nodeName = metadata.langgraph_node;
//               if (nodeName === undefined) {
//                 // might need to come back here and add a specific "start" event
//                 continue;
//               }
//               if (!importantNodes.includes(nodeName)) {
//                 continue;
//               }
//               // 1. User-Facing Text Stream (Use on_llm_new_token for maximum granularity)
//               // Note: 'on_llm_new_token' triggers for both LLM and ChatModel streams.
//               //
//               // maybe make an intro/outro node that just sends a message to the user
//               // on_chat_model_start
//               if (eventType === 'on_chat_model_stream' && userMessagingNodes.includes(nodeName)) {
//                   const token = data?.chunk?.content ?? data?.token; // Check both possible fields
//                   console.log(`Token: ${token}`);
//                   if (typeof token === 'string' && token.length > 0) {
//                       controller.enqueue(token);
//                   }
//               }
//             }
//         } catch(e) {
//           console.log(e);
//         } finally {
//           controller.close();
//         }
//       }
//     });
//     return LangChainAdapter.toDataStreamResponse(transformStream);
//     // return new Response(transformStream, {
//     //   status: 200,
//     //   headers: {
//     //     contentType: "text/plain; charset=utf-8"
//     //   }
//     // });

//       // *** Use StreamingTextResponse ***
//       // return new StreamingTextResponse(stream, {
//       //       status: 200,
//       //       // You can add custom headers here if needed later
//       //       // headers: { 'X-My-Custom-Header': 'value' }
//       // });
//   } catch (error) {
//     console.log(error);

//     throw new Response(null, {
//       status: 500,
//       statusText: 'Internal Server Error',
//     });
//   }
// }
// 2. Code Block Start/End (Map to relevant chain/node start/end)
// Assuming code generation is a specific chain/node execution
// else if (eventType === 'on_chain_start' && nodeName === 'code_generator_node') { // ADJUST NODE/CHAIN NAME
//     currentArtifactId = data?.input?.artifactId || `artifact_${run_id}`;
//     dataStreamWriter.writeData({ type: 'code_start', payload: { artifactId: currentArtifactId, name: nodeName } });
// } else if (eventType === 'on_chain_end' && nodeName === 'code_generator_node') { // ADJUST NODE/CHAIN NAME
//     dataStreamWriter.writeData({ type: 'code_end', payload: { artifactId: currentArtifactId, name: nodeName, output: data?.outputs } }); // Include output if relevant
//     currentArtifactId = null;
// }
// // 3. Tool Start/End/Error
// else if (eventType === 'on_tool_start') {
//     dataStreamWriter.writeData({ type: 'tool_start', payload: { toolName: nodeName, toolInput: data?.input, artifactId: currentArtifactId, runId: run_id } });
// } else if (eventType === 'on_tool_end') {
//     dataStreamWriter.writeData({ type: 'tool_end', payload: { toolName: nodeName, toolOutput: data?.output, artifactId: currentArtifactId, runId: run_id } });
// } else if (eventType === 'on_tool_error') {
//     const errorPayload = { sourceEvent: eventType, sourceName: nodeName, errorMessage: data?.error?.message || JSON.stringify(data?.error) || 'Unknown error', runId: run_id };
//     dataStreamWriter.writeData({ type: 'error', payload: errorPayload });
// }
// // 4. LLM/Chat Model Errors (distinct from tool errors)
// else if (eventType === 'on_llm_error') {
//     const errorPayload = { sourceEvent: eventType, sourceName: nodeName, errorMessage: data?.error?.message || JSON.stringify(data?.error) || 'Unknown error', runId: run_id };
//     dataStreamWriter.writeData({ type: 'error', payload: errorPayload });
// }
// // 5. Agent Action/Finish (If needed for UI)
// else if (eventType === 'on_agent_action') {
//     // Maybe useful for showing "Agent decided to use Tool X" before on_tool_start?
//     dataStreamWriter.writeData({ type: 'agent_action', payload: { action: data?.action, artifactId: currentArtifactId, runId: run_id } });
// } else if (eventType === 'on_agent_finish') {
//     // Signals the agent logic (not necessarily the whole graph) completed
//     dataStreamWriter.writeData({ type: 'agent_finish', payload: { finish: data?.finish, artifactId: currentArtifactId, runId: run_id } });
// }
// // 6. Chain Error (Broader than LLM/Tool errors)
// else if (eventType === 'on_chain_error') {
//     const errorPayload = { sourceEvent: eventType, sourceName: nodeName, errorMessage: data?.error?.message || JSON.stringify(data?.error) || 'Unknown error', runId: run_id };
//     dataStreamWriter.writeData({ type: 'error', payload: errorPayload });
// }