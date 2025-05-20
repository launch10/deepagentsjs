import {
  type LanguageModelV1,
  type LanguageModelV1Middleware,
  type LanguageModelV1StreamPart,
  simulateReadableStream,
} from 'ai';
import * as fs from 'fs';
import * as crypto from 'crypto';
import stringify from "fast-json-stable-stringify";

const CACHE_DIR = `${process.cwd()}/.cache/llm`;

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate a hash based on the request content
 */
function hashRequest(params: any): string {
  const hash = crypto.createHash('sha256');
  
  // If messages are available, use them for hashing
  if (params.messages && params.messages.length > 0) {
    const contentToHash = params.messages.map((m: any) => 
      stringify({
        role: m.role,
        content: m.content,
        // Include any other fields that could affect the response
        ...(m.name && { name: m.name }),
      })
    ).join('|');
    
    hash.update(contentToHash);
  } else {
    // Fallback to stringifying the entire params object
    hash.update(stringify(params));
  }
  
  return hash.digest('hex');
}

/**
 * Middleware for caching LLM responses to the filesystem
 */
export const CacheMiddleware = (env: Env): LanguageModelV1Middleware => ({
  wrapStream: async ({ doStream, params }) => {
      const hash = hashRequest(params);
      const cachePath = `${CACHE_DIR}/${hash}.json`;

    // Check if the result is in the cache
    if (fs.existsSync(cachePath)) {
      try {
        // Read and parse the cached stream parts
        const cachedContent = fs.readFileSync(cachePath, 'utf-8');
        const cachedParts = stringify(cachedContent) as LanguageModelV1StreamPart[];
        
        // Format timestamps in the cached response (convert strings back to Date objects)
        const formattedChunks = cachedParts.map(part => {
          if (part.type === 'response-metadata' && part.timestamp) {
            return { ...part, timestamp: new Date(part.timestamp) };
          }
          return part;
        });

        // Return a simulated stream from the cached parts
        return {
          stream: simulateReadableStream({
            initialDelayInMs: 0,
            chunkDelayInMs: 10,
            chunks: formattedChunks,
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      } catch (error) {
        console.error('Error reading from cache:', error);
        // If there's an error reading the cache, proceed with the actual call
      }
    }

    // If not cached, proceed with streaming
    const { stream, ...rest } = await doStream();
    const fullResponse: LanguageModelV1StreamPart[] = [];

    // Create a transform stream to capture all parts
    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        // Collect the chunk for caching
        fullResponse.push(chunk);
        // Pass the chunk through to the consumer
        controller.enqueue(chunk);
      },
      flush() {
        // Store the full response in the cache after streaming is complete
        try {
          fs.writeFileSync(
            cachePath, 
            stringify(fullResponse, (key, value) => {
              // Handle any circular references or non-serializable objects
              return value;
            }),
            'utf-8'
          );
        } catch (error) {
          console.error('Error writing to cache:', error);
        }
      },
    });

    // Return the transformed stream
    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
});