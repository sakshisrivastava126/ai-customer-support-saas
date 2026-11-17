import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { config } from '../config/env.js';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_JITTER_MS = 250;
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_MIN_STATUS = 500;
const SERVER_ERROR_MAX_STATUS = 599;
const EMBEDDING_NATIVE_DIMENSIONS = 3072;
const EMBEDDING_API_MAX_BATCH_SIZE = 100;

export const EMBEDDING_TASK_TYPES = Object.freeze({
  DOCUMENT: 'RETRIEVAL_DOCUMENT',
  QUERY: 'RETRIEVAL_QUERY',
});

const genAI = new GoogleGenAI({ apiKey: config.googleApiKey });

function errorStatus(err) {
  return Number(err?.status ?? err?.response?.status);
}

function isRetryableError(err) {
  const status = errorStatus(err);
  return (
    status === RATE_LIMIT_STATUS ||
    (status >= SERVER_ERROR_MIN_STATUS && status <= SERVER_ERROR_MAX_STATUS)
  );
}

function rethrowUnlessRetryable(err) {
  if (!isRetryableError(err)) throw err;
}

function backoffDelayMs(attempt) {
  return RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * RETRY_MAX_JITTER_MS;
}

async function withRetries(operation) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryableError(err)) throw err;
      await sleep(backoffDelayMs(attempt));
    }
  }
}

export function getChatModel({ temperature, streaming = false }) {
  return new ChatGoogleGenerativeAI({
    apiKey: config.googleApiKey,
    model: config.llmModel,
    temperature,
    streaming,
    maxRetries: MAX_RETRIES,
    onFailedAttempt: rethrowUnlessRetryable,
  });
}

function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

function toEmbeddingVector(values) {
  if (!Array.isArray(values) || values.length !== config.embeddingDimensions) {
    throw new Error(
      `Expected a ${config.embeddingDimensions}-dimensional embedding, got ${values?.length ?? 0}`,
    );
  }
  return config.embeddingDimensions < EMBEDDING_NATIVE_DIMENSIONS ? l2Normalize(values) : values;
}

async function embedBatch(texts, taskType) {
  const response = await withRetries(() =>
    genAI.models.embedContent({
      model: config.embeddingModel,
      contents: texts,
      config: { taskType, outputDimensionality: config.embeddingDimensions },
    }),
  );
  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
  }
  return embeddings.map((embedding) => toEmbeddingVector(embedding.values));
}

export function getEmbeddings({ taskType }) {
  if (!Object.values(EMBEDDING_TASK_TYPES).includes(taskType)) {
    throw new Error(`Unsupported embedding taskType: ${taskType}`);
  }

  return {
    async embedDocuments(texts) {
      const vectors = [];
      for (let start = 0; start < texts.length; start += EMBEDDING_API_MAX_BATCH_SIZE) {
        const batch = texts.slice(start, start + EMBEDDING_API_MAX_BATCH_SIZE);
        vectors.push(...(await embedBatch(batch, taskType)));
      }
      return vectors;
    },
    async embedQuery(text) {
      const [vector] = await embedBatch([text], taskType);
      return vector;
    },
  };
}
