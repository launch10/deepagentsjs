import { FileExporter } from "../core/fileExporter";
import { WebsiteRunner } from "../core/websiteRunner";
import { BrowserErrorCapture } from "./browserErrorCapture";
import type { ConsoleError } from "@types";
export class ErrorExporter implements AsyncDisposable {
  private websiteId: number;
  private runner?: WebsiteRunner;
  private errorCapture?: BrowserErrorCapture;
  private exporter?: FileExporter;

  constructor(websiteId: number) {
    this.websiteId = websiteId;
  }

  async run(): Promise<ConsoleError[]> {
    this.exporter = new FileExporter(this.websiteId);
    const outputDir = await this.exporter.export();
    
    this.runner = new WebsiteRunner(outputDir);
    await this.runner.install();
    await this.runner.start();
    const consoleErrors = await this.captureErrors();
    await this.stop();

    return consoleErrors;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    return await this.stop();
  }

  private async stop(): Promise<void> {
    // Stop error capture first if it exists
    if (this.errorCapture) {
      await this.errorCapture.stop();
    }
    
    // Stop the dev server
    if (this.runner) {
      await this.runner.stop();
    }
    
    // Clean up temporary directory
    if (this.exporter) {
      await this.exporter[Symbol.asyncDispose]();
    }
  }

  private async captureErrors(): Promise<ConsoleError[]> {
    if (!this.runner) {
      throw new Error('ErrorExporter must be run() before capturing errors');
    }
    
    this.errorCapture = new BrowserErrorCapture(this.runner.getUrl());
    
    // Start browser and load the page - this will wait for initial load and capture any errors
    await this.errorCapture.start();
    
    // The page has loaded and initial errors have been captured
    // No need to wait for more errors - we just want to check if the page loads successfully
    return this.errorCapture.getErrors();
  }
}