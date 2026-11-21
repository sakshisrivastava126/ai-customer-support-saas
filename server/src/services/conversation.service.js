import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';

const TITLE_MAX_LENGTH = 80;
const ROLE_USER = 'user';
const ROLE_ASSISTANT = 'assistant';
const MESSAGE_INCREMENT = 1;

function idOrNull(value) {
  return value ? String(value) : null;
}

export function toPublicConversation(conversation) {
  return {
    id: String(conversation._id),
    visitorId: conversation.visitorId,
    title: conversation.title ?? null,
    messageCount: conversation.messageCount,
    unansweredCount: conversation.unansweredCount,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function toPublicSource(source) {
  return {
    n: source.n,
    documentId: idOrNull(source.documentId),
    documentName: source.documentName,
    page: source.page,
    score: source.score,
  };
}

export function toTranscriptMessage(message) {
  const base = {
    id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
  if (message.role !== ROLE_ASSISTANT) return base;
  return {
    ...base,
    query: message.query ?? null,
    rewrittenQuery: message.rewrittenQuery ?? null,
    sources: (message.sources ?? []).map(toPublicSource),
    answered: message.answered ?? null,
    feedback: message.feedback ?? null,
    feedbackAt: message.feedbackAt ?? null,
    latencyMs: message.latencyMs ?? null,
  };
}

function toUnansweredQuestion(message) {
  return {
    messageId: String(message._id),
    conversationId: String(message.conversationId),
    query: message.query ?? null,
    rewrittenQuery: message.rewrittenQuery ?? null,
    createdAt: message.createdAt,
  };
}

function conversationNotFoundError() {
  return new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
}

function messageNotFoundError() {
  return new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found');
}

function toTitle(message) {
  return Array.from(message).slice(0, TITLE_MAX_LENGTH).join('');
}

export function newMessageId() {
  return new mongoose.Types.ObjectId();
}

export async function getOrCreateConversation(tenantId, { conversationId, visitorId, firstMessage }) {
  if (conversationId) {
    const conversation = await Conversation.findOne({ _id: conversationId, tenantId, visitorId }).lean();
    if (!conversation) throw conversationNotFoundError();
    return conversation;
  }
  const conversation = await Conversation.create({ tenantId, visitorId, title: toTitle(firstMessage) });
  return conversation.toObject();
}

async function recordMessageOnConversation(tenantId, conversationId, { unanswered = false } = {}) {
  await Conversation.updateOne(
    { _id: conversationId, tenantId },
    {
      $inc: { messageCount: MESSAGE_INCREMENT, unansweredCount: unanswered ? MESSAGE_INCREMENT : 0 },
      $set: { lastMessageAt: new Date() },
    },
  );
}

export async function saveUserMessage(tenantId, conversationId, content) {
  const message = await Message.create({ tenantId, conversationId, role: ROLE_USER, content });
  await recordMessageOnConversation(tenantId, conversationId);
  return message.toObject();
}

export async function saveAssistantMessage(
  tenantId,
  conversationId,
  { messageId, content, query, rewrittenQuery, sources, answered, latencyMs },
) {
  const message = await Message.create({
    _id: messageId,
    tenantId,
    conversationId,
    role: ROLE_ASSISTANT,
    content,
    query,
    rewrittenQuery,
    sources,
    answered,
    latencyMs,
  });
  await recordMessageOnConversation(tenantId, conversationId, { unanswered: !answered });
  return message.toObject();
}

export async function getHistoryBefore(tenantId, conversationId, { excludeMessageId, limit }) {
  const messages = await Message.find({ tenantId, conversationId, _id: { $ne: excludeMessageId } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select('role content')
    .lean();
  return messages.reverse().map(({ role, content }) => ({ role, content }));
}

export async function recordFeedback(tenantId, { messageId, visitorId, rating }) {
  const message = await Message.findOne({ _id: messageId, tenantId, role: ROLE_ASSISTANT })
    .select('conversationId')
    .lean();
  if (!message) throw messageNotFoundError();

  const ownsConversation = await Conversation.exists({ _id: message.conversationId, tenantId, visitorId });
  if (!ownsConversation) throw messageNotFoundError();

  await Message.updateOne(
    { _id: messageId, tenantId, role: ROLE_ASSISTANT },
    { $set: { feedback: rating, feedbackAt: new Date() } },
  );
}

export async function listConversations(tenantId, { page, limit, unansweredOnly }) {
  const filter = { tenantId };
  if (unansweredOnly) filter.unansweredCount = { $gt: 0 };
  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);
  return { items: conversations.map(toPublicConversation), page, limit, total };
}

export async function listUnansweredQuestions(tenantId, { page, limit }) {
  const filter = { tenantId, answered: false, role: ROLE_ASSISTANT };
  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('conversationId query rewrittenQuery createdAt')
      .lean(),
    Message.countDocuments(filter),
  ]);
  return { items: messages.map(toUnansweredQuestion), page, limit, total };
}

export async function getTranscript(tenantId, conversationId) {
  const conversation = await Conversation.findOne({ _id: conversationId, tenantId }).lean();
  if (!conversation) throw conversationNotFoundError();
  const messages = await Message.find({ tenantId, conversationId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return { conversation: toPublicConversation(conversation), messages: messages.map(toTranscriptMessage) };
}
