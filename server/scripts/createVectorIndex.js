import { setTimeout as sleep } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Chunk } from '../src/models/Chunk.js';

const SEARCH_INDEX_TYPE = 'vectorSearch';
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000;
const DEFAULT_QUANTIZATION = 'none';
const COMPARED_FIELD_KEYS = ['type', 'path', 'numDimensions', 'similarity', 'quantization'];

const desiredDefinition = {
  fields: [
    {
      type: 'vector',
      path: 'embedding',
      numDimensions: config.embeddingDimensions,
      similarity: 'cosine',
    },
    { type: 'filter', path: 'tenantId' },
    { type: 'filter', path: 'documentId' },
  ],
};

function isComparedEntry([key, value]) {
  return COMPARED_FIELD_KEYS.includes(key) && !(key === 'quantization' && value === DEFAULT_QUANTIZATION);
}

function canonicalFields(definition) {
  return (definition?.fields ?? [])
    .map((field) => Object.fromEntries(Object.entries(field).filter(isComparedEntry)))
    .sort((a, b) => `${a.type}:${a.path}`.localeCompare(`${b.type}:${b.path}`));
}

function hasSameDefinition(index) {
  return (
    index.type === SEARCH_INDEX_TYPE &&
    isDeepStrictEqual(canonicalFields(index.latestDefinition), canonicalFields(desiredDefinition))
  );
}

async function findIndex(collection) {
  const [index] = await collection.listSearchIndexes(config.vectorIndexName).toArray();
  return index;
}

function describe(index) {
  return `status=${index.status} queryable=${index.queryable}`;
}

async function waitUntilQueryable(collection) {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const index = await findIndex(collection);
    if (index?.queryable) return index;
    if (index?.status === 'FAILED') throw new Error(`Index build failed: ${describe(index)}`);
    console.log(`Waiting for "${config.vectorIndexName}": ${index ? describe(index) : 'not listed yet'}`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Index "${config.vectorIndexName}" was not queryable after ${MAX_WAIT_MS / 1000}s`);
}

async function run() {
  await Chunk.init();
  const collection = Chunk.collection;
  const existing = await findIndex(collection);

  if (existing && !hasSameDefinition(existing)) {
    console.error(`Index "${config.vectorIndexName}" already exists with a different definition.`);
    console.error('Existing:', JSON.stringify({ type: existing.type, ...existing.latestDefinition }));
    console.error('Expected:', JSON.stringify({ type: SEARCH_INDEX_TYPE, ...desiredDefinition }));
    console.error(
      'Nothing was changed. Delete the old index in the Atlas UI (and re-ingest documents if EMBEDDING_DIMENSIONS changed), or set a different VECTOR_INDEX_NAME, then run this again.',
    );
    process.exitCode = 1;
    return;
  }

  if (existing) {
    console.log(`Index "${config.vectorIndexName}" already exists with the expected definition (${describe(existing)}).`);
    if (existing.queryable) return;
  } else {
    console.log(`Creating index "${config.vectorIndexName}" on "${collection.collectionName}"...`);
    await collection.createSearchIndex({
      name: config.vectorIndexName,
      type: SEARCH_INDEX_TYPE,
      definition: desiredDefinition,
    });
  }

  const ready = await waitUntilQueryable(collection);
  console.log(`Index "${config.vectorIndexName}" is ready: ${describe(ready)}`);
}

await connectDB();
try {
  await run();
} catch (err) {
  console.error(`Failed to set up the vector index: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
