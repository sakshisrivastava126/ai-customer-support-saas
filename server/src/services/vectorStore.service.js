import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Chunk } from '../models/Chunk.js';

const EMBEDDING_PATH = 'embedding';

function toObjectId(value, name) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new Error(`${name} is required and must be a valid ObjectId`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

export async function insertChunks(chunks) {
  if (chunks.length === 0) return 0;
  const inserted = await Chunk.insertMany(chunks, { ordered: true });
  return inserted.length;
}

export async function deleteDocumentChunks(tenantId, documentId) {
  const result = await Chunk.deleteMany({
    tenantId: toObjectId(tenantId, 'tenantId'),
    documentId: toObjectId(documentId, 'documentId'),
  });
  return result.deletedCount;
}

export async function searchChunks({ tenantId, embedding, k = config.ragTopK }) {
  const tenantObjectId = toObjectId(tenantId, 'tenantId');
  if (!Array.isArray(embedding) || embedding.length !== config.embeddingDimensions) {
    throw new Error(`embedding must be an array of ${config.embeddingDimensions} numbers`);
  }
  if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer');

  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: config.vectorIndexName,
        path: EMBEDDING_PATH,
        queryVector: embedding,
        numCandidates: Math.max(config.ragNumCandidates, k),
        limit: k,
        filter: { tenantId: tenantObjectId },
      },
    },
    {
      $project: {
        _id: 0,
        text: 1,
        documentId: 1,
        documentName: 1,
        page: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);

  return results.map((result) => ({
    text: result.text,
    documentId: String(result.documentId),
    documentName: result.documentName,
    page: result.page,
    score: result.score,
  }));
}
