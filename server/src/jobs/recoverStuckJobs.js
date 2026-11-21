import { failStuckDocuments } from '../services/document.service.js';

const STUCK_AFTER_MS = 10 * 60 * 1000;

export async function recoverStuckJobs() {
  try {
    const failedCount = await failStuckDocuments(new Date(Date.now() - STUCK_AFTER_MS));
    if (failedCount > 0) console.log(`Marked ${failedCount} stuck document(s) as failed`);
  } catch (err) {
    console.error('Could not recover stuck ingestion jobs:', err);
  }
}
