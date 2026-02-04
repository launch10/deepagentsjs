/**
 * Uploads the WebContainer snapshot to Cloudflare R2.
 *
 * Usage:
 *   pnpm run webcontainer:upload
 *
 * Required environment variables:
 *   CLOUDFLARE_R2_ENDPOINT - R2 endpoint URL
 *   CLOUDFLARE_R2_ACCESS_KEY_ID - R2 access key
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY - R2 secret key
 *   CLOUDFLARE_UPLOADS_BUCKET - Bucket name (default: uploads)
 *   CLOUDFLARE_DEPLOY_ENV - Environment prefix (e.g., production, development)
 *
 * Outputs:
 *   - Uploads snapshot to R2 with content hash in filename
 *   - Writes manifest to public/webcontainer-snapshot-manifest.json
 */

/* eslint-disable no-console */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SNAPSHOT_PATH = join(process.cwd(), "public", "webcontainer-snapshot.bin");
const MANIFEST_PATH = join(process.cwd(), "public", "webcontainer-snapshot-manifest.json");

interface SnapshotManifest {
  version: string;
  hash: string;
  filename: string;
  url: string;
  size: number;
  generatedAt: string;
  uploadedAt: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

async function uploadSnapshot() {
  console.log("Uploading WebContainer snapshot to R2...\n");

  // Check snapshot exists
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot not found at ${SNAPSHOT_PATH}`);
    console.error("Run 'pnpm run webcontainer:snapshot' first.");
    process.exit(1);
  }

  // Read snapshot and compute hash
  console.log("Reading snapshot and computing hash...");
  const snapshotBuffer = readFileSync(SNAPSHOT_PATH);
  const hash = createHash("sha256").update(snapshotBuffer).digest("hex").slice(0, 12);
  const filename = `webcontainer-snapshot-${hash}.bin`;
  const sizeMB = (snapshotBuffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`  Size: ${sizeMB} MB`);
  console.log(`  Hash: ${hash}`);
  console.log(`  Filename: ${filename}`);

  // Get config from environment
  const endpoint = getRequiredEnv("CLOUDFLARE_R2_ENDPOINT");
  const accessKeyId = getRequiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = getOptionalEnv("CLOUDFLARE_UPLOADS_BUCKET", "uploads");
  const deployEnv = getOptionalEnv("CLOUDFLARE_DEPLOY_ENV", "production");
  const assetHost = getOptionalEnv("CLOUDFLARE_ASSET_HOST", "");

  // Create S3 client for R2
  const client = new S3Client({
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region: "auto",
    forcePathStyle: false,
  });

  // Upload path with environment prefix
  const key = `${deployEnv}/snapshots/${filename}`;
  console.log(`\nUploading to R2...`);
  console.log(`  Bucket: ${bucket}`);
  console.log(`  Key: ${key}`);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: snapshotBuffer,
        ContentType: "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable", // 1 year cache (content-addressed)
      })
    );
    console.log("  Upload complete!");
  } catch (error) {
    console.error("Upload failed:", error);
    process.exit(1);
  }

  // Build public URL
  const publicUrl = assetHost
    ? `${assetHost}/${key}`
    : `https://${bucket}.r2.cloudflarestorage.com/${key}`;
  console.log(`\nPublic URL: ${publicUrl}`);

  // Write manifest
  const manifest: SnapshotManifest = {
    version: "1",
    hash,
    filename,
    url: publicUrl,
    size: snapshotBuffer.byteLength,
    generatedAt: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${MANIFEST_PATH}`);
  console.log(JSON.stringify(manifest, null, 2));

  console.log("\nDone! Update WEBCONTAINER_SNAPSHOT_URL in production environment.");
}

uploadSnapshot().catch((error) => {
  console.error("Failed to upload snapshot:", error);
  process.exit(1);
});
