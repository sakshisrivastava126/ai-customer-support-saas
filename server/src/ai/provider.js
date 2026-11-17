import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { config } from '../config/env.js';

const CHAT_MAX_RETRIES = 3;
const EMBEDDING_MAX_RETRIES = 5;
const SERVER_RETRY_DELAY_CAP_MS = 60_000;
const MS_PER_SECOND = 1000;
const NANOS_PER_SECOND = 1e9;
const RETRY_INFO_TYPE_SUFFIX = 'google.rpc.RetryInfo';
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

function readHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find((header) => header.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function retryAfterHeaderMs(err) {
  const value = readHeader(err?.headers ?? err?.response?.headers, 'retry-after');
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * MS_PER_SECOND;
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? undefined : retryAt - Date.now();
}

function durationToMs(duration) {
  if (typeof duration === 'string') {
    const seconds = Number.parseFloat(duration);
    return duration.trim().endsWith('s') && Number.isFinite(seconds)
      ? seconds * MS_PER_SECOND
      : undefined;
  }
  if (duration && typeof duration === 'object') {
    const seconds = Number(duration.seconds ?? 0) + Number(duration.nanos ?? 0) / NANOS_PER_SECOND;
    return Number.isFinite(seconds) ? seconds * MS_PER_SECOND : undefined;
  }
  return undefined;
}

function parseErrorBody(err) {
  try {
    return JSON.parse(err?.message);
  } catch {
    return undefined;
  }
}

function retryInfoDelayMs(err) {
  const details = parseErrorBody(err)?.error?.details;
  if (!Array.isArray(details)) return undefined;
  const retryInfo = details.find((detail) => detail?.['@type']?.endsWith(RETRY_INFO_TYPE_SUFFIX));
  return durationToMs(retryInfo?.retryDelay);
}

function serverSuggestedDelayMs(err) {
  const delayMs = retryAfterHeaderMs(err) ?? retryInfoDelayMs(err);
  if (delayMs === undefined) return undefined;
  return Math.min(Math.max(delayMs, 0), SERVER_RETRY_DELAY_CAP_MS);
}

function embeddingRetryDelayMs(err, attempt) {
  return serverSuggestedDelayMs(err) ?? backoffDelayMs(attempt);
}

async function withRetries(operation, { maxRetries, delayMs }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryableError(err)) throw err;
      await sleep(delayMs(err, attempt));
    }
  }
}

export function getChatModel({ temperature, streaming = false }) {
  return new ChatGoogleGenerativeAI({
    apiKey: config.googleApiKey,
    model: config.llmModel,
    temperature,
    streaming,
    maxRetries: CHAT_MAX_RETRIES,
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
  const response = await withRetries(
    () =>
      genAI.models.embedContent({
        model: config.embeddingModel,
        contents: texts,
        config: { taskType, outputDimensionality: config.embeddingDimensions },
      }),
    { maxRetries: EMBEDDING_MAX_RETRIES, delayMs: embeddingRetryDelayMs },
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
