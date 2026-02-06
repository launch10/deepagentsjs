import { Queue } from "bullmq";
import { getLogger } from "@core";
import { queueConnection } from "./connection";

const log = getLogger({ component: "DocumentExtractionQueue" });

export interface DocumentExtractionJobData {
  job_run_id: number;
  document_id: number;
  content: string;
  metadata: {
    title?: string;
    [key: string]: unknown;
  };
}

export const documentExtractionQueue = new Queue<DocumentExtractionJobData>("document-extraction", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

documentExtractionQueue.on("error", (error) => {
  log.error({ err: error }, "Queue error");
});
