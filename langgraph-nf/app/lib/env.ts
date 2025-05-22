import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

export const envSchema = z.object({
    POSTGRES_URI: z.string().min(1).url(),
    REDIS_URI: z.string().min(1).url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    VITE_LOG_LEVEL: z.string().min(1),
    LANGSMITH_TRACING: z.string().min(1),
    LANGSMITH_ENDPOINT: z.string().min(1),
    LANGSMITH_API_KEY: z.string().min(1),
    LANGSMITH_PROJECT: z.string().min(1),
    LLM_PAID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

expand(config());

try {
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
    console.log(process.env.POSTGRES_URI)
	envSchema.parse(process.env);
} catch (e) {
	if (e instanceof z.ZodError) {
		console.error("Environment validation error:", e.errors);
	}
}

export const env = envSchema.parse(process.env);
