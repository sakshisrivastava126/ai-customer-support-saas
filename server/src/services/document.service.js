import { config } from '../config/env.js';
import { Document } from '../models/Document.js';
import { enqueue } from '../jobs/ingestionQueue.js';
import { AppError } from '../utils/AppError.js';
import { deleteDocumentChunks } from './vectorStore.service.js';

const INTERRUPTED_MESSAGE = 'Processing was interrupted. Please upload the file again.';

export function toPublicDocument(document) {
  return {
    id: String(document._id),
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    error: document.error ?? null,
    pageCount: document.pageCount,
    chunkCount: document.chunkCount,
    uploadedBy: String(document.uploadedBy),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function documentNotFoundError() {
  return new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
}

export async function listDocuments(tenantId, { page, limit, status }) {
  const filter = { tenantId };
  if (status) filter.status = status;
  const [documents, total] = await Promise.all([
    Document.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Document.countDocuments(filter),
  ]);
  return { items: documents.map(toPublicDocument), page, limit, total };
}

export async function createDocument(tenantId, uploadedBy, file) {
  const existingCount = await Document.countDocuments({ tenantId });
  if (existingCount >= config.maxDocsPerTenant) {
    throw new AppError(
      409,
      'DOCUMENT_LIMIT_REACHED',
      `This workspace already has the maximum of ${config.maxDocsPerTenant} documents. Delete one to upload another.`,
    );
  }

  const document = await Document.create({
    tenantId,
    uploadedBy,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });

  enqueue({
    documentId: document._id,
    tenantId: document.tenantId,
    buffer: file.buffer,
    mimeType: document.mimeType,
    documentName: document.originalName,
  });

  return toPublicDocument(document);
}

export async function getDocument(tenantId, documentId) {
  const document = await Document.findOne({ _id: documentId, tenantId }).lean();
  if (!document) throw documentNotFoundError();
  return toPublicDocument(document);
}

export async function deleteDocument(tenantId, documentId) {
  const document = await Document.findOneAndDelete({ _id: documentId, tenantId });
  if (!document) throw documentNotFoundError();
  await deleteDocumentChunks(tenantId, documentId);
}

export async function failStuckDocuments(processingBefore) {
  const stuckDocuments = await Document.find({ status: 'processing', updatedAt: { $lt: processingBefore } })
    .select('_id tenantId')
    .lean();

  let failedCount = 0;
  for (const { _id: documentId, tenantId } of stuckDocuments) {
    const { modifiedCount } = await Document.updateOne(
      { _id: documentId, tenantId, status: 'processing', updatedAt: { $lt: processingBefore } },
      { $set: { status: 'failed', error: INTERRUPTED_MESSAGE } },
    );
    if (modifiedCount === 0) continue;
    await deleteDocumentChunks(tenantId, documentId);
    failedCount += 1;
  }
  return failedCount;
}
