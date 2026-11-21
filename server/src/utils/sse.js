const PING_INTERVAL_MS = 15_000;
const PING_COMMENT = ': ping\n\n';

const pingTimers = new WeakMap();

function stopPing(res) {
  clearInterval(pingTimers.get(res));
  pingTimers.delete(res);
}

export function isSSEOpen(res) {
  return !res.writableEnded && !res.destroyed;
}

export function initSSE(res) {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const timer = setInterval(() => {
    if (isSSEOpen(res)) res.write(PING_COMMENT);
  }, PING_INTERVAL_MS);
  pingTimers.set(res, timer);
  res.on('close', () => stopPing(res));
}

export function sendEvent(res, event, data) {
  if (!isSSEOpen(res)) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function endSSE(res) {
  stopPing(res);
  if (isSSEOpen(res)) res.end();
}
