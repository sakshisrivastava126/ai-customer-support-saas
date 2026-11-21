import * as conversationService from '../services/conversation.service.js';
import * as ragService from '../services/rag.service.js';
import { AppError } from '../utils/AppError.js';
import { endSSE, initSSE, isSSEOpen, sendEvent } from '../utils/sse.js';

const STREAM_ERROR_CODE = 'INTERNAL_ERROR';
const STREAM_ERROR_MESSAGE = 'Something went wrong while answering. Please try again.';

function toStreamError(err) {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: STREAM_ERROR_CODE, message: STREAM_ERROR_MESSAGE };
}

export async function streamChat(req, res) {
  const abortController = new AbortController();
  res.on('close', () => abortController.abort());

  const events = ragService.streamChatReply(req.tenant, req.body, { signal: abortController.signal });
  const first = await events.next();

  initSSE(res);
  if (!first.done) sendEvent(res, first.value.event, first.value.data);

  try {
    for await (const { event, data } of events) {
      if (!isSSEOpen(res)) break;
      sendEvent(res, event, data);
    }
  } catch (err) {
    if (isSSEOpen(res)) {
      if (!(err instanceof AppError)) console.error(err);
      sendEvent(res, 'error', toStreamError(err));
    }
  } finally {
    endSSE(res);
  }
}

export async function submitFeedback(req, res) {
  await conversationService.recordFeedback(req.tenant._id, req.body);
  res.json({ ok: true });
}
