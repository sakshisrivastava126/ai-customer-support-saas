import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';

const TITLE_MAX_LENGTH = 80;
const ROLE_USER = 'user';
const ROLE_ASSISTANT = 'assistant';
const MESSAGE_INCREMENT = 1;

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
