import { env } from "@core";
import crypto from "crypto";

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

    console.log(`[WebhookService] Sending webhook to ${url}`);

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

    console.log(`[WebhookService] Webhook sent successfully for job_run ${payload.job_run_id}`);
  }

  private static generateSignature(payload: string): string {
    return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
  }
}
