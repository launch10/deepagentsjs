import fs from "fs";
import path from "path";

/**
 * Playwright global teardown - runs after all tests complete.
 * Cleans up test artifacts like uploaded files.
 */
async function globalTeardown() {
  const uploadsDir = path.join(__dirname, "../public/uploads");

  if (fs.existsSync(uploadsDir)) {
    // Remove all files in uploads directory but keep the directory itself
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Recursively remove subdirectories (e.g., thumb/, medium/)
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
    console.log(`Cleaned up ${files.length} items from ${uploadsDir}`);
  }
}

export default globalTeardown;
