import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import waitOn from "wait-on";

/**
 * Runs a website in an isolated directory
 */
export class WebsiteRunner implements AsyncDisposable {
  private projectDir: string;
  private devServerProcess: ChildProcess | null = null;
  private port: number;
  private serverUrl: string;

  constructor(projectDir: string, port: number = 0) {
    this.projectDir = projectDir;
    this.port = port;
    this.serverUrl = `http://localhost:${port}`;
  }

  /**
   * Install dependencies using pnpm
   */
  async install(): Promise<void> {
    console.log(`Installing dependencies in ${this.projectDir}`);

    // Check if package.json exists
    const packageJsonPath = join(this.projectDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in ${this.projectDir}`);
    }

    return new Promise((resolve, reject) => {
      const installProcess = spawn("pnpm", ["install"], {
        cwd: this.projectDir,
        stdio: "inherit",
        env: { ...process.env, CI: "true" },
      });

      installProcess.on("close", (code) => {
        if (code === 0) {
          console.log("  ✓ Dependencies installed");
          resolve();
        } else {
          reject(new Error(`pnpm install failed with code ${code}`));
        }
      });

      installProcess.on("error", (error) => {
        reject(new Error(`Failed to run pnpm install: ${error.message}`));
      });
    });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    return await this.stop();
  }

  /**
   * Start the dev server
   */
  async start(): Promise<void> {
    console.log(`Starting dev server on port ${this.port}`);

    return new Promise((resolve, reject) => {
      this.devServerProcess = spawn("pnpm", ["dev"], {
        cwd: this.projectDir,
        env: {
          ...process.env,
          PORT: this.port.toString(),
          VITE_PORT: this.port.toString(),
          BROWSER: "none", // Don't auto-open browser
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32", // Create new process group on Unix
      });

      let serverStarted = false;
      let errorOutput = "";

      // Capture stdout to detect when server is ready
      this.devServerProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        console.log(`  Server: ${output.trim()}`);

        // Look for the actual port being used
        const portMatch = output.match(/Local:\s+https?:\/\/localhost:(\d+)/);
        if (portMatch) {
          this.port = parseInt(portMatch[1], 10);
          this.serverUrl = `http://localhost:${this.port}`;
        }

        // Look for signs the server is ready
        if (output.includes("Local:") || output.includes("ready in")) {
          serverStarted = true;
        }
      });

      // Capture stderr for errors
      this.devServerProcess.stderr?.on("data", (data) => {
        errorOutput += data.toString();
        console.error(`  Server Error: ${data.toString().trim()}`);
      });

      this.devServerProcess.on("error", (error) => {
        reject(new Error(`Failed to start dev server: ${error.message}`));
      });

      // Wait for the server to be ready
      setTimeout(async () => {
        try {
          await this.waitForServer();
          console.log(`  ✓ Dev server running at ${this.serverUrl}`);
          resolve();
        } catch (error) {
          this.stop();
          reject(new Error(`Server failed to start: ${errorOutput || error}`));
        }
      }, 2000); // Give server time to start
    });
  }

  /**
   * Wait for the server to be ready
   */
  private async waitForServer(): Promise<void> {
    const opts = {
      resources: [this.serverUrl],
      delay: 1000,
      interval: 100,
      timeout: 30000,
      validateStatus: (status: number) => status >= 200 && status < 600,
    };

    await waitOn(opts);
  }

  /**
   * Stop the dev server
   */
  async stop(): Promise<void> {
    if (!this.devServerProcess) {
      return;
    }

    console.log("Stopping dev server...");

    return new Promise((resolve) => {
      const processToKill = this.devServerProcess;
      let cleanupCalled = false;

      const cleanup = () => {
        if (cleanupCalled) return;
        cleanupCalled = true;

        // Remove listeners
        processToKill?.removeAllListeners();
        this.devServerProcess = null;
        console.log("  ✓ Dev server stopped");
        resolve();
      };

      if (processToKill?.killed) {
        cleanup();
        return;
      }

      // Set up listeners
      processToKill?.once("close", cleanup);
      processToKill?.once("exit", cleanup);
      processToKill?.once("error", cleanup);

      // Try to kill the process tree (including child processes)
      try {
        // On Unix-like systems, use negative PID to kill process group
        if (process.platform !== "win32" && processToKill?.pid) {
          process.kill(-processToKill?.pid, "SIGTERM");
        } else {
          processToKill?.kill("SIGTERM");
        }
      } catch (err) {
        // Process might already be dead
        cleanup();
        return;
      }

      // Force kill after timeout
      setTimeout(() => {
        if (this.devServerProcess && !processToKill?.killed) {
          try {
            if (process.platform !== "win32" && processToKill?.pid) {
              process.kill(-processToKill?.pid, "SIGKILL");
            } else {
              processToKill?.kill("SIGKILL");
            }
          } catch (err) {
            // Process might already be dead
          }
          // Force cleanup even if kill fails
          setTimeout(cleanup, 100);
        }
      }, 2000); // Reduced timeout for faster cleanup
    });
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return this.serverUrl;
  }
}
