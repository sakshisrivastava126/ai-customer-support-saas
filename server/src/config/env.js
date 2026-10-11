import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const positiveInt = z.coerce.number().int().positive();
const requiredString = z.string().trim().min(1, 'is required');

const envSchema = z.object({
  PORT: positiveInt.default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  MONGODB_URI: requiredString,
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN: requiredString,
  CLIENT_ORIGIN: requiredString.transform((value) =>
    value.split(',').map((origin) => origin.trim()).filter(Boolean),
  ),
  GOOGLE_API_KEY: requiredString,
  LLM_MODEL: requiredString,
  EMBEDDING_MODEL: requiredString,
  EMBEDDING_DIMENSIONS: positiveInt,
  VECTOR_INDEX_NAME: requiredString,
  RAG_TOP_K: positiveInt,
  RAG_NUM_CANDIDATES: positiveInt,
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1),
  RAG_HISTORY_MESSAGES: z.coerce.number().int().min(6).max(10),
  MAX_MESSAGE_CHARS: positiveInt,
  MAX_UPLOAD_MB: positiveInt,
  MAX_DOCS_PER_TENANT: positiveInt,
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = result.data;

export const config = Object.freeze({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  mongodbUri: env.MONGODB_URI,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  clientOrigin: Object.freeze(env.CLIENT_ORIGIN),
  googleApiKey: env.GOOGLE_API_KEY,
  llmModel: env.LLM_MODEL,
  embeddingModel: env.EMBEDDING_MODEL,
  embeddingDimensions: env.EMBEDDING_DIMENSIONS,
  vectorIndexName: env.VECTOR_INDEX_NAME,
  ragTopK: env.RAG_TOP_K,
  ragNumCandidates: env.RAG_NUM_CANDIDATES,
  ragSimilarityThreshold: env.RAG_SIMILARITY_THRESHOLD,
  ragHistoryMessages: env.RAG_HISTORY_MESSAGES,
  maxMessageChars: env.MAX_MESSAGE_CHARS,
  maxUploadMb: env.MAX_UPLOAD_MB,
  maxDocsPerTenant: env.MAX_DOCS_PER_TENANT,
});
