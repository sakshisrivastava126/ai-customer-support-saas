import * as conversationService from '../services/conversation.service.js';

export async function listConversations(req, res) {
  res.json(await conversationService.listConversations(req.user.tenantId, req.query));
}

export async function listUnansweredQuestions(req, res) {
  res.json(await conversationService.listUnansweredQuestions(req.user.tenantId, req.query));
}

export async function getConversation(req, res) {
  res.json(await conversationService.getTranscript(req.user.tenantId, req.params.id));
}
