import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { EMBEDDING_TASK_TYPES, getEmbeddings } from '../ai/provider.js';
import { Document } from '../models/Document.js';
import { deleteDocumentChunks, insertChunks } from './vectorStore.service.js';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const MIN_CHUNK_NON_WHITESPACE_CHARS = 30;
const EMBEDDING_BATCH_SIZE = 50;
const TXT_PAGE_NUMBER = 1;
const PDF_MIME_TYPE = 'application/pdf';
const BYTE_ORDER_MARK = /^﻿/;
const WHITESPACE = /\s/g;
const OUTCOME_READY = 'ready';
const OUTCOME_SKIPPED = 'skipped';

const NO_TEXT_MESSAGE = 'No extractable text. Scanned PDFs are not supported.';
const UNREADABLE_PDF_MESSAGE = 'Could not read this PDF. It may be damaged or password-protected.';
const EMBEDDING_FAILED_MESSAGE = 'Could not process the text right now. Please upload the file again later.';
const GENERIC_FAILURE_MESSAGE = 'Processing failed. Please upload the file again.';

class IngestionError extends Error {
  constructor(userMessage, options) {
    super(userMessage, options);
    this.name = 'IngestionError';
    this.userMessage = userMessage;
  }
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

async function loadPdfPages(buffer) {
  let pageDocuments;
  try {
    pageDocuments = await new PDFLoader(new Blob([buffer]), { splitPages: true }).load();
  } catch (err) {
    throw new IngestionError(UNREADABLE_PDF_MESSAGE, { cause: err });
  }
  return {
    pages: pageDocuments.map((pageDocument) => ({
      text: pageDocument.pageContent,
      page: pageDocument.metadata.loc.pageNumber,
    })),
    pageCount: pageDocuments[0]?.metadata.pdf?.totalPages ?? 0,
  };
}

function loadTextPages(buffer) {
  const text = buffer.toString('utf8').replace(BYTE_ORDER_MARK, '');
  return { pages: [{ text, page: TXT_PAGE_NUMBER }], pageCount: TXT_PAGE_NUMBER };
}

function loadPages(buffer, mimeType) {
  return mimeType === PDF_MIME_TYPE ? loadPdfPages(buffer) : loadTextPages(buffer);
}

function hasEnoughText(text) {
  return text.replace(WHITESPACE, '').length >= MIN_CHUNK_NON_WHITESPACE_CHARS;
}

async function splitPages(pages) {
  const chunks = [];
  for (const { text, page } of pages) {
    const pieces = await splitter.splitText(text);
    for (const piece of pieces.filter(hasEnoughText)) chunks.push({ text: piece, page });
  }
  return chunks;
}

async function embedChunkTexts(texts) {
  const embeddings = getEmbeddings({ taskType: EMBEDDING_TASK_TYPES.DOCUMENT });
  const vectors = [];
  try {
    for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
      vectors.push(...(await embeddings.embedDocuments(texts.slice(start, start + EMBEDDING_BATCH_SIZE))));
    }
  } catch (err) {
    throw new IngestionError(EMBEDDING_FAILED_MESSAGE, { cause: err });
  }
  return vectors;
}

function isStillProcessing(tenantId, documentId) {
  return Document.exists({ _id: documentId, tenantId, status: 'processing' });
}

async function ingestDocument({ documentId, tenantId, buffer, mimeType, documentName }) {
  if (!(await isStillProcessing(tenantId, documentId))) return OUTCOME_SKIPPED;

  const { pages, pageCount } = await loadPages(buffer, mimeType);
  const chunks = await splitPages(pages);
  if (chunks.length === 0) throw new IngestionError(NO_TEXT_MESSAGE);

  const vectors = await embedChunkTexts(chunks.map((chunk) => chunk.text));

  if (!(await isStillProcessing(tenantId, documentId))) return OUTCOME_SKIPPED;

  const chunkCount = await insertChunks(
    chunks.map((chunk, chunkIndex) => ({
      tenantId,
      documentId,
      text: chunk.text,
      embedding: vectors[chunkIndex],
      page: chunk.page,
      chunkIndex,
      documentName,
    })),
  );

  const { matchedCount } = await Document.updateOne(
    { _id: documentId, tenantId, status: 'processing' },
    { $set: { status: 'ready', pageCount, chunkCount }, $unset: { error: 1 } },
  );
  if (matchedCount === 0) {
    await deleteDocumentChunks(tenantId, documentId);
    return OUTCOME_SKIPPED;
  }
  return OUTCOME_READY;
}

async function markFailed({ documentId, tenantId }, err) {
  await deleteDocumentChunks(tenantId, documentId);
  await Document.updateOne(
    { _id: documentId, tenantId, status: 'processing' },
    { $set: { status: 'failed', error: err instanceof IngestionError ? err.userMessage : GENERIC_FAILURE_MESSAGE } },
  );
}

export async function runIngestionJob(job) {
  try {
    const outcome = await ingestDocument(job);
    if (outcome === OUTCOME_SKIPPED) {
      console.log(`Ingestion skipped for document ${job.documentId}: deleted or no longer processing`);
    }
  } catch (err) {
    console.error(`Ingestion failed for document ${job.documentId}:`, err);
    try {
      await markFailed(job, err);
    } catch (cleanupErr) {
      console.error(`Could not mark document ${job.documentId} as failed:`, cleanupErr);
    }
  }
}
