import * as documentService from '../services/document.service.js';

export async function listDocuments(req, res) {
  res.json(await documentService.listDocuments(req.user.tenantId, req.query));
}

export async function uploadDocument(req, res) {
  const document = await documentService.createDocument(req.user.tenantId, req.user.id, req.file);
  res.status(202).json({ document });
}

export async function getDocument(req, res) {
  const document = await documentService.getDocument(req.user.tenantId, req.params.id);
  res.json({ document });
}

export async function deleteDocument(req, res) {
  await documentService.deleteDocument(req.user.tenantId, req.params.id);
  res.status(204).end();
}
