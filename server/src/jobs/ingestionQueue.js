import { runIngestionJob } from '../services/ingestion.service.js';

const CONCURRENCY = 2;

const pendingJobs = [];
let activeJobs = 0;

function startNextJobs() {
  while (activeJobs < CONCURRENCY && pendingJobs.length > 0) {
    const job = pendingJobs.shift();
    activeJobs += 1;
    runIngestionJob(job)
      .catch((err) => console.error(`Unexpected ingestion queue error for document ${job.documentId}:`, err))
      .finally(() => {
        activeJobs -= 1;
        startNextJobs();
      });
  }
}

export function enqueue(job) {
  pendingJobs.push(job);
  setImmediate(startNextJobs);
}
