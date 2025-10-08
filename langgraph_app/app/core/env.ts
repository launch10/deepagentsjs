import { z } from "zod";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

export const envSchema = z.object({
    POSTGRES_URI: z.string().min(1).url(),
    REDIS_URI: z.string().min(1).url(),
    RAILS_API_URL: z.string().min(1).url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    GOOGLE_API_KEY: z.string().min(1),
    LANGSMITH_TRACING: z.string().min(1),
    LANGSMITH_ENDPOINT: z.string().min(1),
    LANGSMITH_API_KEY: z.string().min(1),
    LANGSMITH_PROJECT: z.string().min(1),
    LLM_PAID: z.enum(["free", "paid"]).default("paid"),
    LLM_SPEED: z.enum(["fast", "slow"]).default("slow"),
    JWT_SECRET: z.string().min(1),
    USE_CACHE: z.coerce.boolean().default(false),
    LANGGRAPH_SERVER: z.coerce.boolean().default(false),
    NODE_ENV: z.string().default("development"),
});

export const testEnvSchema = envSchema.extend({
  REBUILD_SNAPSHOTS: z.coerce.boolean().default(false),
  VITEST: z.coerce.boolean().default(true),
})

const environmentConfigSchema = z.discriminatedUnion("NODE_ENV", [
  testEnvSchema.extend({
    NODE_ENV: z.literal("test"),
  }),
  envSchema.extend({
    NODE_ENV: z.literal("development"),
  }),
  envSchema.extend({
    NODE_ENV: z.literal("production"),
  }),
]);

export type Env = z.infer<typeof envSchema>;
export type TestEnv = z.infer<typeof testEnvSchema>;
export type RuntimeEnv = Env | TestEnv;

export const env = ((): RuntimeEnv => {
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const isCIEnv = process.env.CI === 'true';
  const envFile = isCIEnv ? '.env.ci' : isTestEnv ? '.env.test' : '.env';

  expand(config({ path: envFile, override: true }));

  try {
    const parsedEnv = environmentConfigSchema.parse(process.env);
    return parsedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      console.error(`❌ Invalid environment variables:\n${errorMessages}`);
      process.exit(1);
    }
    
    throw error;
  }
})();