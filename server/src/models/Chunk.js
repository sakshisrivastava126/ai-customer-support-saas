import mongoose from 'mongoose';
import { config } from '../config/env.js';

const CHUNKS_COLLECTION = 'chunks';

function hasExpectedEmbeddingDimensions(embedding) {
  return (
    Array.isArray(embedding) &&
    embedding.length === config.embeddingDimensions &&
    embedding.every(Number.isFinite)
  );
}

const chunkSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      required: true,
      default: undefined,
      validate: {
        validator: hasExpectedEmbeddingDimensions,
        message: (props) =>
          `embedding must be an array of ${config.embeddingDimensions} finite numbers, got length ${props.value?.length ?? 0}`,
      },
    },
    page: { type: Number, required: true },
    chunkIndex: { type: Number, required: true },
    documentName: { type: String, required: true },
  },
  { timestamps: true, collection: CHUNKS_COLLECTION },
);

chunkSchema.index({ tenantId: 1, documentId: 1 });

export const Chunk = mongoose.model('Chunk', chunkSchema);
