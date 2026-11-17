import mongoose from 'mongoose';

const DOCUMENT_MIME_TYPES = ['application/pdf', 'text/plain'];
const DOCUMENT_STATUSES = ['processing', 'ready', 'failed'];
const DEFAULT_DOCUMENT_STATUS = 'processing';
const MAX_ORIGINAL_NAME_LENGTH = 255;
const MAX_ERROR_LENGTH = 500;

const documentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true, maxlength: MAX_ORIGINAL_NAME_LENGTH },
    mimeType: { type: String, enum: DOCUMENT_MIME_TYPES, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: DOCUMENT_STATUSES, default: DEFAULT_DOCUMENT_STATUS },
    error: { type: String, maxlength: MAX_ERROR_LENGTH },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

documentSchema.index({ tenantId: 1, createdAt: -1 });
documentSchema.index({ status: 1, updatedAt: 1 });

export const Document = mongoose.model('Document', documentSchema);
