import { StringOutputParser } from '@langchain/core/output_parsers';
import { config } from '../config/env.js';
import { EMBEDDING_TASK_TYPES, getChatModel, getEmbeddings } from '../ai/provider.js';
import { ANSWER_PROMPT, REWRITE_PROMPT, formatFallbackText } from '../ai/prompts.js';
import * as conversationService from './conversation.service.js';
import { searchChunks } from './vectorStore.service.js';

const REWRITE_TEMPERATURE = 0;
const ANSWER_TEMPERATURE = 0.2;
const PROMPT_DELIMITER_TAG_PATTERN = /<\s*\/?\s*(context|history)\s*>/gi;
const NON_WHITESPACE_PATTERN = /\S/;
const ANSWER_LEADING_DECORATION_PATTERN = /^[\s"'“”‘’*_>]+/;
const CURLY_APOSTROPHE_PATTERN = /[‘’]/g;
const DONT_KNOW_PREFIX = "i don't know";
const HISTORY_ROLE_LABELS = Object.freeze({ user: 'User', assistant: 'Assistant' });

const queryEmbeddings = getEmbeddings({ taskType: EMBEDDING_TASK_TYPES.QUERY });
const outputParser = new StringOutputParser();

export function stripPromptDelimiters(text) {
  return text.replace(PROMPT_DELIMITER_TAG_PATTERN, '');
}

function formatHistory(history) {
  return history
    .map(({ role, content }) => `${HISTORY_ROLE_LABELS[role]}: ${stripPromptDelimiters(content)}`)
    .join('\n');
}

export async function rewriteQuery({ history, question, signal }) {
  if (history.length === 0) return question;

  const chain = REWRITE_PROMPT.pipe(getChatModel({ temperature: REWRITE_TEMPERATURE })).pipe(outputParser);
  const rewritten = await chain.invoke(
    { history: formatHistory(history), question: stripPromptDelimiters(question) },
    { signal },
  );
  return rewritten.trim() || question;
}

export async function retrieve({ tenantId, query }) {
  const embedding = await queryEmbeddings.embedQuery(query);
  const chunks = await searchChunks({ tenantId, embedding, k: config.ragTopK });
  return chunks
    .filter((chunk) => chunk.score >= config.ragSimilarityThreshold)
    .map((chunk, index) => ({ ...chunk, n: index + 1 }));
}

export function buildContext(chunks) {
  return chunks
    .map(
      (chunk) =>
        `[${chunk.n}] (source: ${stripPromptDelimiters(chunk.documentName)}, page ${chunk.page})\n${stripPromptDelimiters(chunk.text)}`,
    )
    .join('\n\n');
}

export async function* streamAnswer({ tenant, standaloneQuestion, context, signal }) {
  const chain = ANSWER_PROMPT.pipe(
    getChatModel({ temperature: ANSWER_TEMPERATURE, streaming: true }),
  ).pipe(outputParser);
  const stream = await chain.stream(
    {
      botName: tenant.settings.botName,
      tenantName: tenant.name,
      context,
      standaloneQuestion: stripPromptDelimiters(standaloneQuestion),
    },
    { signal },
  );
  for await (const text of stream) {
    if (text) yield text;
  }
}

function isDontKnowAnswer(answer) {
  return answer
    .replace(ANSWER_LEADING_DECORATION_PATTERN, '')
    .replace(CURLY_APOSTROPHE_PATTERN, "'")
    .toLowerCase()
    .startsWith(DONT_KNOW_PREFIX);
}

function toStoredSource(chunk) {
  return {
    n: chunk.n,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    page: chunk.page,
    score: chunk.score,
  };
}

function toPublicSource(chunk) {
  return { n: chunk.n, documentName: chunk.documentName, page: chunk.page };
}

function event(name, data) {
  return { event: name, data };
}

export async function* streamChatReply(tenant, { message, conversationId, visitorId }, { signal } = {}) {
  const startedAt = Date.now();
  const tenantId = tenant._id;

  const conversation = await conversationService.getOrCreateConversation(tenantId, {
    conversationId,
    visitorId,
    firstMessage: message,
  });
  const userMessage = await conversationService.saveUserMessage(tenantId, conversation._id, message);
  const assistantMessageId = conversationService.newMessageId();

  yield event('meta', {
    conversationId: String(conversation._id),
    messageId: String(assistantMessageId),
  });

  const history = await conversationService.getHistoryBefore(tenantId, conversation._id, {
    excludeMessageId: userMessage._id,
    limit: config.ragHistoryMessages,
  });
  const standaloneQuestion = await rewriteQuery({ history, question: message, signal });
  const chunks = await retrieve({ tenantId, query: standaloneQuestion });

  const fallbackText = formatFallbackText(tenant.name);
  let answer = '';

  if (chunks.length > 0) {
    let streamedVisibleText = false;
    for await (const text of streamAnswer({
      tenant,
      standaloneQuestion,
      context: buildContext(chunks),
      signal,
    })) {
      answer += text;
      if (streamedVisibleText) {
        yield event('token', { text });
      } else if (NON_WHITESPACE_PATTERN.test(answer)) {
        streamedVisibleText = true;
        yield event('token', { text: answer.trimStart() });
      }
    }
    answer = answer.trim();
  }

  const usedFallback = answer === '';
  if (usedFallback) {
    answer = fallbackText;
    yield event('token', { text: answer });
  }
  const answered = !usedFallback && !isDontKnowAnswer(answer);

  await conversationService.saveAssistantMessage(tenantId, conversation._id, {
    messageId: assistantMessageId,
    content: answer,
    query: message,
    rewrittenQuery: standaloneQuestion,
    sources: chunks.map(toStoredSource),
    answered,
    latencyMs: Date.now() - startedAt,
  });

  yield event('sources', { sources: answered ? chunks.map(toPublicSource) : [] });
  yield event('done', { answered });
}
