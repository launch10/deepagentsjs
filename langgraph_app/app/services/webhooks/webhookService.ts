import { env, getLogger } from "@core";
import crypto from "crypto";

const log = getLogger({ component: "WebhookService" });

export interface WebhookPayload {
  job_run_id: number;
  document_id: number;
  status: "success" | "failure";
  result?: {
    pairs?: Array<{
      question: string;
      answer: string;
      section?: string;
    }>;
    error?: string;
  };
}

export class WebhookService {
  private static readonly WEBHOOK_PATH = "/webhooks/document_extraction";

  static async sendWebhook(payload: WebhookPayload): Promise<void> {
    const url = `${env.RAILS_API_URL}${this.WEBHOOK_PATH}`;
    const body = JSON.stringify(payload);
    const signature = this.generateSignature(body);

    log.info({ url }, "Sending webhook");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${text}`);
    }

    log.info({ jobRunId: payload.job_run_id }, "Webhook sent successfully");
  }

  private static generateSignature(payload: string): string {
    return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
  }
}
