import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid frontend environment configuration: ${parsedEnv.error.message}`,
  );
}

export const env = parsedEnv.data;
