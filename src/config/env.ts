import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
});

function validateEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([key, msgs]) => `${key}: ${msgs?.join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${message}`);
  }

  return parsed.data;
}

export const env = validateEnv();
